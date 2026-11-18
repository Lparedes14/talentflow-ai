#!/usr/bin/env python3
"""Stage K: the skills a candidate should learn next, ranked by what they unlock. Task 4.

Needs no API key. Reads the same extraction files matching reads, so a candidate's gaps are
measured against the same roles their match scores came from.

    python scripts/14_skill_gaps.py --demo
    python scripts/14_skill_gaps.py --resume 10089434 --postings data/interim/posting_skills_capital_one.jsonl
"""
import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import INTERIM_DIR
from talentflow.matching import (
    Matcher, load_posting_profiles, load_resume_profiles, rank_skill_leverage,
    summarize_leverage,
)

TECHNICAL_FAMILIES = {"INFORMATION-TECHNOLOGY", "ENGINEERING"}
RESULTS_PATH = INTERIM_DIR / "skill_gaps.json"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--postings", type=Path, default=None)
    ap.add_argument("--resume", default=None, help="analyze this resume id")
    ap.add_argument("--k", type=int, default=10)
    ap.add_argument("--all-families", action="store_true")
    ap.add_argument("--demo", action="store_true", help="the candidate with the most skills")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    families = None if args.all_families else TECHNICAL_FAMILIES
    resumes = load_resume_profiles(categories=families)
    postings = load_posting_profiles(args.postings)
    matcher = Matcher(resumes, postings)

    if args.resume:
        candidate = next((r for r in resumes if r.profile_id == args.resume), None)
        if candidate is None:
            logging.error("resume %s not found", args.resume)
            return 1
    else:
        candidate = max(resumes, key=len)

    ranked = rank_skill_leverage(matcher, candidate, top_k=args.k)

    bar = "=" * 76
    print(f"\n{bar}\n  Skills to learn next: candidate {candidate.profile_id} "
          f"({candidate.label}, {len(candidate)} skills)\n{bar}")
    print(f"  {summarize_leverage(ranked, candidate)}\n")
    print(f"  {'skill':<32}{'gain':>8}{'roles':>7}{'rarity':>8}{'peers have':>12}")
    print("  " + "-" * 72)
    for x in ranked:
        print(f"  {x.skill[:31]:<32}{x.score_gain:>8.3f}{x.roles_requiring:>7}"
              f"{x.rarity_weight:>8.2f}{x.held_by_candidates:>12}")
    print(f"\n  gain   = total match-score lift across all roles from learning the skill")
    print(f"  roles  = roles that require it and this candidate does not have it")
    print(f"  rarity = how rare the skill is among candidates; higher means more valuable")
    print(f"  peers have = candidates in the pool who already hold it (supply)")
    print(f"\n{bar}")

    RESULTS_PATH.write_text(json.dumps({
        "resume_id": candidate.profile_id,
        "label": candidate.label,
        "n_skills_held": len(candidate),
        "summary": summarize_leverage(ranked, candidate),
        "recommendations": [vars(x) for x in ranked],
    }, indent=2, default=str))
    logging.info("results -> %s", RESULTS_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
