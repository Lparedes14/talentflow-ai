"""Unit tests for the O*NET vocabulary, alias generation, and skill matching.

Most cases are false positives actually observed on the corpus. Each one cost a diagnostic
pass to find, so a regression here is expensive to rediscover.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.skills.onet import SkillTerm, normalize_term
from talentflow.skills.vocabulary import SkillVocabulary, corpus_document_frequency


def _term(name, domain="software", category="technical", n_occ=100):
    key = normalize_term(name)
    return SkillTerm(term=name, key=key, onet_domain=domain, category=category,
                     n_occupations=n_occ, is_hot_technology=False, is_generic=False)


def _record(sections):
    text, out, pos = "", [], 0
    for name, body in sections:
        out.append({"name": name, "text": body, "char_start": pos,
                    "char_end": pos + len(body), "heading": None})
        text += body + "\n"
        pos = len(text)
    return {"resume_id": "r1", "category": "IT", "text": text, "sections": out}


# ------------------------------------------------------------------ normalization

def test_terms_normalize_with_the_same_tokenizer_as_resumes():
    """Different normalization on the two sides means 'C++' never matches 'C++'."""
    assert normalize_term("C++") == "c++"
    assert normalize_term("Microsoft SQL Server") == "microsoft sql server"
    assert normalize_term("ASP.NET") == "asp.net"


# ------------------------------------------------------------------ alias building

def test_vendor_prefix_is_stripped_so_resume_wording_matches():
    """O*NET writes 'Autodesk AutoCAD'; every resume writes 'AutoCAD'."""
    v = SkillVocabulary([_term("Autodesk AutoCAD")], {})
    assert "autocad" in v.aliases
    assert v.aliases["autocad"][0].term == "Autodesk AutoCAD"


def test_full_term_is_always_indexed():
    v = SkillVocabulary([_term("Microsoft Visual Studio")], {})
    assert "microsoft visual studio" in v.aliases


def test_descriptive_phrases_are_not_suffixed():
    """'Handling and Moving Objects' must not create the alias 'objects'."""
    v = SkillVocabulary([_term("Handling and Moving Objects", domain="work_activity",
                               category="process")], {})
    assert "objects" not in v.aliases
    assert "handling and moving objects" in v.aliases


def test_alias_starting_with_a_function_word_is_rejected():
    """'Thomson Reuters Web of Science' yields 'of science', which hits every BSc."""
    v = SkillVocabulary([_term("Thomson Reuters Web of Science")], {})
    assert "of science" not in v.aliases


def test_numeric_alias_is_rejected():
    v = SkillVocabulary([_term("Pulse Software ChiroPulse 365")], {})
    assert "365" not in v.aliases


@pytest.mark.parametrize("word", ["word", "office", "access", "server", "cloud"])
def test_everyday_english_words_never_become_aliases(word):
    v = SkillVocabulary([_term(f"Microsoft {word.title()}")], {word: 0.3})
    assert word not in v.aliases


def test_moderately_common_word_survives_when_rare_in_the_corpus():
    """'photoshop' and 'excel' are indistinguishable by English frequency alone."""
    v = SkillVocabulary([_term("Adobe Photoshop")], {"photoshop": 0.08})
    assert "photoshop" in v.aliases


def test_moderately_common_word_is_dropped_when_common_in_the_corpus():
    v = SkillVocabulary([_term("Microsoft Excel")], {"excel": 0.39})
    assert "excel" not in v.aliases


def test_symbol_bearing_names_bypass_the_english_test():
    """wordfreq scores 'c++' as 'c' (zipf 5.33) and would flag it as an everyday word."""
    v = SkillVocabulary([_term("C++")], {"c++": 0.05})
    assert v.alias_confidence["c++"] == "exact"


def test_single_token_everyday_word_is_marked_weak_not_dropped():
    """O*NET really does list 'Go' and 'Design'. Keep them, but flag them."""
    v = SkillVocabulary([_term("Go")], {})
    assert v.alias_confidence["go"] == "weak"


def test_ambiguous_alias_resolves_to_the_most_widely_used_term():
    """Otherwise 'sql' resolves to 'Windent SQL', a niche dental product."""
    v = SkillVocabulary([
        _term("Windent SQL", n_occ=1),
        _term("Structured query language SQL", n_occ=151),
    ], {})
    assert v.aliases["sql"][0].term == "Structured query language SQL"


# ---------------------------------------------------------------------- matching

def test_longest_match_wins():
    """'Microsoft SQL Server' is one skill, not three overlapping ones."""
    v = SkillVocabulary([_term("Microsoft SQL Server"), _term("Structured query language SQL")], {})
    matches = v.match("Administered Microsoft SQL Server daily")
    assert [m.name for m in matches] == ["Microsoft SQL Server"]


def test_matches_carry_offsets_into_the_source():
    """This is the evidence citation the proposal requires."""
    v = SkillVocabulary([_term("Adobe Photoshop")], {})
    text = "Designed assets in Adobe Photoshop for print"
    m = v.match(text)[0]
    assert text[m.char_start:m.char_end] == "Adobe Photoshop"


def test_resume_offsets_are_shifted_to_whole_document_coordinates():
    v = SkillVocabulary([_term("Tableau")], {})
    rec = _record([("summary", "A summary line."), ("skills", "Tableau and reporting")])
    m = v.match_resume(rec)[0]
    assert rec["text"][m.char_start:m.char_end] == "Tableau"


def test_matches_record_which_section_they_came_from():
    v = SkillVocabulary([_term("Python")], {})
    rec = _record([("summary", "Nothing here."), ("skills", "Python")])
    assert v.match_resume(rec)[0].section == "skills"


def test_generic_category_terms_are_skipped_on_resumes():
    """'Email software' fires on nearly everyone and says nothing."""
    generic = SkillTerm("Email software", "email software", "software", "technical",
                        500, False, is_generic=True)
    v = SkillVocabulary([generic], {})
    rec = _record([("skills", "Email software experience")])
    assert v.match_resume(rec, skip_generic=True) == []
    assert v.match_resume(rec, skip_generic=False)


def test_min_confidence_filters_weak_hits():
    v = SkillVocabulary([_term("Go")], {})
    rec = _record([("experience", "Asked to go to the client site")])
    assert v.match_resume(rec, min_confidence="alias") == []
    assert v.match_resume(rec, min_confidence="weak")


# ------------------------------------------------------------------- calibration

def test_calibration_drops_a_common_alias_pointing_at_an_obscure_product():
    """'ProFicient' is real, used by 2 occupations, and claimed 21.7% of all resumes."""
    v = SkillVocabulary([_term("Infinity QS ProFicient", n_occ=2)], {})
    assert "proficient" in v.aliases
    records = [_record([("summary", "Proficient in many things")]) for _ in range(10)]
    report = v.calibrate(records, min_df=0.02, min_occupations=10)
    assert "proficient" not in v.aliases
    assert report["n_pruned"] == 1


def test_calibration_keeps_a_common_alias_pointing_at_a_widely_used_product():
    v = SkillVocabulary([_term("Microsoft PowerPoint", n_occ=629)], {})
    records = [_record([("skills", "PowerPoint")]) for _ in range(10)]
    v.calibrate(records, min_df=0.02, min_occupations=10)
    assert "powerpoint" in v.aliases


def test_calibration_iterates_until_no_alias_is_left_exposed():
    """Pruning 'general ledger' uncovers the bare 'ledger' the longer alias was hiding."""
    v = SkillVocabulary([_term("Heron CrossTie General Ledger", n_occ=2)], {})
    records = [_record([("experience", "Maintained the general ledger monthly")])
               for _ in range(10)]
    report = v.calibrate(records, min_df=0.02, min_occupations=10)
    assert "general ledger" not in v.aliases
    assert "ledger" not in v.aliases
    assert report["n_rounds"] > 1 and report["converged"]


def test_corpus_document_frequency_is_a_share_of_documents_not_a_count():
    df = corpus_document_frequency([
        _record([("skills", "python python python")]),
        _record([("skills", "java")]),
    ])
    assert df["python"] == 0.5


def test_alias_ending_in_a_function_word_is_rejected():
    """'Power and Precision' yields 'power and', which matches every "power, and" in prose."""
    v = SkillVocabulary([_term("Power and Precision")], {})
    assert "power and" not in v.aliases
    assert "power and precision" in v.aliases


def test_calibration_judges_an_alias_by_its_worst_corpus_not_the_average():
    """Pooling dilutes: an alias common in postings and absent from resumes averages away."""
    v = SkillVocabulary([_term("Marketo Marketing Automation", n_occ=2)], {})
    assert "automation" in v.aliases
    resumes = [_record([("summary", "Nothing relevant here at all")]) for _ in range(100)]
    postings = [_record([("description", "Build automation for the team")]) for _ in range(10)]
    report = v.calibrate(resumes, postings, min_df=0.05, min_occupations=10)
    assert "automation" not in v.aliases
    assert report["corpus_sizes"] == [100, 10]


def test_calibration_with_no_corpora_is_a_no_op():
    v = SkillVocabulary([_term("Python")], {})
    assert v.calibrate()["n_pruned"] == 0
    assert "python" in v.aliases


def test_two_character_derived_alias_is_rejected():
    """'Exact Software Macola ES' claimed `es` on 48% of one employer's postings."""
    v = SkillVocabulary([_term("Exact Software Macola ES")], {})
    assert "es" not in v.aliases
    assert "exact software macola es" in v.aliases


@pytest.mark.parametrize("term,alias", [
    ("Open Source Matters Joomla!", "open source"),
    ("ONE Software KidsONE", "one software"),
])
def test_alias_made_entirely_of_everyday_words_is_rejected(term, alias):
    """A name made entirely of everyday words is not a name."""
    v = SkillVocabulary([_term(term)], {})
    assert alias not in v.aliases


@pytest.mark.parametrize("term,alias", [
    ("Apache Kafka", "kafka"),
    ("Microsoft PowerPoint", "powerpoint"),
    ("RESTful API", "restful api"),
])
def test_aliases_containing_an_uncommon_token_survive(term, alias):
    v = SkillVocabulary([_term(term)], {})
    assert alias in v.aliases


def test_modern_tools_are_not_filtered_by_popularity():
    """O*NET lags: Snowflake has 6 occupations, PyTorch 4. An occupation bar on aliases
    would delete exactly the tools that matter most."""
    v = SkillVocabulary([_term("PyTorch", n_occ=4), _term("Snowflake", n_occ=6)], {})
    assert "pytorch" in v.aliases and "snowflake" in v.aliases
