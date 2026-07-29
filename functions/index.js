const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
if (!getApps().length) initializeApp();
const db = getFirestore();
// ⚠️ Doit rester identique à DAILY_OPEN_LIMIT dans app.js (côté client,
// utilisé uniquement pour l'affichage/aperçu — la vraie limite, c'est ici).
const DAILY_OPEN_LIMIT = 3;
function todayKeyUTC() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
/**
 * Vérifie ET consomme atomiquement une ouverture de fantôme pour l'utilisateur
 * connecté. Remplace l'ancienne logique côté client (insécurisée — n'importe
 * qui pouvait remettre son compteur à zéro via les DevTools).
 *
 * Retourne { allowed: boolean, remaining: number } où remaining = -1 signifie
 * illimité (Premium ou compte dev).
 */
exports.checkAndConsumeOpen = onCall({ region: 'europe-west9' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Connexion requise.');
  }
  const userRef = db.collection('users').doc(uid);
  const statsRef = db.collection('userStats').doc(uid);
  const today = todayKeyUTC();
  return db.runTransaction(async (tx) => {
    const [userSnap, statsSnap] = await Promise.all([tx.get(userRef), tx.get(statsRef)]);
    // Compte dev — flag Firestore (isDevAccount sur userStats), plus de
    // comparaison d'UID en dur dans le code (cf. audit sécurité juin 2026).
    if (statsSnap.exists && statsSnap.data().isDevAccount === true) {
      return { allowed: true, remaining: -1 };
    }
    // Statut Premium vérifié côté serveur — on ne fait JAMAIS confiance à un
    // éventuel flag "isPremium" envoyé par le client.
    const isPremium = userSnap.exists && userSnap.data().premium === true;
    if (isPremium) {
      return { allowed: true, remaining: -1 };
    }
    const dailyOpens = statsSnap.exists ? (statsSnap.data().dailyOpens || {}) : {};
    const count = dailyOpens[today] || 0;
    if (count >= DAILY_OPEN_LIMIT) {
      return { allowed: false, remaining: 0 };
    }
    tx.set(statsRef, { dailyOpens: { [today]: count + 1 } }, { merge: true });
    return { allowed: true, remaining: DAILY_OPEN_LIMIT - (count + 1) };
  });
});

/**
 * Active un code Premium pour l'utilisateur connecté. Remplace l'ancienne
 * logique côté client qui écrivait directement `premiumCodes` et
 * `users.premium` — les règles Firestore interdisent désormais ces écritures
 * au client (voir firestore.rules), donc cette activation doit passer par
 * l'admin SDK, ici, en transaction atomique (anti double-activation d'un
 * même code).
 */
exports.activatePremiumSecure = onCall({ region: 'europe-west9' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Connexion requise.');
  }
  const rawCode = request.data?.code;
  if (typeof rawCode !== 'string' || !rawCode.trim()) {
    throw new HttpsError('invalid-argument', 'Code manquant.');
  }
  const code = rawCode.trim().toUpperCase();
  const codeRef = db.collection('premiumCodes').doc(code);
  const userRef = db.collection('users').doc(uid);
  try {
    return await db.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      if (!codeSnap.exists) {
        throw new HttpsError('not-found', 'Code invalide.');
      }
      if (codeSnap.data().used === true) {
        throw new HttpsError('already-exists', 'Code déjà utilisé.');
      }
      tx.update(codeRef, { used: true, usedBy: uid, usedAt: FieldValue.serverTimestamp() });
      tx.set(userRef, { premium: true, premiumSince: FieldValue.serverTimestamp(), premiumCodeUsed: code }, { merge: true });
      return { success: true };
    });
  } catch (e) {
    if (e instanceof HttpsError) {
      console.warn('activatePremiumSecure refused', { uid, code, reason: e.code });
      throw e;
    }
    console.error('activatePremiumSecure failed', { uid, code, error: e.message });
    throw new HttpsError('internal', 'Erreur serveur — réessayez.');
  }
});