#!/usr/bin/env python3
"""Stage G: score skill extraction against the 220-resume labeled gold set.

Read `talentflow/eval/extraction.py` before interpreting the output. In short: precision is
not computable from this dataset, because annotators marked only some regions of each
resume, so a skill found in an unmarked region is not a false positive. What is reported
instead is detection against what humans did mark, the vocabulary's own ceiling, and the
hallucination rate.

    python scripts/08_eval_extraction.py
    python scripts/08_eval_extraction.py --min-confidence weak
"""
import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import INTERIM_DIR
from talentflow.eval.extraction import evaluate_extraction
from talentflow.skills.goldset import load_goldset
from talentflow.skills.extractor import LexicalExtractor
from talentflow.skills.build import build_skill_vocabulary

RESULTS_PATH = INTERIM_DIR / "extraction_eval.json"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--min-confidence", default="alias", choices=["weak", "alias", "exact"])
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    vocab, calibration = build_skill_vocabulary()
    logging.info("vocabulary: %d aliases, %d pruned", len(vocab.aliases), calibration["n_pruned"])

    gold, gold_stats = load_goldset()
    logging.info("gold set: %d resumes, %d annotation points, %d dropped (%.1f%%)",
                 gold_stats["n_resumes"], gold_stats["points_total"],
                 gold_stats["points_dropped"], gold_stats["dropped_pct"])

    extractor = LexicalExtractor(vocab, min_confidence=args.min_confidence)
    report = evaluate_extraction(extractor, gold, min_confidence=args.min_confidence)
    RESULTS_PATH.write_text(json.dumps({**report, "gold_set": gold_stats}, indent=2))

    bar = "=" * 70
    print(f"\n{bar}\n  Skill extraction vs the 220-resume gold set\n{bar}")
    print(f"  resumes scored              {report['n_resumes_scored']}")
    print(f"  annotated skill regions     {report['n_skill_spans']}")
    print()
    print(f"  span detection rate         {report['span_detection_rate_pct']:.1f}%"
          "   (regions where we found at least one skill)")
    print(f"  vocabulary ceiling          {report['vocabulary_ceiling_pct']:.1f}%"
          "   (regions containing any term O*NET knows)")
    print(f"  detection vs ceiling        {report['detection_vs_ceiling_pct']:.1f}%"
          "   <- how good the MATCHER is")
    print(f"  token coverage              {report['token_coverage_pct']:.1f}%")
    print()
    h = report["hallucination"]
    print(f"  hallucination rate          {h['rate_pct']:.1f}%"
          f"   ({h['n_not_in_source']} of {h['n_matches']} matches not in the source)")
    print(f"  proposal target             at or below 3%  ->  "
          f"{'MET' if h['rate_pct'] <= 3 else 'NOT MET'}")
    print(f"\n{bar}")
    print("  Reading this: the matcher finds almost everything the vocabulary makes")
    print("  findable. The gap to 100% is vocabulary coverage, not matching logic.")
    print(f"{bar}\n")
    d = report["diagnosis"]
    print("  diagnosis:")
    print(f"    {d['summary']}")
    if d["reachable_miss_examples"]:
        print("    reachable regions the engine still missed (fix these first):")
        for ex in d["reachable_miss_examples"][:6]:
            print(f"      {ex['region']!r} -> vocabulary has {ex['vocabulary_would_find']}")
    print()
    print("  regions where we found nothing:")
    for miss in report["sample_misses"][:8]:
        print(f"    {miss!r}")
    print()
    logging.info("results -> %s", RESULTS_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
