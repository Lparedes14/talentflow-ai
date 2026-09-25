"""Unit tests for posting loading and shaping."""
import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.postings.load import (
    Posting, clean_posting_text, load_postings, posting_to_record,
)


def _posting(title="Senior Java Developer", desc="We need Python and SQL experience.",
             codes=("IT",)):
    return Posting(job_id="1", title=title, description=desc, skill_codes=list(codes))


def test_posting_becomes_the_same_record_shape_a_resume_does():
    """One shape means one extractor, one chunker, one vocabulary for both sides of a match."""
    r = posting_to_record(_posting())
    assert {"resume_id", "category", "text", "sections", "section_names"} <= set(r)
    assert r["category"] == "posting"


def test_title_and_description_are_separate_sections():
    """The title states the role; the description mixes requirements with boilerplate."""
    r = posting_to_record(_posting())
    assert r["section_names"] == ["description", "title"]


def test_section_offsets_resolve_into_the_record_text():
    r = posting_to_record(_posting())
    for s in r["sections"]:
        assert r["text"][s["char_start"]:s["char_end"]] == s["text"]


def test_html_entities_are_unescaped():
    assert "R&D" in clean_posting_text("Work in R&amp;D teams")


def test_stray_tags_are_removed():
    assert "<p>" not in clean_posting_text("<p>We need Python</p>")
    assert "Python" in clean_posting_text("<p>We need Python</p>")


def test_text_about_markup_survives_while_real_markup_is_removed():
    """An escaped tag is content: "experience with &lt;div&gt; layouts" is a front-end role
    describing itself. Unescaping before stripping would delete it."""
    assert "div" in clean_posting_text("experience with &lt;div&gt; layouts")
    assert "div" not in clean_posting_text("<div>experience with layouts</div>")


def test_empty_or_missing_description_is_safe():
    assert clean_posting_text("") == ""
    assert clean_posting_text(None) == ""
    r = posting_to_record(Posting("1", "Title only", ""))
    assert r["section_names"] == ["title"]


def test_technical_flag_reads_linkedin_codes():
    assert _posting(codes=("IT",)).is_technical_by_code
    assert _posting(codes=("ENG",)).is_technical_by_code
    assert not _posting(codes=("MRKT", "SALE")).is_technical_by_code
    assert not _posting(codes=()).is_technical_by_code


def _write_csvs(tmp_path, rows, skills):
    p = tmp_path / "postings.csv"
    pd.DataFrame(rows).to_csv(p, index=False)
    s = tmp_path / "job_skills.csv"
    pd.DataFrame(skills).to_csv(s, index=False)
    return p, s


def test_load_filters_to_technical_codes_by_default(tmp_path):
    p, s = _write_csvs(
        tmp_path,
        [{"job_id": "1", "title": "Dev", "description": "code", "company_name": "A"},
         {"job_id": "2", "title": "Chef", "description": "cook", "company_name": "B"}],
        [{"job_id": "1", "skill_abr": "IT"}, {"job_id": "2", "skill_abr": "MGMT"}],
    )
    assert [x.job_id for x in load_postings(p, s)] == ["1"]


def test_all_categories_is_a_flag_not_a_rewrite(tmp_path):
    p, s = _write_csvs(
        tmp_path,
        [{"job_id": "1", "title": "Dev", "description": "code", "company_name": "A"},
         {"job_id": "2", "title": "Chef", "description": "cook", "company_name": "B"}],
        [{"job_id": "1", "skill_abr": "IT"}, {"job_id": "2", "skill_abr": "MGMT"}],
    )
    assert len(load_postings(p, s, technical_only=False)) == 2


def test_postings_without_a_description_are_dropped(tmp_path):
    p, s = _write_csvs(
        tmp_path,
        [{"job_id": "1", "title": "Dev", "description": None, "company_name": "A"},
         {"job_id": "2", "title": "Dev2", "description": "code", "company_name": "B"}],
        [{"job_id": "1", "skill_abr": "IT"}, {"job_id": "2", "skill_abr": "IT"}],
    )
    assert [x.job_id for x in load_postings(p, s)] == ["2"]


def test_missing_file_raises_clearly(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_postings(tmp_path / "nope.csv", tmp_path / "also_nope.csv")


def test_the_extractor_runs_on_a_posting_unchanged():
    """The whole point of the shared record shape."""
    from talentflow.skills.extractor import LexicalExtractor
    from talentflow.skills.onet import SkillTerm, normalize_term
    from talentflow.skills.vocabulary import SkillVocabulary

    terms = [SkillTerm(n, normalize_term(n), "software", "technical", 100, False, False)
             for n in ("Python", "Structured query language SQL")]
    record = posting_to_record(_posting(desc="We need Python and SQL experience."))
    found = {m.name for m in LexicalExtractor(SkillVocabulary(terms, {})).extract(record)}
    assert "Python" in found
