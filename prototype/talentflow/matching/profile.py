"""A skill profile: what one person has, or what one role requires.

Both sides reduce to the same object, which is the payoff of shaping postings like resumes
back in D37. A profile is a set of O*NET skill names plus the evidence for each, so a match
between two profiles is a comparison within one vocabulary rather than between two.

Evidence is carried, not discarded. The proposal commits to explanations a recruiter can act
on, and "you have Python" is worth far less than "you have Python, and here is the line in
your resume that says so".
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterator

from ..config import INTERIM_DIR


@dataclass
class SkillEvidence:
    """Where a skill was found, and what confidence the extractor had in it."""

    matched_text: str
    section: str | None
    char_start: int
    char_end: int
    confidence: str


@dataclass
class SkillProfile:
    """One resume or one posting, reduced to skills with evidence."""

    profile_id: str
    kind: str                       # "resume" or "posting"
    label: str = ""                 # job family for a resume, job title for a posting
    company: str = ""
    skills: dict[str, SkillEvidence] = field(default_factory=dict)
    categories: dict[str, str] = field(default_factory=dict)   # skill -> technical/soft/process

    @property
    def skill_names(self) -> set[str]:
        return set(self.skills)

    def __len__(self) -> int:
        return len(self.skills)


def _profile_from_record(record: dict, kind: str) -> SkillProfile:
    """Build a profile from one line of an extraction output file.

    Where a skill appears several times, the first occurrence is kept as its evidence. It is
    the earliest thing a reader would find, and the extraction files are written in document
    order, so "first" means "nearest the top of the page".
    """
    profile = SkillProfile(
        profile_id=str(record.get("resume_id") or record.get("job_id")),
        kind=kind,
        label=str(record.get("title") or record.get("category") or ""),
        company=str(record.get("company") or ""),
    )
    for skill in record.get("skills", []):
        name = skill["name"]
        if name in profile.skills:
            continue
        profile.skills[name] = SkillEvidence(
            matched_text=skill.get("matched_text", ""),
            section=skill.get("section"),
            char_start=skill.get("char_start", 0),
            char_end=skill.get("char_end", 0),
            confidence=skill.get("confidence", "alias"),
        )
        profile.categories[name] = skill.get("skill_category", "technical")
    return profile


def _iter_profiles(path: Path, kind: str) -> Iterator[SkillProfile]:
    if not path.exists():
        raise FileNotFoundError(
            f"no extraction output at {path}. Run the matching extraction scripts first."
        )
    with path.open() as fh:
        for line in fh:
            if line.strip():
                yield _profile_from_record(json.loads(line), kind)


def load_resume_profiles(
    path: Path = INTERIM_DIR / "resume_skills.jsonl",
    categories: set[str] | None = None,
) -> list[SkillProfile]:
    """Load candidate profiles. `categories` narrows to job families, e.g. the technical ones."""
    profiles = list(_iter_profiles(path, "resume"))
    if categories:
        profiles = [p for p in profiles if p.label in categories]
    return profiles


def load_posting_profiles(path: Path | None = None) -> list[SkillProfile]:
    """Load role profiles. Defaults to the full technical posting extraction."""
    return list(_iter_profiles(path or (INTERIM_DIR / "posting_skills.jsonl"), "posting"))
