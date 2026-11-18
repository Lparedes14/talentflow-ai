"""Central paths. Everything resolves relative to the repo, no absolute paths in code."""
from pathlib import Path

PROTOTYPE_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = PROTOTYPE_ROOT.parent

KAGGLE_ROOT = PROJECT_ROOT / "KaggleDOwnloads"
RESUME_PDF_DIR = KAGGLE_ROOT / "KaggleResumeDataset" / "data" / "data"
RESUME_CSV = KAGGLE_ROOT / "KaggleResumeDataset" / "Resume" / "Resume.csv"
POSTINGS_ROOT = KAGGLE_ROOT / "linkedInJobPostings"
ONET_ROOT = PROJECT_ROOT / "ONET"          # O*NET 31.0, CSV distribution

DATA_DIR = PROTOTYPE_ROOT / "data"
INTERIM_DIR = DATA_DIR / "interim"
PROCESSED_DIR = DATA_DIR / "processed"

for _d in (INTERIM_DIR, PROCESSED_DIR):
    _d.mkdir(parents=True, exist_ok=True)
