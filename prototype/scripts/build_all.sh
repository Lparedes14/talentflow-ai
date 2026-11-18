#!/usr/bin/env bash
#
# One command to build everything the app needs, in order. Safe to re-run: every stage only
# redoes its own work, so a second run is fast. After this, start the app with:
#
#     streamlit run app.py
#
# On Windows, run this in Git Bash, or use scripts/build_all.ps1 in PowerShell.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -d .venv ]; then
  echo "Creating the virtual environment..."
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate

echo "Installing packages..."
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt

echo "Building the corpus and the skill data (first run is a few minutes)..."
python scripts/01_extract_pdfs.py
python scripts/02_build_corpus.py
python scripts/03_build_chunks.py
python scripts/04_build_index.py --backend lsa
python scripts/06_extract_skills.py
python scripts/10_extract_posting_skills.py --company "Capital One"

echo
echo "Build complete. Next steps:"
echo "  streamlit run app.py          # the app (resume upload, and the video tool)"
echo "  ./scripts/run.sh 08           # extraction accuracy vs the gold set"
echo "  ./scripts/run.sh 11 --demo    # matching, both directions"
