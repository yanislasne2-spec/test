#!/usr/bin/env python3
"""Studio RAW : interface web locale.

    python3 app.py            → ouvre http://localhost:8765 dans le navigateur

Tu glisses ton preset Lightroom (.xmp) et tes RAW, l'appli les développe et les exporte en JPG
dans le dossier « Exports Studio RAW » (dans tes Images), + un .zip à télécharger.
"""
import io
import multiprocessing
import os
import platform
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
import zipfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_file, send_from_directory

from develop import SUPPORTED, develop, save_jpeg
from preset import PresetError, parse_preset
from worker import process_one

HERE = Path(__file__).resolve().parent
WORK = HERE / "_travail"
PICTURES = next((p for p in (Path.home() / "Pictures", Path.home() / "Images") if p.is_dir()), HERE)
EXPORTS = Path(os.environ.get("STUDIO_RAW_EXPORTS", PICTURES / "Exports Studio RAW"))
PORT = int(os.environ.get("STUDIO_RAW_PORT", "8765"))
WORKERS = int(os.environ.get("STUDIO_RAW_WORKERS", max(1, min(3, (os.cpu_count() or 2) - 1))))

app = Flask(__name__, static_folder=None)
jobs = {}
lock = threading.Lock()
pool = None


def safe_name(name):
    name = Path(name.replace("\\", "/")).name
    return re.sub(r"[^\w.\- ()]+", "_", name).strip() or "photo"


def options_from(form):
    size = form.get("taille", "")
    return {
        "long_side": int(size) if size.isdigit() else None,
        "quality": max(50, min(100, int(form.get("qualite", "92") or 92))),
        "keep_camera_wb": form.get("wb_appareil") in ("1", "true", "on"),
    }


def read_preset():
    f = request.files.get("preset")
    if not f:
        abort(400, "Ajoute ton preset (.xmp)")
    try:
        return parse_preset(f.read(), f.filename or "preset.xmp")
    except PresetError as e:
        abort(400, str(e))


@app.errorhandler(400)
def bad_request(e):
    return jsonify(error=e.description), 400


@app.get("/")
def index():
    return send_from_directory(HERE / "static", "index.html")


@app.get("/static/<path:p>")
def static_files(p):
    return send_from_directory(HERE / "static", p)


@app.post("/api/preset")
def api_preset():
    settings, name = read_preset()
    keys = sorted(k for k, v in settings.items() if isinstance(v, (int, float, list)) and not isinstance(v, bool)
                  and v not in (0, 0.0, []))
    return jsonify(name=name, count=len(keys), keys=keys[:60],
                   wb=str(settings.get("WhiteBalance", "As Shot")),
                   temperature=settings.get("Temperature"))


@app.post("/api/apercu")
def api_preview():
    """Aperçu rapide d'une photo : avant (rendu neutre) ou après (avec le preset)."""
    settings, _ = read_preset()
    photo = request.files.get("photo")
    if not photo:
        abort(400, "Ajoute une photo")
    opts = options_from(request.form)
    tmp = WORK / "apercu"
    tmp.mkdir(parents=True, exist_ok=True)
    src = tmp / f"{uuid.uuid4().hex}_{safe_name(photo.filename)}"
    photo.save(src)
    try:
        im = develop(src, {} if request.form.get("avant") == "1" else settings,
                     long_side=1600, preview=True, keep_camera_wb=opts["keep_camera_wb"])
    except Exception as e:  # noqa: BLE001
        abort(400, f"Photo illisible : {e}")
    finally:
        src.unlink(missing_ok=True)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=88)
    buf.seek(0)
    return send_file(buf, mimetype="image/jpeg")


@app.post("/api/jobs")
def create_job():
    settings, name = read_preset()
    jid = time.strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6]
    folder_name = f"{time.strftime('%Y-%m-%d %Hh%M')} - {safe_name(name)}"
    out = EXPORTS / folder_name
    n = 2
    while out.exists():
        out = EXPORTS / f"{folder_name} ({n})"
        n += 1
    job = {"id": jid, "preset": name, "settings": settings, "opts": options_from(request.form),
           "in": WORK / jid, "out": out, "thumbs": WORK / jid / "_vignettes",
           "files": [], "items": [], "errors": [], "started": False, "done": 0, "t0": None, "t1": None}
    job["thumbs"].mkdir(parents=True, exist_ok=True)
    with lock:
        jobs[jid] = job
    return jsonify(id=jid)


def get_job(jid):
    job = jobs.get(jid)
    if not job:
        abort(404)
    return job


@app.post("/api/jobs/<jid>/photos")
def add_photo(jid):
    job = get_job(jid)
    f = request.files.get("photo")
    if not f or not f.filename:
        abort(400, "Fichier manquant")
    name = safe_name(f.filename)
    if Path(name).suffix.lower() not in SUPPORTED:
        abort(400, f"{name} : format non pris en charge")
    dest = job["in"] / name
    stem, n = dest.stem, 2
    while dest.exists():
        dest = job["in"] / f"{stem}-{n}{dest.suffix}"
        n += 1
    f.save(dest)
    with lock:
        job["files"].append(dest)
    return jsonify(ok=True)


def _finished(job, fut, src):
    try:
        res = fut.result()
    except Exception as e:  # noqa: BLE001
        res = {"ok": False, "source": src.name, "error": f"{type(e).__name__}: {e}"}
    with lock:
        job["done"] += 1
        if res.get("ok"):
            job["items"].append(res)
        else:
            job["errors"].append(f"{res['source']} — {res['error']}")
        if job["done"] == len(job["files"]):
            job["t1"] = time.time()
            for p in job["files"]:  # les copies des RAW ne servent plus
                p.unlink(missing_ok=True)


@app.post("/api/jobs/<jid>/start")
def start_job(jid):
    job = get_job(jid)
    if job["started"]:
        return jsonify(ok=True)
    if not job["files"]:
        abort(400, "Aucune photo reçue")
    job["out"].mkdir(parents=True, exist_ok=True)
    job["started"], job["t0"] = True, time.time()
    used = set()
    for i, src in enumerate(sorted(job["files"], key=lambda p: p.name.lower())):
        out_name = src.stem + ".jpg"
        while out_name.lower() in used:
            out_name = f"{src.stem}-{src.suffix[1:].lower()}.jpg"
        used.add(out_name.lower())
        fut = pool.submit(process_one, str(src), str(job["out"] / out_name), str(job["thumbs"] / out_name),
                          job["settings"], job["opts"], i)
        fut.add_done_callback(lambda f, s=src: _finished(job, f, s))
    return jsonify(ok=True)


@app.get("/api/jobs/<jid>")
def job_status(jid):
    job = get_job(jid)
    with lock:
        total, done = len(job["files"]), job["done"]
        t0, t1 = job["t0"], job["t1"]
        return jsonify(total=total, done=done, finished=job["started"] and done == total,
                       items=sorted((i["name"] for i in job["items"]), key=str.lower),
                       errors=list(job["errors"]), dossier=str(job["out"]), preset=job["preset"],
                       secondes=round((t1 or time.time()) - t0, 1) if t0 else 0)


@app.get("/api/jobs/<jid>/vignette/<name>")
def thumb(jid, name):
    return send_from_directory(get_job(jid)["thumbs"], safe_name(name))


@app.get("/api/jobs/<jid>/photo/<name>")
def photo(jid, name):
    return send_from_directory(get_job(jid)["out"], safe_name(name))


@app.get("/api/jobs/<jid>/zip")
def job_zip(jid):
    job = get_job(jid)
    zpath = WORK / jid / f"{job['out'].name}.zip"
    if not zpath.exists():
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_STORED) as z:  # des JPG : inutile de recompresser
            for item in sorted(job["items"], key=lambda i: i["name"].lower()):
                z.write(job["out"] / item["name"], item["name"])
    return send_file(zpath, as_attachment=True, download_name=zpath.name)


@app.post("/api/jobs/<jid>/ouvrir")
def open_folder(jid):
    folder = str(get_job(jid)["out"])
    system = platform.system()
    cmd = ["open", folder] if system == "Darwin" else ["explorer", folder] if system == "Windows" else ["xdg-open", folder]
    try:
        subprocess.Popen(cmd)
    except OSError:
        abort(400, f"Ouvre ce dossier à la main : {folder}")
    return jsonify(ok=True)


def main():
    global pool
    shutil.rmtree(WORK, ignore_errors=True)
    WORK.mkdir(parents=True, exist_ok=True)
    pool = ProcessPoolExecutor(max_workers=WORKERS, mp_context=multiprocessing.get_context("spawn"))
    url = f"http://localhost:{PORT}"
    print(f"\n  Studio RAW est prêt : {url}\n  Exports : {EXPORTS}\n  (ferme cette fenêtre pour quitter)\n")
    if "--sans-navigateur" not in sys.argv:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    app.run(host="127.0.0.1", port=PORT, threaded=True)


if __name__ == "__main__":
    main()
