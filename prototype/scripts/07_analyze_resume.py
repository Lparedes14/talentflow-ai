#!/usr/bin/env python3
"""Analyze a single resume -- yours, a teammate's, any file.

Runs one document through the whole pipeline and prints what the system found and why.
Every skill is shown with the exact words that produced it, because a skill you cannot
trace back to the page is a skill you cannot check.

    python scripts/07_analyze_resume.py ~/Documents/my_resume.pdf
    python scripts/07_analyze_resume.py resume.docx --show-evidence
    python scripts/07_analyze_resume.py resume.doc --min-confidence exact

Accepts .pdf, .docx, .doc, .odt, .rtf, .txt and .md.
"""
import argparse
import logging
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.ingest.document import load_resume, SUPPORTED_SUFFIXES
from talentflow.skills.build import build_skill_vocabulary
from talentflow.text.chunk import chunk_resume

BAR = "=" * 72


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("resume", type=Path, help=f"resume file ({', '.join(sorted(SUPPORTED_SUFFIXES))})")
    ap.add_argument("--min-confidence", default="alias", choices=["weak", "alias", "exact"])
    ap.add_argument("--show-evidence", action="store_true",
                    help="print the source text behind every skill")
    ap.add_argument("--no-calibrate", action="store_true",
                    help="skip vocabulary calibration (faster, noisier)")
    args = ap.parse_args()

    logging.basicConfig(level=logging.WARNING, format="%(levelname)s %(message)s")

    record = load_resume(args.resume)
    if record["extract_error"]:
        print(f"Could not read {args.resume.name}: {record['extract_error']}")
        return 1
    if record["n_words"] < 20:
        print(f"{args.resume.name} produced almost no text ({record['n_words']} words). "
              "If it is a scanned image, it needs OCR first.")
        return 1

    chunks = chunk_resume(record)

    print(f"\n{BAR}\n  {args.resume.name}\n{BAR}")
    print(f"  {record['n_words']:,} words   {len(record['sections'])} sections   "
          f"{len(chunks)} chunks")
    print(f"  sections found: {', '.join(record['section_names'])}")
    if record["residual_artifacts"]:
        print(f"  note: {record['residual_artifacts']} unreadable characters in the source")

    print("\n  building the skill vocabulary...", end=" ", flush=True)
    vocab, _ = build_skill_vocabulary(calibrate=not args.no_calibrate)
    print(f"{len(vocab.aliases):,} names and aliases")

    matches = vocab.match_resume(record, min_confidence=args.min_confidence)
    if not matches:
        print("\n  No skills matched. Try --min-confidence weak to see borderline hits.")
        return 0

    # Keep the strongest evidence per skill, and count how often each was mentioned.
    best: dict[str, object] = {}
    mentions: Counter[str] = Counter()
    for m in matches:
        mentions[m.name] += 1
        if m.name not in best:
            best[m.name] = m

    by_category: dict[str, list] = {}
    for name, m in best.items():
        by_category.setdefault(m.term.category, []).append((name, m))

    print(f"\n{BAR}\n  {len(best)} skills found\n{BAR}")
    for category in ("technical", "soft", "process"):
        found = by_category.get(category)
        if not found:
            continue
        print(f"\n  {category.upper()}  ({len(found)})")
        for name, m in sorted(found, key=lambda x: -mentions[x[0]]):
            times = f"x{mentions[name]}" if mentions[name] > 1 else "  "
            print(f"    {times:>4}  {name:<44} [{m.section}]")
            if args.show_evidence:
                snippet = " ".join(record["text"][
                    max(0, m.char_start - 45):m.char_end + 45
                ].split())
                print(f"          found as {m.matched_text!r} in: ...{snippet}...")

    print(f"\n{BAR}")
    print(f"  confidence: {dict(Counter(m.confidence for m in matches))}")
    print("  every skill above points at real words in your resume -- run with "
          "--show-evidence to see them.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
