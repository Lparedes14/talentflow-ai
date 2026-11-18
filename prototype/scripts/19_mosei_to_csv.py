#!/usr/bin/env python3
"""Stage P: turn CMU-MOSEI .csd files into the text,label CSV the sentiment eval reads.

Download CMU-MOSEI with the CMU-MultimodalSDK on a normal machine. You need two computational
sequences: the labels (sentiment) and the timestamped words. Point this at both.

    python scripts/19_mosei_to_csv.py \\
        --labels CMU_MOSEI_Labels.csd --words CMU_MOSEI_TimestampedWords.csd \\
        --out data/interim/mosei.csv --limit 3000

Then score it:  python scripts/18_eval_sentiment.py --data data/interim/mosei.csv
"""
import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.eval.mosei import align_mosei, write_csv


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--labels", required=True, help="the labels .csd (sentiment)")
    ap.add_argument("--words", required=True, help="the timestamped-words .csd")
    ap.add_argument("--out", default="data/interim/mosei.csv")
    ap.add_argument("--limit", type=int, default=None, help="cap the number of segments")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    samples = align_mosei(args.labels, args.words, args.limit)
    if not samples:
        logging.error("no aligned segments produced; check the two .csd files")
        return 1
    path = write_csv(samples, args.out)
    print(f"wrote {len(samples)} segments -> {path}")
    print(f"score it: python scripts/18_eval_sentiment.py --data {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
