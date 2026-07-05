# Intégration du mark "Trace" — brief pour Claude Code

## 0. Fichiers à copier dans le repo d'abord
Copier le dossier `ghostub-brand/` (téléchargé depuis la conversation Claude web) dans le repo,
par exemple sous `assets/brand/`. Contient :
- ghostub-mark-trace.svg (version fine, grands formats)
- ghostub-mark-solid.svg (version pleine, petits formats)
- ghostub-icon-flat.svg (base favicon/app icon)
- adaptive-icon-foreground.svg / adaptive-icon-background.svg (Android)
- png/favicon-16.png, favicon-32.png, favicon-48.png
- png/apple-touch-icon-180.png
- png/icon-192.png, icon-512.png
- png/icon-maskable-512.png  ← remplace le fichier existant du même nom
- png/adaptive-icon-foreground-432.png, adaptive-icon-background-432.png

## 1. manifest.json
- Remplacer `icon-maskable-512.png` par la nouvelle version (même nom, juste écraser le fichier).
- Vérifier que les entrées `icon-192.png` / `icon-512.png` pointent bien vers les nouveaux fichiers.

## 2. `<head>` de index.html
Ajouter/mettre à jour les liens favicon :
```html
<link rel="icon" type="image/png" sizes="16x16" href="assets/brand/png/favicon-16.png">
<link rel="icon" type="image/png" sizes="32x32" href="assets/brand/png/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="assets/brand/png/apple-touch-icon-180.png">
```

## 3. Remplacements HTML — emoji → mark (7 emplacements prioritaires)
Dans chaque cas : remplacer le `👻` textuel par une balise `<img>` (ou `<svg>` inline si tu préfères
éviter une requête réseau) pointant vers `ghostub-mark-solid.svg`, en gardant EXACTEMENT le même
conteneur/classe/style pour ne rien casser côté layout/animation.

Repère chaque emplacement en cherchant le texte indiqué (les numéros de ligne peuvent avoir bougé
depuis la version que j'ai auditée) :

1. **Écran connexion** — `<div style="font-size:40px;margin-bottom:8px;" aria-hidden="true">👻</div>`
   → remplacer par `<img src="assets/brand/ghostub-mark-solid.svg" style="width:40px;height:40px;" aria-hidden="true">`

2. **Confirmation de dépôt** — `<div class="success-ghost" aria-hidden="true">👻</div>`
   → même logique, garder la classe `success-ghost` (probablement animée en CSS)

3. **Profil/empreinte** — `<div class="empreinte-icon">👻</div>`
   → idem, garder la classe

4. **Carte Premium** — `<div style="font-size:32px;filter:drop-shadow(...);">👻</div>`
   → idem, garder le filter drop-shadow (fonctionne aussi sur une image)

5. **Écran Aide** — `<div style="font-size:36px;margin-bottom:8px;">👻</div>`
   → idem

6. **Limite d'ouverture atteinte** — `<div class="open-limit-icon" id="openLimitIcon">👻</div>`
   → ⚠️ celui-ci a un `id`, vérifier qu'aucun script ne fait `.textContent = '👻'` dessus ailleurs
   (sinon il faudra adapter ce script pour changer `src` au lieu de `textContent`)

7. **Onboarding** (2 endroits) — `.ob-ghost-dot` et `.ob-env-emoji`
   → idem, garder les classes

## 4. Ghost Card / Year Card (canvas) — app.js
Deux endroits utilisent `ctx.fillText(emoji, x, y)` pour dessiner le fantôme sur un canvas exporté
en image (partage social) :
- la génération de la Ghost Card
- la génération de la Year Card / scratch reveal

Remplacer par un `ctx.drawImage()` avec une image pré-chargée depuis `ghostub-mark-solid.svg`
(converti en PNG ou chargé via `new Image()` + `img.src = 'assets/brand/png/icon-512.png'` recadré,
ou exporter un PNG carré transparent dédié si le rendu ne convient pas tel quel).
Attention : `drawImage` nécessite que l'image soit chargée (`img.onload`) avant de dessiner —
si le canvas est généré à la volée au clic utilisateur, précharger l'image au démarrage de l'app
pour éviter un délai.

## 5. Cas à trancher ensemble avant de coder : l'enveloppe scellée
`envelope-sealed-emoji` / `#sealedEmoji` — affiche 🔮 (secret), 🏪 (commerce), ou l'emoji du fantôme
(par défaut 👻 sauf si le déposant a choisi un autre emoji). Remplacer seulement le cas par défaut
demande une condition en plus dans le JS qui fixe `.textContent`. Décider si ça vaut le coup avant
de toucher ce point — pas urgent, à faire dans un second temps.

## 6. Ce qu'on NE touche PAS
Tout le reste (~100 occurrences) : textes i18n (boutons, notifications, aide), toasts, texte de
partage natif (`navigator.share` ne peut afficher qu'un emoji, pas une image), picker d'emoji du
dépôt, valeur par défaut du champ `emoji` en base, badges de rang, symboles décoratifs. Ça reste
en emoji natif `👻` — ne pas remplacer.

## 7. Test après intégration
- Vérifier chaque écran modifié sur A54 (les 7 emplacements de la section 3)
- Vérifier que le favicon apparaît bien dans l'onglet navigateur
- Vérifier l'icône d'app après réinstallation du PWA (icon-maskable-512.png)
- Vérifier que la Ghost Card générée affiche bien le nouveau mark et pas un carré vide
  (bug classique si l'image n'a pas fini de charger avant le `drawImage`)
