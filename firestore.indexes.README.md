# firestore.indexes.json — pourquoi chaque index existe

`firestore.indexes.json` doit rester du JSON strict (pas de commentaires `//`).
Ce fichier documente, dans l'ordre du tableau `indexes`, la requête réelle que
chaque index composite sert à satisfaire.

## NOTIFICATIONS
`toUid ASC, notified ASC`
Sert `checkReplyNotifications()` : `where toUid == x AND notified == false`.

## DISCOVERIES
`authorUid ASC, notified ASC`
Sert `checkDiscoveries()` : `where authorUid == x AND notified == false`.

## GHOSTS
`authorUid ASC, createdAt DESC`
Sert `checkResonances()` : `where authorUid == x`, `limit(50)`.

`authorUid ASC, resonances DESC`
Sert `refreshProfileStats()` : `where authorUid == x` (compteur + tri par resonances).

## REPORTS
`ghostId ASC, createdAt DESC`
Sert l'auto-modération de `submitReport` (Cloud Function) : `where ghostId == x`.

## REPLIES
`ghostId ASC, createdAt DESC`
Sert l'affichage des réponses dans `openGhost` (`app.js:6415-6419`) :
`where ghostId == x`, `orderBy createdAt desc`.

## Index orphelin mentionné dans A5 (non retrouvé)

La tâche A5 faisait référence à un index `ghosts(geohash5, expired)` décrit comme
« orphelin confirmé et intentionnellement conservé ». Il n'existe ni dans
`firestore.indexes.json` au moment de ce nettoyage, ni dans aucun commentaire du
fichier — vérifié par recherche texte sur tout le dépôt. Soit il a déjà été
retiré avant cette tâche, soit il s'agit d'un index géré uniquement depuis la
console Firebase (donc jamais synchronisé dans ce fichier). À vérifier
directement dans la console Firebase si la question se pose à nouveau — rien
n'a été deviné ni recréé ici.
