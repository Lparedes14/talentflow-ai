#!/usr/bin/env python3
"""Stage F: build the O*NET vocabulary, calibrate it, and extract skills from every resume.

This is the proposal's `O*NET word match` baseline -- the floor every later extraction
method has to beat. It is deliberately dumb: no model, no embeddings, just a controlled
vocabulary and longest-match-first scanning. Its value is that it is fast, fully
explainable, and every hit carries the exact span that produced it.

    python scripts/06_extract_skills.py
    python scripts/06_extract_skills.py --min-confidence weak   # see what the filter costs
"""
import argparse
import json
import logging
import sys
from collections import Counter
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import INTERIM_DIR
from talentflow.ingest.corpus import iter_corpus
from talentflow.skills.build import build_skill_vocabulary

SKILLS_PATH = INTERIM_DIR / "resume_skills.jsonl"
VOCAB_REPORT_PATH = INTERIM_DIR / "vocabulary_report.json"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--min-confidence", default="alias", choices=["weak", "alias", "exact"])
    ap.add_argument("--keep-generic", action="store_true",
                    help="keep category terms like 'Email software'")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    records = list(iter_corpus())
    logging.info("loaded %d resumes", len(records))

    vocab, report = build_skill_vocabulary()
    logging.info("vocabulary: %d aliases, %d pruned across corpora %s",
                 len(vocab.aliases), report["n_pruned"], report["corpus_sizes"])

    per_resume, categories, top = [], Counter(), Counter()
    confidences: Counter[str] = Counter()

    with SKILLS_PATH.open("w") as fh:
        for record in records:
            matches = vocab.match_resume(
                record,
                skip_generic=not args.keep_generic,
                min_confidence=args.min_confidence,
            )
            distinct = {m.name for m in matches}
            per_resume.append(len(distinct))
            top.update(distinct)
            confidences.update(m.confidence for m in matches)
            for m in matches:
                categories[m.term.category] += 1
            fh.write(json.dumps({
                "resume_id": record["resume_id"],
                "category": record["category"],
                "n_matches": len(matches),
                "n_distinct_skills": len(distinct),
                "skills": [
                    {
                        "name": m.name, "onet_domain": m.term.onet_domain,
                        "skill_category": m.term.category, "confidence": m.confidence,
                        "matched_text": m.matched_text, "alias": m.alias,
                        "section": m.section,
                        "char_start": m.char_start, "char_end": m.char_end,
                    }
                    for m in matches
                ],
            }) + "\n")

    per_resume.sort()
    q = lambda p: per_resume[int(p * len(per_resume))]  # noqa: E731
    summary = {
        "n_resumes": len(records),
        "vocabulary": vocab.stats(),
        "calibration": {k: v for k, v in report.items() if k != "pruned"},
        "min_confidence": args.min_confidence,
        "skills_per_resume": {
            "min": per_resume[0], "p25": q(.25), "median": q(.5),
            "p75": q(.75), "p95": q(.95), "max": per_resume[-1],
        },
        "resumes_with_no_skills": sum(1 for x in per_resume if x == 0),
        "matches_by_confidence": dict(confidences),
        "matches_by_category": dict(categories),
        "top_skills": top.most_common(25),
    }
    VOCAB_REPORT_PATH.write_text(json.dumps({**summary, "pruned_aliases": report["pruned"]}, indent=2))

    logging.info("skills -> %s", SKILLS_PATH)
    logging.info("report -> %s", VOCAB_REPORT_PATH)
    print(json.dumps({k: v for k, v in summary.items() if k != "top_skills"}, indent=2))
    print("\ntop skills across the corpus:")
    for name, count in summary["top_skills"]:
        print(f"  {count:5}  {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
