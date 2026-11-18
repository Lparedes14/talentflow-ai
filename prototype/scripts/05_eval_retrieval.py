#!/usr/bin/env python3
"""Stage E: compare retrieval backends with a paired significance test.

Two benchmarks, and the difference between them is the point:

- `--quick` runs 12 hand-written recruiter queries. 60 judgments, so one document moves the
  mean by 1.7 points. A smoke test, not evidence.
- The default is leave-one-out over all 2,484 resumes: each resume queries for others in
  its own category, ~12,400 judgments. Enough power to tell a 2-point difference from noise.

Systems are compared with a paired bootstrap on the same query set, so the reported
interval reflects the difference between systems and not the spread in query difficulty.

    python scripts/05_eval_retrieval.py
    python scripts/05_eval_retrieval.py --quick
"""
import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import INTERIM_DIR
from talentflow.embed import HybridIndex, VectorIndex, get_embedder
from talentflow.eval.retrieval import (
    leave_one_out_precision, paired_comparison, precision_at_k,
)
from talentflow.ingest.corpus import iter_corpus, read_jsonl

CHUNKS_PATH = INTERIM_DIR / "chunks.jsonl"
RESULTS_PATH = INTERIM_DIR / "retrieval_eval.json"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--n-components", type=int, default=128)
    ap.add_argument("--quick", action="store_true", help="12-query smoke test instead")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not CHUNKS_PATH.exists():
        logging.error("no chunks at %s -- run scripts/03_build_chunks.py first", CHUNKS_PATH)
        return 1

    chunks = list(read_jsonl(CHUNKS_PATH))
    records = list(iter_corpus())
    logging.info("%d chunks from %d resumes", len(chunks), len(records))

    tfidf = VectorIndex.build(get_embedder("tfidf"), chunks)
    lsa = VectorIndex.build(get_embedder("lsa", n_components=args.n_components), chunks)
    systems = {
        "tfidf": tfidf,
        f"lsa{args.n_components}": lsa,
        "hybrid_rrf": HybridIndex([tfidf, lsa]),
    }

    results = {}
    for name, index in systems.items():
        results[name] = (
            precision_at_k(index, k=args.k) if args.quick
            else leave_one_out_precision(index, records, k=args.k)
        )
        logging.info("%-12s P@%d = %.4f", name, args.k, results[name]["mean_precision_at_k"])

    print("\n" + "=" * 66)
    print(f"{'system':<14}{'P@' + str(args.k):>9}   {'judgments':>10}")
    print("-" * 66)
    for name, r in results.items():
        print(f"{name:<14}{r['mean_precision_at_k']:>9.4f}   "
              f"{r.get('n_judgments', len(r.get('per_query', []))):>10}")

    comparisons = []
    if not args.quick:
        print("\npaired bootstrap (same queries, 2000 resamples)")
        print("-" * 66)
        names = list(results)
        for a, b in [(names[0], names[1]), (names[0], names[2]), (names[1], names[2])]:
            c = paired_comparison(results[a], results[b], a, b)
            comparisons.append(c)
            verdict = "SIGNIFICANT" if c["significant"] else "within noise"
            print(f"  {a:<12} -> {b:<12} {c['delta_points']:+6.2f} pts  "
                  f"CI95 [{c['ci95_points'][0]:+.2f}, {c['ci95_points'][1]:+.2f}]  {verdict}")

    RESULTS_PATH.write_text(json.dumps({
        "benchmark": "quick_12_queries" if args.quick else "leave_one_out",
        "k": args.k,
        "n_components": args.n_components,
        "summary": {n: r["mean_precision_at_k"] for n, r in results.items()},
        "comparisons": comparisons,
        "per_category": {
            n: r.get("per_category") for n, r in results.items() if r.get("per_category")
        },
    }, indent=2))
    logging.info("results -> %s", RESULTS_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
