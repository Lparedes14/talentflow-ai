#!/usr/bin/env python3
"""Ask the configured provider which models this key can actually call.

Model names are perishable and provider-specific, and both facts have already cost this
project a run. F29: a model name for one provider sent to another, 404. F31: Gemini retired
`gemini-2.0-flash` between sessions, 404. Each failure surfaced only after a 25-second
vocabulary build, and neither could have been guessed from the code.

So stop guessing. This asks.

    python scripts/12_list_models.py              # the provider LLM_PROVIDER selects
    python scripts/12_list_models.py --filter flash

Whatever it prints is callable with the key in .env right now, which is a stronger claim
than anything written in a constant. Put a name you see here in --model, or leave --model
alone and change the default in talentflow/llm/client.py if it has gone stale.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.llm import load_client
from talentflow.llm.client import LLMError


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--filter", default="", help="only names containing this substring")
    args = ap.parse_args()

    client = load_client()
    if client is None:
        print("No API key found. Put one in .env at the project root, as ANTHROPIC_API_KEY,")
        print("OPENAI_API_KEY or GEMINI_API_KEY, and set LLM_PROVIDER if you have several.")
        return 1

    provider = type(client).__name__.replace("Client", "")
    try:
        names = client.list_models()
    except LLMError as exc:
        print(f"\n{provider} would not list its models:\n\n    {exc}\n")
        return 1

    shown = [n for n in names if args.filter.lower() in n.lower()]
    print(f"\n{provider}: {len(shown)} of {len(names)} models"
          f"{f' matching {args.filter!r}' if args.filter else ''}\n")
    for name in shown:
        print(f"  {name}{'   <- current default' if name == client.model else ''}")

    if client.model not in names:
        print(f"\n  WARNING: the configured default, {client.model}, is not in this list.")
        print("  Update DEFAULT_* in talentflow/llm/client.py, or pass --model.")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
