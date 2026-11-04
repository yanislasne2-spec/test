# Pépite — 10 infos par jour

Appli de culture générale au style néon Tokyo (violet, noir, rose) : chaque jour, 10 infos sur des thèmes variés,
chacune affichée avec son thème (icône + couleur). Pas de quiz : on lit, on garde ses favorites, on partage.
Publiée avec le site sur **https://yanislasne.fr/apprendre/**.

## L'installer sur iPhone
Safari → https://yanislasne.fr/apprendre/ → **Share** (Partager) → **Add to Home Screen** (Sur l'écran d'accueil) → **Add**.

## Fonctionnement
- **Aujourd'hui** : 10 infos, choisies dans 10 thèmes différents. On glisse ou on touche « Suivante ». La lecture reprend là où on s'est arrêté.
  Une fois finies : relire, ou 5 infos bonus. La série 🔥 augmente chaque jour où les 10 infos sont lues.
- **Thèmes** : 20 thèmes (sciences, histoire, espace, sport, cinéma, musique, littérature, philosophie,
  environnement, société & politique, mythologie…), progression par thème, possibilité d'en exclure.
- **Mes infos** : toutes les infos lues, filtrables par thème ou favoris ⭐.
- **Néko, l'IA** : sous chaque info, « Demander à Néko » ouvre un chat pour poser ses questions (explication plus simple,
  détails, anecdotes…). Néko utilise Claude (modèle `claude-opus-5-5`, effort bas) via le SDK officiel `@anthropic-ai/sdk`
  (empaqueté dans `vendor/`), directement depuis le navigateur avec **ta propre clé API** Anthropic
  (console.anthropic.com → API Keys). La clé est enregistrée uniquement sur l'appareil. Environ 1 centime par question.
- **Réglages** : thème Néon nuit (sombre) ou Néon jour (clair), clé de l'IA, sons, statistiques.
- La progression est enregistrée sur l'appareil.

## Ajouter du contenu
Tout est dans `data.js` (300 infos, 15 par thème) : ajoute un bloc `{ id, theme, title, text }`.
Après une modification, change `?v=2` dans `index.html` et `sw.js`, et `VERSION` dans `sw.js`,
pour que l'iPhone récupère la nouvelle version.
