#!/usr/bin/env python3
"""TC6: measure whether identity changes what the system says about a candidate.

Two tests, and the second is the one that can fail.

  1. Perturbation. Swap name, pronouns and school on real resumes, re-extract, diff.
  2. Collision audit. Every vocabulary alias that is also a common personal name. This is
     the complete list of strings through which a candidate's name becomes a skill, and it
     needs no resume, no posting and no API key.

    python scripts/13_eval_fairness.py               # both tests, 40 resumes
    python scripts/13_eval_fairness.py --limit 200
    python scripts/13_eval_fairness.py --audit-only  # just the vocabulary, seconds

D26 argues TC6 passes by construction, because the score is arithmetic over skill sets and
identity terms are not skills. Test 2 is what checks that a name cannot become a skill in
the first place, which is the assumption that argument rests on.
"""
import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import INTERIM_DIR
from talentflow.eval.fairness import (
    ALL_NAMES, IDENTITIES, identity_sensitivity, name_alias_collisions,
)
from talentflow.ingest.corpus import iter_corpus
from talentflow.skills.build import build_skill_vocabulary
from talentflow.skills.extractor import LexicalExtractor
from talentflow.skills.vocabulary import IDENTITY_SECTIONS

RESULTS_DIR = INTERIM_DIR


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=40, help="resumes for the perturbation test")
    ap.add_argument("--audit-only", action="store_true")
    ap.add_argument("--engine", default="lexical", choices=["lexical", "llm"],
                    help="llm needs an API key and makes 8 calls per resume; use a small "
                         "--limit. The deterministic scorer is fair by construction, so the "
                         "LLM path is the one this test can actually fail on.")
    ap.add_argument("--min-confidence", default="alias", choices=["weak", "alias", "exact"])
    ap.add_argument("--search-header", action="store_true",
                    help="search the header too, which is the pre-F32 behaviour")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    vocab, _ = build_skill_vocabulary()
    logging.info("vocabulary: %d aliases", len(vocab.aliases))

    bar = "=" * 72

    # ---------------------------------------------------------------- audit
    collisions = name_alias_collisions(vocab)
    print(f"\n{bar}\n  TC6 part 1: names that are also skills\n{bar}")
    print(f"  Checked {len(vocab.aliases):,} aliases against {len(ALL_NAMES)} common names.\n")
    if not collisions:
        print("  No collisions. A candidate's name cannot be read as a skill.\n")
    else:
        print(f"  {len(collisions)} aliases are also personal names:\n")
        print(f"  {'alias':<22}{'resolves to':<34}{'tier':<8}{'name kind':<10}occ")
        print("  " + "-" * 68)
        for c in collisions:
            print(f"  {c.alias:<22}{c.term_name[:33]:<34}{c.confidence:<8}"
                  f"{c.kind:<10}{c.n_occupations}")
        print("\n  Each row is a way for a candidate's name to be scored as a skill.")
        print("  Read the tier column: 'exact' fires on the bare word.\n")

    results_path = RESULTS_DIR / (f"fairness_tc6_{args.engine}.json" if args.engine == "llm"
                                 else "fairness_tc6.json")
    if args.audit_only:
        results_path.write_text(json.dumps({"collisions": [c.__dict__ for c in collisions]},
                                           indent=2))
        return 0

    # ---------------------------------------------------------------- perturbation
    records = []
    for record in iter_corpus():
        records.append(record)
        if len(records) >= args.limit:
            break

    if args.engine == "llm":
        from talentflow.llm import load_client
        from talentflow.skills.extractor import LLMExtractor, OnetMapper
        client = load_client()
        if client is None:
            logging.error("the llm engine needs an API key; none found. See .env.example")
            return 1
        logging.info("llm fairness via %s; building the O*NET mapper...", client.model)
        extractor = LLMExtractor(client, vocab, mapper=OnetMapper(vocab))
    else:
        extractor = LexicalExtractor(
            vocab, min_confidence=args.min_confidence,
            skip_sections=() if args.search_header else IDENTITY_SECTIONS)
    results = identity_sensitivity(extractor, records, IDENTITIES)

    affected = [r for r in results if r.changed]
    print(f"{bar}\n  TC6 part 2: same resume, {len(IDENTITIES)} identities, "
          f"{args.engine} engine\n{bar}")
    print(f"  {len(records)} resumes x {len(IDENTITIES)} identities "
          f"= {len(records) * len(IDENTITIES)} extractions\n")
    print(f"  Resumes whose extracted skills changed: {len(affected)} of {len(results)}")

    if affected:
        print("\n  Every difference, with the identity that caused it:\n")
        for r in affected[:20]:
            for label, diff in r.changed.items():
                print(f"    {r.resume_id[:26]:<28}{label:<12}{sorted(diff)}")
        print("\n  A skill that appears only under one identity is that identity leaking")
        print("  into the result. Cross-reference part 1: the alias should be listed there.")
    else:
        print("\n  No resume changed under any identity. Identity text does not enter the")
        print("  skill set, so it cannot enter a score computed from the skill set.")

    if args.engine == "llm" and not affected:
        print("\n  The deterministic scorer is fair by construction (D26). This is the LLM")
        print("  path, which reads the whole resume including the name, so a clean result")
        print("  here is a measured fact, not a guarantee.")
    print(f"\n{bar}")
    results_path.write_text(json.dumps({
        "engine": args.engine,
        "n_resumes": len(results),
        "identities": [i.label for i in IDENTITIES],
        "n_changed": len(affected),
        "collisions": [c.__dict__ for c in collisions],
        "changes": {r.resume_id: {k: sorted(v) for k, v in r.changed.items()}
                    for r in affected},
    }, indent=2))
    logging.info("results -> %s", results_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
