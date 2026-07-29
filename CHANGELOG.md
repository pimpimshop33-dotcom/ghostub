# Ghostub — Changelog

## v1.5.0 — 15 mars 2026
### Performance
- Carte Leaflet réutilisée sans reconstruction à chaque ouverture (fin du clignotement)
- Leaderboard lit directement `users.totalResonances` au lieu d'agréger 100 ghosts
- Service Worker v15

### Fiabilité
- Fallback GPS : tentative géolocalisation IP (`ipapi.co`) au lieu du hardcode Arcachon
- La carte se centre sur Paris si aucun GPS disponible

### Sécurité
- `_verifyPremiumServer()` relit Firestore avant tout dépôt Premium (empêche contournement DevTools)
- Règles Firestore déployées : `users.premium` non modifiable côté client
- `isPremium` synchronisé automatiquement si désynchronisé

### Scalabilité
- Compteurs dénormalisés : `ghostCount` incrémenté au dépôt, `totalResonances` à la résonance
- `refreshProfileStats` lit `users/{uid}` en 1 lecture Firestore (au lieu de N)

### Accessibilité
- Contrastes améliorés : `--spirit-dim` 0.35 → 0.50
- Textes secondaires (compteurs, hints, swipe) relevés à 0.45–0.50

---

## v1.4.0 — 14 mars 2026
### Architecture
- **Split monolithique** : 449Ko → `index.html` (81Ko) + `app.js` (286Ko) + `style.css` (75Ko)
- Cache différentiel : seul le fichier modifié est re-téléchargé à chaque déploiement
- Service Worker v14 mis à jour

### Internationalisation
- Rangs bilingues : Vagabond → Wanderer, Chasseur → Hunter, Légende → Legend (EN)
- Titres de page dynamiques via `t.misc_screen_*`
- Canvas Ghost Card, Map Card, Year Card traduits FR/EN
- Boutons et toasts Stripe traduits

### Qualité
- 51 magic strings Firestore remplacées par `const COLL`
- `visibilitychange` : intervals suspendus en arrière-plan, repris au retour

---

## v1.3.0 — 13 mars 2026
### Sécurité & Performance
- 0 requêtes Firestore sans `limit()` (8 corrections)
- `refreshProfileStats` avec fallback compteurs dénormalisés
- 3 `console.log` de debug supprimés
- Erreurs de dépôt : message technique masqué, `dep_err_generic` affiché

### Fonctionnalités
- **Ghost dédié** (Premium) : ghost réservé à un destinataire via UID/email ou lien unique
- **"Mon année Ghostub"** : carte Canvas 1080×1920 Stories-ready, partage natif
- **Pricing section** : cartes Premium (0,99€/mois) et Commerce (4,99€/mois) dans le profil
- `startStripeCheckout()` stub prêt pour connexion Stripe

### i18n
- Clés ajoutées : `dep_err_generic`, `blocked_dedicated_title/sub`, `stripe_btn_*`, `stripe_pending_*`
- Section pricing masquée pour les utilisateurs Premium

---

## v1.2.0 — 12 mars 2026
### Fonctionnalités
- **Onboarding interactif** : démo bris de sceau réelle (flash + particules + son + haptic) en slide 3
- Slide GPS : demande de permission au moment émotionnel fort
- `OB_TOTAL` : 4 → 5 slides

### UX/UI
- **Badge Premium** : bordure dorée + halo sur avatar + badge `✦ Premium`
- **Mini-map dépôt** : carte Leaflet réelle en étape 2 (rayon dynamique)
- **Ghost Spots** : clusters 3+ ghosts dans 50m avec badge doré animé sur la carte
- **Streak découverte** : badge `🔥 Nj` dans vibe-bar dès 2 jours consécutifs
- Animation post-dépôt : 55 particules dorées + haptic + son arpège
- Animation bris de sceau : 68 particules canvas + flash + 3 couches sonores

### Performance
- Carte dark : tuiles CartoDB (`dark_all`) au lieu d'OSM
- `visibilitychange` : 4 setInterval suspendus en arrière-plan

---

## v1.1.0 — 11 mars 2026
### Fonctionnalités
- **i18n FR/EN** : `LANGS{fr,en}` ~600 clés, Proxy `t`, `setLang()`, `localStorage ghostub_lang`
- `GhostService.timeRemaining()` wrappé FR→EN avec regex

### Sécurité
- `_verifyPremiumServer()` : re-lecture Firestore avant activation Premium
- XSS : `sanitizeToastMsg()` sur tous les toasts
- `cleanOldResoKeys()` : nettoyage orphelins localStorage
- CSP renforcée (CartoDB, Nominatim)

### Performance
- Cache Nominatim en mémoire (geocode)
- `WorldService.getVisibleGhosts()` avec filtre geohash (~15km)
- `firestore.indexes.json` couvrant toutes les queries composites

### Cloud Functions
- `autoModerateGhost` : modération automatique
- `cleanExpiredGhosts` : nettoyage périodique
- `activatePremiumSecure` : activation codes Premium
- Migration Spark → Blaze, Node 20 → 22

> **Correctif (2026-07-29, audit) :** ces trois fonctions n'ont en réalité
> jamais existé dans `functions/index.js` malgré cette entrée — un audit les
> a trouvées absentes du code source ET non déployées (`firebase
> functions:list`), ce qui avait induit en erreur un rapport d'audit
> antérieur. `activatePremiumSecure` et `cleanExpiredGhosts` ont depuis été
> réellement implémentées et déployées (Lots Audit-2 et Audit-3).
> `autoModerateGhost` reste absente à ce jour — `ghosts.reportCount`
> s'incrémente désormais correctement (Audit-Reste, Batch B) mais aucune
> action de modération automatique n'est déclenchée dessus.

---

## v1.0.0 — 10 mars 2026
### Lancement
- PWA géolocation — géocaching émotionnel
- Firebase Auth/Firestore, Cloudinary, Leaflet/OSM, vanilla JS
- Radar GPS, carte Leaflet, dépôt de ghosts, bris de sceau
- Système Premium via `premiumCodes` Firestore
- Service Worker v13, `manifest.json`, icônes PWA
- Écran Aide & Mentions légales (RGPD)
- Vocabulaire mystique : "Invoquer", "Briser le sceau", résonance, rangs
- Hunt Mode, notifications push, partage natif
- Compteur de vues (`viewCount`), favoris, signalement
