#!/usr/bin/env python3
"""Stage A: Kaggle resume PDFs -> raw text JSONL. Slow, run once.

    python scripts/01_extract_pdfs.py                  # full run, resumable
    python scripts/01_extract_pdfs.py --limit 50       # smoke test
    python scripts/01_extract_pdfs.py --max-seconds 30 # stop cleanly, rerun to continue
"""
import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.ingest.corpus import RAW_PATH, build_raw_corpus


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--fresh", action="store_true", help="ignore existing output")
    ap.add_argument("--workers", type=int, default=None)
    ap.add_argument("--max-seconds", type=float, default=None)
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    _, finished = build_raw_corpus(
        limit=args.limit, resume=not args.fresh,
        workers=args.workers, max_seconds=args.max_seconds,
    )
    logging.info("raw text -> %s", RAW_PATH)
    if not finished:
        logging.warning("partial run -- rerun the same command to continue")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
