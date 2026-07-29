const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
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

// ⚠️ Doit rester identique à DURATIONS_MS / isExpired() dans services/ghost.service.js
// (clés FR + EN : `duration` stocke le libellé affiché au moment du dépôt,
// pas un code canonique — cf. audit 1.3. Sans les clés anglaises,
// cleanExpiredGhosts ne nettoyait jamais les fantômes déposés en anglais.)
const GHOST_DURATIONS_MS = {
  '24h': 86_400_000,
  '7 jours': 604_800_000,
  '7 days': 604_800_000,
  '1 mois': 2_592_000_000,
  '1 month': 2_592_000_000,
};
function ghostIsExpired(g, now) {
  if (!g.createdAt) return false;
  if (!g.duration || g.duration === '♾ Éternel' || g.duration === 'Eternal') return false;
  const maxAge = GHOST_DURATIONS_MS[g.duration];
  if (!maxAge) return false;
  return now - g.createdAt.toMillis() > maxAge;
}
// Suppression définitive 60 jours après expiration — même seuil que l'ancienne
// logique client dans loadNearbyGhosts() (app.js), qui ne s'exécutait que si
// l'auteur rouvrait l'app sur son propre fantôme expiré. Reproduit ici côté
// serveur pour que ça s'applique à tous les fantômes, pas seulement ceux
// qu'un client charge par hasard.
const HARD_DELETE_AFTER_EXPIRY_MS = 60 * 24 * 3600 * 1000;

/**
 * Nettoyage périodique : marque `expired: true` sur les fantômes dont la
 * durée est dépassée (pour que getVisibleGhosts() puisse les filtrer côté
 * Firestore), puis supprime définitivement ceux expirés depuis plus de 60
 * jours. Remplace l'ancienne dépendance à un client qui "tombe" sur le
 * fantôme expiré pour déclencher sa mise à jour — voir D3-expired-field-not-updated.md.
 */
exports.cleanExpiredGhosts = onSchedule({ region: 'europe-west9', schedule: 'every 60 minutes' }, async () => {
  const now = Date.now();
  const snap = await db.collection('ghosts').where('expired', '==', false).get();

  let batch = db.batch();
  let batchOps = 0;
  let markedCount = 0;
  let deletedCount = 0;

  const commitBatch = async () => {
    if (batchOps > 0) {
      await batch.commit();
      batch = db.batch();
      batchOps = 0;
    }
  };

  for (const docSnap of snap.docs) {
    const g = docSnap.data();
    if (!ghostIsExpired(g, now)) continue;
    const expiredAtMs = g.createdAt.toMillis() + GHOST_DURATIONS_MS[g.duration];
    if (now - expiredAtMs > HARD_DELETE_AFTER_EXPIRY_MS) {
      batch.delete(docSnap.ref);
      deletedCount++;
    } else {
      batch.update(docSnap.ref, { expired: true });
      markedCount++;
    }
    batchOps++;
    if (batchOps >= 450) await commitBatch();
  }
  await commitBatch();

  console.log(`cleanExpiredGhosts: ${snap.size} fantômes actifs examinés, ${markedCount} marqués expirés, ${deletedCount} supprimés définitivement.`);
});

// ── Geohash (précision 5) — porté depuis services/world.service.js ─────────
// ⚠️ Troisième copie de cet algorithme dans le dépôt (la première vit dans
// world.service.js, la deuxième dans patch_geohash.js — déjà documenté ainsi
// dans CLAUDE.md). Toute modification de l'encodage doit être répercutée aux
// trois endroits.
const GEOHASH_STORE_PRECISION = 5;
const GH_CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';
function encodeGeohash(lat, lng, precision = GEOHASH_STORE_PRECISION) {
  let minLat = -90, maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '', bits = 0, hashVal = 0, isLng = true;
  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng > mid) { hashVal = (hashVal << 1) | 1; minLng = mid; }
      else { hashVal <<= 1; maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat > mid) { hashVal = (hashVal << 1) | 1; minLat = mid; }
      else { hashVal <<= 1; maxLat = mid; }
    }
    isLng = !isLng;
    if (++bits === 5) { hash += GH_CHARS[hashVal]; hashVal = 0; bits = 0; }
  }
  return hash;
}

// ⚠️ Doit rester synchronisé avec DEPOSIT dans services/world.service.js.
const DEPOSIT_COOLDOWN_MS = 15 * 60 * 1000;
const DEPOSIT_MAX_ACTIVE = 5;

// ⚠️ Doit rester synchronisé avec hasValidTextFieldSizes() dans firestore.rules.
const TEXT_FIELD_LIMITS = {
  location: 120, author: 100, chainHint: 120, promoCode: 40,
  dedicatedTo: 100, radius: 10, duration: 20,
};

function isPremiumOnlyInput(d) {
  return d.videoUrl != null
    || d.duration === '♾ Éternel' || d.duration === 'Eternal'
    || d.chainHint != null || d.chainLat != null || d.chainLng != null
    || d.openCondition === 'after' || d.openCondition === 'future'
    || d.businessMode === true
    || d.promoCode != null
    || d.dedicatedTo != null
    || (Array.isArray(d.attachments) && d.attachments.length > 0)
    || (d.maxOpenCount != null && d.maxOpenCount > 1);
}

/**
 * Crée un fantôme pour l'utilisateur connecté. Remplace l'écriture directe
 * WorldService.createGhost() (SDK client) pour pouvoir enfin appliquer
 * DEPOSIT.MAX_ACTIVE côté serveur (audit constat 4.3) : ce plafond n'était
 * vérifié que côté client (services/world.service.js::checkDepositCooldown),
 * donc contournable par tout appel direct au SDK Firestore. Le cooldown de
 * 15 min était lui aussi uniquement une vérification cliente (la règle
 * Firestore cooldownOk() protège l'écriture mais pas un COMPTAGE des
 * fantômes actifs, qu'elle ne peut pas faire — pas d'agrégation possible en
 * règles Firestore). Même politique Premium que l'existant : les comptes
 * Premium ne sont soumis ni au cooldown ni au plafond (déjà le cas
 * aujourd'hui, cf. depositGhost() qui ignore checkDepositCooldown() pour eux).
 *
 * L'upload media (Cloudinary) reste entièrement côté client, en amont de cet
 * appel — seule la création du document Firestore est déplacée ici.
 */
exports.createGhostSecure = onCall({ region: 'europe-west9' }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Connexion requise.');
  }
  const d = request.data || {};

  const message = typeof d.message === 'string' ? d.message.trim() : '';
  if (!message) throw new HttpsError('invalid-argument', 'Message manquant.');
  if (message.length > 600) throw new HttpsError('invalid-argument', 'Message trop long.');

  const lat = d.lat, lng = d.lng;
  if (typeof lat !== 'number' || lat < -90 || lat > 90) throw new HttpsError('invalid-argument', 'Latitude invalide.');
  if (typeof lng !== 'number' || lng < -180 || lng > 180) throw new HttpsError('invalid-argument', 'Longitude invalide.');

  for (const [field, max] of Object.entries(TEXT_FIELD_LIMITS)) {
    const v = d[field];
    if (v != null && (typeof v !== 'string' || v.length > max)) {
      throw new HttpsError('invalid-argument', `Champ "${field}" invalide ou trop long.`);
    }
  }

  const userRef = db.collection('users').doc(uid);

  try {
    return await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      const userData = userSnap.exists ? userSnap.data() : {};
      const isPremium = userData.premium === true;

      if (isPremiumOnlyInput(d) && !isPremium) {
        throw new HttpsError('permission-denied', 'Fonctionnalité réservée aux membres Premium.');
      }

      if (!isPremium) {
        const lastCreated = userData.lastGhostCreatedAt;
        if (lastCreated) {
          const elapsed = Date.now() - lastCreated.toMillis();
          if (elapsed < DEPOSIT_COOLDOWN_MS) {
            const rem = Math.ceil((DEPOSIT_COOLDOWN_MS - elapsed) / 60_000);
            throw new HttpsError('resource-exhausted', `Patientez encore ${rem} min avant votre prochain dépôt.`);
          }
        }
        // Comptage des fantômes actifs — pas d'agrégation possible en règles
        // Firestore, d'où la migration de toute la création vers cette
        // fonction plutôt qu'un simple durcissement de firestore.rules.
        const activeSnap = await tx.get(db.collection('ghosts').where('authorUid', '==', uid));
        let active = 0;
        const now = Date.now();
        activeSnap.forEach(docSnap => {
          const g = docSnap.data();
          if (!g.expired && !ghostIsExpired(g, now)) active++;
        });
        if (active >= DEPOSIT_MAX_ACTIVE) {
          throw new HttpsError('resource-exhausted', `Vous avez déjà ${DEPOSIT_MAX_ACTIVE} fantômes actifs — attendez qu'un expire.`);
        }
      }

      const geohash = encodeGeohash(lat, lng, GEOHASH_STORE_PRECISION);
      const geohash4 = encodeGeohash(lat, lng, 4);
      const hasChain = d.chainHint != null || d.chainLat != null;

      const ghostRef = db.collection('ghosts').doc();
      const ghost = {
        message,
        location: (typeof d.location === 'string' && d.location.trim()) || 'Lieu sans nom',
        emoji: hasChain ? '🔗' : (typeof d.emoji === 'string' && d.emoji ? d.emoji : '👻'),
        duration: (typeof d.duration === 'string' && d.duration) || '7 jours',
        radius: (typeof d.radius === 'string' && d.radius) || '10m',
        audioUrl: d.audioUrl || null,
        photoUrl: d.photoUrl || null,
        videoUrl: d.videoUrl || null,
        attachments: Array.isArray(d.attachments) && d.attachments.length > 0 ? d.attachments : null,
        openCondition: (typeof d.openCondition === 'string' && d.openCondition) || 'always',
        openHour: d.openHour ?? null,
        openAfterGhostId: null,
        openDate: d.openDate ?? null,
        businessMode: d.businessMode === true,
        promoCode: d.promoCode || null,
        maxOpenCount: d.maxOpenCount ?? null,
        anonymous: d.anonymous === true,
        secret: false,
        dedicatedTo: d.dedicatedTo || null,
        chainHint: d.chainHint || null,
        chainLat: d.chainLat ?? null,
        chainLng: d.chainLng ?? null,
        author: (typeof d.author === 'string' && d.author) || 'Anonyme',
        authorUid: uid,
        lat, lng, geohash, geohash4,
        resonances: 0,
        activityScore: 0,
        discoveriesCount: 0,
        openCount: 0,
        lastPresenceAt: FieldValue.serverTimestamp(),
        state: 'fresh',
        expired: false,
        createdAt: FieldValue.serverTimestamp(),
      };

      tx.set(ghostRef, ghost);
      tx.set(userRef, {
        lastGhostCreatedAt: FieldValue.serverTimestamp(),
        ghostCount: FieldValue.increment(1),
      }, { merge: true });

      return { ghostId: ghostRef.id };
    });
  } catch (e) {
    if (e instanceof HttpsError) {
      console.warn('createGhostSecure refused', { uid, reason: e.code, message: e.message });
      throw e;
    }
    console.error('createGhostSecure failed', { uid, error: e.message });
    throw new HttpsError('internal', 'Erreur serveur — réessayez.');
  }
});
