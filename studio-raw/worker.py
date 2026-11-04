"""Traitement d'une photo, exécuté dans un processus séparé (plusieurs photos en parallèle)."""
from pathlib import Path

from PIL import Image

from develop import develop, save_jpeg


def process_one(src, dest, thumb, settings, opts, seed=0):
    src, dest = Path(src), Path(dest)
    try:
        im = develop(src, settings, long_side=opts.get("long_side"),
                     keep_camera_wb=opts.get("keep_camera_wb", False), seed=seed)
        save_jpeg(im, dest, source=src, quality=opts.get("quality", 92))
        if thumb:
            im.thumbnail((480, 480), Image.LANCZOS)
            im.save(thumb, "JPEG", quality=80)
        return {"ok": True, "source": src.name, "name": dest.name, "size": list(im.size)}
    except Exception as e:  # une photo illisible ne bloque pas les autres
        msg = str(e)
        if type(e).__name__.startswith("LibRaw"):
            msg = "RAW illisible (fichier abîmé ou appareil trop récent pour LibRaw : mets à jour rawpy)"
        return {"ok": False, "source": src.name, "error": msg}
