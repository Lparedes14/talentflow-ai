"""Task 1 sentiment: score a transcript's sentiment and measure it against MOSEI.

This is the language-model half of task 1, scored the way the proposal asks. Two numbers come
out, both against the CMU-MOSEI transcripts and their -3 to +3 labels:

- **Accuracy and F1**, positive against negative. A label above 0 is positive, below 0 is
  negative, and the exactly-neutral ones are dropped for this pair, which is the standard
  MOSEI binary split.
- **Mean absolute error** on the -3 to +3 score, so a model that leans the right way but
  overshoots the magnitude is still penalized.

Two scorers behind one interface, so the comparison is fair:

- **VADER**, the proposal's baseline. A rule-based lexicon, no model and no network, so it
  runs anywhere and sets the bar the LLM has to beat.
- **The LLM**, asked for a single integer from -3 to +3, through the client the rest of the
  project already uses.

The data is not shipped. CMU-MOSEI comes from the CMU-MultimodalSDK, which downloads from a
CMU server, so the transcripts and labels are gathered on a normal machine and handed to this
module as a table of text and score. `load_sentiment_dataset` reads that table from CSV or
JSONL. `docs/demos/sentiment_sample.csv` is a tiny hand-written sample for smoke-testing the
harness, not a benchmark.
"""
from __future__ import annotations

import csv
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, Sequence

# VADER's own thresholds for turning its compound score into a label.
VADER_POS = 0.05
VADER_NEG = -0.05

TARGETS = {"accuracy": 0.75, "f1": 0.72, "mae": 1.0}


@dataclass
class Sample:
    text: str
    label: float          # gold sentiment, -3 to +3


class SentimentScorer(Protocol):
    name: str

    def score(self, text: str) -> float:
        """Return a sentiment score on the -3 to +3 scale."""


class VaderScorer:
    """The rule-based baseline. compound in [-1, 1], scaled to the -3 to +3 scale."""

    name = "vader"

    def __init__(self):
        try:
            from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
        except ImportError as exc:  # pragma: no cover
            raise ImportError(
                "VADER needs its package. It is in requirements.txt:\n"
                "    pip install -r requirements.txt"
            ) from exc
        self._analyzer = SentimentIntensityAnalyzer()

    def score(self, text: str) -> float:
        return self._analyzer.polarity_scores(text or "")["compound"] * 3.0


SENTIMENT_SYSTEM = (
    "You rate the sentiment of a short spoken passage. You answer with one integer only."
)
SENTIMENT_PROMPT = """Rate the overall sentiment of this passage on an integer scale:
-3 very negative, -2 negative, -1 slightly negative, 0 neutral, 1 slightly positive,
2 positive, 3 very positive.

Return only the integer, nothing else.

PASSAGE:
{text}
"""


class LLMSentimentScorer:
    """Asks the model for a single integer from -3 to +3."""

    name = "llm"

    def __init__(self, client, temperature: float = 0.0):
        self.client = client
        self.temperature = temperature

    def score(self, text: str) -> float:
        raw = self.client.complete(SENTIMENT_PROMPT.format(text=text[:4000]),
                                   system=SENTIMENT_SYSTEM, temperature=self.temperature)
        return _parse_score(raw)


def _parse_score(raw: str) -> float:
    """Pull the first signed number out of a response and clamp it to [-3, 3]."""
    match = re.search(r"-?\d+(?:\.\d+)?", raw or "")
    if not match:
        return 0.0
    return max(-3.0, min(3.0, float(match.group())))


def load_sentiment_dataset(path: str | Path, limit: int | None = None) -> list[Sample]:
    """Read a text-and-label table. CSV with `text,label` columns, or JSONL with the same
    keys. `label` is the -3 to +3 gold score."""
    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(
            f"no sentiment data at {path}. Export MOSEI transcripts and labels to a CSV with "
            "'text' and 'label' columns (label from -3 to +3). See docs/PIPELINE.md."
        )
    samples: list[Sample] = []
    if path.suffix.lower() == ".jsonl":
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                r = json.loads(line)
                samples.append(Sample(str(r["text"]), float(r["label"])))
    else:
        with path.open(encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                samples.append(Sample(str(r["text"]), float(r["label"])))
    return samples[:limit] if limit else samples


def _binary(score: float) -> int | None:
    """Positive/negative as 1/0, or None for exactly neutral (dropped from the pair test)."""
    if score > 0:
        return 1
    if score < 0:
        return 0
    return None


def evaluate_sentiment(scorer: SentimentScorer, samples: Sequence[Sample]) -> dict:
    """Score every sample and report accuracy and F1 (positive vs negative) and MAE."""
    preds = [scorer.score(s.text) for s in samples]

    abs_err = [abs(p - s.label) for p, s in zip(preds, samples)]
    mae = round(sum(abs_err) / len(abs_err), 4) if abs_err else 0.0

    # Binary metrics on the samples whose gold is not exactly neutral.
    pairs = [(_binary(s.label), _binary(p)) for s, p in zip(samples, preds)
             if _binary(s.label) is not None]
    # A neutral prediction on a non-neutral gold counts as the wrong class, never dropped.
    pairs = [(g, 0 if p is None else p) for g, p in pairs]

    correct = sum(1 for g, p in pairs if g == p)
    accuracy = round(correct / len(pairs), 4) if pairs else 0.0

    tp = sum(1 for g, p in pairs if g == 1 and p == 1)
    fp = sum(1 for g, p in pairs if g == 0 and p == 1)
    fn = sum(1 for g, p in pairs if g == 1 and p == 0)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = round(2 * precision * recall / (precision + recall), 4) if (precision + recall) else 0.0

    return {
        "scorer": getattr(scorer, "name", "unknown"),
        "n": len(samples),
        "n_binary": len(pairs),
        "accuracy": accuracy,
        "f1": f1,
        "mae": mae,
        "targets": TARGETS,
        "meets_accuracy": accuracy >= TARGETS["accuracy"],
        "meets_f1": f1 >= TARGETS["f1"],
        "meets_mae": mae <= TARGETS["mae"],
    }
