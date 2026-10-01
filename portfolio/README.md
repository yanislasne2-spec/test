# Portfolio photo de Yanis Lasne

Site statique, sans build : `index.html`, `style.css`, `app.js`, `game.js`.

## Ajouter tes photos

1. Dépose tes images dans le bon dossier :
   - `photos/sport/` (basket)
   - `photos/portrait/`
   - `photos/concert/`
   - `photos/paysage/`
2. Lance `python3 generer-galeries.py` : `photos.js` est mis à jour automatiquement.
3. (Optionnel) dans `photos.js`, ajoute une `caption` (légende) et un `exif` (ex. `"1/1000 · f/2.8 · ISO 3200"`).
   Le script garde ce que tu as écrit.

Une pellicule « Bientôt » se déverrouille automatiquement dès qu'elle contient au moins une photo.
Les premières photos servent aussi de fond animé au hero.

Conseil : exporte en JPG, environ 2000 px sur le grand côté, qualité 80 : le site reste rapide.

## Personnaliser

Tout se règle dans `config.js` : email, Instagram, photo « à propos », textes, couleurs et intros des galeries.

## Tester en local

```bash
cd portfolio
python3 -m http.server 8000
# puis ouvre http://localhost:8000
```

## Gamification

- XP + niveaux (Rookie → Hall of Fame) : on en gagne en ouvrant des photos et en débloquant des trophées
- 12 trophées (🏆 en haut à droite), progression sauvegardée dans le navigateur
- Mini-jeu **Shootaround** : basket façon lance-pierre, avec un shot clock de 24 s et un record
- Secrets : un ballon caché dans le footer, et le code Konami (↑↑↓↓←→←→BA) qui active le mode argentique
