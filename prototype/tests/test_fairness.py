"""TC6: identity must not change what the system says about a candidate."""

from talentflow.eval.fairness import (
    ALL_NAMES, GIVEN_NAMES, IDENTITIES, Identity, identity_sensitivity,
    name_alias_collisions, perturb_identity,
)


def _record(header="Alex Taylor", body="Built services in Python and SQL."):
    return {
        "resume_id": "r1",
        "text": header + "\n" + body,
        "sections": [
            {"name": "header", "heading": None, "text": header, "char_start": 0,
             "char_end": len(header)},
            {"name": "experience", "heading": "Experience", "text": body,
             "char_start": len(header) + 1, "char_end": len(header) + 1 + len(body)},
        ],
    }


def test_identity_goes_into_the_header_not_the_first_section():
    """A real resume puts the name in the header. Injecting it anywhere else would test a
    document shape that does not occur, and would make the result look better than it is."""
    record = _record()
    out = perturb_identity(record, Identity("x", "Cassandra Jenkins", "she/her", "MIT"))
    assert "Cassandra Jenkins" in out["sections"][0]["text"]
    assert out["sections"][1]["text"] == record["sections"][1]["text"]


def test_collision_audit_finds_a_name_that_is_also_a_skill():
    """The audit's whole job. A vocabulary where `ruby` is an alias must report it."""

    class _Term:
        term = "Ruby"
        n_occupations = 33

    class _Vocab:
        aliases = {"ruby": [_Term()], "python": [_Term()], "kubernetes": [_Term()]}
        alias_confidence = {"ruby": "exact", "python": "exact", "kubernetes": "exact"}

    found = {c.alias for c in name_alias_collisions(_Vocab())}
    assert "ruby" in found
    assert "kubernetes" not in found


def test_the_name_list_covers_more_than_one_demographic():
    """A fairness test drawn from one naming tradition measures nothing about fairness."""
    for name in ("lakisha", "guadalupe", "rahul", "emily", "hiroshi"):
        assert name in GIVEN_NAMES, name
    assert len(ALL_NAMES) > 250


def test_a_header_only_difference_does_not_reach_the_skill_set():
    """F32. The default extractor skips the header, so a surname that is also a vendor
    product name cannot be scored as a skill."""

    class _Match:
        def __init__(self, name):
            self.name = name

    class _Extractor:
        """Stands in for the real one: reports a skill for every known word it sees, but
        only in the sections it is given."""

        def extract(self, record):
            seen = " ".join(s["text"] for s in record["sections"]
                            if s["name"] != "header").lower()
            return [_Match(w.title()) for w in ("python", "cassandra", "jenkins")
                    if w in seen]

    results = identity_sensitivity(_Extractor(), [_record()], IDENTITIES)
    assert results[0].changed == {}, results[0].changed


def test_the_same_difference_is_caught_when_the_header_is_searched():
    """The negative control. If skipping the header were not doing the work, this test
    would pass too, and the one above would prove nothing."""

    class _Match:
        def __init__(self, name):
            self.name = name

    class _Extractor:
        def extract(self, record):
            seen = " ".join(s["text"] for s in record["sections"]).lower()
            return [_Match(w.title()) for w in ("python", "cassandra", "jenkins")
                    if w in seen]

    results = identity_sensitivity(_Extractor(), [_record()], IDENTITIES)
    assert "collision" in results[0].changed
    assert results[0].changed["collision"] == {"Cassandra", "Jenkins"}


# ----------------------------------------------------------- the LLM path (F42)

def _skill_vocab(names):
    from talentflow.skills.onet import SkillTerm, normalize_term
    from talentflow.skills.vocabulary import SkillVocabulary
    terms = [SkillTerm(n, normalize_term(n), "software", "technical", 33, False, False)
             for n in names]
    return SkillVocabulary(terms, {})


def test_llm_fairness_harness_catches_a_name_read_as_a_skill():
    """The LLM reads the whole resume, name included, so it can fail TC6 where the
    deterministic scorer cannot. Here the model always returns Ruby quoting the school name.
    Grounding makes that skill survive only under the identity whose school is Ruby Valley
    College, which is exactly an identity leak, and the harness must catch it."""
    import json
    from talentflow.llm import MockClient
    from talentflow.skills.extractor import LLMExtractor

    resp = json.dumps([{"skill": "Ruby", "quote": "Ruby Valley College",
                        "category": "technical"}])
    ex = LLMExtractor(MockClient(resp), _skill_vocab(["Ruby"]))
    results = identity_sensitivity(ex, [_record()], IDENTITIES)
    assert "collision" in results[0].changed
    assert results[0].changed["collision"] == {"Ruby"}


def test_llm_fairness_is_clean_when_skills_come_from_the_body():
    """A skill quoted from the unchanged body is present under every identity, so nothing
    moves. This is the plumbing test: a stable model gives a stable skill set."""
    import json
    from talentflow.llm import MockClient
    from talentflow.skills.extractor import LLMExtractor

    resp = json.dumps([{"skill": "Python", "quote": "Python", "category": "technical"}])
    ex = LLMExtractor(MockClient(resp), _skill_vocab(["Python"]))
    results = identity_sensitivity(ex, [_record()], IDENTITIES)
    assert results[0].changed == {}
