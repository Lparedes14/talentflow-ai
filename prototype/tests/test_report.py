"""Unit tests for the evidence rendering the UI shows.

An off-by-one here highlights the wrong words, which is worse than highlighting nothing:
it looks like evidence.
"""
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.report import dedupe_spans, highlight_html, summarize_matches


@dataclass
class FakeMatch:
    name: str
    char_start: int
    char_end: int
    confidence: str = "exact"


def test_highlights_the_exact_matched_span():
    text = "Built dashboards in Tableau daily"
    out = highlight_html(text, [FakeMatch("Tableau", 20, 27)])
    assert "<mark" in out and ">Tableau</mark>" in out
    assert "Built dashboards in " in out


def test_leaves_unmatched_text_alone():
    text = "Nothing to see here"
    assert highlight_html(text, []) == "Nothing to see here"


def test_escapes_html_in_the_resume():
    """A resume containing markup must render as text, never execute."""
    out = highlight_html("I know <script>alert(1)</script> and Python",
                         [FakeMatch("Python", 36, 42)])
    assert "<script>" not in out
    assert "&lt;script&gt;" in out


def test_escapes_html_inside_a_highlighted_span():
    out = highlight_html("<b>Python</b>", [FakeMatch("Python", 0, 13)])
    assert "<b>" not in out.replace("<mark", "").replace("</mark>", "")


def test_confidence_changes_the_colour():
    a = highlight_html("Python here", [FakeMatch("Python", 0, 6, "exact")])
    b = highlight_html("Python here", [FakeMatch("Python", 0, 6, "weak")])
    assert a != b


def test_multiple_spans_all_render_in_order():
    text = "Python and Tableau and SQL"
    out = highlight_html(text, [
        FakeMatch("SQL", 23, 26), FakeMatch("Python", 0, 6), FakeMatch("Tableau", 11, 18),
    ])
    assert out.count("<mark") == 3
    assert out.index("Python") < out.index("Tableau") < out.index("SQL")


def test_overlapping_spans_are_dropped_not_interleaved():
    """Overlapping markup would corrupt the output rather than fail loudly."""
    kept = dedupe_spans([FakeMatch("A", 0, 10), FakeMatch("B", 5, 15)])
    assert len(kept) == 1 and kept[0].name == "A"


def test_truncation_does_not_cut_inside_a_span():
    text = "x" * 50 + "Python"
    out = highlight_html(text, [FakeMatch("Python", 50, 56)], max_chars=53)
    assert "truncated" in out
    assert out.count("<mark") <= 1


def test_span_past_the_truncation_limit_is_skipped():
    out = highlight_html("a" * 100, [FakeMatch("X", 90, 95)], max_chars=20)
    assert "<mark" not in out


def test_newlines_become_line_breaks():
    assert "<br>" in highlight_html("line one\nline two", [])


def test_summarize_keeps_one_row_per_skill_with_a_count():
    ms = [FakeMatch("Python", 0, 6), FakeMatch("Python", 20, 26), FakeMatch("SQL", 30, 33)]
    best, mentions = summarize_matches(ms)
    assert set(best) == {"Python", "SQL"}
    assert mentions["Python"] == 2 and mentions["SQL"] == 1


def test_summarize_keeps_the_first_occurrence_as_evidence():
    ms = [FakeMatch("Python", 5, 11), FakeMatch("Python", 40, 46)]
    best, _ = summarize_matches(ms)
    assert best["Python"].char_start == 5


def test_naive_tokenizer_really_does_destroy_technology_names():
    """The Under the hood tab claims this. If the claim were wrong the tab would be a lie."""
    from talentflow.report import naive_tokens

    assert naive_tokens("C++ and C# and .NET") == ["c", "and", "c", "and", "net"]


def test_tokenizer_comparison_names_what_would_be_lost():
    from talentflow.report import tokenizer_comparison

    out = tokenizer_comparison("Built CI/CD in C++ and .NET with P&L reporting.")
    damaged = {d["token"]: d["becomes"] for d in out["damaged"]}
    assert damaged["C++"] == ["c"]
    assert damaged["CI/CD"] == ["ci", "cd"]
    assert damaged["P&L"] == ["p", "l"]
    assert out["n_ours"] > 0


def test_plain_prose_reports_no_damage():
    """The tab must not manufacture a problem on a resume that has none."""
    from talentflow.report import tokenizer_comparison

    assert tokenizer_comparison("Managed a team of eight people over three years.")["damaged"] == []


def test_token_stream_marks_special_tokens_and_escapes_html():
    """`&` reaches the output because P&L is a token we keep whole, so it has to be escaped
    or it breaks the page. Angle brackets never survive tokenization, so they are not the
    test case here even though they look like the obvious one."""
    from talentflow.report import token_stream_html

    out = token_stream_html("C++ and P&L reporting")
    assert "tf-tok-special" in out
    assert "P&amp;L" in out and ">P&L<" not in out


def test_token_stream_respects_its_limit():
    from talentflow.report import token_stream_html

    assert token_stream_html(" ".join(["word"] * 900), limit=10).count("<span") == 10
