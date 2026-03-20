/**
 * Gestionnaire du cycle de vie de l'application
 * Centralise les fonctions de nettoyage pour éviter les fuites mémoire
 */

// Collection de toutes les fonctions de nettoyage
const cleanupFunctions = [];

/**
 * Enregistre une fonction à exécuter lors du nettoyage
 * @param {Function} fn - Fonction de nettoyage (unsubscribe, clearInterval, etc.)
 */
export function registerCleanup(fn) {
  if (typeof fn !== 'function') {
    console.warn('[AppLifecycle] Tentative d\'enregistrement d\'une fonction invalide');
    return;
  }
  cleanupFunctions.push(fn);
}

/**
 * Exécute toutes les fonctions de nettoyage enregistrées
 * Appeler lors de la déconnexion ou du changement d'écran critique
 */
export function performCleanup() {
  console.log(`[AppLifecycle] Nettoyage de ${cleanupFunctions.length} fonctions...`);
  
  cleanupFunctions.forEach((fn, index) => {
    try {
      fn();
    } catch (error) {
      console.warn(`[AppLifecycle] Erreur lors du nettoyage #${index}:`, error);
    }
  });
  
  // Vider le tableau après nettoyage
  cleanupFunctions.length = 0;
}

/**
 * Réinitialise le gestionnaire (utile pour les tests)
 */
export function resetCleanup() {
  cleanupFunctions.length = 0;
}

// Export par défaut pour compatibilité
export default {
  registerCleanup,
  performCleanup,
  resetCleanup
};
