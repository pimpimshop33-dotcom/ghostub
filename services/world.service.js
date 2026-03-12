/**
 * world.service.js
 */

export const GHOST_DURATIONS = {
  '24h':    86_400_000,
  '7 jours': 604_800_000,
  '1 mois': 2_592_000_000,
};

export const LIFECYCLE = {
  FRESH_RATIO : 0.10,
  WEAK_RATIO  : 0.80,
  FRESH_FALLBACK_MS: 7_200_000,
};

export const ACTIVITY = {
  VERY_ACTIVE_SCORE : 10,
  VERY_ACTIVE_RECENT: 5,
  ACTIVE_SCORE      : 3,
  RECENT_WINDOW_MS  : 3_600_000,
};

export const DEPOSIT = {
  COOLDOWN_MS : 15 * 60 * 1000,
  MAX_ACTIVE  : 5,
};

const GEOHASH_QUERY_PRECISION = 4;
const GEOHASH_STORE_PRECISION = 5;
const QUERY_LIMIT = 50;

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
  return {
    geohash  : encodeGeohash(lat, lng, GEOHASH_STORE_PRECISION),
    geohash4 : encodeGeohash(lat, lng, GEOHASH_QUERY_PRECISION),
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

  async createGhost(data, lat, lng, author) {
    this._requireInit();
    const { collection, addDoc, serverTimestamp } = this._fns;

    const ghost = {
      message         : data.message,
      location        : data.location || 'Lieu sans nom',
      emoji           : data.secret ? '🔮' : (data.chainHint || data.chainLat ? '🔗' : (data.emoji || '👻')),
      duration        : data.duration || '7 jours',
      radius          : data.secret ? '3m' : (data.radius || '10m'),
      audioUrl        : data.audioUrl  || null,
      photoUrl        : data.photoUrl  || null,
      videoUrl        : data.videoUrl  || null,
      openCondition   : data.openCondition   || 'always',
      openHour        : data.openHour        || null,
      openAfterGhostId: data.openAfterGhostId || null,
      openDate        : data.openDate        || null,
      businessMode    : data.businessMode    || false,
      promoCode       : data.promoCode       || null,
      maxOpenCount    : data.maxOpenCount    || null,
      anonymous       : data.anonymous || false,
      secret          : data.secret    || false,
      chainHint       : data.chainHint || null,
      chainLat        : data.chainLat  || null,
      chainLng        : data.chainLng  || null,
      author          : author.displayName || author.email,
      authorUid       : author.uid,
      lat,
      lng,
      ...buildGeohashFields(lat, lng),
      resonances      : 0,
      activityScore   : 0,
      discoveriesCount: 0,
      openCount       : 0,
      lastPresenceAt  : serverTimestamp(),
      state           : 'fresh',
      expired         : false,
      createdAt       : serverTimestamp(),
    };

    const ref = await addDoc(collection(this._db, 'ghosts'), ghost);
    this._track('ghost_created', { secret: ghost.secret, anonymous: ghost.anonymous });
    return ref.id;
  },

  async getVisibleGhosts(lat, lng) {
    this._requireInit();
    const { collection, getDocs, query, where, limit } = this._fns;

    if (!lat) {
      return getDocs(query(
        collection(this._db, 'ghosts'),
        where('expired', '==', false),
        limit(QUERY_LIMIT)
      ));
    }

    const prefix = encodeGeohash(lat, lng, GEOHASH_QUERY_PRECISION);

    try {
      const snap = await getDocs(query(
        collection(this._db, 'ghosts'),
        where('geohash4', '>=', prefix),
        where('geohash4', '<=', prefix + '\uf8ff'),
        limit(QUERY_LIMIT)
      ));

      if (snap.size > 0) {
        return snap;
      }
      console.debug('[WorldService] geohash vide, fallback filtre expired');
    } catch (e) {
      console.warn('[WorldService] getVisibleGhosts fallback:', e.code);
    }

    // Fallback : fantômes sans geohash4 (créés avant le fix geohash)
    // On filtre sur expired=false pour respecter les règles Firestore
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

  getActivityLevel(ghost) {
    const score  = ghost.activityScore || 0;
    const lp     = ghost.lastPresenceAt;
    const recent = lp && (Date.now() - lp.seconds * 1000) < ACTIVITY.RECENT_WINDOW_MS;

    if (score >= ACTIVITY.VERY_ACTIVE_SCORE || (score >= ACTIVITY.VERY_ACTIVE_RECENT && recent)) {
      return { label: 'très actif', color: 'rgba(255,140,60,.85)' };
    }
    if (score >= ACTIVITY.ACTIVE_SCORE || recent) {
      return { label: 'agité', color: 'rgba(168,180,255,.75)' };
    }
    return { label: 'calme', color: 'rgba(168,180,255,.3)' };
  },

  async checkDepositCooldown(uid, isExpiredFn) {
    this._requireInit();
    const { doc, getDoc, getDocs, query, collection, where } = this._fns;

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

      const snap = await getDocs(query(
        collection(this._db, 'ghosts'),
        where('authorUid', '==', uid)
      ));
      let active = 0;
      snap.forEach(d => {
        const g = d.data();
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

  async recordDepositTimestamp(uid) {
    this._requireInit();
    const { doc, setDoc, serverTimestamp } = this._fns;
    try {
      await setDoc(
        doc(this._db, 'users', uid),
        { lastGhostCreatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.warn('[WorldService] recordDepositTimestamp:', e);
    }
  },

  computeLifetime(ghost) {
    if (!ghost.createdAt) return { state: 'fresh', ratio: 0 };

    const age    = Date.now() - ghost.createdAt.seconds * 1000;
    const maxAge = GHOST_DURATIONS[ghost.duration];

    if (!maxAge) {
      return { state: age < LIFECYCLE.FRESH_FALLBACK_MS ? 'fresh' : 'stable', ratio: null };
    }

    const ratio = age / maxAge;
    let state;
    if      (ratio < LIFECYCLE.FRESH_RATIO) state = 'fresh';
    else if (ratio > LIFECYCLE.WEAK_RATIO)  state = 'weak';
    else                                     state = 'stable';

    return { state, ratio };
  },

  async syncLifecycleState(ghostId, newState, currentState) {
    if (newState === currentState) return;
    this._requireInit();
    const { doc, updateDoc } = this._fns;
    try {
      await updateDoc(doc(this._db, 'ghosts', ghostId), { state: newState });
    } catch (e) {
      console.warn('[WorldService] syncLifecycleState:', e);
    }
  },

  _track(event, params = {}) {
    if (this._analytics) {
      this._analytics.track(event, params);
    }
  },
};

export default WorldService;
