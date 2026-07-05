# TODO — Remplacement du sealedEmoji (enveloppe scellée)

## Contexte

L'élément `<div class="envelope-sealed-emoji" id="sealedEmoji">` affiche l'emoji de l'enveloppe
avant ouverture. Sa valeur est fixée dynamiquement en JS (app.js ~ligne 6060) :

```js
document.getElementById('sealedEmoji').textContent =
  selectedGhost.secret      ? '🔮' :
  selectedGhost.businessMode ? '🏪' :
  (selectedGhost.emoji || '👻');
```

## Ce qu'il faut faire

Remplacer **uniquement le cas par défaut** (`👻`) par le mark SVG, sans toucher aux cas `🔮` et `🏪`.

### 1. HTML (index.html)

Remplacer :
```html
<div class="envelope-sealed-emoji" id="sealedEmoji" aria-hidden="true">👻</div>
```
Par un contenu initial avec l'img (le JS le remplacera de toute façon) :
```html
<div class="envelope-sealed-emoji" id="sealedEmoji" aria-hidden="true">
  <img src="assets/brand/ghostub-mark-solid.svg" style="width:1em;height:1em;" aria-hidden="true">
</div>
```

### 2. JS (app.js ~ligne 6060)

Remplacer le bloc `textContent = ...` par une logique qui switche entre texte et img :

```js
const sealedEl = document.getElementById('sealedEmoji');
const emojiVal = selectedGhost.secret       ? '🔮'
               : selectedGhost.businessMode ? '🏪'
               : (selectedGhost.emoji && selectedGhost.emoji !== '👻' ? selectedGhost.emoji : null);
if (emojiVal) {
  sealedEl.textContent = emojiVal;
} else {
  sealedEl.innerHTML = '<img src="assets/brand/ghostub-mark-solid.svg" style="width:1em;height:1em;" aria-hidden="true">';
}
```

## À vérifier après intégration

- Fantôme avec emoji custom (ex. 🌹) → affiche l'emoji custom, pas le mark
- Fantôme secret → affiche 🔮
- Fantôme business → affiche 🏪
- Fantôme sans emoji (défaut) → affiche le mark SVG
- Animation CSS sur `.envelope-sealed-emoji` toujours fonctionnelle (le `<img>` enfant doit hériter du transform/opacity)
