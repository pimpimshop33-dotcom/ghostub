#!/usr/bin/env node
// AT-4/C4 — parité i18n : échoue si une clé appelée (t.x, t['x'], data-i18n,
// data-i18n-placeholder) n'est pas définie en FR ET en EN, ou si un écart
// entre les deux langues existe. Objectif : ~20 lignes, exécutable au commit.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
// Retire les commentaires avant de chercher les usages t.x — sinon un
// commentaire qui MENTIONNE un nom de clé (ex. cette ligne même) compte
// comme un faux usage. Ne touche pas `app` ailleurs (LANGS, etc.), seulement
// la copie utilisée pour extraire les clés APPELÉES.
const appNoComments = app.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

function extractBlockKeys(src, marker) {
  const markerIdx = src.indexOf(marker);
  const braceIdx = markerIdx + marker.length - 1; // index du '{' d'ouverture
  let depth = 0, i = braceIdx, end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const block = src.slice(braceIdx + 1, end); // exclut les accolades elles-mêmes
  // Plusieurs "clé: 'valeur'" peuvent partager une ligne (ex. ob_title1/ob_sub1) :
  // ancré sur { , ou début de ligne plutôt que sur ^ seul.
  return new Set([...block.matchAll(/(?:^|[{,])\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*['"]/gm)].map(m => m[1]));
}

const frKeys = extractBlockKeys(app, 'fr: {');
const enKeys = extractBlockKeys(app, 'en: {');

// `t` est aussi utilisé comme nom de variable ordinaire ailleurs dans le
// fichier (boucles, callbacks) — ces membres ne sont jamais des clés i18n.
const NOT_I18N_MEMBERS = new Set(['classList', 'setAttribute', 'stop', 'style', 'target', 'closest', 'matches', 'lang']);

const used = new Set([
  ...[...appNoComments.matchAll(/\bt\.([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(m => m[1]).filter(k => !NOT_I18N_MEMBERS.has(k)),
  ...[...appNoComments.matchAll(/\bt\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\]/g)].map(m => m[1]),
  ...[...html.matchAll(/data-i18n(?:-placeholder)?="([a-zA-Z_][a-zA-Z0-9_]*)"/g)].map(m => m[1]),
]);

let failed = false;
const missing = [...used].filter(k => !frKeys.has(k) || !enKeys.has(k)).sort();
if (missing.length) {
  failed = true;
  console.error('❌ Clés i18n appelées mais absentes de FR et/ou EN :');
  missing.forEach(k => console.error(`   ${k} (FR:${frKeys.has(k)} EN:${enKeys.has(k)})`));
}
const frOnly = [...frKeys].filter(k => !enKeys.has(k)).sort();
const enOnly = [...enKeys].filter(k => !frKeys.has(k)).sort();
if (frOnly.length || enOnly.length) {
  failed = true;
  if (frOnly.length) console.error('❌ Clés définies en FR mais absentes en EN :', frOnly.join(', '));
  if (enOnly.length) console.error('❌ Clés définies en EN mais absentes en FR :', enOnly.join(', '));
}
if (failed) process.exit(1);
console.log(`✅ i18n OK — ${used.size} clés utilisées, ${frKeys.size} FR / ${enKeys.size} EN définies.`);
