"""Loader for the dataturks 'Entity Recognition in Resumes' gold set (220 resumes).

This is the labeled data the proposal names for scoring skill extraction. Three things
about it have to be understood before any number computed from it means anything.

## 1. The `end` offset is inclusive

Not one of the 3,558 annotation points matches `content[start:end]`. 3,335 of them match
`content[start:end + 1]`. Anyone slicing it the normal Python way silently loses the last
character of every span, which turns 'SQL' into 'SQ' and quietly wrecks every downstream
comparison without raising anything.

## 2. 223 points (6.3%) have offsets that are simply wrong

They match at neither `end` nor `end + 1`. They are dropped, and the count is reported, so
the loss is visible rather than absorbed.

## 3. The annotations are NOT exhaustive, which limits what can be measured

Annotators marked *some* regions of each resume, not every skill in it. In a typical record
the Skills spans cover about 4% of the text, and skills named in the summary or the
experience section are usually unmarked.

**This means precision cannot be computed from this dataset.** A skill we extract from an
unannotated region is not a false positive; nobody looked there. Counting it as one would
punish the extractor for finding real skills.

What the set *can* support is recall against what was marked, which is a genuine and
useful measurement, and it is what `talentflow.eval.extraction` computes.

The annotation unit is also inconsistent: 250 of 472 Skills spans are under 30 characters
(one skill, like 'CSS'), while 76 are over 200 characters (an entire skills block, up to
2,474 characters). So recall is measured over characters and tokens rather than over
'skills', because 'a skill' is not a unit this data defines consistently.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path

from ..config import KAGGLE_ROOT

log = logging.getLogger(__name__)

GOLDSET_PATH = KAGGLE_ROOT / "Entity Recognition in Resumes.json"

SKILL_LABEL = "Skills"


@dataclass
class GoldSpan:
    """One annotated region. `end` is exclusive here, unlike the source file."""

    label: str
    text: str
    start: int
    end: int


@dataclass
class GoldResume:
    """One labeled resume."""

    index: int
    content: str
    spans: list[GoldSpan] = field(default_factory=list)

    def spans_for(self, label: str) -> list[GoldSpan]:
        return [s for s in self.spans if s.label == label]

    @property
    def skill_spans(self) -> list[GoldSpan]:
        return self.spans_for(SKILL_LABEL)


def load_goldset(path: Path = GOLDSET_PATH) -> tuple[list[GoldResume], dict]:
    """Load the gold set. Returns (resumes, a report on what was dropped and why).

    Offsets are normalized to Python's half-open convention so callers can slice normally.
    """
    if not path.exists():
        raise FileNotFoundError(
            f"gold set not found at {path}. Download 'Entity Recognition in Resumes' from "
            "https://www.kaggle.com/datasets/dataturks/resume-entities-for-ner"
        )

    resumes: list[GoldResume] = []
    stats = {"points_total": 0, "points_inclusive_end": 0, "points_dropped": 0,
             "records_unparsable": 0}

    with path.open(encoding="utf-8") as fh:
        for i, line in enumerate(fh):
            if not line.strip():
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                stats["records_unparsable"] += 1
                continue

            content = raw.get("content") or ""
            spans: list[GoldSpan] = []

            for annotation in (raw.get("annotation") or []):
                labels = annotation.get("label") or []
                label = labels[0] if labels else "UNKNOWN"
                for point in (annotation.get("points") or []):
                    stats["points_total"] += 1
                    start, end, text = point.get("start"), point.get("end"), point.get("text", "")
                    if start is None or end is None:
                        stats["points_dropped"] += 1
                        continue
                    if content[start:end] == text:
                        span_end = end
                    elif content[start:end + 1] == text:
                        span_end = end + 1
                        stats["points_inclusive_end"] += 1
                    else:
                        stats["points_dropped"] += 1
                        continue
                    spans.append(GoldSpan(label, text, start, span_end))

            resumes.append(GoldResume(index=i, content=content, spans=spans))

    stats["n_resumes"] = len(resumes)
    stats["n_with_skill_spans"] = sum(1 for r in resumes if r.skill_spans)
    stats["dropped_pct"] = (
        round(100 * stats["points_dropped"] / stats["points_total"], 2)
        if stats["points_total"] else 0.0
    )
    log.info("gold set: %d resumes, %d points, %d dropped (%.1f%%)",
             stats["n_resumes"], stats["points_total"], stats["points_dropped"],
             stats["dropped_pct"])
    return resumes, stats
