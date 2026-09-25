"""One place that constructs the skill vocabulary, for every caller.

## Why this exists

Building the vocabulary is three steps that have to happen in order: measure how common each
token is in the text it will meet, construct the alias index using those measurements, then
prune aliases that fire too often for the term they point at. Five callers were each doing
that dance separately, which is exactly how two of them quietly end up with different
vocabularies and an incomparable result.

## Why calibration reads postings as well as resumes

The pruning rule (D18) asks how often an alias fires *in the corpus*. Calibrating on resumes
alone produced a vocabulary that was wrong for job postings, and the evidence was immediate
once postings were extracted:

| alias | resolves to | fires on postings |
|---|---|---|
| `equal employment` | Equal employment opportunity EEO compliance software | 28 |
| `leverage` | IAD Audit Leverage | 17 |
| `automation` | Marketo Marketing Automation | 36 |
| `translate` | jalada GmbH Just Translate | 23 |
| `pipelines` | Graphics pipelines | 15 |
| `precision` | Power and Precision | 14 |

Every one is boilerplate or filler in a job advert and rare in a resume, so resume-only
calibration had no reason to touch them. `equal employment` is the clearest case: it comes
from the equal-opportunity paragraph that nearly every posting carries, and it was being
reported as a demanded skill.

**Both sides must share one vocabulary** or matching compares two different languages. So the
answer is not a second posting-specific vocabulary; it is one vocabulary calibrated against
all the text it will meet. An alias unsafe on either corpus is unsafe, and pruning it helps
both sides.

Postings are sampled rather than read whole. The pruning test is a *rate*, so a few thousand
documents estimate it as well as thirty thousand do, and calibration stays fast enough to run
on every script start.
"""
from __future__ import annotations

import json
import logging
from collections import Counter
from pathlib import Path
from typing import Iterable, Sequence

from ..config import INTERIM_DIR
from ..ingest.corpus import iter_corpus
from ..text.tokenize import tokenize
from .onet import load_vocabulary
from .vocabulary import SkillVocabulary

log = logging.getLogger(__name__)

POSTING_SAMPLE_PATH = INTERIM_DIR / "posting_sample.jsonl"
TECHNICAL_SAMPLE_PATH = INTERIM_DIR / "posting_sample_technical.jsonl"
DEFAULT_POSTING_SAMPLE = 2500

# A calibrated vocabulary shipped with the code, so the app starts instantly and reads no
# resumes and no O*NET. Regenerate with scripts/17_build_vocab_cache.py after changing the
# vocabulary, the corpus, or the O*NET data.
PREBUILT_VOCAB_PATH = Path(__file__).parent / "onet_vocab.json.gz"


def load_prebuilt_vocabulary(path: Path = PREBUILT_VOCAB_PATH):
    """Load the shipped calibrated vocabulary if present. Returns (vocab, report) or None."""
    if not Path(path).exists():
        return None
    import gzip
    try:
        with gzip.open(path, "rt", encoding="utf-8") as fh:
            data = json.load(fh)
        vocab = SkillVocabulary.from_dict(data)
        report = data.get("meta", {"n_pruned": 0, "corpus_sizes": []})
        log.info("loaded the prebuilt vocabulary from %s", path)
        return vocab, report
    except Exception as exc:  # noqa: BLE001 - a bad file should fall back to building
        log.warning("could not load prebuilt vocab (%s); building instead", exc)
        return None


def save_prebuilt_vocabulary(vocab, report, path: Path = PREBUILT_VOCAB_PATH) -> Path:
    """Write a calibrated vocabulary to the shipped file the app loads first."""
    import gzip
    data = vocab.to_dict()
    data["meta"] = {"n_pruned": report.get("n_pruned", 0),
                    "corpus_sizes": report.get("corpus_sizes", [])}
    with gzip.open(path, "wt", encoding="utf-8") as fh:
        json.dump(data, fh)
    return path


def document_frequency(corpora: Sequence[Iterable[dict]]) -> dict[str, float]:
    """Share of documents each token appears in, across every corpus combined."""
    counts: Counter[str] = Counter()
    n = 0
    for corpus in corpora:
        for record in corpus:
            n += 1
            counts.update(set(tokenize(record["text"])))
    return {token: c / n for token, c in counts.items()} if n else {}


def _cached_sample(path: Path, technical: bool, n: int, seed: int = 42) -> list[dict]:
    """A cached random sample of posting records. Delete the file to rebuild it."""
    if path.exists():
        with path.open() as fh:
            return [json.loads(line) for line in fh if line.strip()]

    try:
        from ..postings import load_postings, posting_to_record
    except ImportError:  # pragma: no cover
        return []

    try:
        postings = load_postings(technical_only=technical)
    except FileNotFoundError:
        log.info("no postings available; calibrating without them")
        return []

    # Random, not the first N. File order is not arbitrary, and taking the head of a CSV
    # sorted by anything at all produces a sample that is not representative of the rest.
    import random

    rng = random.Random(seed)
    if len(postings) > n:
        postings = rng.sample(postings, n)

    records = [posting_to_record(p) for p in postings]
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as fh:
        for record in records:
            # Only the fields calibration touches, so the cache stays small.
            fh.write(json.dumps({
                "resume_id": record["resume_id"], "text": record["text"],
                "sections": record["sections"],
            }) + "\n")
    log.info("cached %d %s postings for calibration", len(records),
             "technical" if technical else "general")
    return records


def ensure_posting_samples(n: int = DEFAULT_POSTING_SAMPLE) -> list[list[dict]]:
    """Two posting samples, kept as separate corpora on purpose.

    Technical postings are the working set for matching, and their vocabulary differs
    sharply from the rest: `apis`, `pipelines`, `scripting` and `automation` are everywhere
    in engineering adverts and rare in a warehouse advert. Pooled into one general sample
    they sit below the pruning threshold and survive, then fire on every posting we actually
    process. Kept as their own corpus, the per-corpus rule (D18) sees their real rate.

    This is the same dilution problem as mixing resumes with postings, one level down.
    """
    return [
        _cached_sample(TECHNICAL_SAMPLE_PATH, technical=True, n=n),
        _cached_sample(POSTING_SAMPLE_PATH, technical=False, n=n),
    ]


def build_skill_vocabulary(
    corpora: Sequence[Iterable[dict]] | None = None,
    calibrate: bool = True,
    include_postings: bool = True,
    technical_only: bool = False,
    cache_path=None,
) -> tuple[SkillVocabulary, dict]:
    """Build and calibrate the vocabulary. The single entry point every caller should use.

    Returns (vocabulary, calibration report).

    `cache_path` is an optional file to read a prebuilt vocabulary from, and to write one to
    after building. The app passes it so restarting the server does not repeat the roughly
    25-second build. Delete the file after changing the vocabulary, the corpus, or the O*NET
    data, or the app keeps serving the old one. The pipeline scripts leave it unset and always
    build fresh, so nothing they produce can go stale.
    """
    import pickle

    if cache_path is not None and Path(cache_path).exists():
        try:
            with open(cache_path, "rb") as fh:
                vocab, report = pickle.load(fh)
            log.info("loaded the vocabulary from cache %s", cache_path)
            return vocab, report
        except Exception as exc:  # noqa: BLE001 - a bad cache should rebuild, not crash
            log.warning("could not read vocab cache (%s); rebuilding", exc)

    if corpora is None:
        corpora = [list(iter_corpus())]
        if include_postings:
            corpora.extend(s for s in ensure_posting_samples() if s)

    materialized = [list(c) for c in corpora]
    sizes = [len(c) for c in materialized]
    log.info("building vocabulary over %s documents", " + ".join(str(s) for s in sizes))

    vocab = SkillVocabulary(load_vocabulary(technical_only=technical_only),
                            document_frequency(materialized))
    report = {"corpus_sizes": sizes, "n_pruned": 0}
    if calibrate:
        # One argument per corpus, so an alias is judged by its worst corpus rather than
        # by an average that hides it.
        report = vocab.calibrate(*materialized)

    if cache_path is not None:
        try:
            with open(cache_path, "wb") as fh:
                pickle.dump((vocab, report), fh)
            log.info("cached the vocabulary to %s", cache_path)
        except Exception as exc:  # noqa: BLE001
            log.warning("could not write vocab cache (%s)", exc)

    return vocab, report
