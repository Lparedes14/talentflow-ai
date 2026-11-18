# One command to build everything the app needs. Run from the prototype folder in PowerShell.
# Safe to re-run. After this, start the app with:  streamlit run app.py
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path .venv)) {
    Write-Host "Creating the virtual environment..."
    python -m venv .venv
}
.\.venv\Scripts\Activate.ps1

Write-Host "Installing packages..."
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt

Write-Host "Building the corpus and the skill data (first run is a few minutes)..."
python scripts\01_extract_pdfs.py
python scripts\02_build_corpus.py
python scripts\03_build_chunks.py
python scripts\04_build_index.py --backend lsa
python scripts\06_extract_skills.py
python scripts\10_extract_posting_skills.py --company "Capital One"

Write-Host ""
Write-Host "Build complete. Next steps:"
Write-Host "  streamlit run app.py          # the app (resume upload, and the video tool)"
Write-Host "  .\scripts\run.ps1 08          # extraction accuracy vs the gold set"
Write-Host "  .\scripts\run.ps1 11 --demo   # matching, both directions"
