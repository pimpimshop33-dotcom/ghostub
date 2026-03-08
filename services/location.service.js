/**
 * location.service.js — Service de géolocalisation
 * Fantôme PWA
 */

let _lat = null;
let _lng = null;
let _watchId = null;
let _lastUpdateTs = 0;
const _subscribers = new Set();

const GPS_THROTTLE_MS = 10_000;

// ── DISTANCE ──────────────────────────────────────────────────────────────────

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

export function getPosition() {
  return { lat: _lat, lng: _lng };
}

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

// ── WATCH ─────────────────────────────────────────────────────────────────────

export function startWatch({ throttleMs = GPS_THROTTLE_MS } = {}) {
  if (_watchId !== null) return;
  if (!navigator.geolocation) return;

  _watchId = navigator.geolocation.watchPosition(
    pos => {
      const now = Date.now();
      if (now - _lastUpdateTs < throttleMs) return;

      const accuracy = pos.coords.accuracy;

      // FIX : ignorer les positions imprécises (géoloc IP = Paris, accuracy > 5000m)
      if (accuracy > 5000) {
        console.warn('[LocationService] position ignorée — trop imprécise (' + Math.round(accuracy) + 'm)');
        return;
      }

      _lastUpdateTs = now;
      _lat = pos.coords.latitude;
      _lng = pos.coords.longitude;

      // Notifier les abonnés — on passe aussi accuracy
      _subscribers.forEach(cb => {
        try { cb({ lat: _lat, lng: _lng, accuracy }); }
        catch (e) { console.warn('[LocationService] subscriber error', e); }
      });
    },
    err => console.warn('[LocationService] watchPosition error', err),
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 }
  );
}

export function stopWatch() {
  if (_watchId !== null) {
    navigator.geolocation.clearWatch(_watchId);
    _watchId = null;
  }
}

// ── ABONNEMENTS ───────────────────────────────────────────────────────────────

export function onPositionUpdate(callback) {
  _subscribers.add(callback);
  return () => _subscribers.delete(callback);
}

// ── PRÉSENCE PASSIVE ──────────────────────────────────────────────────────────

const _presenceThrottle = new Map();
const PRESENCE_THROTTLE_MS = 60_000;

export function canRecordPresence(ghostId) {
  const last = _presenceThrottle.get(ghostId) || 0;
  return Date.now() - last > PRESENCE_THROTTLE_MS;
}

export function markPresenceRecorded(ghostId) {
  _presenceThrottle.set(ghostId, Date.now());
}

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

// ── EXPORT ────────────────────────────────────────────────────────────────────

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
