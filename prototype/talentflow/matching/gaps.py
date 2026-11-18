"""Task 4: which skills should a candidate learn next, ranked by what they unlock.

Matching tells a person how well they fit each role. It does not tell them what to do about a
poor fit. This module answers the next question: of everything you are missing, which few
skills would open the most doors?

## The measure, and why it is this one

For one missing skill, its **score gain** is how much it would raise the candidate's match
scores, added up across every role in the pool. That is not a new formula. `match.py` scores
a role as the rarity-weighted share of its requirements the candidate holds, and learning one
skill raises that share by exactly `weight(skill) / total_weight(role)` for each role that
requires it. Summing that across roles is the total lift from learning the skill, so the
ranking here is built from the same arithmetic the matcher already uses. No new threshold, so
none of the calibration traps this project keeps hitting apply here.

Two skills that are both missing from the same role each add their own lift to that role,
and neither changes the other's, so the gains are independent. That means the best three
skills to learn are simply the three with the highest gain. There is no interaction to solve
for, which keeps the "learn these 3" answer honest and simple.

## What gets reported, and the honesty it carries

Gain is the ranking number, but a plain count rides alongside it: how many roles require the
skill that the candidate lacks. Same split as the matcher's coverage next to weighted score,
so the ranking is arguable rather than hidden inside one figure.

`held_by_candidates` is reported too, and it matters for reading the list. A skill no
candidate in the pool holds gets the highest rarity weight, so the vintage gap (F18) surfaces
here as well: `Terraform` and `Kafka` will rank high because the 2019 resume corpus predates
them, not because they are the wrong advice. Showing the supply count keeps that visible.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .match import Matcher
    from .profile import SkillProfile


@dataclass
class SkillLeverage:
    """One skill a candidate is missing, with the case for learning it."""

    skill: str
    score_gain: float               # total match-score lift across the pool, the ranking number
    roles_requiring: int            # roles that require it and the candidate lacks, the plain count
    rarity_weight: float            # the IDF weight: rarer in the pool means more valuable
    held_by_candidates: int         # how many candidates already hold it, the supply side
    example_roles: list[str] = field(default_factory=list)


def rank_skill_leverage(
    matcher: "Matcher",
    candidate: "SkillProfile",
    top_k: int = 10,
) -> list[SkillLeverage]:
    """Rank the skills a candidate is missing by how much learning each would unlock.

    Reads the role pool the matcher already holds, so it sees the same roles matching does.
    Returns the `top_k` highest-gain skills, most valuable first.
    """
    held = candidate.skill_names

    gain: dict[str, float] = defaultdict(float)
    roles: dict[str, int] = defaultdict(int)
    examples: dict[str, list[str]] = defaultdict(list)

    for posting in matcher.postings:
        required = posting.skill_names
        total_weight = sum(matcher.weight_of(s) for s in required) or 1.0
        label = posting.label or posting.profile_id
        for skill in required - held:
            gain[skill] += matcher.weight_of(skill) / total_weight
            roles[skill] += 1
            if len(examples[skill]) < 3 and label not in examples[skill]:
                examples[skill].append(label)

    leverage = [
        SkillLeverage(
            skill=skill,
            score_gain=round(gain[skill], 4),
            roles_requiring=roles[skill],
            rarity_weight=round(matcher.weight_of(skill), 4),
            held_by_candidates=matcher._holders.get(skill, 0),
            example_roles=examples[skill],
        )
        for skill in gain
    ]
    leverage.sort(key=lambda x: (-x.score_gain, -x.roles_requiring, x.skill))
    return leverage[:top_k]


def summarize_leverage(items: list[SkillLeverage], candidate: "SkillProfile") -> str:
    """A one-line, plain-language recommendation from the top of the ranking."""
    if not items:
        return (f"Candidate {candidate.profile_id} is missing no skills that any role in the "
                "pool demands.")
    top = items[:3]
    names = ", ".join(x.skill for x in top)
    roles = sum(x.roles_requiring for x in top)
    return (f"Learning {names} would raise this candidate's fit across roles the most, "
            f"touching {roles} role requirements they don't currently meet.")
