# Pépite — une info par jour

Petite appli d'apprentissage quotidien, style épuré (boutons « 3D », mascotte, série 🔥, XP).
Aucune installation ni build : HTML/CSS/JS dans ce dossier, publiée avec le site sur
**https://yanislasne.fr/apprendre/**.

## L'installer sur iPhone
1. Ouvre https://yanislasne.fr/apprendre/ dans **Safari**.
2. Touche **Partager** puis **« Sur l'écran d'accueil »**.
3. L'icône Pépite apparaît : l'app s'ouvre en plein écran et marche hors connexion.

## Fonctionnement
- **Aujourd'hui** : une leçon du jour (3, 5 ou 8 infos selon l'objectif), puis un quiz. Chaque info affiche son thème (icône + couleur).
- **Thèmes** : 12 thèmes, progression par thème, possibilité d'en exclure de la leçon du jour.
- **Mes infos** : toutes les infos apprises, filtrables par thème ou favoris.
- **Révisions** : répétition espacée (1, 3, 7, 14, 30, 60 jours) ; une erreur renvoie l'info au début.
- La progression est enregistrée sur l'appareil (localStorage).

## Ajouter du contenu
Tout est dans `data.js` : ajoute un bloc `{ id, theme, title, text, q, choices, a }`.
Après une modification, change `?v=1` dans `index.html` et `VERSION` dans `sw.js` pour que l'iPhone récupère la nouvelle version.
