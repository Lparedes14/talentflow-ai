"""Unit tests for skill-gap leverage (task 4)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.matching import Matcher, rank_skill_leverage, summarize_leverage
from talentflow.matching.profile import SkillEvidence, SkillProfile


def prof(pid, kind="resume", skills=(), label=""):
    p = SkillProfile(pid, kind, label=label)
    for s in skills:
        p.skills[s] = SkillEvidence(s, "skills", 0, len(s), "exact")
        p.categories[s] = "technical"
    return p


def test_a_skill_more_roles_demand_ranks_higher():
    candidate = prof("c", skills=["Python"])
    postings = [prof("p1", "posting", ["Python", "Scala"]),
                prof("p2", "posting", ["Python", "Scala"]),
                prof("p3", "posting", ["Python", "Kafka"])]
    m = Matcher([candidate] + [prof(f"r{i}", skills=["Python"]) for i in range(5)],
                postings, min_required=1)
    top = rank_skill_leverage(m, candidate)[0]
    assert top.skill == "Scala"          # two roles demand it, versus one for Kafka
    assert top.roles_requiring == 2


def test_a_skill_the_candidate_has_is_never_recommended():
    candidate = prof("c", skills=["Python", "SQL"])
    m = Matcher([candidate], [prof("p1", "posting", ["Python", "SQL"])], min_required=1)
    assert rank_skill_leverage(m, candidate) == []


def test_held_by_candidates_reports_the_supply_side():
    candidate = prof("c", skills=[])
    pool = [candidate] + [prof(f"r{i}", skills=["SQL"]) for i in range(3)]
    m = Matcher(pool, [prof("p1", "posting", ["SQL", "Rust"])], min_required=1)
    by = {x.skill: x for x in rank_skill_leverage(m, candidate)}
    assert by["SQL"].held_by_candidates == 3
    assert by["Rust"].held_by_candidates == 0


def test_top_k_limits_the_list():
    candidate = prof("c", skills=[])
    posting = prof("p1", "posting", ["A", "B", "C", "D", "E"])
    m = Matcher([candidate], [posting], min_required=1)
    assert len(rank_skill_leverage(m, candidate, top_k=3)) == 3


def test_summary_names_a_top_skill():
    candidate = prof("c", skills=[])
    m = Matcher([candidate], [prof("p1", "posting", ["Scala", "Kafka", "Docker"])],
                min_required=1)
    assert "Scala" in summarize_leverage(rank_skill_leverage(m, candidate), candidate)


def test_summary_handles_a_candidate_with_no_gaps():
    candidate = prof("c", skills=["Python"])
    m = Matcher([candidate], [prof("p1", "posting", ["Python"])], min_required=1)
    assert "missing no skills" in summarize_leverage([], candidate)
