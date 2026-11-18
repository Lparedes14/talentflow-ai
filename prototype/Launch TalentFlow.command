#!/bin/bash
# Double-click this file in Finder to open the TalentFlow prototype in your browser.
#
# First run takes a couple of minutes: it creates a private Python environment inside this
# folder and installs what the app needs. After that it opens in a few seconds.
#
# Nothing here touches your system Python. Everything lives in ./.venv, and deleting that
# folder undoes all of it.

set -e
cd "$(dirname "$0")"

echo "TalentFlow prototype"
echo "===================="
echo

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is not installed."
  echo "Install it from https://www.python.org/downloads/ and run this again."
  echo
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

if [ ! -d ".venv" ]; then
  echo "First run: setting up (this takes a minute or two)..."
  python3 -m venv .venv
fi

source .venv/bin/activate

# Marker file so the slow install runs once, not on every launch.
if [ ! -f ".venv/.installed" ] || [ requirements.txt -nt ".venv/.installed" ]; then
  echo "Installing packages..."
  python -m pip install --quiet --upgrade pip
  python -m pip install --quiet -r requirements.txt streamlit
  touch .venv/.installed
  echo "Done."
  echo
fi

if [ ! -f "data/interim/resumes.jsonl" ]; then
  echo "The reference corpus has not been built yet."
  echo "That is a one-time step and takes about 4 minutes."
  echo
  read -p "Build it now? [y/N] " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    python scripts/01_extract_pdfs.py
    python scripts/02_build_corpus.py
    python scripts/03_build_chunks.py
  else
    echo "Cannot start without it. Exiting."
    read -n 1 -s -r -p "Press any key to close..."
    exit 1
  fi
fi

echo "Starting. Your browser will open in a moment."
echo "Leave this window open while you use the app. Close it to stop."
echo
exec python -m streamlit run app.py --browser.gatherUsageStats false
