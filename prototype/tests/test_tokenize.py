"""Unit tests for tokenization.

The technology-name cases are the point of this module. A `\\w+` tokenizer scores zero on
most of them, and each miss is a skill that becomes permanently unfindable.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.text.tokenize import (
    build_vocabulary,
    count_tokens,
    iter_sentences,
    tokenize,
    tokenize_spans,
)


@pytest.mark.parametrize("text,expected", [
    ("C++ developer", ["c++", "developer"]),
    ("C# and F#", ["c#", "and", "f#"]),
    (".NET Core", [".net", "core"]),
    ("ASP.NET MVC", ["asp.net", "mvc"]),
    ("Node.js backend", ["node.js", "backend"]),
    ("CI/CD pipeline", ["ci/cd", "pipeline"]),
    ("TCP/IP networking", ["tcp/ip", "networking"]),
    ("A/B testing", ["a/b", "testing"]),
    ("MS-SQL Server", ["ms-sql", "server"]),
    ("e-commerce sales", ["e-commerce", "sales"]),
    ("3D modeling", ["3d", "modeling"]),
    ("401k plans", ["401k", "plans"]),
    ("Office 365", ["office", "365"]),
])
def test_keeps_technology_names_intact(text, expected):
    assert tokenize(text) == expected


def test_splits_slash_separated_tool_lists():
    """Resumes write tool inventories this way. Kept whole, none of them is findable."""
    assert tokenize("Word/Excel/PowerPoint/Visio") == [
        "word", "excel", "powerpoint", "visio",
    ]


def test_keeps_genuine_slash_terms_whole():
    assert tokenize("Managed P/L and AP/AR") == ["managed", "p/l", "and", "ap/ar"]


def test_splits_dotted_run_ons_from_a_lost_space():
    """'AutoCAD. Created' loses its space in the PDF and must not become one token."""
    assert tokenize("AutoCAD.Created drawings") == ["autocad", "created", "drawings"]


def test_drops_sentence_final_period():
    assert tokenize("I know Python.") == ["i", "know", "python"]


def test_offsets_index_back_into_the_source():
    """Evidence citation depends on this exactly. A fuzzy re-search can hit the wrong copy."""
    src = "Skilled in Word/Excel and C++ work"
    for t in tokenize_spans(src):
        assert src[t.start:t.end] == t.text


def test_offsets_survive_compound_splitting():
    src = "Word/Excel"
    assert [(t.text, t.start, t.end) for t in tokenize_spans(src)] == [
        ("Word", 0, 4), ("Excel", 5, 10),
    ]


def test_count_agrees_with_tokenize():
    """The chunker budgets in these units, so a disagreement silently mis-sizes chunks."""
    text = "Word/Excel and AutoCAD.Created plans in C++"
    assert count_tokens(text) == len(tokenize(text))


def test_case_is_preserved_when_asked():
    assert tokenize("Python SQL", lower=False) == ["Python", "SQL"]


def test_vocabulary_counts_across_documents():
    v = build_vocabulary(["python sql", "python python"])
    assert v["python"] == 3 and v["sql"] == 1


def test_empty_text_is_safe():
    assert tokenize("") == [] and count_tokens("") == 0


def test_sentences_split_on_lines_and_carry_offsets():
    """Resumes are newline-delimited bullets, so a line break beats a period as a boundary."""
    src = "Managed the team\nBuilt reports. Shipped it"
    out = list(iter_sentences(src))
    assert [s for s, _, _ in out] == ["Managed the team", "Built reports.", "Shipped it"]
    for sent, start, end in out:
        assert src[start:end] == sent


@pytest.mark.parametrize("text,expected", [
    ("P&L responsibility", ["p&l", "responsibility"]),
    ("R&D budget", ["r&d", "budget"]),
    ("AT&T account", ["at&t", "account"]),
    ("S&P 500 index", ["s&p", "500", "index"]),
    ("M&A due diligence", ["m&a", "due", "diligence"]),
])
def test_keeps_ampersand_business_terms(text, expected):
    """Without this, 'P&L' becomes 'p' + 'l' -- two stopword-grade single letters."""
    assert tokenize(text) == expected


def test_spaced_ampersand_is_not_joined():
    """'Sales & Marketing' is two terms and a conjunction, not one name."""
    assert tokenize("Sales & Marketing") == ["sales", "marketing"]
