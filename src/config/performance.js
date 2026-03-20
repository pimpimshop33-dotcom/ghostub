/**
 * GHOSTUB - Configuration des performances
 * Ajustements pour optimiser l'expérience utilisateur
 */

// Configuration des debounces et throttles
export const PerformanceConfig = {
  // Délais en millisecondes
  debounce: {
    search: 300,      // Recherche de lieux
    save: 500,        // Sauvegarde automatique
    resize: 150       // Redimensionnement fenêtre
  },
  
  throttle: {
    scroll: 100,      // Événements de scroll
    location: 1000,   // Mise à jour position GPS
    render: 50        // Rendu DOM
  },
  
  // Limites
  limits: {
    maxGhostsDisplay: 50,     // Nombre max de fantômes affichés
    maxDistanceMeters: 5000,  // Distance max pour afficher un fantôme (5km)
    imageCompression: 0.82,   // Qualité compression images (0-1)
    maxImageWidth: 1200,      // Largeur max images
    maxVideoSizeMB: 50,       // Taille max vidéo
    maxMessageLength: 280     // Longueur max message
  },
  
  // Cache
  cache: {
    geocodeTTL: 24 * 60 * 60 * 1000,  // 24h pour le cache géocodage
    ghostListTTL: 60 * 1000,          // 1 minute pour la liste
    userDataTTL: 5 * 60 * 1000        // 5 minutes pour les données utilisateur
  },
  
  // Animations
  animations: {
    enabled: true,
    duration: {
      fast: 150,
      normal: 300,
      slow: 500
    },
    easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)'
  }
};

// Détecter les préférences de réduction de mouvement
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Adapter les animations selon les préférences
export function getAnimationDuration(baseDuration) {
  if (prefersReducedMotion()) return 0;
  return baseDuration;
}

export default PerformanceConfig;
