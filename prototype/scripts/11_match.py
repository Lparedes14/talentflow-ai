#!/usr/bin/env python3
"""Stage J: match candidates to roles, both directions. Task 3.

Needs no API key. Both sides were extracted with the same engine into the same vocabulary,
which is what makes the comparison mean anything.

    python scripts/11_match.py --demo
    python scripts/11_match.py --postings data/interim/posting_skills_capital_one.jsonl
    python scripts/11_match.py --resume 10089434 --k 5
"""
import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import INTERIM_DIR
from talentflow.matching import Matcher, load_posting_profiles, load_resume_profiles

TECHNICAL_FAMILIES = {"INFORMATION-TECHNOLOGY", "ENGINEERING"}
RESULTS_PATH = INTERIM_DIR / "matching_report.json"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--postings", type=Path, default=None)
    ap.add_argument("--resume", default=None, help="rank roles for this resume id")
    ap.add_argument("--posting", default=None, help="rank candidates for this posting id")
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--all-families", action="store_true",
                    help="every resume, not just IT and ENGINEERING")
    ap.add_argument("--demo", action="store_true", help="one example of each direction")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    families = None if args.all_families else TECHNICAL_FAMILIES
    resumes = load_resume_profiles(categories=families)
    postings = load_posting_profiles(args.postings)
    matcher = Matcher(resumes, postings)

    stats = matcher.pool_stats()
    logging.info("pool: %d candidates, %d roles", stats["n_resumes"], stats["n_postings"])

    bar = "=" * 74
    print(f"\n{bar}\n  Pool\n{bar}")
    print(f"  candidates            {stats['n_resumes']}")
    print(f"  roles                 {stats['n_postings']}")
    print(f"  skills held           {stats['distinct_skills_held']}")
    print(f"  skills required       {stats['distinct_skills_required']}")
    print(f"  required by roles but held by NO candidate: "
          f"{stats['requirements_no_candidate_has']}")
    if stats["top_unmatchable"]:
        print("    most common: " +
              ", ".join(f"{s} ({n} roles)" for s, n in stats["top_unmatchable"][:6]))
        print("    These depress every score for a reason that is about the corpus, not")
        print("    the candidates: the resumes are from ~2019, the postings from 2023-24.")

    payload = {"pool": stats, "examples": {}}

    if args.demo or args.resume:
        resume = (next((r for r in resumes if r.profile_id == args.resume), None)
                  if args.resume else max(resumes, key=len))
        if resume is None:
            logging.error("resume %s not found", args.resume)
            return 1
        print(f"\n{bar}\n  Roles for candidate {resume.profile_id} "
              f"({resume.label}, {len(resume)} skills)\n{bar}")
        results = matcher.roles_for(resume, k=args.k)
        for i, r in enumerate(results, 1):
            print(f"\n  {i}. {r.posting_title[:56]}  [{r.company[:24]}]")
            print(f"     {r.summary}   weighted {r.weighted_score:.0%}")
            print(f"     has:     {', '.join(r.matched[:6]) or 'nothing'}")
            print(f"     missing: {', '.join(r.missing[:6]) or 'nothing'}")
            if r.unmatchable:
                print(f"     no candidate in the pool has: {', '.join(r.unmatchable[:4])}")
        payload["examples"]["roles_for"] = {
            "resume_id": resume.profile_id,
            "results": [vars(r) for r in results],
        }

    if args.demo or args.posting:
        posting = (next((p for p in postings if p.profile_id == args.posting), None)
                   if args.posting else max(postings, key=len))
        if posting is None:
            logging.error("posting %s not found", args.posting)
            return 1
        print(f"\n{bar}\n  Candidates for role: {posting.label[:50]} "
              f"({len(posting)} required skills)\n{bar}")
        results = matcher.candidates_for(posting, k=args.k)
        for i, r in enumerate(results, 1):
            print(f"\n  {i}. candidate {r.resume_id}   {r.summary}   "
                  f"weighted {r.weighted_score:.0%}")
            print(f"     has:     {', '.join(r.matched[:6]) or 'nothing'}")
            print(f"     missing: {', '.join(r.missing[:5]) or 'nothing'}")
        payload["examples"]["candidates_for"] = {
            "posting_id": posting.profile_id,
            "results": [vars(r) for r in results],
        }

    RESULTS_PATH.write_text(json.dumps(payload, indent=2, default=str))
    print(f"\n{bar}")
    print("  Scores are arithmetic over skill sets, never a model. A candidate's name,")
    print("  pronouns and school are not skills, so they cannot move the score at all.")
    print(f"  Full output -> {RESULTS_PATH}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
