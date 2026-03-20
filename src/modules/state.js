/**
 * GHOSTUB - State Manager
 * Gestion centralisée de l'état de l'application avec observers
 */

// État initial
let state = {
  user: null,
  isPremium: false,
  location: { lat: null, lng: null },
  ghosts: [],
  selectedGhost: null,
  filters: { active: 'all', search: '' },
  ui: { currentScreen: 'screenOnboard', loading: false, error: null }
};

// Observateurs
const observers = new Map();

// Enregistrer un observateur pour une clé spécifique
export function observe(key, callback) {
  if (!observers.has(key)) observers.set(key, []);
  observers.get(key).push(callback);
  
  // Appel immédiat avec l'état actuel
  callback(state[key]);
  
  // Retourne une fonction pour se désabonner
  return () => {
    const callbacks = observers.get(key);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
    }
  };
}

// Mettre à jour l'état
export function setState(updates) {
  const oldState = { ...state };
  const changedKeys = [];
  
  Object.keys(updates).forEach(key => {
    if (JSON.stringify(state[key]) !== JSON.stringify(updates[key])) {
      state[key] = updates[key];
      changedKeys.push(key);
    }
  });
  
  // Notifier les observateurs
  changedKeys.forEach(key => {
    if (observers.has(key)) {
      observers.get(key).forEach(cb => cb(state[key], oldState[key]));
    }
  });
  
  // Notifier l'observateur global "all"
  if (observers.has('all')) {
    observers.get('all').forEach(cb => cb(state, oldState));
  }
  
  return state;
}

// Obtenir l'état actuel
export function getState() {
  return { ...state };
}

// Obtenir une clé spécifique
export function getStateKey(key) {
  return state[key];
}

// Réinitialiser l'état (déconnexion)
export function resetState() {
  state = {
    user: null,
    isPremium: false,
    location: { lat: null, lng: null },
    ghosts: [],
    selectedGhost: null,
    filters: { active: 'all', search: '' },
    ui: { currentScreen: 'screenOnboard', loading: false, error: null }
  };
  
  // Notifier tous les observateurs
  if (observers.has('all')) {
    observers.get('all').forEach(cb => cb(state, null));
  }
}

export default {
  observe,
  setState,
  getState,
  getStateKey,
  resetState
};
