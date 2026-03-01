/**
 * location.service.js — Service de géolocalisation
 * Fantôme PWA
 *
 * Responsabilités :
 *  - Obtenir la position GPS (one-shot ou watch)
 *  - Throttling des mises à jour (max 1 update / 10s)
 *  - Calcul de distance (Haversine)
 *  - Présence passive : détecter passage près d'un fantôme sans ouverture
 *  - Callbacks abonnés aux mises à jour de position
 *
 * Zéro dépendance Firebase — communique via callbacks.
 */

// ── ÉTAT INTERNE ──────────────────────────────────────────────────────────────

let _lat = null;
let _lng = null;
let _watchId = null;
let _lastUpdateTs = 0;
const _subscribers = new Set();

// Throttle GPS : une mise à jour max toutes les 10 secondes
const GPS_THROTTLE_MS = 10_000;

// ── DISTANCE ──────────────────────────────────────────────────────────────────

/**
 * Distance Haversine entre deux points GPS (en mètres).
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number} distance en mètres
 */
export function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── POSITION COURANTE ─────────────────────────────────────────────────────────

/**
 * Retourne la dernière position connue.
 * @returns {{ lat: number|null, lng: number|null }}
 */
export function getPosition() {
  return { lat: _lat, lng: _lng };
}

/**
 * Obtenir la position GPS une seule fois (Promise).
 * Met à jour _lat / _lng.
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Géolocalisation non supportée'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        _lat = pos.coords.latitude;
        _lng = pos.coords.longitude;
        resolve({ lat: _lat, lng: _lng });
      },
      err => reject(err),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  });
}

// ── WATCH (PRÉSENCE PASSIVE) ──────────────────────────────────────────────────

/**
 * Démarre la surveillance GPS continue.
 * Appelle les abonnés à chaque mise à jour (throttlée).
 *
 * @param {object} [options]
 * @param {number} [options.throttleMs=10000] — throttle en ms
 * @returns {void}
 */
export function startWatch({ throttleMs = GPS_THROTTLE_MS } = {}) {
  if (_watchId !== null) return; // déjà actif
  if (!navigator.geolocation) return;

  _watchId = navigator.geolocation.watchPosition(
    pos => {
      const now = Date.now();
      if (now - _lastUpdateTs < throttleMs) return; // throttle
      _lastUpdateTs = now;

      _lat = pos.coords.latitude;
      _lng = pos.coords.longitude;

      // Notifier les abonnés
      _subscribers.forEach(cb => {
        try { cb({ lat: _lat, lng: _lng }); } catch (e) { console.warn('[LocationService] subscriber error', e); }
      });
    },
    err => console.warn('[LocationService] watchPosition error', err),
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 }
  );
}

/**
 * Arrête la surveillance GPS.
 */
export function stopWatch() {
  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }
}

// ── ABONNEMENTS ───────────────────────────────────────────────────────────────

/**
 * S'abonner aux mises à jour de position.
 * @param {function({ lat, lng }): void} callback
 * @returns {function} — fonction pour se désabonner
 */
export function onPositionUpdate(callback) {
  _subscribers.add(callback);
  return () => _subscribers.delete(callback);
}

// ── PRÉSENCE PASSIVE ──────────────────────────────────────────────────────────

// Throttle par fantôme : 1 écriture max toutes les 60s
const _presenceThrottle = new Map(); // ghostId → timestamp dernière écriture
const PRESENCE_THROTTLE_MS = 60_000;

/**
 * Vérifie si on peut enregistrer une présence pour ce fantôme.
 * Retourne true si le throttle est passé.
 * @param {string} ghostId
 * @returns {boolean}
 */
export function canRecordPresence(ghostId) {
  const last = _presenceThrottle.get(ghostId) || 0;
  return Date.now() - last > PRESENCE_THROTTLE_MS;
}

/**
 * Marque la présence comme enregistrée (pour le throttle).
 * @param {string} ghostId
 */
export function markPresenceRecorded(ghostId) {
  _presenceThrottle.set(ghostId, Date.now());
}

/**
 * Pour chaque fantôme de la liste, vérifie si l'utilisateur est dans le radius
 * et si le throttle est passé — retourne la liste des ghostIds à mettre à jour.
 *
 * @param {number} userLat
 * @param {number} userLng
 * @param {Array<{ id: string, lat: number, lng: number, radius: number }>} ghosts
 * @returns {string[]} — liste de ghostIds proches
 */
export function detectNearbyPresence(userLat, userLng, ghosts) {
  if (userLat == null || userLng == null) return [];

  return ghosts
    .filter(g => {
      if (!g.lat || !g.lng) return false;
      const dist = distanceMeters(userLat, userLng, g.lat, g.lng);
      const radius = g.radius ? parseFloat(g.radius) : 500;
      return dist <= radius && canRecordPresence(g.id);
    })
    .map(g => g.id);
}

// ── EXPORT DEFAULT ────────────────────────────────────────────────────────────

const LocationService = {
  distanceMeters,
  getPosition,
  getCurrentPosition,
  startWatch,
  stopWatch,
  onPositionUpdate,
  canRecordPresence,
  markPresenceRecorded,
  detectNearbyPresence,
};

export default LocationService;
