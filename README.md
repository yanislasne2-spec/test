# Portfolio photo de Yanis Lasne

Site statique, sans build : `index.html`, `galerie.html`, `style.css`, `app.js`.
En ligne sur **https://yanislasne.fr** (GitHub Pages, domaine déclaré dans le fichier `CNAME`).

## Ajouter des photos depuis GitHub (le plus simple, sans limite de nombre)

1. Ouvre le dossier de la galerie sur GitHub, par exemple
   https://github.com/yanislasne2-spec/test/tree/main/photos/paysage
   (ou `sport`, `portrait`, `concert`).
2. **Add file → Upload files**, glisse tes photos (JPG, PNG, HEIC d'iPhone… jusqu'à 100 par envoi, 25 Mo max chacune).
3. En bas, laisse « Commit directly to the main branch » et clique **Commit changes**.
4. Attends 2 à 3 minutes : GitHub convertit et redimensionne les photos, les renomme (`paysage-11.jpg`…),
   met à jour la galerie puis republie le site (onglet **Actions** pour suivre).

Une photo illisible est mise de côté dans `photos-refusees/` sans bloquer les autres.

## Ajouter tes photos (à la main, sur ton ordinateur)

1. Dépose tes images dans le bon dossier :
   - `photos/sport/` (basket)
   - `photos/portrait/`
   - `photos/concert/`
   - `photos/paysage/`
2. Lance `python3 generer-galeries.py` : `photos.js` est mis à jour automatiquement.
3. (Optionnel) dans `photos.js`, ajoute une `caption` (légende) et un `exif` (ex. `"1/1000 · f/2.8 · ISO 3200"`).
   Le script garde ce que tu as écrit.

Une pellicule « Bientôt » se déverrouille automatiquement dès qu'elle contient au moins une photo.
Le diaporama plein écran de l'accueil utilise la liste `hero` de `config.js` (sinon les premières photos).
Dans `photos.js`, le champ `focus` (ex. `"50% 40%"`) règle le cadrage de chaque photo en plein écran.
Cliquer sur une pellicule ouvre `galerie.html#<id>`, une page dédiée avec toutes les photos du thème.

Conseil : exporte en JPG, environ 2000 px sur le grand côté, qualité 80 : le site reste rapide.

## Personnaliser

Tout se règle dans `config.js` : email, Instagram, photo « à propos », textes, couleurs et intros des galeries.

## Mettre en ligne une nouvelle version

Dans `index.html` et `galerie.html`, change le numéro `?v=...` après `style.css`, `config.js`, `photos.js` et `app.js`
(ex. `?v=20261007c` → `?v=20261008a`) : les visiteurs reçoivent alors la nouvelle version au lieu de celle en cache.

## Tester en local

```bash
python3 -m http.server 8000
# puis ouvre http://localhost:8000
```

## Sound design

Petits sons d'interface synthétisés (style épuré, façon Apple) dans `app.js` : tap au clic, souffle très léger
au survol, ouverture / fermeture (lightbox, trophées, playlist), glissement entre photos, cran de « molette »
à chaque photo de la sélection, cran doux quand une section arrive à l'écran, carillons pour les trophées.
Activés par défaut, coupés avec le bouton 🔊 en haut à droite (indépendant de la playlist).

## Playlist (type beats)

Bouton à barres animées en haut à droite : 5 instrus trap originales dans l'esprit de Future et Young Thug
(Flûte de minuit, Bounce, Piano sombre, Guitare d'Atlanta, Cloches), composées et jouées en direct par
`ambiance.js` (Web Audio : 808 avec glides, rafales de charleston, clap, flûte/cloches/piano/guitare ; aucun fichier audio).
Ouvrir la playlist lance le son ; morceau suivant toutes les 3 minutes ; volume et morceau mémorisés.
Les navigateurs interdisent la lecture automatique : la musique reprend au premier clic si elle était active.

## Gamification

- XP + niveaux (Débutant → Légende) : on en gagne en ouvrant des photos et en débloquant des trophées
- 12 trophées (🏆 en haut à droite), progression sauvegardée dans le navigateur
- Secrets : un bouchon d'objectif caché dans le footer, et le code Konami (↑↑↓↓←→←→BA) qui active le mode argentique
