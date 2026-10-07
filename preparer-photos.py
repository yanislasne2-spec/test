#!/usr/bin/env python3
"""Prépare les photos déposées dans photos/<galerie>/ puis met à jour le site.

Lancé automatiquement par GitHub (.github/workflows/photos.yml) après chaque dépôt
de photos, ou à la main :  python3 preparer-photos.py

Pour chaque galerie :
- convertit les nouvelles photos (JPG, PNG, WEBP, HEIC de l'iPhone…) en JPG,
  redressées, 1800 px max sur le grand côté, nommées <galerie>-NN.jpg à la suite ;
- réduit les photos déjà nommées si elles sont trop lourdes ;
puis met à jour photos.js et le numéro de version des pages (cache des navigateurs).
"""
import re
import subprocess
import sys
import time
from pathlib import Path

from PIL import Image, ImageOps

try:  # photos iPhone (HEIC)
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent
PHOTOS = ROOT / "photos"
GALLERIES = ["sport", "portrait", "concert", "paysage"]
IN_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".avif", ".tif", ".tiff"}
MAX_SIDE = 1800
MAX_BYTES = 900_000


def save(im, dest):
    im = ImageOps.exif_transpose(im).convert("RGB")
    im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    im.save(dest, "JPEG", quality=84, optimize=True, progressive=True)


changed = False
for g in GALLERIES:
    folder = PHOTOS / g
    if not folder.exists():
        continue
    named = re.compile(rf"^{g}-(\d+)\.jpg$")
    numbers = [int(m.group(1)) for f in folder.iterdir() if (m := named.match(f.name))]
    nxt = max(numbers, default=0) + 1
    width = max(2, len(str(nxt + 50)))

    for f in sorted(folder.iterdir(), key=lambda p: p.name.lower()):
        if f.name.startswith(".") or f.suffix.lower() not in IN_EXT:
            continue
        if named.match(f.name):
            # déjà au bon nom : on réduit seulement si la photo est trop lourde
            with Image.open(f) as im:
                big = max(im.size) > MAX_SIDE + 50 or f.stat().st_size > MAX_BYTES
                if big:
                    save(im, f)
                    print(f"réduite   {f.relative_to(ROOT)}")
                    changed = True
            continue
        dest = folder / f"{g}-{nxt:0{width}d}.jpg"
        try:
            with Image.open(f) as im:
                save(im, dest)
        except Exception as e:  # fichier illisible : mis de côté, sans bloquer les autres
            rejected = ROOT / "photos-refusees"
            rejected.mkdir(exist_ok=True)
            f.rename(rejected / f.name)
            print(f"refusée   {f.name} → photos-refusees/ ({e})", file=sys.stderr)
            continue
        f.unlink()
        print(f"ajoutée   {f.name} → {dest.relative_to(ROOT)}")
        nxt += 1
        changed = True

# photos.js
before = (ROOT / "photos.js").read_text(encoding="utf-8")
subprocess.run([sys.executable, str(ROOT / "generer-galeries.py")], check=True)
if (ROOT / "photos.js").read_text(encoding="utf-8") == before and not changed:
    print("rien à mettre à jour")
    sys.exit(0)

# nouveau numéro de version : les visiteurs rechargent le CSS/JS au lieu de garder l'ancien cache
version = time.strftime("%Y%m%d%H%M")
for page in ["index.html", "galerie.html"]:
    p = ROOT / page
    s = p.read_text(encoding="utf-8")
    s2 = re.sub(r'((?:style\.css|config\.js|photos\.js|app\.js|ambiance\.js))\?v=[\w.-]+', rf"\1?v={version}", s)
    if s2 != s:
        p.write_text(s2, encoding="utf-8")

print("terminé" + (" (photos modifiées)" if changed else ""))
