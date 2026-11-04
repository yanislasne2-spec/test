#!/bin/bash
# Double-clique sur ce fichier pour ouvrir Studio RAW (la 1re fois : installation automatique, ~1 min).
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 n'est pas installé : télécharge-le sur https://www.python.org/downloads/ puis relance."
  read -r -p "Appuie sur Entrée pour fermer…"; exit 1
fi
if [ ! -x .venv/bin/python ]; then
  echo "Première ouverture : installation de Studio RAW…"
  python3 -m venv .venv || exit 1
fi
.venv/bin/python -m pip install -q --upgrade pip >/dev/null 2>&1
.venv/bin/python -m pip install -q -r requirements.txt || { read -r -p "Installation impossible. Entrée pour fermer…"; exit 1; }
.venv/bin/python app.py
