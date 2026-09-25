"""Unit tests for text normalization.

Each case is a defect actually observed in the Kaggle resume PDFs, so a regression here
means the corpus quietly degraded.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.ingest.normalize import (
    dehyphenate,
    fold_unicode,
    normalize,
    residual_mojibake_count,
)


@pytest.mark.parametrize("raw,expected", [
    ("Company Name â City", "Company Name - City"),   # en dash
    ("the companyâs goals", "the company's goals"),   # apostrophe
    ("he said âhiâ", 'he said "hi"'),  # quotes
])
def test_repairs_double_encoded_utf8(raw, expected):
    assert normalize(raw) == expected


def test_repairs_truncated_separator():
    """EF BC xx lost its third byte during extraction; ftfy cannot fix it, we can."""
    assert normalize("Company Name ï¼​ City") == "Company Name - City"


def test_strips_zero_width_characters():
    assert normalize("Py​thon﻿") == "Python"


def test_drops_bullet_glyphs_but_keeps_the_line():
    assert normalize("•  Managed team\n▪ Shipped it") == "Managed team\nShipped it"


def test_keeps_blank_line_between_sections():
    """Section splitting depends on paragraph breaks surviving normalization."""
    assert normalize("SUMMARY\n\n\n\nExperience") == "SUMMARY\n\nExperience"


def test_rejoins_hyphenated_line_break():
    assert dehyphenate("manage-\nment") == "management"


def test_does_not_join_across_a_real_hyphen():
    assert dehyphenate("full-time work") == "full-time work"


def test_expands_ligatures():
    assert fold_unicode("ﬁnancial ofﬁcer") == "financial officer"


def test_keeps_accented_names():
    """Folding must not strip accents -- names and some terms depend on them."""
    assert "é" in normalize("José Ramírez")


def test_empty_input_is_safe():
    assert normalize("") == ""
    assert normalize(None or "") == ""


def test_residual_counter_flags_damage_and_clean_text():
    assert residual_mojibake_count("Company â City") > 0
    assert residual_mojibake_count("Company - City") == 0


def test_drops_replacement_char_used_as_a_bullet():
    """U+FFFD at line start was a bullet glyph the PDF lost. Structural, so remove it."""
    assert normalize("Duties\n� Oversees accounting\n� Ran payroll") == (
        "Duties\nOversees accounting\nRan payroll"
    )


def test_keeps_replacement_char_inside_a_word():
    """Mid-word U+FFFD was a real character. Deleting it would hide genuine data loss."""
    out = normalize("BBA : Accounting Andr�s Bello Catholic University")
    assert "�" in out
    assert residual_mojibake_count(out) == 1
