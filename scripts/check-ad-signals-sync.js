#!/usr/bin/env node
// AU-1/arbitrage 6 — shared/ad-signals.mjs (ES module, chargé par app.js) et
// functions/ad-signals.js (copie CommonJS, chargée par createGhostSecure) ne
// peuvent pas être un seul fichier sans étape de build (navigateur vs Node
// CJS). Ce script exécute les DEUX implémentations sur la même batterie de
// messages et échoue à la moindre divergence — même principe que
// scripts/check-constants.js (lot AT-8).
const path = require('path');

const TEST_MESSAGES = [
  '',
  'Je pense à toi, c\'était un moment gratuit et parfait',
  '-20% sur tous les cafés ce week-end, code CAFE20',
  'Venez à la boutique, le menu du midi est à 13,50 €',
  'prooomo exceptionnelle ce week-end',
  'Achetez maintenant, livraison offerte, www.exemple.fr',
  'Appelez-nous au 06 12 34 56 78',
  '@monpseudo',
  'Un simple message sans aucun signal publicitaire',
  'RÉDUCTION de 30% chez nous, réservez au plus vite !',
];

// AU-1 — les deux exemples chiffrés de la section "Vérification attendue"
// du lot : le tableau des signaux à lui seul ne les atteint pas ('gratuit'
// et le motif de code promo ont dû être ajoutés, cf. commentaires dans les
// deux fichiers) — verrouillés ici pour ne pas régresser silencieusement.
const EXPECTED_SCORES = [
  { message: 'Je pense à toi, c\'était un moment gratuit et parfait', expected: 2 },
  { message: '-20% sur tous les cafés ce week-end, code CAFE20', min: 4 },
];

async function main() {
  const mjsUrl = 'file://' + path.join(__dirname, '..', 'shared', 'ad-signals.mjs').replace(/\\/g, '/');
  const esm = await import(mjsUrl);
  const cjs = require(path.join(__dirname, '..', 'functions', 'ad-signals.js'));

  let failed = false;
  if (esm.AD_SCORE_THRESHOLD !== cjs.AD_SCORE_THRESHOLD) {
    failed = true;
    console.error(`❌ AD_SCORE_THRESHOLD diverge : mjs=${esm.AD_SCORE_THRESHOLD} vs cjs=${cjs.AD_SCORE_THRESHOLD}`);
  }
  for (const msg of TEST_MESSAGES) {
    const a = esm.adScore(msg);
    const b = cjs.adScore(msg);
    if (a !== b) {
      failed = true;
      console.error(`❌ adScore diverge pour "${msg}" : shared/ad-signals.mjs=${a} vs functions/ad-signals.js=${b}`);
    }
  }

  for (const { message, expected, min } of EXPECTED_SCORES) {
    const a = esm.adScore(message);
    if (expected != null && a !== expected) {
      failed = true;
      console.error(`❌ score attendu ${expected} pour "${message}", obtenu ${a}`);
    }
    if (min != null && a < min) {
      failed = true;
      console.error(`❌ score attendu >= ${min} pour "${message}", obtenu ${a}`);
    }
  }

  if (failed) process.exit(1);
  console.log(`✅ ad-signals OK — ${TEST_MESSAGES.length} messages testés, shared/ad-signals.mjs et functions/ad-signals.js identiques.`);
}

main().catch(e => { console.error('❌ check-ad-signals-sync a échoué :', e); process.exit(1); });
