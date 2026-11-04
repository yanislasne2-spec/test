# Studio RAW

Tu glisses **ton preset Lightroom** et **toutes les photos RAW d'un shooting**,
l'appli applique le preset à chaque photo et les **exporte en JPG**. Tout tourne sur ton ordinateur :
aucune photo n'est envoyée sur internet.

## Lancer l'appli

1. Installe Python 3 si ce n'est pas déjà fait : https://www.python.org/downloads/
   (sur Windows, coche « Add Python to PATH »).
2. Télécharge ce dossier `studio-raw` (sur GitHub : bouton **Code → Download ZIP**, puis garde le dossier `studio-raw`).
3. Double-clique sur :
   - **Mac** : `Lancer Studio RAW (Mac).command`
     (si macOS bloque : clic droit → **Ouvrir** → **Ouvrir**, une seule fois) ;
   - **Windows** : `Lancer Studio RAW (Windows).bat`.

   La première fois, il installe ce qu'il faut (≈ 1 min). Ensuite la page s'ouvre toute seule
   dans ton navigateur : http://localhost:8765

## Utilisation

1. **Preset** : glisse ton fichier `.xmp` (presets Lightroom Classic / Lightroom / Camera Raw).
   Marchent aussi : les anciens `.lrtemplate`, et les presets vendus en `.dng`.
   *Où trouver tes presets ?* Dans Lightroom Classic : clic droit sur le preset → **Afficher dans le Finder / l'Explorateur**.
   Dans Lightroom (CC) : **Fichier → Exporter le profil/preset**.
2. **Photos** : glisse tes RAW (CR2, CR3, NEF, ARW, RAF, DNG, ORF, RW2… et même des JPG), ou un dossier entier.
3. **Export** : taille (pleine résolution, 2048 px pour Instagram…), qualité JPG, et option
   « Garder la balance des blancs de l'appareil » (utile si le preset impose une température
   qui ne va pas avec ta lumière).
4. **Aperçu avant / après** sur la première photo pour vérifier, puis **Développer et exporter**.

Les JPG arrivent dans **Images → Exports Studio RAW → `<date> - <nom du preset>`**
(bouton « Ouvrir le dossier »), et tu peux aussi tout télécharger en `.zip`.

Les photos sont développées en parallèle (≈ 5 à 15 s par photo en pleine résolution selon l'ordinateur,
beaucoup plus rapide en 2048 px).

## Réglages du preset appliqués

Balance des blancs (température / teinte), exposition, contraste, hautes lumières, ombres, blancs, noirs,
courbe des tonalités (paramétrique, points, et courbes rouge / vert / bleu), texture, clarté, correction du voile,
vibrance, saturation, TSL (teinte / saturation / luminance des 8 couleurs), noir & blanc (avec mélangeur),
étalonnage couleur (ombres / tons moyens / hautes lumières / global) et ancien virage partiel,
vignetage, grain, netteté, réduction du bruit (légère).

**Pas pris en charge** : masques et retouches locales (ciel, sujet, pinceau, dégradés), profils Adobe
et LUT de profil, corrections d'objectif, recadrage. Le rendu est **très proche** de Lightroom mais pas identique
au pixel près : Lightroom utilise des algorithmes et des profils couleur propres à Adobe.
Fais un aperçu, et si un réglage te semble trop fort ou pas assez, dis-le-moi : on peut ajuster.

## En ligne de commande (optionnel)

```bash
python3 developper.py mon-preset.xmp ~/Shooting/ --taille 2048 --qualite 90
```

Les JPG sont écrits dans `~/Shooting/export/` (ou le dossier donné avec `-o`).
Si [exiftool](https://exiftool.org) est installé, les métadonnées (date, appareil, objectif…) sont recopiées dans les JPG.
