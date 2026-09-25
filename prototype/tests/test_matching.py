"""Unit tests for bi-directional matching (task 3)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.matching import Matcher, SkillProfile
from talentflow.matching.profile import SkillEvidence, _profile_from_record


def prof(pid, kind="resume", skills=(), label="", company=""):
    p = SkillProfile(pid, kind, label=label, company=company)
    for s in skills:
        p.skills[s] = SkillEvidence(s, "skills", 0, len(s), "exact")
        p.categories[s] = "technical"
    return p


# --------------------------------------------------------------------- scoring

def test_coverage_is_the_share_of_required_skills_held():
    """The proposal's literal definition, kept verbatim."""
    m = Matcher([prof("r1", skills=["Python", "SQL"])],
                [prof("p1", "posting", ["Python", "SQL", "Go", "Rust"])], min_required=1)
    assert m.score(m.resumes[0], m.postings[0]).coverage == 0.5


def test_rare_skills_outweigh_ubiquitous_ones():
    """A posting is not one third satisfied by the one skill everybody already has."""
    resumes = [prof("has_rare", skills=["Kubernetes", "Common"]),
               prof("has_common", skills=["Common"])] + \
              [prof(f"r{i}", skills=["Common"]) for i in range(8)]
    posting = prof("p1", "posting", ["Kubernetes", "Common"])
    m = Matcher(resumes, [posting], min_required=1)
    rare = m.score(resumes[0], posting)
    common = m.score(resumes[1], posting)
    assert rare.coverage > common.coverage
    assert rare.weighted_score > common.weighted_score
    # The weighted gap must be wider than the plain one, or weighting achieved nothing.
    assert (rare.weighted_score - common.weighted_score) > (rare.coverage - common.coverage)


def test_missing_skills_are_the_gap_list():
    m = Matcher([prof("r1", skills=["Python"])],
                [prof("p1", "posting", ["Python", "Scala"])], min_required=1)
    result = m.score(m.resumes[0], m.postings[0])
    assert result.matched == ["Python"] and result.missing == ["Scala"]


def test_gap_list_has_no_false_gaps():
    """TC2: the gap names skills in the posting missing from the resume, and nothing else."""
    m = Matcher([prof("r1", skills=["Python", "Excel"])],
                [prof("p1", "posting", ["Python", "Scala"])], min_required=1)
    result = m.score(m.resumes[0], m.postings[0])
    assert "Excel" not in result.missing          # held but not required
    assert set(result.missing) <= m.postings[0].skill_names


def test_a_perfect_match_scores_one():
    m = Matcher([prof("r1", skills=["Python", "SQL"])],
                [prof("p1", "posting", ["Python", "SQL"])], min_required=1)
    r = m.score(m.resumes[0], m.postings[0])
    assert r.coverage == 1.0 and r.weighted_score == pytest.approx(1.0)


def test_no_overlap_scores_zero():
    m = Matcher([prof("r1", skills=["Chef"])],
                [prof("p1", "posting", ["Python"])], min_required=1)
    assert m.score(m.resumes[0], m.postings[0]).coverage == 0.0


# ------------------------------------------------------------------- fairness

def test_identity_changes_cannot_move_the_score_at_all():
    """TC6. The proposal allows under 5 points of drift; scoring over skill sets makes it
    exactly zero, because a name is not a skill and never enters the calculation."""
    skills = ["Python", "SQL", "Kubernetes"]
    posting = prof("p1", "posting", ["Python", "SQL", "Go"])
    pool = [prof(f"other{i}", skills=["Python"]) for i in range(5)]

    original = prof("Jane Doe, Stanford", skills=skills)
    swapped = prof("John Smith, State College", skills=skills)

    m = Matcher(pool + [original, swapped], [posting], min_required=1)
    a = m.score(original, posting)
    b = m.score(swapped, posting)
    assert a.coverage == b.coverage
    assert a.weighted_score == b.weighted_score
    assert a.matched == b.matched and a.missing == b.missing


def test_ranking_order_is_unchanged_by_identity():
    """The second half of TC6: the top-k order must hold, not just the score."""
    posting = prof("p1", "posting", ["Python", "SQL"])
    pool = [prof("A", skills=["Python", "SQL"]), prof("B", skills=["Python"]),
            prof("C", skills=[])]
    before = [r.resume_id for r in Matcher(pool, [posting], min_required=1).candidates_for(posting)]
    renamed = [prof("Zachary", skills=["Python", "SQL"]), prof("Aaron", skills=["Python"]),
               prof("Mildred", skills=[])]
    after = [r.resume_id for r in Matcher(renamed, [posting], min_required=1).candidates_for(posting)]
    assert [p.profile_id for p in pool].index(before[0]) == \
           [p.profile_id for p in renamed].index(after[0])


# ------------------------------------------------------- corpus honesty

def test_requirements_no_candidate_holds_are_reported():
    """The vintage gap made visible per match, rather than masquerading as a poor fit."""
    m = Matcher([prof("r1", skills=["Python"])],
                [prof("p1", "posting", ["Python", "Terraform"])], min_required=1)
    result = m.score(m.resumes[0], m.postings[0])
    assert result.unmatchable == ["Terraform"]
    assert m.pool_stats()["requirements_no_candidate_has"] == 1


def test_a_skill_nobody_holds_still_gets_a_finite_weight():
    """Smoothing: it must not divide by zero, and it must outrank everything held."""
    m = Matcher([prof("r1", skills=["Common"])], [prof("p1", "posting", ["Common"])],
                min_required=1)
    assert m.weight_of("NeverSeen") > m.weight_of("Common")
    assert m.weight_of("NeverSeen") < float("inf")


# --------------------------------------------------------------------- ranking

def test_both_directions_use_the_same_scoring():
    resume = prof("r1", skills=["Python", "SQL"])
    posting = prof("p1", "posting", ["Python", "SQL", "Go"])
    m = Matcher([resume], [posting], min_required=1)
    assert m.roles_for(resume)[0].weighted_score == \
           m.candidates_for(posting)[0].weighted_score


def test_ranking_is_ordered_and_respects_k():
    posting = prof("p1", "posting", ["Python", "SQL", "Go"])
    pool = [prof("a", skills=["Python", "SQL", "Go"]), prof("b", skills=["Python", "SQL"]),
            prof("c", skills=["Python"]), prof("d", skills=[])]
    out = Matcher(pool, [posting], min_required=1).candidates_for(posting, k=2)
    assert len(out) == 2
    assert out[0].weighted_score >= out[1].weighted_score


def test_thin_postings_are_excluded_from_the_role_set():
    """A role listing one skill produces a meaningless 0% or 100%."""
    m = Matcher([prof("r1", skills=["Python"])],
                [prof("thin", "posting", ["Python"]),
                 prof("real", "posting", ["Python", "SQL", "Go"])], min_required=3)
    assert [p.profile_id for p in m.postings] == ["real"]


def test_empty_pool_does_not_crash():
    m = Matcher([], [prof("p1", "posting", ["Python", "SQL", "Go"])])
    assert m.candidates_for(m.postings[0]) == []
    assert m.pool_stats()["n_resumes"] == 0


# --------------------------------------------------------------------- loading

def test_profile_keeps_the_first_evidence_for_a_repeated_skill():
    record = {"resume_id": "r1", "category": "IT", "skills": [
        {"name": "Python", "matched_text": "Python", "char_start": 10, "char_end": 16,
         "section": "skills", "confidence": "exact", "skill_category": "technical"},
        {"name": "Python", "matched_text": "python", "char_start": 90, "char_end": 96,
         "section": "experience", "confidence": "alias", "skill_category": "technical"},
    ]}
    p = _profile_from_record(record, "resume")
    assert len(p) == 1
    assert p.skills["Python"].char_start == 10


def test_posting_and_resume_records_both_load():
    resume = _profile_from_record({"resume_id": "r1", "category": "IT", "skills": []}, "resume")
    posting = _profile_from_record(
        {"job_id": "p1", "title": "Engineer", "company": "Acme", "skills": []}, "posting")
    assert resume.label == "IT" and posting.label == "Engineer" and posting.company == "Acme"
