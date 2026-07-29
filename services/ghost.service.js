/**
 * ghost.service.js — Logique métier des fantômes
 * Fantôme PWA
 *
 * Responsabilités :
 *  - Calcul d'expiration et de temps restant
 *  - Cycle de vie (fresh / stable / weak / expired)
 *  - Règles de visibilité
 *  - Rendu des métadonnées (distance, timeAgo, timeRemaining)
 *
 * Zéro dépendance Firebase — reçoit les données, retourne des résultats.
 */

// ── CONSTANTES ────────────────────────────────────────────────────────────────

// ⚠️ Le champ `duration` stocké sur un ghost est le libellé affiché au moment
// du dépôt (pas un code canonique) — donc FR *et* EN selon la langue active
// de l'auteur au moment du dépôt (cf. depositGhost() dans app.js). Sans les
// clés anglaises, DURATIONS_MS[g.duration] était undefined pour tout fantôme
// déposé en anglais : la barre de vie restait bloquée à 0% et ne progressait
// jamais (computeLifetime), sans que timeRemaining() n'affiche d'erreur
// visible (audit 1.3 — écart trouvé entre ce fichier, FR seulement, et le
// isExpired() dupliqué d'app.js qui gérait déjà les deux langues).
export const DURATIONS_MS = {
  '24h':    86_400_000,
  '7 jours':604_800_000,
  '7 days': 604_800_000,
  '1 mois': 2_592_000_000,
  '1 month':2_592_000_000,
};

export const LIFECYCLE = {
  FRESH:   'fresh',    // activité récente   (lastPresenceAt < 10 min)
  STABLE:  'stable',   // activité normale   (lastPresenceAt < 1h)
  WEAK:    'weak',     // peu d'activité     (lastPresenceAt > 1h)
  EXPIRED: 'expired',  // durée dépassée
};

// ── EXPIRATION ────────────────────────────────────────────────────────────────

/**
 * Indique si un fantôme est expiré.
 * @param {object} g — document Firestore du fantôme
 * @returns {boolean}
 */
export function isExpired(g) {
  if (!g.createdAt) return false;
  if (!g.duration || g.duration === '♾ Éternel' || g.duration === 'Eternal') return false;
  const maxAge = DURATIONS_MS[g.duration];
  if (!maxAge) return false;
  return Date.now() - g.createdAt.seconds * 1000 > maxAge;
}

/**
 * Texte humain du temps restant.
 * @param {object} g
 * @returns {string}
 */
export function timeRemaining(g) {
  if (!g.createdAt || !g.duration || g.duration === '♾ Éternel' || g.duration === 'Eternal') return '♾ Éternel';
  const maxAge = DURATIONS_MS[g.duration];
  if (!maxAge) return '♾ Éternel';
  const remaining = maxAge - (Date.now() - g.createdAt.seconds * 1000);
  if (remaining <= 0) return 'Expiré';
  const h = Math.floor(remaining / 3_600_000);
  const d = Math.floor(h / 24);
  if (d > 0) return `expire dans ${d}j`;
  return `expire dans ${h}h`;
}

// ── CYCLE DE VIE ──────────────────────────────────────────────────────────────

/**
 * Calcule l'état du cycle de vie d'un fantôme.
 * @param {object} g — document Firestore
 * @returns {{ state: string, pct: number }}
 *   - state : LIFECYCLE constant
 *   - pct   : pourcentage de vie consommé (0–100)
 */
export function computeLifetime(g) {
  if (isExpired(g)) return { state: LIFECYCLE.EXPIRED, pct: 100 };

  // Pourcentage de vie consommé
  let pct = 0;
  if (g.createdAt && g.duration && DURATIONS_MS[g.duration]) {
    const elapsed = Date.now() - g.createdAt.seconds * 1000;
    pct = Math.min(100, (elapsed / DURATIONS_MS[g.duration]) * 100);
  }

  // État basé sur lastPresenceAt
  const now = Date.now();
  const lastSeen = g.lastPresenceAt ? g.lastPresenceAt.seconds * 1000 : 0;
  const minSincePresence = (now - lastSeen) / 60_000;

  let state;
  if (minSincePresence < 10)  state = LIFECYCLE.FRESH;
  else if (minSincePresence < 60) state = LIFECYCLE.STABLE;
  else state = LIFECYCLE.WEAK;

  return { state, pct };
}

// ── FORMATAGE ─────────────────────────────────────────────────────────────────

/**
 * Formate une distance en mètres en texte lisible.
 * @param {number} m
 * @returns {string}
 */
export function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;
}

/**
 * Formate un timestamp Firestore en "il y a X".
 * @param {{ seconds: number } | null} ts
 * @returns {string}
 */
export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts.seconds * 1000) / 1000);
  if (s < 60)     return 'à l\'instant';
  if (s < 3600)   return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400)  return `il y a ${Math.floor(s / 3600)}h`;
  return `il y a ${Math.floor(s / 86400)} jours`;
}

// ── EXPORT DEFAULT (objet façade optionnel) ───────────────────────────────────

const GhostService = {
  isExpired,
  timeRemaining,
  computeLifetime,
  formatDistance,
  timeAgo,
  LIFECYCLE,
  DURATIONS_MS,
};

export default GhostService;
