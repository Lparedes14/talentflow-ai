#!/usr/bin/env python3
"""Stage N: build the shipped, calibrated vocabulary the app loads first.

Writes talentflow/skills/onet_vocab.json.gz. Run it after changing the O*NET data, the
corpus, or the alias rules. It needs O*NET and the corpus, which is the whole point: pay the
build cost once here so the app never pays it and starts instantly.

    python scripts/17_build_vocab_cache.py
"""
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.skills.build import build_skill_vocabulary, save_prebuilt_vocabulary


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    vocab, report = build_skill_vocabulary()
    path = save_prebuilt_vocabulary(vocab, report)
    print(f"\nwrote {path} ({path.stat().st_size / 1024:.0f} KB)")
    print(f"  {len(vocab.terms):,} terms, {len(vocab.aliases):,} aliases, "
          f"{report.get('n_pruned', 0)} pruned during calibration")
    print("  The app now starts from this file, reading no resumes and no O*NET.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
