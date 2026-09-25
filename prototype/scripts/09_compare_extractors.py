#!/usr/bin/env python3
"""Stage H: head-to-head, lexical vs LLM skill extraction.

This is the comparison the team contract assigns to Juan. Both engines are scored by the
same harness against the same 220-resume gold set, so the engine is the only variable.

Needs ANTHROPIC_API_KEY, in the environment or in a `.env` file at the project root:

    ANTHROPIC_API_KEY=sk-ant-...

Responses are cached on disk by a hash of the model, prompt and parameters, so a rerun
costs nothing and an evaluation stays reproducible offline once it has run.

    python scripts/09_compare_extractors.py --limit 20      # a cheap first look
    python scripts/09_compare_extractors.py                 # the full gold set
    python scripts/09_compare_extractors.py --lexical-only  # no key needed
"""
import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import INTERIM_DIR
from talentflow.eval.extraction import evaluate_extraction
from talentflow.llm import load_client
from talentflow.llm.client import LLMError
from talentflow.skills.extractor import LexicalExtractor, LLMExtractor, OnetMapper
from talentflow.skills.goldset import load_goldset
from talentflow.skills.build import build_skill_vocabulary

RESULTS_PATH = INTERIM_DIR / "extractor_comparison.json"


def _row(label: str, report: dict) -> str:
    h = report["hallucination"]
    return (f"  {label:<10}{report['span_detection_rate_pct']:>10.1f}%"
            f"{report['token_coverage_pct']:>12.1f}%"
            f"{h['rate_pct']:>12.1f}%{h['n_matches']:>10}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--limit", type=int, default=None, help="score only the first N resumes")
    # No default. A model name belongs to one provider, so a default here would be
    # wrong for the other two. load_client() picks the default for whichever key is
    # configured. See F29.
    ap.add_argument("--model", default=None,
                    help="override the provider's default model")
    ap.add_argument("--min-confidence", default="alias", choices=["weak", "alias", "exact"])
    ap.add_argument("--lexical-only", action="store_true", help="skip the LLM engine")
    ap.add_argument("--map-threshold", type=float, default=0.55)
    # lsa needs no extra package. "st" is a pretrained sentence encoder and needs
    # `pip install sentence-transformers` plus a model download, but it is the only backend
    # that can map a near-synonym like HTML5 -> HTML. See F41.
    ap.add_argument("--map-backend", default="lsa", choices=["lsa", "tfidf", "st"],
                    help="embedding backend for the free-text -> O*NET mapping step")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    vocab, calibration = build_skill_vocabulary()
    logging.info("vocabulary: %d aliases, %d pruned", len(vocab.aliases), calibration["n_pruned"])

    gold, gold_stats = load_goldset()
    scored = [r for r in gold if r.skill_spans]
    if args.limit:
        scored = scored[:args.limit]
    logging.info("scoring %d gold resumes", len(scored))

    results = {}
    lexical = LexicalExtractor(vocab, min_confidence=args.min_confidence)
    results["lexical"] = evaluate_extraction(
        lexical, scored, min_confidence=args.min_confidence, vocab=vocab)
    logging.info("lexical: detection %.1f%%", results["lexical"]["span_detection_rate_pct"])

    llm_stats = None
    llm_error = None
    model_used = None
    if not args.lexical_only:
        client = load_client(model=args.model)
        if client is None:
            print("\nNo API key found, so only the lexical engine ran. Put one in .env at")
            print("the project root, as ANTHROPIC_API_KEY, OPENAI_API_KEY or GEMINI_API_KEY,")
            print("and set LLM_PROVIDER if more than one is present. See .env.example.\n")
        else:
            model_used = client.model
            logging.info("building the O*NET mapper for the retrieval step...")
            mapper = OnetMapper(vocab, backend=args.map_backend, threshold=args.map_threshold)
            llm = LLMExtractor(client, vocab, mapper=mapper)
            try:
                results["llm"] = evaluate_extraction(
                    llm, scored, min_confidence=args.min_confidence, vocab=vocab)
            except LLMError as exc:
                # The lexical half of this run is finished, valid, and took a 25-second
                # vocabulary build to produce. Throwing it away because the provider said
                # no would make the user pay that cost again for nothing. See F30.
                llm_error = str(exc)
                logging.error("the LLM engine failed: %s", exc)
            else:
                llm_stats = {**llm.stats(), **client.stats()}
                logging.info("llm: detection %.1f%%",
                             results["llm"]["span_detection_rate_pct"])

    bar = "=" * 62
    print(f"\n{bar}\n  Skill extraction, head to head\n{bar}")
    print(f"  {'engine':<10}{'detection':>11}{'token cov':>12}{'halluc.':>12}{'matches':>10}")
    print("-" * 62)
    for name, report in results.items():
        print(_row(name, report))
    print(bar)
    print(f"  vocabulary ceiling {results['lexical']['vocabulary_ceiling_pct']:.1f}%  "
          f"(what O*NET makes findable at all)")

    if "llm" in results:
        delta = (results["llm"]["span_detection_rate_pct"]
                 - results["lexical"]["span_detection_rate_pct"])
        print(f"  LLM vs lexical: {delta:+.1f} points of detection")
        print(f"\n  LLM behaviour: {json.dumps(llm_stats)}")
        print("\n  Read the hallucination column carefully. The lexical engine cannot")
        print("  hallucinate, because every result is a span of the document. The LLM")
        print("  can, and that number is the price of whatever detection it bought.")

    if llm_error:
        print("\n  The LLM engine did not run to completion, so only the lexical row above")
        print("  is a result. The reason, verbatim from the provider:")
        print(f"\n    {llm_error}\n")
        print("  To use a different provider, edit LLM_PROVIDER in .env.")

    for name, report in results.items():
        print(f"\n  {name} diagnosis: {report['diagnosis']['summary']}")

    RESULTS_PATH.write_text(json.dumps({
        "n_scored": len(scored),
        # The model that actually ran, not the one requested. --model now defaults to None
        # so each provider picks its own (F29), and the contract requires every result to
        # name the model behind it.
        "model": model_used, "model_requested": args.model,
        "llm_error": llm_error,
        "min_confidence": args.min_confidence,
        "map_backend": args.map_backend,
        "results": {k: {kk: vv for kk, vv in v.items() if kk != "sample_misses"}
                    for k, v in results.items()},
        "llm_stats": llm_stats, "gold_set": gold_stats,
    }, indent=2))
    logging.info("results -> %s", RESULTS_PATH)
    return 1 if llm_error else 0


if __name__ == "__main__":
    raise SystemExit(main())
