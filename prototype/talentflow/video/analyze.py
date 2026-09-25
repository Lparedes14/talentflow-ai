"""Sentiment and career directions from a transcript, using the LLM client we already have.

This is the language-model half of task 1. It runs on the transcript, after transcription, so
its metric (sentiment accuracy, career directions) is separate from the transcriber's (word
error rate). Same grounding discipline as the resume extractor: every claim has to quote the
transcript, so a reader can check it and the model invents less.

Two calls, kept apart on purpose. A sentiment read and a career read are different questions
with different rubrics, and folding them into one prompt makes each answer worse and the
result harder to score.
"""
from __future__ import annotations

import json
import logging
import re

log = logging.getLogger(__name__)

MAX_CHARS = 12000

SYSTEM = (
    "You read a transcript of someone talking about their work and career. You report only "
    "what the transcript supports, you quote it for every claim, and you never invent."
)

SENTIMENT_PROMPT = """Read this transcript and judge the speaker's overall sentiment about
their work and career.

Return only a JSON object:
{{"overall": "positive" | "neutral" | "negative",
  "confidence": "high" | "medium" | "low",
  "evidence": "a short quote from the transcript that shows it",
  "summary": "one sentence, plain language"}}

TRANSCRIPT:
{transcript}
"""

CAREER_PROMPT = """Read this transcript and pull out where the speaker wants their career to
go. Use only what they say.

Return only a JSON object:
{{"current_role": "their role now, or empty if not stated",
  "target_directions": [{{"direction": "a role or direction they want", "quote": "their words"}}],
  "skills_to_learn": ["skills they say they need or want to learn"],
  "summary": "one sentence, plain language"}}

TRANSCRIPT:
{transcript}
"""


def _parse_json_object(text: str) -> dict:
    """Pull one JSON object out of a response, tolerant of a code fence or a stray sentence."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no JSON object in response")
    obj = json.loads(text[start:end + 1])
    if not isinstance(obj, dict):
        raise ValueError("response JSON is not an object")
    return obj


def analyze_transcript(client, transcript: str, temperature: float = 0.0) -> dict:
    """Run the sentiment and career reads. Returns a dict with both, or a note if empty.

    `client` is any LLM client with `.complete(prompt, system, temperature)`, so the mock,
    Gemini, Anthropic and OpenAI all work unchanged.
    """
    text = transcript.strip()[:MAX_CHARS]
    if not text:
        return {"sentiment": None, "career": None, "note": "empty transcript"}

    out: dict = {}
    for key, prompt in (("sentiment", SENTIMENT_PROMPT), ("career", CAREER_PROMPT)):
        try:
            raw = client.complete(prompt.format(transcript=text), system=SYSTEM,
                                  temperature=temperature)
            out[key] = _parse_json_object(raw)
        except (ValueError, json.JSONDecodeError) as exc:
            log.warning("could not parse the %s response: %s", key, exc)
            out[key] = {"error": "could not parse the model response"}
    return out
