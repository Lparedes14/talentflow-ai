#!/usr/bin/env python3
"""Stage D: chunks -> embeddings -> searchable vector index.

    python scripts/04_build_index.py --backend lsa
    python scripts/04_build_index.py --backend tfidf
"""
import argparse
import json
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import PROCESSED_DIR
from talentflow.embed import VectorIndex, get_embedder, list_backends
from talentflow.ingest.corpus import read_jsonl
from talentflow.config import INTERIM_DIR

CHUNKS_PATH = INTERIM_DIR / "chunks.jsonl"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--backend", default="lsa", choices=list_backends())
    ap.add_argument("--n-components", type=int, default=256, help="lsa only")
    ap.add_argument("--min-df", type=int, default=3)
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not CHUNKS_PATH.exists():
        logging.error("no chunks at %s -- run scripts/03_build_chunks.py first", CHUNKS_PATH)
        return 1

    chunks = list(read_jsonl(CHUNKS_PATH))
    logging.info("loaded %d chunks", len(chunks))

    kw = {"min_df": args.min_df}
    if args.backend == "lsa":
        kw["n_components"] = args.n_components

    t0 = time.monotonic()
    index = VectorIndex.build(get_embedder(args.backend, **kw), chunks)
    elapsed = time.monotonic() - t0

    out = PROCESSED_DIR / f"index_{args.backend}"
    index.save(out)

    info = {
        "backend": args.backend,
        "n_chunks": len(index),
        "dim": int(index.matrix.shape[1]),
        "fit_encode_seconds": round(elapsed, 1),
        "index_mb": round(sum(f.stat().st_size for f in out.glob("vectors.*")) / 1e6, 1),
    }
    if hasattr(index.embedder, "explained_variance"):
        info["explained_variance"] = round(index.embedder.explained_variance, 3)

    logging.info("index -> %s", out)
    print(json.dumps(info, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
