#!/usr/bin/env python3
"""Stage M: video and audio understanding. Task 1, end to end.

Point it at a recording, or at a folder to scan, and it transcribes the speech and reads the
sentiment and career directions off the transcript.

    python scripts/16_video.py ~/Desktop/my_clip.mp4
    python scripts/16_video.py --scan ~/Desktop
    python scripts/16_video.py my_clip.m4a --transcriber gemini
    python scripts/16_video.py my_clip.mp4 --transcriber openai-whisper --model small

Transcription backends: faster-whisper (default, local), openai-whisper (local, heavier),
gemini (the API, needs a key). The sentiment and career reads use whatever LLM key is in .env;
pass --no-analysis to stop at the transcript. The transcriber packages are an optional group
in requirements.txt; uncomment them and reinstall before using a Whisper backend.
"""
import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.config import INTERIM_DIR
from talentflow.llm import load_client
from talentflow.video import find_media, get_transcriber, process_media


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("media", nargs="?", default=None, help="a video/audio file, or a folder")
    ap.add_argument("--scan", default=None, help="a folder to scan for recordings")
    ap.add_argument("--transcriber", default="faster-whisper",
                    choices=["faster-whisper", "openai-whisper", "gemini"])
    ap.add_argument("--model", default="base", help="Whisper model size (whisper backends)")
    ap.add_argument("--all", action="store_true",
                    help="when a folder holds several, do all of them, not just the newest")
    ap.add_argument("--no-analysis", action="store_true",
                    help="stop at the transcript, skip sentiment and career directions")
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    target = args.media or args.scan
    if not target:
        ap.error("give a file or folder, or use --scan DIR")

    found = find_media(target)
    if not found:
        logging.error("no video or audio files found at %s", target)
        return 1
    todo = found if args.all else found[:1]
    if len(found) > 1 and not args.all:
        logging.info("found %d recordings; doing the newest (%s). --all does every one.",
                     len(found), found[0].name)

    kw = {} if args.transcriber == "gemini" else {"model_size": args.model}
    transcriber = get_transcriber(args.transcriber, **kw)

    client = None
    if not args.no_analysis:
        client = load_client()
        if client is None:
            logging.warning("no API key, so only the transcript will be produced. "
                            "Add a key to .env for sentiment and career directions.")

    bar = "=" * 76
    for media in todo:
        logging.info("transcribing %s with %s...", media.name, args.transcriber)
        result = process_media(media, transcriber, client)

        print(f"\n{bar}\n  {media.name}\n{bar}")
        print(f"  transcriber: {result['backend']}"
              + (f"   language: {result['language']}" if result.get("language") else "")
              + (f"   {result['duration_s']:.0f}s" if result.get("duration_s") else ""))
        print(f"\n  Transcript:\n  {result['transcript'][:1200]}"
              + ("..." if len(result["transcript"]) > 1200 else ""))

        analysis = result.get("analysis")
        if analysis:
            s = analysis.get("sentiment") or {}
            c = analysis.get("career") or {}
            print(f"\n  Sentiment: {s.get('overall', '?')} ({s.get('confidence', '?')})"
                  f" -- {s.get('summary', '')}")
            if s.get("evidence"):
                print(f"    evidence: \"{s['evidence']}\"")
            print(f"\n  Career directions: {c.get('summary', '')}")
            if c.get("current_role"):
                print(f"    now: {c['current_role']}")
            for d in c.get("target_directions", []):
                print(f"    wants: {d.get('direction', '')}  (\"{d.get('quote', '')}\")")
            if c.get("skills_to_learn"):
                print(f"    to learn: {', '.join(c['skills_to_learn'])}")

        out_path = INTERIM_DIR / f"video_{media.stem}.json"
        out_path.write_text(json.dumps(result, indent=2, default=str))
        print(f"\n  saved -> {out_path}")

    print(f"\n{bar}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
