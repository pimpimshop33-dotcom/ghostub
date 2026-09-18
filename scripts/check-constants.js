#!/usr/bin/env node
// AT-8 — les durées d'expiration, la précision geohash et la limite
// d'ouvertures quotidiennes existent en plusieurs exemplaires (browser ESM
// vs Cloud Functions CJS : pas de module unique importable des deux côtés
// sans étape de build, cf. rapport de lot). Faute de source unique, ce
// script vérifie qu'aucune copie n'a divergé — la cause directe de M3/M9/m2
// dans l'audit du 18 septembre 2026 était précisément une divergence non
// détectée entre ces copies.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const ghostService = fs.readFileSync(path.join(root, 'services/ghost.service.js'), 'utf8');
const worldService = fs.readFileSync(path.join(root, 'services/world.service.js'), 'utf8');
const functionsIndex = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function extractObjectLiteral(src, varName) {
  const m = src.match(new RegExp(`(?:const|let)\\s+${varName}\\s*=\\s*\\{`));
  if (!m) return null;
  let i = m.index + m[0].length - 1, depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) break; }
  }
  const body = src.slice(m.index + m[0].length, i);
  const entries = [...body.matchAll(/'([^']+)'\s*:\s*([\d_]+)/g)];
  const obj = {};
  entries.forEach(([, k, v]) => { obj[k] = Number(v.replace(/_/g, '')); });
  return obj;
}

function extractNumber(src, varName) {
  const m = src.match(new RegExp(`(?:const|let)\\s+${varName}\\s*=\\s*(\\d+)`));
  return m ? Number(m[1]) : null;
}

let failed = false;
function compare(label, a, b, aLabel, bLabel) {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    failed = true;
    console.error(`❌ ${label} diverge entre ${aLabel} et ${bLabel} :`);
    console.error(`   ${aLabel}:`, a);
    console.error(`   ${bLabel}:`, b);
  }
}

compare(
  'Durées d\'expiration',
  extractObjectLiteral(ghostService, 'DURATIONS_MS'),
  extractObjectLiteral(functionsIndex, 'GHOST_DURATIONS_MS'),
  'services/ghost.service.js', 'functions/index.js'
);
compare(
  'Précision geohash',
  extractNumber(worldService, 'GEOHASH_STORE_PRECISION'),
  extractNumber(functionsIndex, 'GEOHASH_STORE_PRECISION'),
  'services/world.service.js', 'functions/index.js'
);
compare(
  'Limite d\'ouvertures quotidiennes',
  extractNumber(appJs, 'DAILY_OPEN_LIMIT'),
  extractNumber(functionsIndex, 'DAILY_OPEN_LIMIT'),
  'app.js', 'functions/index.js'
);

if (failed) process.exit(1);
console.log('✅ Constantes dupliquées OK — aucune divergence détectée.');
