// Lot AO — applique la classe de thème AVANT le premier paint, pour éviter
// un flash (Mode nuit par défaut du CSS) le temps que app.js (module, donc
// différé) charge et exécute applyTheme(). Script classique (pas module),
// placé au tout début de <body> : bloque le parsing jusqu'à son exécution,
// donc s'exécute avant que le reste du contenu ne soit peint. CSP : fichier
// externe 'self', pas de script inline (script-src n'autorise pas
// 'unsafe-inline').
(function () {
  try {
    var saved = localStorage.getItem('ghostub_theme');
    var isLight = saved ? saved === 'light' : window.matchMedia('(prefers-color-scheme: light)').matches;
    if (isLight) document.body.classList.add('light-theme');
  } catch (e) {}
})();
