"""Unit tests for the two extraction engines.

All of these run with a MockClient: no API key, no network, no cost. That is the point of
the seam. The LLM engine's behaviour has to be testable or nobody will change its prompt.
"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.llm import MockClient
from talentflow.skills.extractor import (
    LLMExtractor, LexicalExtractor, OnetMapper, _normalized_find, filter_by_confidence,
)
from talentflow.skills.onet import SkillTerm, normalize_term
from talentflow.skills.vocabulary import SkillVocabulary

RESUME_TEXT = """SENIOR DATA ANALYST
Summary
Ten years building reports.
Skills
Python, Microsoft Excel, and Tableau
Experience
Built dashboards in Tableau for the finance team.
"""


def _record(text=RESUME_TEXT):
    sections, pos = [], 0
    for name, body in [("header", "SENIOR DATA ANALYST"),
                       ("summary", "Ten years building reports."),
                       ("skills", "Python, Microsoft Excel, and Tableau"),
                       ("experience", "Built dashboards in Tableau for the finance team.")]:
        start = text.find(body)
        sections.append({"name": name, "text": body, "heading": None,
                         "char_start": start, "char_end": start + len(body)})
    return {"resume_id": "r1", "category": "IT", "text": text, "sections": sections}


def _term(name, n_occ=100, category="technical"):
    return SkillTerm(name, normalize_term(name), "software", category, n_occ, False, False)


def _vocab(names=("Python", "Microsoft Excel", "Tableau")):
    return SkillVocabulary([_term(n) for n in names], {})


def _response(items):
    return json.dumps(items)


# ------------------------------------------------------------------- lexical

def test_lexical_extractor_returns_matches_with_offsets():
    out = LexicalExtractor(_vocab()).extract(_record())
    assert {m.name for m in out} >= {"Python", "Tableau"}
    for m in out:
        assert RESUME_TEXT[m.char_start:m.char_end] == m.matched_text


def test_lexical_extractor_tags_its_engine():
    assert all(m.engine == "lexical" for m in LexicalExtractor(_vocab()).extract(_record()))


# --------------------------------------------------------------------- parsing

def test_parses_a_bare_json_array():
    out = LLMExtractor.parse_response('[{"skill":"Python","quote":"Python","category":"technical"}]')
    assert out[0]["skill"] == "Python"


def test_parses_through_a_code_fence_and_preamble():
    """Telling a model not to add commentary reduces it; it does not eliminate it."""
    raw = 'Sure, here you go:\n```json\n[{"skill":"SQL","quote":"SQL","category":"technical"}]\n```'
    assert LLMExtractor.parse_response(raw)[0]["skill"] == "SQL"


def test_unparsable_response_raises_rather_than_returning_junk():
    with pytest.raises(ValueError):
        LLMExtractor.parse_response("I could not find any skills.")


def test_a_parse_failure_loses_one_resume_not_the_run():
    ex = LLMExtractor(MockClient("no json here"), _vocab())
    assert ex.extract(_record()) == []
    assert ex.stats()["parse_failures"] == 1


# ------------------------------------------------------------------- grounding

def test_llm_skill_is_grounded_to_the_quoted_span():
    ex = LLMExtractor(MockClient(_response([
        {"skill": "Tableau", "quote": "Built dashboards in Tableau", "category": "technical"}
    ])), _vocab())
    m = ex.extract(_record())[0]
    assert RESUME_TEXT[m.char_start:m.char_end] == "Built dashboards in Tableau"


def test_a_skill_whose_quote_is_absent_counts_as_hallucination_and_is_dropped():
    """This is the whole reason the prompt demands a quote."""
    ex = LLMExtractor(MockClient(_response([
        {"skill": "Kubernetes", "quote": "orchestrated Kubernetes clusters", "category": "technical"}
    ])), _vocab())
    assert ex.extract(_record()) == []
    assert ex.stats()["unquotable"] == 1
    assert ex.stats()["hallucination_rate_pct"] == 100.0


def test_a_reflowed_quote_is_not_treated_as_hallucination():
    """A model that changed a line break into a space has not invented anything."""
    ex = LLMExtractor(MockClient(_response([
        {"skill": "Python", "quote": "Skills Python", "category": "technical"}
    ])), _vocab())
    assert len(ex.extract(_record())) == 1
    assert ex.stats()["unquotable"] == 0


def test_normalized_find_ignores_whitespace_runs_but_not_words():
    assert _normalized_find("a  b\nc", "a b c") is not None
    assert _normalized_find("a b c", "a x c") is None


def test_matches_record_which_section_the_quote_fell_in():
    ex = LLMExtractor(MockClient(_response([
        {"skill": "Tableau", "quote": "Built dashboards in Tableau", "category": "technical"}
    ])), _vocab())
    assert ex.extract(_record())[0].section == "experience"


def test_llm_matches_tag_their_engine():
    ex = LLMExtractor(MockClient(_response([
        {"skill": "Python", "quote": "Python", "category": "technical"}
    ])), _vocab())
    assert ex.extract(_record())[0].engine == "llm"


# --------------------------------------------------------------------- mapping

def test_a_known_name_maps_to_its_onet_term_exactly():
    ex = LLMExtractor(MockClient(_response([
        {"skill": "Microsoft Excel", "quote": "Microsoft Excel", "category": "technical"}
    ])), _vocab())
    m = ex.extract(_record())[0]
    assert m.name == "Microsoft Excel" and m.confidence == "exact"


def test_an_unknown_skill_is_reported_as_unmapped_never_dropped():
    """TC8: reported as unmapped, never dropped in silence."""
    ex = LLMExtractor(MockClient(_response([
        {"skill": "Mainframe", "quote": "Built dashboards", "category": "technical"}
    ])), _vocab())
    m = ex.extract(_record())[0]
    assert m.name == "Mainframe"
    assert m.term.onet_domain == "unmapped"
    assert m.confidence == "weak"
    assert ex.stats()["unmapped_to_onet"] == 1


def test_an_unmapped_term_cannot_win_an_alias_tiebreak():
    """n_occupations is 0 so a placeholder never outranks a real O*NET term."""
    ex = LLMExtractor(MockClient(_response([
        {"skill": "Nonexistent Tool", "quote": "Built dashboards", "category": "technical"}
    ])), _vocab())
    assert ex.extract(_record())[0].term.n_occupations == 0


def test_mapper_finds_a_near_synonym_by_embedding():
    """The RAG step: free text that is not an exact name still reaches the vocabulary."""
    vocab = _vocab(("Microsoft SQL Server", "Adobe Photoshop", "Autodesk AutoCAD", "Tableau"))
    mapper = OnetMapper(vocab, backend="tfidf", threshold=0.3)
    term, score = mapper.map("Microsoft SQL Server administration")
    assert term is not None and "SQL Server" in term.term


def test_mapper_refuses_a_match_below_the_threshold():
    """Below the threshold a nearest neighbour is a coincidence, not a mapping."""
    mapper = OnetMapper(_vocab(("Adobe Photoshop", "Autodesk AutoCAD", "Tableau")),
                        backend="tfidf", threshold=0.9)
    term, _ = mapper.map("underwater basket weaving")
    assert term is None


def test_mapper_prefers_an_exact_alias_over_embedding_similarity():
    mapper = OnetMapper(_vocab(("Tableau", "Adobe Photoshop", "Autodesk AutoCAD")),
                        backend="tfidf", threshold=0.1)
    term, score = mapper.map("Tableau")
    assert term.term == "Tableau" and score == 1.0


# --------------------------------------------------------------------- shared

def test_confidence_filter_cuts_both_engines_at_the_same_line():
    from talentflow.skills.vocabulary import SkillMatch
    ms = [SkillMatch(_term("A"), "a", "a", 0, 1, None, "weak", "llm"),
          SkillMatch(_term("B"), "b", "b", 1, 2, None, "exact", "lexical")]
    assert [m.confidence for m in filter_by_confidence(ms, "alias")] == ["exact"]


def test_both_engines_return_the_same_shape():
    """The A/B is only trustworthy if the harness cannot tell them apart structurally."""
    vocab = _vocab()
    lex = LexicalExtractor(vocab).extract(_record())
    llm = LLMExtractor(MockClient(_response([
        {"skill": "Python", "quote": "Python", "category": "technical"}
    ])), vocab).extract(_record())
    assert {type(m) for m in lex} == {type(m) for m in llm}
    for m in lex + llm:
        assert isinstance(m.char_start, int) and isinstance(m.name, str)


# ------------------------------------------------------------------- providers

def test_provider_is_picked_by_which_key_exists(monkeypatch):
    from talentflow.llm.client import detect_provider
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    assert detect_provider(anthropic_key="sk-ant-x") == "anthropic"
    assert detect_provider(openai_key="sk-proj-x") == "openai"
    assert detect_provider(gemini_key="AIza-x") == "gemini"
    assert detect_provider() is None


def test_anthropic_wins_when_several_keys_are_present(monkeypatch):
    from talentflow.llm.client import detect_provider
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    assert detect_provider("sk-ant-x", "AIza-x", "sk-proj-x") == "anthropic"


def test_explicit_override_beats_the_default_order(monkeypatch):
    from talentflow.llm.client import detect_provider
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    assert detect_provider("sk-ant-x", "AIza-x", "sk-proj-x") == "gemini"


def test_override_naming_a_provider_with_no_key_returns_none(monkeypatch):
    """Silently falling back would record the wrong model against a result, and the team
    contract requires every result to name the model that produced it."""
    from talentflow.llm.client import detect_provider
    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    assert detect_provider(gemini_key="AIza-x") is None


@pytest.mark.parametrize("cls,attr", [
    ("OpenAIClient", "ENDPOINT"), ("GeminiClient", "ENDPOINT"),
])
def test_untestable_providers_are_at_least_constructible(cls, attr):
    """Neither host is reachable from the build environment, so this is the most that can
    be checked here. Both need verifying on a machine with ordinary internet."""
    import talentflow.llm as llm
    client = getattr(llm, cls)(api_key="x", cache_dir=None)
    assert getattr(client, attr).startswith("https://")
    assert client.stats()["api_calls"] == 0


def test_a_truncated_response_keeps_the_skills_that_arrived():
    """F34. The token limit cut a real response mid-array. Twenty valid skills arrived and
    the parser threw all of them away over a missing bracket."""
    from talentflow.skills.extractor import LLMExtractor

    truncated = (
        '[\n  {"skill": "Python", "quote": "Python", "category": "technical"},\n'
        '  {"skill": "HP ALM", "quote": "HP ALM", "category": "technical"},\n'
        '  {"skill": "REST", "quote": "REST", "category": "technical'
    )
    items = LLMExtractor.parse_response(truncated)
    assert [i["skill"] for i in items] == ["Python", "HP ALM"]


def test_salvage_does_not_trip_on_braces_inside_a_quote():
    """A brace in a value must not be counted as structure. Skill names contain anything."""
    from talentflow.skills.extractor import LLMExtractor

    text = '[{"skill": "Jinja", "quote": "templates use {{ var }}", "category": "technical"},'
    assert LLMExtractor.parse_response(text)[0]["skill"] == "Jinja"


def test_a_complete_response_is_still_parsed_normally():
    from talentflow.skills.extractor import LLMExtractor

    text = '```json\n[{"skill": "SQL", "quote": "SQL", "category": "technical"}]\n```'
    assert LLMExtractor.parse_response(text) == [
        {"skill": "SQL", "quote": "SQL", "category": "technical"}]


# ----------------------------------------------------------------- truncation

def test_a_resume_longer_than_the_budget_is_flagged_as_truncated():
    """F39. A resume past max_chars is cut for the model, so a skill that appears only past
    the cut can't be found. The cut is counted, so lost skills are a known number."""
    ex = LLMExtractor(MockClient(_response([
        {"skill": "Python", "quote": "Python", "category": "technical"}
    ])), _vocab(), max_chars=50)
    ex.extract(_record())
    assert ex.stats()["truncated_resumes"] == 1


def test_a_resume_within_the_budget_is_not_flagged():
    ex = LLMExtractor(MockClient(_response([
        {"skill": "Python", "quote": "Python", "category": "technical"}
    ])), _vocab(), max_chars=100_000)
    ex.extract(_record())
    assert ex.stats()["truncated_resumes"] == 0
