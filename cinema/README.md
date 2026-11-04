# Éveil — le Système du cinéphile

To-do list gamifiée pour se faire une culture cinéma : films, séries et une catégorie **Culture** (documentaires,
séries docs, chaînes pour apprendre). Classiques, succès actuels et futurs cultes.
Publiée avec le site sur **https://yanislasne.fr/cinema/**.

## L'installer sur iPhone
Safari → https://yanislasne.fr/cinema/ → **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
L'appli s'ouvre ensuite en plein écran, comme une vraie appli, et marche hors connexion.

## Fonctionnement
- **Statut** : niveau, rang du chasseur (E → D → C → B → A → S → Légende), barre d'XP, 6 stats
  (Héritage, Flair, Endurance, Savoir, Éclectisme, Plume), titre équipé.
- **Quêtes journalières** : 3 par jour (+100 XP bonus si toutes faites) + une quête hebdo. Série 🔥 de jours d'éveil.
- **Portail du jour** : un titre tiré au hasard ; accepte-le et termine-le pour ×1,5 XP.
- **Ma liste** : « À voir » / « En cours » / « Vus ». Touche ○ quand tu as vu un titre : note en étoiles + critique.
- **Explorer** : 178 titres (90 films, 47 séries, 41 culture), filtres par époque et par rang, recherche,
  lien JustWatch pour savoir où le regarder. On peut ajouter ses propres titres.
- **Donjons** : 18 collections (Ghibli, Nolan, Palmes d'or, L'Âge d'or des séries, Devoir de mémoire…) :
  termine-les pour un gros bonus d'XP et un titre exclusif.
- **Profil** : titres débloqués, chronique, sons, export / import de la sauvegarde.

La progression est enregistrée sur le téléphone : pense à exporter une sauvegarde de temps en temps.

## Ajouter du contenu
Tout est dans `data.js` : une ligne par titre, et la liste `DUNGEONS` pour les collections.
Après une modification, change `?v=1` dans `index.html` et `sw.js`, et `VERSION` dans `sw.js`.
