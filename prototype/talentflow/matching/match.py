"""Bi-directional matching: rank roles for a person, rank people for a role.

## The score

The proposal defines it: *"the share of a posting's required skills the person already has."*
That definition is kept, with one refinement, and the refinement is the interesting part.

**Plain coverage treats every skill as equally informative, and they are not.** A posting
asking for Python, Kubernetes and Attention to Detail is not one third satisfied by a
candidate who has only Attention to Detail. Nearly every candidate has that; almost none has
Kubernetes. So each skill is weighted by how rare it is in the candidate pool, which is
inverse document frequency, the same idea TF-IDF uses and for the same reason.

Both numbers are reported. `coverage` is the proposal's literal definition and is what goes
in the report; `weighted_score` is what the ranking uses. Showing both means the refinement
is visible and arguable rather than buried.

## Why the score is arithmetic and not a model

Recorded as D26 and worth restating where the code lives. TC6 requires the match score to
move under 5 points when a candidate's name, pronouns and school change. With a score
computed from skill sets, that is **guaranteed**: identity terms are not skills, so they are
not in the calculation and cannot affect it. With a model producing the score it would be a
property to test and hope for. The prototype makes fairness claims on screen, so it needs to
be the former.

## Coverage honesty

Every result reports how many of a role's requirements **no candidate in the pool has at
all**. This is the cheap mitigation for the corpus vintage gap (F18): the resume set is from
around 2019 and the postings from 2023 to 2024, so roles asking for Terraform or Kafka will
show low scores for a reason that has nothing to do with the candidates. Surfacing it per
match keeps that visible instead of letting it masquerade as a poor fit.
"""
from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass, field
from typing import Sequence

from .profile import SkillProfile


@dataclass
class MatchResult:
    """One candidate against one role, with the evidence a recruiter would ask for."""

    resume_id: str
    posting_id: str
    posting_title: str = ""
    company: str = ""

    matched: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    unmatchable: list[str] = field(default_factory=list)

    coverage: float = 0.0          # the proposal's definition: share of requirements held
    weighted_score: float = 0.0    # rarity-weighted, what ranking uses
    n_required: int = 0

    @property
    def summary(self) -> str:
        """A one-line explanation. Deliberately states the denominator."""
        return (f"{len(self.matched)} of {self.n_required} required skills "
                f"({self.coverage:.0%})")


class Matcher:
    """Ranks in both directions over a fixed candidate pool and role set."""

    def __init__(
        self,
        resumes: Sequence[SkillProfile],
        postings: Sequence[SkillProfile],
        min_required: int = 3,
    ):
        self.resumes = list(resumes)
        self.postings = [p for p in postings if len(p) >= min_required]
        self.min_required = min_required

        # How many candidates hold each skill. The basis for both the rarity weights and the
        # unmatchable count.
        self._holders: Counter[str] = Counter()
        for resume in self.resumes:
            self._holders.update(resume.skill_names)

        n = len(self.resumes) or 1
        # Smoothed IDF. A skill nobody holds still gets a finite weight rather than dividing
        # by zero, and a skill everybody holds still counts for a little rather than zero.
        self._weight = {
            skill: math.log(1 + n / (1 + count))
            for skill, count in self._holders.items()
        }
        self._max_weight = math.log(1 + n)

    def weight_of(self, skill: str) -> float:
        """Rarity weight. Unknown skills get the maximum, since nobody in the pool has them."""
        return self._weight.get(skill, self._max_weight)

    # ------------------------------------------------------------------ scoring

    def score(self, resume: SkillProfile, posting: SkillProfile) -> MatchResult:
        """Score one pair. Symmetric, so both ranking directions use it unchanged."""
        required = posting.skill_names
        held = resume.skill_names

        matched = sorted(required & held, key=lambda s: -self.weight_of(s))
        missing = sorted(required - held, key=lambda s: -self.weight_of(s))
        unmatchable = sorted(s for s in required if self._holders.get(s, 0) == 0)

        total_weight = sum(self.weight_of(s) for s in required) or 1.0
        matched_weight = sum(self.weight_of(s) for s in matched)

        return MatchResult(
            resume_id=resume.profile_id,
            posting_id=posting.profile_id,
            posting_title=posting.label,
            company=posting.company,
            matched=matched,
            missing=missing,
            unmatchable=unmatchable,
            coverage=len(matched) / len(required) if required else 0.0,
            weighted_score=matched_weight / total_weight,
            n_required=len(required),
        )

    # ----------------------------------------------------------------- ranking

    def roles_for(self, resume: SkillProfile, k: int = 10) -> list[MatchResult]:
        """Rank open roles for one person. The employee-facing direction."""
        scored = (self.score(resume, posting) for posting in self.postings)
        return sorted(scored, key=lambda r: -r.weighted_score)[:k]

    def candidates_for(self, posting: SkillProfile, k: int = 10) -> list[MatchResult]:
        """Rank internal candidates for one role. The recruiter-facing direction."""
        scored = (self.score(resume, posting) for resume in self.resumes)
        return sorted(scored, key=lambda r: -r.weighted_score)[:k]

    # ------------------------------------------------------------------- stats

    def pool_stats(self) -> dict:
        """Facts about the pool that every result has to be read against."""
        required = Counter()
        for posting in self.postings:
            required.update(posting.skill_names)

        held_by_nobody = [s for s in required if self._holders.get(s, 0) == 0]
        return {
            "n_resumes": len(self.resumes),
            "n_postings": len(self.postings),
            "distinct_skills_held": len(self._holders),
            "distinct_skills_required": len(required),
            "requirements_no_candidate_has": len(held_by_nobody),
            "top_unmatchable": Counter(
                {s: required[s] for s in held_by_nobody}
            ).most_common(10),
        }
