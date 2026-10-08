# Ghostub — Design tokens (référence unique)

But de ce fichier : que le débat "quelle couleur pour ce nouvel élément" (répété sur les Lots G, R, S) ne se reproduise plus. **Avant d'introduire une nouvelle couleur codée en dur dans un lot, vérifier d'abord si elle existe déjà ici.**

En relisant `style.css`, la palette n'était pas du tout du bricolage : chaque variable a un rôle documenté en commentaire dans `:root`. Le problème n'était pas l'absence de système, mais l'absence d'un **résumé consultable en dehors d'un fichier CSS de 3000 lignes** — d'où les régressions type "orange qui traîne" (Lot R) alors qu'une couleur correcte existait déjà pour cet usage.

## Palette officielle (7 couleurs actives)

| Token | Valeur | Rôle | Ne pas utiliser pour |
|---|---|---|---|
| `--spirit-rgb` | `122,184,245` (#7ab8f5) | Bleu ciel saturé — radar, espace, distance, GPS, halos extérieurs, fond bokeh partagé | Lettres/enveloppes (→ ghost-blue) |
| `--ghost-blue-rgb` | `168,180,255` | Lavande froide — lettres, enveloppes, mystère, hints, sceaux | Radar/GPS (→ spirit) |
| `--amber` / `--amber-dim` / `--amber-glow` | `#e8a030` | Réverbère urbain — halo bas de l'écran (`.phone::after`), accents chaleureux ponctuels sur écrans **non contextualisés** (radar/déposer/carte/profil/intro l'excluent explicitly via `body:has(...)`) | Tout fond bokeh des écrans principaux — c'est précisément l'erreur corrigée aux Lots R/S |
| `--premium-rgb` | `255,200,80` | Or Premium — badge "✦ Premium", CTA payants, tout ce qui signale un palier payant | Rareté d'enveloppe générique (→ tier-gold) |
| `--tier-gold-rgb` | `245,223,160` | Or rareté — enveloppes rare/légendaire du radar (mécanique de jeu, pas de paiement) | Statut Premium (→ premium) |
| `--mist-rgb` | `61,184,122` | Brume verte — enseigne nocturne, ambiance urbaine | Succès/validation (→ accent-green) |
| `--accent-green-rgb` | `100,220,160` | Vert succès — badges type "Premier lecteur", confirmations | Ambiance décorative (→ mist) |

## Encres de détail (usage restreint, à garder tel quel)

- `--lettre-ink-rgb` (`232,200,150`) : texte de l'écran de dépôt façon papier à lettre.
- `--seal-ink-rgb` / `--seal-ink2-rgb` (`255,210,180` / `255,235,210`, remplacés par des rouges `120,30,30` / `110,25,25` en contexte cire) : dégradé à deux teintes du bouton sceau de cire. **Ne pas fusionner** — c'est un effet de profondeur à deux tons, pas une redondance (vérifié dans le code : deux usages distincts, pas un doublon accidentel).

## Neutres

- `--void` `#020408`, `--deep` `#04080f`, `--surface` `#090d16`, `--surface2` `#0d1220` — fonds, du plus profond au plus clair.
- `--ether` `#c8daf5` — texte clair principal sur fond sombre.
- `--warm` `#e8d4a8` / `--warm-dim` — texte secondaire chaud (hints, compteurs).
- `--red` — erreurs/danger uniquement.

## Règle de gouvernance

1. Un nouveau lot qui a besoin d'une couleur cherche d'abord dans ce tableau.
2. Si aucun token ne convient, la décision de couleur devient un point à trancher **avec Pipo avant implémentation** (comme cela a été fait pour K6/L3) — pas une valeur hex improvisée dans le CSS.
3. Toute nouvelle variable ajoutée à `:root` est documentée ici le jour même, avec son rôle et ce pour quoi elle ne doit *pas* servir (c'est la colonne qui a manqué jusqu'ici et qui aurait évité la confusion ambre/spirit sur l'intro).

## L'Approche (Lot AV) — paliers de couleur par distance

Nouveau système de tokens dédié à l'écran L'Approche (ex-Radar), **distinct** de la palette officielle ci-dessus : ces couleurs n'ont de sens que dans ce contexte précis (chaud-froid selon la distance à un fantôme), pas comme accents génériques ailleurs dans l'app.

| Token | Rôle |
|---|---|
| `--approach-t0/t1/t2/t3-center/-mid/-edge` | Dégradé radial de fond par palier, Mode nuit (`.approach-bg-tN`, style.css) — jamais interpolés directement (un dégradé ne s'anime pas), seule l'opacité du calque fond en fondu (1,2 s) |
| `--approach-t0/t1/t2/t3-accent` | Anneau + pastilles de pagination actives, Mode nuit |
| `--approach-t0/t1/t2/t3-text2` | Texte secondaire (contexte, phrase, sous-titre arrivée), les deux thèmes — interpolé nativement via `transition:color` |
| `--approach-t0/t1/t2/t3-halo` (définis dans `body.light-theme`) | Halo derrière le Trace + anneau, Mode jour **uniquement** — remplace `-accent` dans ce thème (couleurs vives pensées pour fond sombre, pas pour un accent sur fond clair) |
| `--approach-text-cold` / `--approach-text-warm` | Texte principal (distance géante, titre d'arrivée), Mode nuit seulement — `t0`/`t1` vs `t2`/`t3`. En Mode jour, retombe sur `--ether` (encre existante, contraste déjà vérifié) |

Ne pas réutiliser ces tokens hors de `#approachStage` — ce sont des paliers contextuels (froid→chaud selon la distance), pas des couleurs de marque.

## Ce qui n'a volontairement pas été touché dans ce lot

Les usages réels de chaque variable ont été comptés dans `style.css` + `app.js` avant d'écrire ce fichier (`--ghost-blue-rgb` : 242, `--spirit` : 204, `--premium-rgb` : 121, `--tier-gold-rgb` : 42, `--amber` : 39, `--mist` : 31, `--accent-green-rgb` : 28, `--lettre-ink-rgb` : 27) : ce sont des couleurs **actives et sémantiquement distinctes**, pas du code mort à purger. Une fusion à l'aveugle de ces variables sur ~700 points d'usage combinés, sans pouvoir tester visuellement en live sur l'A54, aurait été le genre de refactor à risque disproportionné pour le gain — exactement le type de décision que le projet a l'habitude de différer plutôt que de faire à l'aveugle (cf. constats de l'audit laissés de côté volontairement). Ce fichier documente et fige donc le système existant plutôt que de le réécrire ; une vraie réduction du nombre de couleurs, si elle est souhaitée, est un chantier à part, à faire avec Claude Code en local (rechargement live, test réel sur l'A54).
