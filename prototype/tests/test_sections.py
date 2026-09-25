"""Unit tests for resume section segmentation."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.ingest.sections import classify_header, sections_to_dict, split_sections

RESUME = """SENIOR DATA ANALYST
Professional Summary
Ten years turning messy data into decisions.
Highlights
SQL
Python
Experience
Data Analyst 2019 to Current
Built the reporting layer.
Education
BS Statistics
"""


def test_maps_header_variants_to_one_canonical_name():
    assert classify_header("Professional Summary") == "summary"
    assert classify_header("Work History") == "experience"
    assert classify_header("Core Qualifications") == "skills"
    assert classify_header("Skills:") == "skills"


def test_body_text_is_not_a_header():
    assert classify_header("Built the reporting layer.") is None
    assert classify_header("Company Name") is None


def test_bare_skill_lines_are_not_mistaken_for_headers():
    """'Microsoft Office' on its own line is a skill, not a section. The allowlist is why."""
    assert classify_header("Microsoft Office") is None
    assert classify_header("Time management") is None


def test_text_before_the_first_header_becomes_the_header_section():
    first = split_sections(RESUME)[0]
    assert first.name == "header"
    assert "SENIOR DATA ANALYST" in first.text


def test_finds_every_section_and_excludes_the_heading_line():
    d = sections_to_dict(split_sections(RESUME))
    assert set(d) == {"header", "summary", "skills", "experience", "education"}
    assert d["skills"] == "SQL\nPython"
    assert "Highlights" not in d["skills"]


def test_char_offsets_point_back_at_the_source():
    """Evidence citations depend on these offsets being exact."""
    for s in split_sections(RESUME):
        assert RESUME[s.char_start:s.char_end].strip().endswith(s.text.split("\n")[-1])


def test_repeated_header_opens_a_new_section_and_merges_on_lookup():
    text = "Skills\nSQL\nExperience\nBuilt things.\nSkills\nPython\n"
    assert [s.name for s in split_sections(text)] == ["skills", "experience", "skills"]
    assert sections_to_dict(split_sections(text))["skills"] == "SQL\nPython"


def test_resume_with_no_recognized_headers_is_still_returned():
    out = split_sections("Just a paragraph about my work.")
    assert len(out) == 1 and out[0].name == "unsectioned"


def test_empty_text_yields_no_sections():
    assert split_sections("") == []
