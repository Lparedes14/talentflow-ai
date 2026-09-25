"""Scoring skill extraction against the 220-resume labeled gold set.

## What this can and cannot measure

The proposal asks for "precision, recall and F1 against the 220 labeled resumes, F1 at or
above 0.75". **Precision is not computable from this dataset**, and saying so is more useful
than reporting a number that looks like precision but is not.

The reason is in the data: annotators marked *some* regions of each resume, not every skill
in it. Skills spans cover roughly 4% of a typical record, and skills named in the summary or
experience sections are usually unmarked. A skill we extract from an unannotated region is
therefore not a false positive, because nobody looked there. Counting it as one would punish
the extractor for working.

So this module reports four things it *can* stand behind:

1. **Span detection rate.** Of the regions a human marked as skills, in how many do we find
   at least one skill? Directly interpretable, and the closest honest thing to recall.
2. **Vocabulary ceiling.** Of those same regions, how many contain *any* term the O*NET
   vocabulary knows at all? This is the separation that matters: a region we miss because
   O*NET has no entry for it is a vocabulary problem, and no amount of matcher work fixes
   it. Reporting achieved against ceiling says which problem we actually have.
3. **Token coverage.** Within marked regions, the share of word tokens our spans cover.
   Coarse, because marked regions also contain filler like "Less than 1 year", but it moves
   when boundaries get better and the detection rate does not.
4. **Hallucination rate.** The proposal's own metric: the share of returned skills whose
   words are not in the source. By construction it is zero, since every match is a span of
   the document. Measuring it turns a design claim into a verified one.

## Why the unit is characters and tokens, not "skills"

The gold set does not define "a skill" consistently. 250 of its 472 Skills spans are under
30 characters (one skill, like 'CSS'); 76 are over 200 characters (an entire skills block,
up to 2,474 characters). Set comparison over "skills" would be comparing against a unit the
data does not have.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from ..skills.goldset import GoldResume, GoldSpan
from ..skills.vocabulary import SkillVocabulary
from ..text.tokenize import tokenize_spans


@dataclass
class SpanResult:
    """How one annotated region fared."""

    text: str
    found: list[str] = field(default_factory=list)
    findable: list[str] = field(default_factory=list)

    @property
    def detected(self) -> bool:
        return bool(self.found)

    @property
    def reachable(self) -> bool:
        """True when the vocabulary contains anything at all in this region."""
        return bool(self.findable)


def _covered_positions(matches: Sequence, lo: int, hi: int) -> set[int]:
    """Character positions inside [lo, hi) covered by any match."""
    covered: set[int] = set()
    for m in matches:
        start, end = max(m.char_start, lo), min(m.char_end, hi)
        if start < end:
            covered.update(range(start, end))
    return covered


def _as_record(resume: GoldResume) -> dict:
    """Wrap a gold resume as the record shape the extractors take.

    The gold set is raw text with no section markup, so it becomes a single unsectioned
    span. Both engines then read it through exactly the same path they use in production,
    which is the only way the comparison means anything.
    """
    return {
        "resume_id": f"gold-{resume.index}",
        "category": "gold",
        "text": resume.content,
        "sections": [{
            "name": "unsectioned", "heading": None, "text": resume.content,
            "char_start": 0, "char_end": len(resume.content),
        }],
    }


def evaluate_extraction(
    extractor,
    resumes: Sequence[GoldResume],
    min_confidence: str = "alias",
    skip_generic: bool = True,
    vocab: SkillVocabulary | None = None,
) -> dict:
    """Score any extractor against the gold set. Returns a report, not a single number.

    `extractor` is anything with `.extract(record)`, so the lexical and LLM engines are
    scored by identical code with the engine as the only variable. That is the same
    discipline the embedding backends are held to, and it is what makes the head-to-head
    comparison the contract asks for actually trustworthy.

    `vocab` supplies the ceiling, which is a property of the vocabulary rather than of the
    engine. It defaults to the extractor's own vocabulary when it has one.
    """
    vocab = vocab or getattr(extractor, "vocab", None)
    span_results: list[SpanResult] = []
    n_hallucinated = n_matches = 0
    token_hits = token_total = 0
    misses: list[str] = []
    reachable_misses: list[dict] = []   # engine missed it, yet the vocabulary could reach it
    gap_misses: list[str] = []          # no O*NET term in the region at all

    for resume in resumes:
        spans: list[GoldSpan] = resume.skill_spans
        if not spans:
            continue

        from ..skills.extractor import filter_by_confidence

        matches = [
            m for m in extractor.extract(_as_record(resume))
            if not (skip_generic and m.term.is_generic)
        ]
        matches = filter_by_confidence(matches, min_confidence)

        for m in matches:
            n_matches += 1
            # Every match must be a literal span of the source. This is the hallucination
            # check: it verifies the property rather than assuming it.
            if resume.content[m.char_start:m.char_end] != m.matched_text:
                n_hallucinated += 1

        for span in spans:
            inside = [m for m in matches if m.char_start >= span.start and m.char_end <= span.end]
            # The ceiling: what the vocabulary can find when pointed straight at this
            # region. A property of the vocabulary, not of the engine, so it is computed the
            # same way whichever engine is being scored, and both are read against one bar.
            findable = (
                filter_by_confidence(
                    [m for m in vocab.match(span.text)
                     if not (skip_generic and m.term.is_generic)],
                    min_confidence,
                )
                if vocab is not None else []
            )
            result = SpanResult(
                text=span.text,
                found=sorted({m.name for m in inside}),
                findable=sorted({m.name for m in findable}),
            )
            span_results.append(result)
            if not result.detected:
                misses.append(span.text)
                if result.reachable:
                    reachable_misses.append({
                        "region": " ".join(span.text.split())[:110],
                        "vocabulary_would_find": result.findable[:6],
                    })
                else:
                    gap_misses.append(" ".join(span.text.split())[:110])

            covered = _covered_positions(matches, span.start, span.end)
            for token in tokenize_spans(span.text):
                token_total += 1
                if (span.start + token.start) in covered:
                    token_hits += 1

    n_spans = len(span_results)
    detected = sum(1 for r in span_results if r.detected)
    reachable = sum(1 for r in span_results if r.reachable)

    pct = lambda a, b: round(100 * a / b, 2) if b else 0.0  # noqa: E731

    # A written diagnosis, not just a score. The lecture's point on prompt optimization is
    # that "a score of 0.62 tells you almost nothing"; what helps is knowing which regions
    # were missed and why. Two reasons a region is missed, and only one is worth fixing:
    # a vocabulary gap (O*NET has no term there, so no matcher change reaches it) versus a
    # reachable miss (the vocabulary has a term, but the engine did not return it). See F40.
    n_missed = n_spans - detected
    if n_missed == 0:
        summary = (f"The engine found at least one skill in every one of the {n_spans} "
                   "marked regions.")
    else:
        summary = (
            f"The engine missed {n_missed} of {n_spans} marked regions. "
            f"{len(gap_misses)} hold no O*NET term at all, so no matcher change can reach "
            f"them; that is a vocabulary gap, not a matcher fault. "
            f"{len(reachable_misses)} are reachable: O*NET has a term in the region but the "
            f"engine did not return it. Those are the ones worth fixing first."
        )

    return {
        "n_resumes_scored": sum(1 for r in resumes if r.skill_spans),
        "n_skill_spans": n_spans,
        "span_detection_rate_pct": pct(detected, n_spans),
        "vocabulary_ceiling_pct": pct(reachable, n_spans),
        "detection_vs_ceiling_pct": pct(detected, reachable),
        "token_coverage_pct": pct(token_hits, token_total),
        "hallucination": {
            "n_matches": n_matches,
            "n_not_in_source": n_hallucinated,
            "rate_pct": pct(n_hallucinated, n_matches),
        },
        "engine": getattr(extractor, "name", "unknown"),
        "min_confidence": min_confidence,
        "sample_misses": [m[:110] for m in misses[:12]],
        "diagnosis": {
            "summary": summary,
            "n_missed": n_missed,
            "missed_vocabulary_gap": len(gap_misses),
            "missed_but_reachable": len(reachable_misses),
            "reachable_miss_examples": reachable_misses[:12],
            "vocabulary_gap_examples": gap_misses[:8],
        },
    }
