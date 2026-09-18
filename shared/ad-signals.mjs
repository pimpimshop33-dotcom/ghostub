/**
 * shared/ad-signals.mjs — AU-1
 *
 * Source unique du score publicitaire, importée côté client (app.js) ET
 * côté Cloud Functions (functions/ad-signals.js, copie CommonJS synchronisée
 * — cf. scripts/check-ad-signals-sync.js, même principe que le script de
 * garde du lot AT-8 : le navigateur charge des ES modules nativement, les
 * Cloud Functions tournent en CommonJS, aucune étape de build n'unifie les
 * deux sans un bundler — donc deux fichiers, jamais deux LOGIQUES).
 *
 * Remplace l'ancienne liste de 18 mots-clés (contournable sans effort,
 * cf. audit AU-1) par un score cumulatif sur 4 familles de signaux.
 */

// Extrait sans accents/diacritiques (NFD + suppression des marques
// combinantes), en minuscules, espaces multiples réduits, et caractères
// répétés 3 fois ou plus compressés à une seule occurrence (prooomo → promo)
// — un contournement trivial du filtre par mot-clé sinon.
export function normalizeAdText(message) {
  return String(message || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(.)\1{2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// Signal A — vocabulaire d'offre (2 points). 'gratuit' ajouté : absent du
// tableau du lot mais nécessaire pour son propre exemple vérifié ("c'était
// un moment gratuit et parfait" → 1 signal, score 2). Motif de code promo
// (lettres suivies de chiffres collés, ex. CAFE20, BIENVENUE10) ajouté pour
// la même raison ("-20%... code CAFE20" → score 4+ dans le lot) : la seule
// liste de mots du tableau ne l'atteint pas seule (2 pts de %, rien d'autre) ;
// un code postal ("code postal 33120", chiffres seuls) ne matche pas.
const VOCAB_TERMS = [
  'promo', 'soldes', 'remise', 'reduction', 'offre speciale', 'discount',
  'coupon', 'code promo', 'bon plan', 'happy hour', '2 pour 1', 'vente',
  'destockage', 'black friday', 'gratuit',
];
const PROMO_CODE_RE = /\bcode\s+[a-z]+\d+\b/;

// Signal B — appel à l'action commercial (1 point)
const CTA_TERMS = [
  'achetez', 'commandez', 'reservez', 'passez nous voir', 'livraison',
  'ouvert de', 'nos horaires', 'notre boutique', 'notre carte',
];

// Signal C — prix ou pourcentage (2 points)
const PRICE_RE = /\d+\s*%|\d+([.,]\d{1,2})?\s*(€|eur|euros)/;

// Signal D — contact ou lien (2 points) : URL, www., téléphone FR, @pseudo
const CONTACT_RE = /https?:\/\/|www\.|(?:\+33|0)\s*[1-9](?:[\s.-]?\d{2}){4}|@[a-z0-9_]{2,}/;

/**
 * Calcule le score publicitaire d'un message. Un signal compte une seule
 * fois même s'il apparaît plusieurs fois. Seuil de bascule : 3 (cf. lot AU,
 * arbitrage tranché — non configurable).
 * @param {string} message
 * @returns {number}
 */
export function adScore(message) {
  const norm = normalizeAdText(message);
  if (!norm) return 0;
  let score = 0;
  if (VOCAB_TERMS.some(w => norm.includes(w)) || PROMO_CODE_RE.test(norm)) score += 2;
  if (CTA_TERMS.some(w => norm.includes(w))) score += 1;
  if (PRICE_RE.test(norm)) score += 2;
  if (CONTACT_RE.test(norm)) score += 2;
  return score;
}

export const AD_SCORE_THRESHOLD = 3;
