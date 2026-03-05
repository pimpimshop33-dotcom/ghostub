/**
 * world.service.js
 * ─────────────────────────────────────────────────────────────────────
 * Service central de la logique métier "monde fantôme".
 * Toute règle qui touche un fantôme (création, cycle de vie, activité,
 * chargement géographique, cooldowns) passe par ici.
 *
 * Dépendances injectées via WorldService.init(db, firestoreFns)
 * → aucun import Firebase direct : le service est testable seul.
 *
 * Structure :
 *   WorldService.init()          — initialisation obligatoire
 *   WorldService.createGhost()   — ÉTAPE 1 / dépôt
 *   WorldService.getVisibleGhosts() — ÉTAPE 3 / géo
 *   WorldService.registerPresence() — ÉTAPE 2 / activité
 *   WorldService.computeLifetime()  — ÉTAPE 5 / cycle de vie
 *   WorldService.getActivityLevel() — ÉTAPE 2 / badge activité
 *   WorldService.checkDepositCooldown() — ÉTAPE 4 / cooldown
 * ─────────────────────────────────────────────────────────────────────
 */

// ── CONSTANTES MÉTIER ─────────────────────────────────────────────────

/** Durées de vie en millisecondes */
export const GHOST_DURATIONS = {
  '24h':    86_400_000,
  '7 jours': 604_800_000,
  '1 mois': 2_592_000_000,
};

/** Seuil d'état cycle de vie */
export const LIFECYCLE = {
  FRESH_RATIO : 0.10,   // < 10% de la durée écoulée → fresh
  WEAK_RATIO  : 0.80,   // > 80% écoulée → weak
  FRESH_FALLBACK_MS: 7_200_000,  // 2h pour les fantômes "éternels"
};

/** Seuils d'activité */
export const ACTIVITY = {
  VERY_ACTIVE_SCORE : 10,
  VERY_ACTIVE_RECENT: 5,
  ACTIVE_SCORE      : 3,
  RECENT_WINDOW_MS  : 3_600_000,  // 1h
};

/** Cooldown dépôt */
export const DEPOSIT = {
  COOLDOWN_MS : 15 * 60 * 1000,  // 15 min
  MAX_ACTIVE  : 5,
};

/** Précision geohash pour requête de proximité (≈ 39×20 km) */
const GEOHASH_QUERY_PRECISION = 4;
/** Précision geohash stocké (≈ 4×5 km — pour tri fin côté client) */
const GEOHASH_STORE_PRECISION = 5;
/** Limite max de documents retournés par requête géo */
const QUERY_LIMIT = 50;


// ── GEOHASH ───────────────────────────────────────────────────────────

const GH_CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode une paire lat/lng en geohash base32.
 * @param {number} lat
 * @param {number} lng
 * @param {number} precision  Longueur du hash (défaut : 5)
 * @returns {string}
 */
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

/**
 * Retourne les champs geohash à persister dans Firestore.
 * @param {number} lat
 * @param {number} lng
 * @returns {{ geohash: string, geohash4: string }}
 */
export function buildGeohashFields(lat, lng) {
  return {
    geohash  : encodeGeohash(lat, lng, GEOHASH_STORE_PRECISION),
    geohash4 : encodeGeohash(lat, lng, GEOHASH_QUERY_PRECISION),
  };
}


// ── WORLD SERVICE ─────────────────────────────────────────────────────

/**
 * @typedef {Object} Ghost  Représentation d'un fantôme (données Firestore)
 * @property {string}  id
 * @property {number}  lat
 * @property {number}  lng
 * @property {string}  message
 * @property {string}  [location]
 * @property {string}  [emoji]
 * @property {string}  duration
 * @property {string}  state        — fresh | stable | weak
 * @property {number}  activityScore
 * @property {Object}  lastPresenceAt  — Firestore Timestamp
 * @property {number}  discoveriesCount
 * @property {boolean} expired
 */

/**
 * @typedef {Object} LifetimeResult
 * @property {'fresh'|'stable'|'weak'} state
 * @property {number|null} ratio   — fraction de durée écoulée (null si éternel)
 */

/**
 * @typedef {Object} ActivityLevel
 * @property {'calme'|'agité'|'très actif'} label
 * @property {string} color   — rgba string pour l'UI
 */

const WorldService = {

  // ── Références Firestore (injectées via init) ──────────────────────
  _db     : null,
  _fns    : null,   // { collection, addDoc, getDocs, query, where, limit, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp }
  _analytics: null, // objet Analytics de l'app (optionnel)

  /**
   * ÉTAPE 1 — Initialiser le service.
   * Doit être appelé UNE SEULE FOIS après firebase init.
   *
   * @param {object} db           — instance Firestore
   * @param {object} firestoreFns — fonctions Firestore importées
   * @param {object} [analytics]  — objet Analytics de l'app (optionnel)
   */
  init(db, firestoreFns, analytics = null) {
    this._db       = db;
    this._fns      = firestoreFns;
    this._analytics = analytics;
    console.debug('[WorldService] initialisé');
  },

  _requireInit() {
    if (!this._db) throw new Error('[WorldService] non initialisé — appeler init() en premier');
  },


  // ── ÉTAPE 1 : Créer un fantôme ────────────────────────────────────

  /**
   * Crée un fantôme dans Firestore avec tous les champs métier.
   * Centralise : geohash, cycle de vie initial, activité initiale.
   *
   * @param {object} data  Données brutes du formulaire (message, location, etc.)
   * @param {number} lat
   * @param {number} lng
   * @param {object} author  { uid, displayName, email }
   * @returns {Promise<string>}  id du document créé
   */
  async createGhost(data, lat, lng, author) {
    this._requireInit();
    const { collection, addDoc, serverTimestamp } = this._fns;

    const ghost = {
      // ── Contenu ────────────────────────────────────────
      message         : data.message,
      location        : data.location || 'Lieu sans nom',
      emoji           : data.secret ? '🔮' : (data.chainHint || data.chainLat ? '🔗' : (data.emoji || '👻')),
      duration        : data.duration || '7 jours',
      radius          : data.secret ? '3m' : (data.radius || '10m'),
      audioUrl        : data.audioUrl  || null,
      photoUrl        : data.photoUrl  || null,
      videoUrl        : data.videoUrl  || null,

      // ── Conditions ─────────────────────────────────────
      openCondition   : data.openCondition   || 'always',
      openHour        : data.openHour        || null,
      openAfterGhostId: data.openAfterGhostId || null,

      // ── Comportement ───────────────────────────────────
      anonymous       : data.anonymous || false,
      secret          : data.secret    || false,
      chainHint       : data.chainHint || null,
      chainLat        : data.chainLat  || null,
      chainLng        : data.chainLng  || null,

      // ── Auteur ─────────────────────────────────────────
      author          : author.displayName || author.email,
      authorUid       : author.uid,

      // ── Position ───────────────────────────────────────
      lat,
      lng,
      ...buildGeohashFields(lat, lng),  // geohash + geohash4 (P3)

      // ── Activité initiale (P2) ──────────────────────────
      resonances      : 0,
      activityScore   : 0,
      discoveriesCount: 0,
      lastPresenceAt  : serverTimestamp(),

      // ── Cycle de vie (P5) ───────────────────────────────
      state           : 'fresh',
      expired         : false,

      // ── Métadonnées ─────────────────────────────────────
      createdAt       : serverTimestamp(),
    };

    const ref = await addDoc(collection(this._db, 'ghosts'), ghost);
    this._track('ghost_created', { secret: ghost.secret, anonymous: ghost.anonymous });
    return ref.id;
  },


  // ── ÉTAPE 3 : Chargement géographique ────────────────────────────

  /**
   * Retourne les fantômes visibles autour d'un point.
   * Utilise geohash4 pour filtrer côté Firestore (LIMIT 50).
   * Fallback sur getDocs global si pas encore de geohash4 (migration).
   *
   * @param {number} lat
   * @param {number} lng
   * @returns {Promise<QuerySnapshot>}
   */
  async getVisibleGhosts(lat, lng) {
    this._requireInit();
    const { collection, getDocs, query, where, limit } = this._fns;

    if (!lat) {
      // Fallback sans géolocalisation
      return getDocs(collection(this._db, 'ghosts'));
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
        this._track('ghosts_geohash_query', { prefix, count: snap.size });
        return snap;
      }
      // Pas de résultat → fantômes legacy sans geohash4
      console.debug('[WorldService] geohash vide, fallback global');
    } catch (e) {
      // Index Firestore pas encore créé → fallback silencieux
      console.warn('[WorldService] getVisibleGhosts fallback:', e.code);
    }

    return getDocs(collection(this._db, 'ghosts'));
  },


  // ── ÉTAPE 2 : Activité ────────────────────────────────────────────

  /**
   * Enregistre qu'un utilisateur s'est approché / a ouvert un fantôme.
   * Incrémente activityScore et lastPresenceAt.
   * Si c'est une nouvelle découverte, incrémente aussi discoveriesCount.
   *
   * @param {string}  ghostId
   * @param {boolean} isNewDiscovery
   */
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

  /**
   * Calcule le niveau d'activité visible d'un fantôme.
   *
   * @param {Ghost} ghost
   * @returns {ActivityLevel}
   */
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


  // ── ÉTAPE 4 : Cooldown dépôt ──────────────────────────────────────

  /**
   * Vérifie si un utilisateur peut créer un nouveau fantôme.
   * Règles : 1 fantôme / 15 min, max 5 actifs simultanément.
   *
   * @param {string} uid
   * @param {Function} isExpiredFn  — fonction isExpired() de l'app
   * @returns {Promise<{ok:boolean, reason?:string}>}
   */
  async checkDepositCooldown(uid, isExpiredFn) {
    this._requireInit();
    const { doc, getDoc, getDocs, query, collection, where } = this._fns;

    try {
      const userDoc = await getDoc(doc(this._db, 'users', uid));
      const data    = userDoc.exists() ? userDoc.data() : {};

      // Vérif cooldown 15 min
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

      // Vérif max actifs
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
      // En cas d'erreur réseau, on laisse passer (fail open)
      console.warn('[WorldService] checkDepositCooldown:', e);
      return { ok: true };
    }
  },

  /**
   * Enregistre la date du dernier dépôt dans /users/{uid}.
   * À appeler APRÈS addDoc réussi.
   *
   * @param {string} uid
   */
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


  // ── ÉTAPE 5 : Cycle de vie ────────────────────────────────────────

  /**
   * Calcule l'état actuel du cycle de vie d'un fantôme.
   *
   * États :
   *  - 'fresh'  → < 10% de la durée écoulée (nouveau, brillant)
   *  - 'stable' → entre 10% et 80%
   *  - 'weak'   → > 80% (s'évanouit bientôt)
   *
   * @param {Ghost} ghost
   * @returns {LifetimeResult}
   */
  computeLifetime(ghost) {
    if (!ghost.createdAt) return { state: 'fresh', ratio: 0 };

    const age    = Date.now() - ghost.createdAt.seconds * 1000;
    const maxAge = GHOST_DURATIONS[ghost.duration];

    // Fantôme éternel : fresh les 2 premières heures, stable ensuite
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

  /**
   * Met à jour le champ `state` dans Firestore si nécessaire.
   * À appeler lors du chargement de la liste (batch silencieux).
   *
   * @param {string} ghostId
   * @param {'fresh'|'stable'|'weak'} newState
   * @param {'fresh'|'stable'|'weak'} currentState
   */
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


  // ── ÉTAPE 6 : Métriques minimales ────────────────────────────────

  /**
   * Enregistre une métrique via l'objet Analytics de l'app.
   * Aucun effet si Analytics non injecté.
   *
   * @param {string} event
   * @param {object} [params]
   */
  _track(event, params = {}) {
    if (this._analytics) {
      this._analytics.track(event, params);
    }
  },
};

export default WorldService;
