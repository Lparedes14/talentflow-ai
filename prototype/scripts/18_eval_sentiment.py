#!/usr/bin/env python3
"""Stage O: measure sentiment against MOSEI. Task 1.

    python scripts/18_eval_sentiment.py --data path/to/mosei.csv
    python scripts/18_eval_sentiment.py --data docs/demos/sentiment_sample.csv --scorer vader

Getting the data: CMU-MOSEI comes from the CMU-MultimodalSDK, which downloads from a CMU
server, so gather it on a normal machine and export a CSV with 'text' and 'label' columns,
label from -3 to +3. VADER needs no key and sets the baseline; the LLM scorer uses whatever
key is in .env.
"""
import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import INTERIM_DIR
from talentflow.eval.sentiment import (
    LLMSentimentScorer, VaderScorer, evaluate_sentiment, load_sentiment_dataset,
)
from talentflow.llm import load_client

RESULTS_PATH = INTERIM_DIR / "sentiment_eval.json"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", required=True, help="CSV or JSONL with text and label columns")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--scorer", default="both", choices=["vader", "llm", "both"])
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    samples = load_sentiment_dataset(args.data, args.limit)
    logging.info("loaded %d samples from %s", len(samples), args.data)

    results = {}
    if args.scorer in ("vader", "both"):
        results["vader"] = evaluate_sentiment(VaderScorer(), samples)
    if args.scorer in ("llm", "both"):
        client = load_client()
        if client is None:
            print("\nNo API key, so only VADER ran. Add one to .env for the LLM scorer.\n")
        else:
            logging.info("scoring with %s (this makes one call per sample)", client.model)
            results["llm"] = evaluate_sentiment(LLMSentimentScorer(client), samples)

    bar = "=" * 66
    print(f"\n{bar}\n  Sentiment vs MOSEI ({len(samples)} samples)\n{bar}")
    print(f"  {'scorer':<8}{'n(bin)':>8}{'accuracy':>11}{'F1':>8}{'MAE':>8}")
    print("  " + "-" * 60)
    for name, r in results.items():
        print(f"  {name:<8}{r['n_binary']:>8}{r['accuracy']:>11.3f}{r['f1']:>8.3f}"
              f"{r['mae']:>8.3f}")
    print("  " + "-" * 60)
    print(f"  targets   accuracy >= {0.75}, F1 >= {0.72}, MAE <= {1.0}")
    if "llm" in results and "vader" in results:
        r = results["llm"]
        print(f"\n  LLM vs the VADER baseline: accuracy "
              f"{results['llm']['accuracy'] - results['vader']['accuracy']:+.3f}, "
              f"MAE {results['llm']['mae'] - results['vader']['mae']:+.3f}")
    print(bar)

    RESULTS_PATH.write_text(json.dumps({"data": args.data, "n": len(samples),
                                        "results": results}, indent=2))
    logging.info("results -> %s", RESULTS_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
