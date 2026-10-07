#!/usr/bin/env python3
"""Scanne photos/<galerie>/ et met à jour photos.js.

Usage :  python3 generer-galeries.py

- Ajoute les nouvelles images (jpg, jpeg, png, webp, avif) triées par nom.
- Garde les légendes / exif déjà écrits dans photos.js.
- Retire les entrées dont le fichier n'existe plus.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PHOTOS_DIR = ROOT / "photos"
OUT = ROOT / "photos.js"
EXT = {".jpg", ".jpeg", ".png", ".webp", ".avif"}
GALLERIES = ["sport", "portrait", "concert", "paysage"]

src = OUT.read_text(encoding="utf-8")
match = re.search(r"/\*DATA\*/(.*)/\*END\*/", src, re.S)
current = json.loads(match.group(1)) if match else {}

data = {}
for g in GALLERIES + sorted(p.name for p in PHOTOS_DIR.iterdir() if p.is_dir() and p.name not in GALLERIES):
    known = {e["src"]: e for e in current.get(g, [])}
    folder = PHOTOS_DIR / g
    files = sorted(f for f in folder.iterdir() if f.suffix.lower() in EXT) if folder.exists() else []
    data[g] = [known.get(f"photos/{g}/{f.name}", {"src": f"photos/{g}/{f.name}", "alt": "", "caption": "", "exif": ""}) for f in files]
    print(f"{g:>10} : {len(data[g])} photo(s)")

body = json.dumps(data, ensure_ascii=False, indent=2)
OUT.write_text(src[: match.start()] + "/*DATA*/" + body + "/*END*/" + src[match.end():] if match
               else f"window.PHOTOS = /*DATA*/{body}/*END*/;\n", encoding="utf-8")
print("photos.js mis à jour ✔")
