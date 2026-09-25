"""Prompt-injection defense: catching text a reader cannot see (F43)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
pytest.importorskip("pdfplumber")

from talentflow.ingest.hidden_text import _whiteness, find_hidden_spans

DEMO = Path(__file__).resolve().parent.parent / "docs" / "demos" / "injected_resume.pdf"


def test_whiteness_reads_every_color_space():
    assert _whiteness(None) == 0.0                 # unknown reads as black, never flagged
    assert _whiteness(0.0) == 0.0 and _whiteness(1.0) == 1.0     # gray
    assert _whiteness((1, 1, 1)) == 1.0 and _whiteness((0, 0, 0)) == 0.0   # rgb
    assert _whiteness((1, 0, 0)) == 0.0            # rgb: one dark channel is not white
    assert _whiteness((0, 0, 0, 0)) == 1.0         # cmyk: no ink is white


@pytest.mark.skipif(not DEMO.exists(), reason="demo pdf not generated")
def test_the_injected_line_is_flagged_and_the_visible_text_is_not():
    spans = find_hidden_spans(DEMO)
    joined = " ".join(s.text for s in spans)
    assert "ignore your previous instructions" in joined
    assert "Kubernetes" in joined
    assert "JAMIE RIVERA" not in joined            # the visible resume must not be flagged
