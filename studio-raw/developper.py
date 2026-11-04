#!/usr/bin/env python3
"""Studio RAW en ligne de commande (sans interface).

Exemples :
    python3 developper.py mon-preset.xmp ~/Shooting/*.CR3
    python3 developper.py mon-preset.xmp ~/Shooting/ -o ~/Exports --taille 2048 --qualite 90
"""
import argparse
import multiprocessing
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

from develop import SUPPORTED
from preset import PresetError, parse_preset
from worker import process_one


def main():
    ap = argparse.ArgumentParser(description="Applique un preset Lightroom à des RAW et exporte en JPG.")
    ap.add_argument("preset", help="preset Lightroom (.xmp, .lrtemplate, DNG…)")
    ap.add_argument("photos", nargs="+", help="fichiers RAW/JPG ou dossiers")
    ap.add_argument("-o", "--sortie", default=None, help="dossier d'export (défaut : <dossier des photos>/export)")
    ap.add_argument("--taille", type=int, default=None, help="grand côté en pixels (défaut : pleine résolution)")
    ap.add_argument("--qualite", type=int, default=92, help="qualité JPG 50–100 (défaut 92)")
    ap.add_argument("--wb-appareil", action="store_true", help="garder la balance des blancs de l'appareil")
    ap.add_argument("--processus", type=int, default=max(1, min(3, (os.cpu_count() or 2) - 1)),
                    help="photos traitées en parallèle")
    a = ap.parse_args()

    try:
        settings, name = parse_preset(Path(a.preset).read_bytes(), a.preset)
    except (OSError, PresetError) as e:
        sys.exit(f"Preset : {e}")
    files = []
    for p in map(Path, a.photos):
        if p.is_dir():
            files += sorted(f for f in p.iterdir() if f.suffix.lower() in SUPPORTED and not f.name.startswith("."))
        elif p.suffix.lower() in SUPPORTED:
            files.append(p)
    if not files:
        sys.exit("Aucune photo trouvée.")
    out = Path(a.sortie) if a.sortie else files[0].parent / "export"
    out.mkdir(parents=True, exist_ok=True)
    opts = {"long_side": a.taille, "quality": a.qualite, "keep_camera_wb": a.wb_appareil}
    print(f"Preset « {name} » → {len(files)} photo(s) → {out}")

    t0, errors = time.time(), 0
    with ProcessPoolExecutor(max_workers=a.processus, mp_context=multiprocessing.get_context("spawn")) as pool:
        futs = [pool.submit(process_one, str(f), str(out / (f.stem + ".jpg")), None, settings, opts, i)
                for i, f in enumerate(files)]
        for n, fut in enumerate(as_completed(futs), 1):
            r = fut.result()
            if r["ok"]:
                print(f"[{n}/{len(files)}] {r['source']} → {r['name']}")
            else:
                errors += 1
                print(f"[{n}/{len(files)}] ÉCHEC {r['source']} : {r['error']}", file=sys.stderr)
    print(f"Terminé en {time.time() - t0:.0f} s" + (f" ({errors} échec(s))" if errors else ""))


if __name__ == "__main__":
    main()
