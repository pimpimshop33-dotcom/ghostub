/**
 * GHOSTUB - Gestionnaire d'erreurs centralisé
 * Capture, log et affiche les erreurs de manière élégante
 */

import { t } from './i18n.js';

// Types d'erreurs
const ErrorTypes = {
  NETWORK: 'network',
  AUTH: 'auth',
  DATABASE: 'database',
  LOCATION: 'location',
  UPLOAD: 'upload',
  UNKNOWN: 'unknown'
};

// Messages d'erreur par type
const ErrorMessages = {
  [ErrorTypes.NETWORK]: {
    fr: 'Problème de connexion — vérifiez votre réseau.',
    en: 'Network issue — check your connection.'
  },
  [ErrorTypes.AUTH]: {
    fr: 'Erreur d\'authentification — reconnectez-vous.',
    en: 'Authentication error — please sign in again.'
  },
  [ErrorTypes.DATABASE]: {
    fr: 'Erreur de base de données — réessayez plus tard.',
    en: 'Database error — please try again later.'
  },
  [ErrorTypes.LOCATION]: {
    fr: 'Impossible d\'obtenir votre position — activez le GPS.',
    en: 'Cannot get your location — enable GPS.'
  },
  [ErrorTypes.UPLOAD]: {
    fr: 'Erreur lors de l\'upload — vérifiez votre connexion.',
    en: 'Upload error — check your connection.'
  },
  [ErrorTypes.UNKNOWN]: {
    fr: 'Une erreur inattendue est survenue.',
    en: 'An unexpected error occurred.'
  }
};

// Queue des erreurs à logger
let errorQueue = [];
let flushTimer = null;

// Log une erreur
function logError(error, type, context = {}) {
  const errorLog = {
    timestamp: new Date().toISOString(),
    type,
    message: error?.message || String(error),
    stack: error?.stack,
    context,
    userAgent: navigator.userAgent,
    url: window.location.href
  };
  
  errorQueue.push(errorLog);
  
  // Flush périodique ou immédiat pour les erreurs critiques
  if (type === ErrorTypes.AUTH || type === ErrorTypes.DATABASE) {
    flushErrors();
  } else if (!flushTimer) {
    flushTimer = setTimeout(flushErrors, 5000);
  }
}

// Envoyer les erreurs au serveur (ou localStorage)
function flushErrors() {
  if (errorQueue.length === 0) return;
  
  const errorsToSend = [...errorQueue];
  errorQueue = [];
  
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  
  // Stocker dans localStorage pour debug
  try {
    const existing = JSON.parse(localStorage.getItem('ghostub_errors') || '[]');
    const merged = [...existing, ...errorsToSend].slice(-50);
    localStorage.setItem('ghostub_errors', JSON.stringify(merged));
  } catch(e) {}
  
  // TODO: Envoyer à un service d'analytics si configuré
  console.debug('[ErrorHandler]', errorsToSend);
}

// Afficher une erreur à l'utilisateur
function showError(type, customMessage = null) {
  const message = customMessage || (ErrorMessages[type]?.[_currentLang] || ErrorMessages[ErrorTypes.UNKNOWN][_currentLang]);
  
  // Utiliser le système de toast existant
  if (window.showToast) {
    window.showToast('error', message);
  } else {
    alert(message);
  }
}

// Wrapper pour capturer les erreurs dans les async functions
export async function safeAsync(fn, context = {}) {
  try {
    return await fn();
  } catch (error) {
    const type = detectErrorType(error);
    logError(error, type, context);
    showError(type);
    throw error;
  }
}

// Détecter le type d'erreur
function detectErrorType(error) {
  const message = error?.message?.toLowerCase() || '';
  
  if (message.includes('network') || message.includes('fetch') || message.includes('offline')) {
    return ErrorTypes.NETWORK;
  }
  if (message.includes('auth') || message.includes('permission') || message.includes('unauthorized')) {
    return ErrorTypes.AUTH;
  }
  if (message.includes('firestore') || message.includes('database')) {
    return ErrorTypes.DATABASE;
  }
  if (message.includes('geolocation') || message.includes('position')) {
    return ErrorTypes.LOCATION;
  }
  if (message.includes('upload') || message.includes('cloudinary')) {
    return ErrorTypes.UPLOAD;
  }
  
  return ErrorTypes.UNKNOWN;
}

// Décorateur pour les fonctions critiques
export function withErrorHandling(fn, context = {}) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      const type = detectErrorType(error);
      logError(error, type, { ...context, args: args.slice(0, 2) });
      showError(type);
      throw error;
    }
  };
}

// Initialiser la capture d'erreurs globales
export function initGlobalErrorHandler() {
  window.addEventListener('error', (event) => {
    logError(event.error || event.message, ErrorTypes.UNKNOWN, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason, ErrorTypes.UNKNOWN, { promise: true });
  });
}

export default {
  ErrorTypes,
  safeAsync,
  withErrorHandling,
  showError,
  initGlobalErrorHandler
};
