/**
 * world.service.js
 */

export const DEPOSIT = {
  COOLDOWN_MS : 15 * 60 * 1000,
  MAX_ACTIVE  : 5,
};

const GEOHASH_STORE_PRECISION = 5;
const QUERY_LIMIT = 100;

// Ramène une longitude dans [-180, 180) — gère le wraparound à l'antiméridien
// (ex. 180.02 devient -179.98) au lieu de la clamper et perdre la position réelle.
function wrapLng(lng) {
  return ((lng + 180) % 360 + 360) % 360 - 180;
}

// Décode un geohash en son centre (lat, lng) — nécessaire pour calculer les
// voisins depuis le CENTRE de la cellule plutôt que depuis le point brut
// reçu, qui peut tomber n'importe où dans sa cellule.
function decodeGeohash(hash) {
  let lat = [-90, 90], lng = [-180, 180];
  let isLng = true;
  for (const c of hash) {
    const idx = GH_CHARS.indexOf(c);
    for (let bits = 4; bits >= 0; bits--) {
      const bit = (idx >> bits) & 1;
      if (isLng) { const mid = (lng[0] + lng[1]) / 2; lng[bit ? 0 : 1] = mid; }
      else        { const mid = (lat[0] + lat[1]) / 2; lat[bit ? 0 : 1] = mid; }
      isLng = !isLng;
    }
  }
  return { lat: (lat[0] + lat[1]) / 2, lng: (lng[0] + lng[1]) / 2 };
}

// Retourne les 9 cellules geohash5 couvrant ~7km autour de lat/lng.
// AT-6/m19 — décaler directement depuis le point BRUT (comme avant) peut
// manquer la cellule adjacente immédiate quand ce point est déjà proche du
// bord de sa propre cellule (~2,4% des positions par axe, pour une cellule
// de ~0.043945° et un décalage fixe de 0.045°). Décaler depuis le CENTRE de
// la cellule (calculé en décodant son propre geohash) rend le calcul
// indépendant de l'endroit où le point brut tombe dans sa cellule.
function getGeohash5Neighbors(lat, lng) {
  const centerHash = encodeGeohash(lat, lng, GEOHASH_STORE_PRECISION);
  const center = decodeGeohash(centerHash);
  const d = 0.045; // ~5km en degrés, > la largeur d'une cellule (~0.043945°)
  const cells = new Set();
  const offsets = [
    [0,0],[d,0],[-d,0],[0,d],[0,-d],
    [d,d],[d,-d],[-d,d],[-d,-d]
  ];
  for (const [dlat, dlng] of offsets) {
    cells.add(encodeGeohash(
      Math.max(-90, Math.min(90, center.lat + dlat)),
      wrapLng(center.lng + dlng),
      GEOHASH_STORE_PRECISION
    ));
  }
  return [...cells]; // 1–9 valeurs uniques
}

const GH_CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat, lng, precision = GEOHASH_STORE_PRECISION) {
  let minLat = -90,  maxLat = 90;
  let minLng = -180, maxLng = 180;
  let hash = '', bits = 0, hashVal = 0, isLng = true;

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng > mid) { hashVal = (hashVal << 1) | 1; minLng = mid; }
      else            { hashVal <<= 1;                 maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat > mid) { hashVal = (hashVal << 1) | 1; minLat = mid; }
      else            { hashVal <<= 1;                 maxLat = mid; }
    }
    isLng = !isLng;
    if (++bits === 5) {
      hash    += GH_CHARS[hashVal];
      hashVal  = 0;
      bits     = 0;
    }
  }
  return hash;
}

export function buildGeohashFields(lat, lng) {
  const geohash = encodeGeohash(lat, lng, GEOHASH_STORE_PRECISION);
  return {
    geohash,
    // AT-6/M8 — alias : plusieurs call sites d'app.js (série de présence
    // physique, détection de lieu fréquenté, badge "premier fantôme de ce
    // lieu") lisent _gf.geohash5, resté undefined depuis un renommage —
    // ces fonctionnalités étaient du code mort silencieux.
    geohash5 : geohash,
    geohash4 : encodeGeohash(lat, lng, 4), // conservé pour compatibilité anciens docs
  };
}

const WorldService = {

  _db     : null,
  _fns    : null,
  _analytics: null,

  init(db, firestoreFns, analytics = null) {
    this._db       = db;
    this._fns      = firestoreFns;
    this._analytics = analytics;
    console.debug('[WorldService] initialisé');
  },

  _requireInit() {
    if (!this._db) throw new Error('[WorldService] non initialisé — appeler init() en premier');
  },

  async getVisibleGhosts(lat, lng) {
    this._requireInit();
    const { collection, getDocs, query, where, limit } = this._fns;

    // AT-6/m19 — !lat est faux pour lat===0 (équateur) : bascule à tort en
    // requête mondiale pour une position pourtant valide.
    if (lat == null) {
      return getDocs(query(
        collection(this._db, 'ghosts'),
        where('expired', '==', false),
        limit(QUERY_LIMIT)
      ));
    }

    // Query sur 9 cellules geohash5 voisines (~7km de couverture)
    // Firestore 'in' supporte jusqu'à 30 valeurs — on est à 9 max
    const hashes = getGeohash5Neighbors(lat, lng);

    try {
      const snap = await getDocs(query(
        collection(this._db, 'ghosts'),
        where('geohash', 'in', hashes),
        where('expired', '==', false),
        limit(QUERY_LIMIT)
      ));

      if (snap.size > 0) {
        return snap;
      }
      console.debug('[WorldService] geohash vide, fallback filtre expired');
    } catch (e) {
      console.warn('[WorldService] getVisibleGhosts fallback:', e.code);
    }

    // Fallback : fantômes sans geohash (anciens documents)
    return getDocs(query(
      collection(this._db, 'ghosts'),
      where('expired', '==', false),
      limit(QUERY_LIMIT)
    ));
  },

  async registerPresence(ghostId, isNewDiscovery = false) {
    this._requireInit();
    const { doc, updateDoc, increment, serverTimestamp } = this._fns;

    try {
      const updates = {
        activityScore  : increment(1),
        lastPresenceAt : serverTimestamp(),
      };
      if (isNewDiscovery) {
        updates.discoveriesCount = increment(1);
      }
      await updateDoc(doc(this._db, 'ghosts', ghostId), updates);
      this._track('ghost_seen', { ghostId, isNewDiscovery });
    } catch (e) {
      console.warn('[WorldService] registerPresence:', e);
    }
  },

  // ⚠️ Précontrôle UX uniquement (retour immédiat avant même l'upload média) —
  // l'application réelle du cooldown et du plafond de 5 fantômes actifs se
  // fait désormais côté serveur dans la Cloud Function createGhostSecure
  // (audit 4.3), seule habilitée à écrire réellement le fantôme.
  async checkDepositCooldown(uid, isExpiredFn) {
    this._requireInit();
    const { doc, getDoc, getDocs, query, collection, where, limit } = this._fns;

    try {
      const userDoc = await getDoc(doc(this._db, 'users', uid));
      const data    = userDoc.exists() ? userDoc.data() : {};

      if (data.lastGhostCreatedAt) {
        const elapsed = Date.now() - data.lastGhostCreatedAt.seconds * 1000;
        if (elapsed < DEPOSIT.COOLDOWN_MS) {
          const rem = Math.ceil((DEPOSIT.COOLDOWN_MS - elapsed) / 60_000);
          return {
            ok    : false,
            reason: `Patientez encore ${rem} min avant votre prochain dépôt.`,
          };
        }
      }

      // AT-6/m15 — précontrôle UX seulement (cf. commentaire ci-dessus) : un
      // plafond ici est sans risque même s'il sous-compte occasionnellement
      // sur un compte très ancien, puisque createGhostSecure recompte sans
      // limite côté serveur et fait foi. 20 ≫ DEPOSIT.MAX_ACTIVE (5).
      const snap = await getDocs(query(
        collection(this._db, 'ghosts'),
        where('authorUid', '==', uid),
        limit(20)
      ));
      let active = 0;
      snap.forEach(d => {
        const g = d.data();
        // AT-6/M9 — le fantôme de bienvenue (_welcome) ne doit pas consommer
        // une des 5 places actives : ce n'est pas un dépôt volontaire.
        if (g._welcome) return;
        if (!g.expired && !(isExpiredFn && isExpiredFn(g))) active++;
      });
      if (active >= DEPOSIT.MAX_ACTIVE) {
        return {
          ok    : false,
          reason: `Vous avez déjà ${DEPOSIT.MAX_ACTIVE} fantômes actifs — attendez qu'un expire.`,
        };
      }

      return { ok: true };
    } catch (e) {
      console.warn('[WorldService] checkDepositCooldown:', e);
      return { ok: true };
    }
  },

  _track(event, params = {}) {
    if (this._analytics) {
      this._analytics.track(event, params);
    }
  },
};

export default WorldService;
