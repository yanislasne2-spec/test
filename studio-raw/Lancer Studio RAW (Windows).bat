@echo off
rem Double-clique sur ce fichier pour ouvrir Studio RAW (la 1re fois : installation automatique, ~1 min).
cd /d "%~dp0"
where py >nul 2>nul || (
  echo Python 3 n'est pas installe : telecharge-le sur https://www.python.org/downloads/ ^(coche "Add Python to PATH"^) puis relance.
  pause & exit /b 1
)
if not exist .venv\Scripts\python.exe (
  echo Premiere ouverture : installation de Studio RAW...
  py -3 -m venv .venv || (pause & exit /b 1)
)
.venv\Scripts\python -m pip install -q --upgrade pip >nul 2>nul
.venv\Scripts\python -m pip install -q -r requirements.txt || (pause & exit /b 1)
.venv\Scripts\python app.py
pause
