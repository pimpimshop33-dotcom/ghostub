/**
 * functions/ad-signals.js — AU-1
 *
 * Copie CommonJS de shared/ad-signals.mjs (source unique de la logique).
 * Le navigateur charge des ES modules nativement ; les Cloud Functions
 * tournent en CommonJS (pas de "type":"module" dans functions/package.json)
 * — sans étape de build, un seul fichier ne peut pas être importé tel quel
 * des deux côtés (même contrainte que le lot AT-8 pour les constantes de
 * durée/geohash). scripts/check-ad-signals-sync.js exécute les deux
 * implémentations sur les mêmes messages et échoue à la moindre divergence
 * — toute modification de la logique doit être répercutée ICI ET dans
 * shared/ad-signals.mjs, jamais un seul des deux.
 */

function normalizeAdText(message) {
  return String(message || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/(.)\1{2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// 'gratuit' + motif de code promo : cf. shared/ad-signals.mjs pour la
// justification (exemples vérifiés du lot AU).
const VOCAB_TERMS = [
  'promo', 'soldes', 'remise', 'reduction', 'offre speciale', 'discount',
  'coupon', 'code promo', 'bon plan', 'happy hour', '2 pour 1', 'vente',
  'destockage', 'black friday', 'gratuit',
];
const PROMO_CODE_RE = /\bcode\s+[a-z]+\d+\b/;

const CTA_TERMS = [
  'achetez', 'commandez', 'reservez', 'passez nous voir', 'livraison',
  'ouvert de', 'nos horaires', 'notre boutique', 'notre carte',
];

const PRICE_RE = /\d+\s*%|\d+([.,]\d{1,2})?\s*(€|eur|euros)/;

const CONTACT_RE = /https?:\/\/|www\.|(?:\+33|0)\s*[1-9](?:[\s.-]?\d{2}){4}|@[a-z0-9_]{2,}/;

function adScore(message) {
  const norm = normalizeAdText(message);
  if (!norm) return 0;
  let score = 0;
  if (VOCAB_TERMS.some(w => norm.includes(w)) || PROMO_CODE_RE.test(norm)) score += 2;
  if (CTA_TERMS.some(w => norm.includes(w))) score += 1;
  if (PRICE_RE.test(norm)) score += 2;
  if (CONTACT_RE.test(norm)) score += 2;
  return score;
}

const AD_SCORE_THRESHOLD = 3;

module.exports = { normalizeAdText, adScore, AD_SCORE_THRESHOLD };
