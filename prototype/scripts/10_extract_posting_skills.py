#!/usr/bin/env python3
"""Stage I: extract required skills from job postings.

Step 1 of task 3. Needs no API key and no model weights: the extractor built in Piece 3
already works on any text, and a posting is shaped into the same record a resume becomes, so
both sides of a future match speak one vocabulary.

Why this is needed at all: `job_skills.csv` maps a posting to 35 coarse abbreviations (`IT`,
`MRKT`, `ENG`). Those are job *families*, not skills. Matching needs the actual skills, and
the only place they exist is the description prose.

Resumable and time-boxed, like the PDF stage, because 29,000 postings do not finish inside
one short shell call.

    python scripts/10_extract_posting_skills.py --limit 500      # a quick look
    python scripts/10_extract_posting_skills.py --max-seconds 30 # a slice, rerun to continue
    python scripts/10_extract_posting_skills.py --all-categories # not just IT and ENG
"""
import argparse
import json
import logging
import sys
import time
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import INTERIM_DIR
from talentflow.ingest.corpus import _already_done, repair_jsonl
from talentflow.postings import drop_company_name_matches, load_postings, posting_to_record
from talentflow.skills.extractor import LexicalExtractor
from talentflow.skills.build import build_skill_vocabulary

SKILLS_PATH = INTERIM_DIR / "posting_skills.jsonl"
REPORT_PATH = INTERIM_DIR / "posting_skills_report.json"


def _slug(name: str) -> str:
    return "".join(c if c.isalnum() else "_" for c in name.lower()).strip("_")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--all-categories", action="store_true",
                    help="every posting, not only those coded IT or ENG")
    ap.add_argument("--company", action="append", default=None,
                    help="restrict to an employer. Repeatable: --company 'Capital One' "
                         "--company Amazon. An internal talent marketplace is a single "
                         "company; matching across all of LinkedIn is a job board.")
    ap.add_argument("--technical-skills-only", action="store_true",
                    help="drop human-capability terms from the vocabulary, keeping the "
                         "8,917 technology and technical-knowledge terms")
    ap.add_argument("--min-confidence", default="alias", choices=["weak", "alias", "exact"])
    ap.add_argument("--max-seconds", type=float, default=None,
                    help="stop cleanly at a record boundary; rerun to continue")
    ap.add_argument("--fresh", action="store_true")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    # A company-scoped run gets its own files, so it never half-overwrites the full corpus.
    global SKILLS_PATH, REPORT_PATH
    if args.company:
        tag = _slug("_".join(sorted(args.company)))[:60]
        SKILLS_PATH = INTERIM_DIR / f"posting_skills_{tag}.jsonl"
        REPORT_PATH = INTERIM_DIR / f"posting_skills_report_{tag}.json"

    # The vocabulary is calibrated against the resume corpus, not the postings, on purpose.
    # Both sides of a match must be read with one vocabulary or the comparison is between
    # two different things. Whether posting text deserves its own calibration is an open
    # question in the build log, not something to decide silently here.
    vocab, calibration = build_skill_vocabulary(technical_only=args.technical_skills_only)
    logging.info("vocabulary: %d aliases, %d pruned across corpora %s",
                 len(vocab.aliases), calibration["n_pruned"], calibration["corpus_sizes"])

    extractor = LexicalExtractor(vocab, min_confidence=args.min_confidence)

    postings = load_postings(technical_only=not args.all_categories,
                             company=args.company, limit=args.limit)
    logging.info("loaded %d postings%s", len(postings),
                 f" for {', '.join(args.company)}" if args.company else "")
    if not postings:
        logging.error("no postings matched. Check the company name spelling.")
        return 1

    if args.fresh:
        SKILLS_PATH.write_text("")
        done = set()
    else:
        repair_jsonl(SKILLS_PATH)
        done = _already_done(SKILLS_PATH)
        if done:
            logging.info("resuming: %d already extracted", len(done))

    todo = [p for p in postings if p.job_id not in done]
    logging.info("extracting %d", len(todo))

    started, finished, n = time.monotonic(), True, 0
    with SKILLS_PATH.open("a") as fh:
        for i, posting in enumerate(todo, 1):
            record = posting_to_record(posting)
            matches = drop_company_name_matches(extractor.extract(record), posting.company)
            fh.write(json.dumps({
                "resume_id": posting.job_id,          # keyed like the resume file
                "job_id": posting.job_id,
                "title": record["title"],
                "company": posting.company,
                "skill_codes": posting.skill_codes,
                "n_words": record["n_words"],
                "n_distinct_skills": len({m.name for m in matches}),
                "skills": [
                    {"name": m.name, "onet_domain": m.term.onet_domain,
                     "skill_category": m.term.category, "confidence": m.confidence,
                     "matched_text": m.matched_text, "section": m.section,
                     "char_start": m.char_start, "char_end": m.char_end}
                    for m in matches
                ],
            }) + "\n")
            n += 1
            if i % 500 == 0:
                fh.flush()
                logging.info("  %d/%d", i, len(todo))
            if args.max_seconds and time.monotonic() - started > args.max_seconds:
                logging.info("time budget reached at %d/%d; rerun to continue", i, len(todo))
                finished = False
                break

    # Report over everything extracted so far, not just this slice.
    per, top, cats, by_company = [], Counter(), Counter(), {}
    with SKILLS_PATH.open() as fh:
        for line in fh:
            if not line.strip():
                continue
            rec = json.loads(line)
            per.append(rec["n_distinct_skills"])
            co = by_company.setdefault(rec["company"] or "(unknown)",
                                       {"postings": 0, "skills": Counter()})
            co["postings"] += 1
            co["skills"].update({s["name"] for s in rec["skills"]})
            top.update({s["name"] for s in rec["skills"]})
            for s in rec["skills"]:
                cats[s["skill_category"]] += 1

    per.sort()
    q = lambda p: per[int(p * len(per))] if per else 0  # noqa: E731
    report = {
        "companies": args.company,
        "technical_skills_only": args.technical_skills_only,
        "n_postings_extracted": len(per),
        "n_postings_targeted": len(postings),
        "finished": finished,
        "skills_per_posting": {"min": per[0] if per else 0, "p25": q(.25), "median": q(.5),
                               "p75": q(.75), "p95": q(.95), "max": per[-1] if per else 0},
        "postings_with_no_skills": sum(1 for x in per if x == 0),
        "matches_by_category": dict(cats),
        "top_skills": top.most_common(25),
        "per_company": {
            name: {"postings": v["postings"], "distinct_skills": len(v["skills"]),
                   "top_skills": v["skills"].most_common(12)}
            for name, v in sorted(by_company.items(), key=lambda kv: -kv[1]["postings"])
        },
    }
    REPORT_PATH.write_text(json.dumps(report, indent=2))

    logging.info("skills -> %s", SKILLS_PATH)
    print(json.dumps({k: v for k, v in report.items() if k != "top_skills"}, indent=2))
    for name, info in report["per_company"].items():
        print(f"\n  {name}: {info['postings']} postings, {info['distinct_skills']} distinct skills")
        print("    " + ", ".join(f"{s}({c})" for s, c in info["top_skills"]))
    if not finished:
        logging.warning("partial run; rerun the same command to continue")
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
