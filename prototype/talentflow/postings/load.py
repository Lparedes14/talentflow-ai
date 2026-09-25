"""Load LinkedIn job postings and shape them like resumes.

## The unification that makes this cheap

A posting becomes the same record shape a resume becomes: an id, a category, normalized
text, and a list of sections with character offsets. That one decision means the skill
extractor, the chunker, the vocabulary, the confidence tiers and the evidence citation all
work on postings with no changes at all. Matching compares two things built by the same
code, which is the only way "this candidate has 7 of the 9 required skills" is a sentence
about one vocabulary rather than two.

Postings get two sections, `title` and `description`, because the distinction carries real
information: "Senior Java Developer" states the role, while the description mixes
requirements with benefits, company boilerplate and equal-opportunity statements.

## Data quality, measured rather than assumed

Unlike the resume PDFs, these are clean. Across 123,842 descriptions:

| Defect | Rate |
|---|---|
| HTML tags | 0.0% |
| HTML entities | 0.2% |
| Bullet glyphs | 3.5% |
| Double-encoded UTF-8 | 0.0% |
| U+FFFD | 0.1% |

So the shared `normalize()` is enough, plus entity unescaping. No posting-specific repair
work was needed, which is worth recording because the proposal budgeted for "strip HTML".

## On the IT and ENG skill codes

`job_skills.csv` tags 30,056 postings `IT` or `ENG`, and that is the cheap way to select
technical roles. It is also visibly noisy: the tagged set includes "Warehouse Team Lead",
"Lab Support Technician/Phlebotomist I" and "Buried Drop Technician". Treated as ground
truth it would quietly corrupt every matching result downstream, which is the argument for
replacing it with a validated labeling function.
"""
from __future__ import annotations

import html
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator, Sequence

import pandas as pd

from ..config import POSTINGS_ROOT
from ..ingest.normalize import normalize
from ..ingest.sections import Section
from ..text.tokenize import tokenize

log = logging.getLogger(__name__)

POSTINGS_CSV = POSTINGS_ROOT / "postings.csv"
JOB_SKILLS_CSV = POSTINGS_ROOT / "jobs" / "job_skills.csv"
SKILL_NAMES_CSV = POSTINGS_ROOT / "mappings" / "skills.csv"

# LinkedIn's own coarse codes for technical work. 35 codes exist; these two are the
# technical ones. Used as a cheap pre-filter, never as ground truth.
TECHNICAL_CODES = frozenset({"IT", "ENG"})

_TAG_RE = re.compile(r"<[a-z/][^>]*>", re.IGNORECASE)


@dataclass
class Posting:
    """One job posting, normalized and sectioned like a resume."""

    job_id: str
    title: str
    description: str
    skill_codes: list[str] = field(default_factory=list)
    company: str = ""

    @property
    def is_technical_by_code(self) -> bool:
        """LinkedIn's own answer. A pre-filter, not a label to trust."""
        return bool(TECHNICAL_CODES & set(self.skill_codes))


def clean_posting_text(text: str) -> str:
    """Drop the rare stray tag, unescape entities, then apply the shared normalizer.

    **Order matters, and the obvious order is wrong.** Unescaping first turns an escaped
    `&lt;div&gt;` into a real `<div>`, which the tag stripper then deletes. But an escaped
    tag in a posting is content, not markup: "experience with &lt;div&gt; layouts" is a
    front-end role describing itself, and deleting it loses a real skill mention.

    Stripping first and unescaping second keeps that distinction: genuine markup is removed
    while text *about* markup survives.
    """
    if not isinstance(text, str) or not text.strip():
        return ""
    text = _TAG_RE.sub(" ", text)
    text = html.unescape(text)
    return normalize(text)


def posting_to_record(posting: Posting) -> dict:
    """Turn a posting into the record shape the extractor and chunker already accept."""
    title = clean_posting_text(posting.title)
    description = clean_posting_text(posting.description)

    sections: list[Section] = []
    text_parts: list[str] = []
    cursor = 0
    for name, body in (("title", title), ("description", description)):
        if not body:
            continue
        sections.append(Section(name=name, heading=None, text=body,
                                char_start=cursor, char_end=cursor + len(body)))
        text_parts.append(body)
        cursor += len(body) + 1  # the newline that joins them

    text = "\n".join(text_parts)
    return {
        "resume_id": posting.job_id,          # the extractor's id field; a posting id here
        "category": "posting",
        "source_path": str(POSTINGS_CSV),
        "n_pages": 1,
        "n_chars_raw": len(posting.description or ""),
        "n_chars_clean": len(text),
        "n_words": len(text.split()),
        "text": text,
        "sections": [
            {"name": s.name, "heading": s.heading, "text": s.text,
             "char_start": s.char_start, "char_end": s.char_end}
            for s in sections
        ],
        "section_names": sorted({s.name for s in sections}),
        "residual_artifacts": 0,
        "extract_error": None,
        "title": title,
        "company": posting.company,
        "skill_codes": posting.skill_codes,
    }


def drop_company_name_matches(matches, company: str):
    """Remove skills that matched the employer's own name.

    Observed on Ingersoll Rand, where "Rand" matched **Rand McNally World Digital
    Database** across all 141 of their postings. A company name appears in nearly every
    line of its own advert, so one collision with a product name contaminates that
    employer's entire skill profile, and it looks perfectly plausible in the output.

    Matching is on the company's individual name tokens, because the name rarely appears
    the same way twice ("Ingersoll Rand", "Ingersoll-Rand plc", "Ingersoll Rand Inc").
    """
    if not company:
        return list(matches)
    name_tokens = {t for t in tokenize(company) if len(t) > 2}
    if not name_tokens:
        return list(matches)
    return [m for m in matches
            if not set(tokenize(m.matched_text)).issubset(name_tokens)]


def load_postings(
    postings_csv: Path = POSTINGS_CSV,
    job_skills_csv: Path = JOB_SKILLS_CSV,
    technical_only: bool = True,
    company: str | Sequence[str] | None = None,
    limit: int | None = None,
) -> list[Posting]:
    """Load postings, joined to their skill codes.

    `technical_only` narrows to LinkedIn's IT and ENG codes. That is for evaluation clarity
    rather than compute: matching a chef's resume against engineering roles produces noise
    that then has to be explained away. It is a flag, so widening to all 24 resume
    categories later is a parameter change rather than a rewrite.

    `company` narrows to one employer, which is what an *internal* talent marketplace
    actually is. Matching across all of LinkedIn is a job board; matching inside one company
    is the product. Note that the highest-volume posters in this dataset are staffing
    agencies and job boards (Dice, TEKsystems, Apex Systems, Insight Global), which have no
    internal workforce and are the wrong shape for this.
    """
    if not postings_csv.exists():
        raise FileNotFoundError(f"postings not found at {postings_csv}")

    codes: dict[str, list[str]] = {}
    if job_skills_csv.exists():
        frame = pd.read_csv(job_skills_csv, dtype={"job_id": str})
        for job_id, group in frame.groupby("job_id")["skill_abr"]:
            codes[job_id] = sorted(set(group.dropna()))

    wanted = None
    if technical_only:
        wanted = {j for j, c in codes.items() if TECHNICAL_CODES & set(c)}
        log.info("%d postings carry an IT or ENG code", len(wanted))

    frame = pd.read_csv(
        postings_csv,
        usecols=["job_id", "title", "description", "company_name"],
        dtype={"job_id": str},
    )
    frame = frame[frame.description.notna()]
    if company:
        wanted_companies = [company] if isinstance(company, str) else list(company)
        frame = frame[frame.company_name.isin(wanted_companies)]
    if wanted is not None:
        frame = frame[frame.job_id.isin(wanted)]
    if limit:
        frame = frame.head(limit)

    return [
        Posting(
            job_id=str(row.job_id),
            title=str(row.title) if pd.notna(row.title) else "",
            description=str(row.description),
            skill_codes=codes.get(str(row.job_id), []),
            company=str(row.company_name) if pd.notna(row.company_name) else "",
        )
        for row in frame.itertuples(index=False)
    ]


def iter_postings(**kwargs) -> Iterator[dict]:
    """Stream postings already shaped as records."""
    for posting in load_postings(**kwargs):
        yield posting_to_record(posting)
