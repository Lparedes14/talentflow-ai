#!/usr/bin/env python3
"""Stage C: corpus -> embedding-sized chunks.

    python scripts/03_build_chunks.py
    python scripts/03_build_chunks.py --target-tokens 256
"""
import argparse
import json
import logging
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import INTERIM_DIR
from talentflow.ingest.corpus import iter_corpus
from talentflow.text.chunk import (
    DEFAULT_MIN_TOKENS, DEFAULT_OVERLAP_TOKENS, DEFAULT_TARGET_TOKENS, chunk_resume,
)

CHUNKS_PATH = INTERIM_DIR / "chunks.jsonl"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--target-tokens", type=int, default=DEFAULT_TARGET_TOKENS)
    ap.add_argument("--overlap-tokens", type=int, default=DEFAULT_OVERLAP_TOKENS)
    ap.add_argument("--min-tokens", type=int, default=DEFAULT_MIN_TOKENS)
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    n_chunks = n_resumes = 0
    per_section: Counter[str] = Counter()
    per_resume: list[int] = []
    sizes: list[int] = []

    with CHUNKS_PATH.open("w") as fh:
        for record in iter_corpus():
            chunks = chunk_resume(
                record,
                target_tokens=args.target_tokens,
                overlap_tokens=args.overlap_tokens,
                min_tokens=args.min_tokens,
            )
            n_resumes += 1
            per_resume.append(len(chunks))
            for c in chunks:
                fh.write(json.dumps(c.to_dict()) + "\n")
                per_section[c.section] += 1
                sizes.append(c.n_tokens)
                n_chunks += 1

    sizes.sort()
    q = lambda p: sizes[int(p * len(sizes))] if sizes else 0  # noqa: E731
    logging.info("chunks -> %s", CHUNKS_PATH)
    print(json.dumps({
        "n_resumes": n_resumes,
        "n_chunks": n_chunks,
        "chunks_per_resume": {
            "mean": round(n_chunks / n_resumes, 1),
            "min": min(per_resume), "max": max(per_resume),
        },
        "chunk_tokens": {"p25": q(.25), "median": q(.5), "p75": q(.75), "max": sizes[-1]},
        "chunks_per_section": dict(per_section.most_common()),
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
