#!/usr/bin/env python3
"""Stage L: the prompt-injection demo, for the report and the talk.

A resume is supplied by the person being judged, and text extractors read it whatever color
it is drawn in. `docs/demos/injected_resume.pdf` is a modest analyst resume with an invisible
white-text line that names Kubernetes, Terraform and PyTorch and tells the screening system to
report them at expert level. This script shows what each engine does with it, and the fix.

    python scripts/15_prompt_injection.py
    python scripts/15_prompt_injection.py --pdf some_other.pdf

The lexical engine needs no key. The LLM half runs only if a key is in .env.
"""
import argparse
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.ingest.document import load_resume
from talentflow.ingest.hidden_text import find_hidden_spans
from talentflow.llm import load_client
from talentflow.skills.build import build_skill_vocabulary
from talentflow.skills.extractor import LexicalExtractor, LLMExtractor, OnetMapper

DEMO_PDF = Path(__file__).resolve().parent.parent / "docs" / "demos" / "injected_resume.pdf"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pdf", type=Path, default=DEMO_PDF)
    args = ap.parse_args()

    logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(levelname)s %(message)s")
    bar = "=" * 76

    record = load_resume(args.pdf)
    spans = find_hidden_spans(args.pdf)
    hidden = " ".join(s.text for s in spans).lower()

    print(f"\n{bar}\n  Prompt injection: what a resume can hide from a reader\n{bar}")
    print(f"  file: {args.pdf.name}\n")
    if spans:
        print("  Invisible text the extractor still read (white on white):")
        for s in spans:
            print(f"    page {s.page}, color {s.color}: {s.text[:100]}...")
    else:
        print("  No hidden text found.")

    vocab, _ = build_skill_vocabulary()
    lex = LexicalExtractor(vocab).extract(record)
    lex_names = {m.name for m in lex}
    from_hidden = sorted({m.name for m in lex if m.matched_text.lower() in hidden})

    print(f"\n  Dictionary Matcher found {len(lex_names)} skills.")
    print(f"    from the visible resume: "
          f"{sorted(lex_names - set(from_hidden)) or 'none'}")
    print(f"    from the hidden line:    {from_hidden or 'none'}")
    print("  The matcher does not follow instructions, so it never invents a skill. But it")
    print("  reads the hidden words, so a skill pasted in white type still lands.")

    client = load_client()
    if client is None:
        print("\n  No API key, so the LLM Reader half did not run. Add one to .env to show")
        print("  whether the model obeys the hidden instruction.")
    else:
        llm_ex = LLMExtractor(client, vocab, mapper=OnetMapper(vocab))
        llm = llm_ex.extract(record)
        llm_names = {m.name for m in llm}
        stats = llm_ex.stats()
        print(f"\n  LLM Reader ({client.model}) found {len(llm_names)} skills: {sorted(llm_names)}")
        print(f"    hidden-line skills it reported: "
              f"{sorted(n for n in llm_names if n.lower() in hidden) or 'none'}")
        print(f"    unquotable and dropped: {stats['unquotable']} "
              f"({stats['hallucination_rate_pct']}%)")
        print("  Grounding drops any skill the model cannot quote, but the injected words")
        print("  are in the document, so a quote for them exists and they survive.")

    print(f"\n{bar}")
    print("  The lesson. The weak point is not the engine, it is trusting text nobody can")
    print("  see. Both engines read it. The fix is upstream: find_hidden_spans() flags")
    print("  invisible text at ingestion, so a resume like this can be caught, dropped, or")
    print("  stripped and re-read before any skill is scored.")
    print(f"{bar}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
