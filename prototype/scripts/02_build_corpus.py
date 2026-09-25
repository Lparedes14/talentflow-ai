#!/usr/bin/env python3
"""Stage B: raw text -> normalized, section-segmented corpus + quality report.

Cheap. Rerun this after any change to normalization or section rules.

    python scripts/02_build_corpus.py
"""
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.ingest.corpus import (
    CORPUS_PATH, RAW_PATH, REPORT_PATH, build_clean_corpus, quality_report,
)


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not RAW_PATH.exists():
        logging.error("no raw text at %s -- run scripts/01_extract_pdfs.py first", RAW_PATH)
        return 1

    build_clean_corpus()
    report = quality_report()
    REPORT_PATH.write_text(json.dumps(report, indent=2))

    logging.info("corpus -> %s", CORPUS_PATH)
    logging.info("report -> %s", REPORT_PATH)
    summary = {k: v for k, v in report.items() if k not in ("per_category", "problem_ids")}
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
