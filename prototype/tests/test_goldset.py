"""Unit tests for the gold-set loader and the extraction evaluation.

The offset convention is the point of most of these. Nothing in the source file matches
`content[start:end]`, so a loader that assumes Python's half-open convention silently
truncates every span by one character and every number computed from it is wrong.
"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.eval.extraction import evaluate_extraction
from talentflow.skills.extractor import LexicalExtractor
from talentflow.skills.goldset import GoldResume, GoldSpan, load_goldset
from talentflow.skills.onet import SkillTerm, normalize_term
from talentflow.skills.vocabulary import SkillVocabulary


def _write(tmp_path, records):
    p = tmp_path / "gold.json"
    p.write_text("\n".join(json.dumps(r) for r in records), encoding="utf-8")
    return p


def _annotation(label, start, end, text):
    return {"label": [label], "points": [{"start": start, "end": end, "text": text}]}


def test_inclusive_end_offsets_are_normalized(tmp_path):
    """The source file's `end` is inclusive. Slicing it normally loses the last character."""
    content = "I know Python well"
    p = _write(tmp_path, [{"content": content,
                           "annotation": [_annotation("Skills", 7, 12, "Python")]}])
    resumes, stats = load_goldset(p)
    span = resumes[0].skill_spans[0]
    assert content[span.start:span.end] == "Python"
    assert stats["points_inclusive_end"] == 1


def test_exact_offsets_are_left_alone(tmp_path):
    content = "I know Python well"
    p = _write(tmp_path, [{"content": content,
                           "annotation": [_annotation("Skills", 7, 13, "Python")]}])
    resumes, stats = load_goldset(p)
    assert resumes[0].skill_spans[0].text == "Python"
    assert stats["points_inclusive_end"] == 0


def test_broken_offsets_are_dropped_and_counted(tmp_path):
    """6.3% of the real file is unusable. Dropping silently would hide that."""
    p = _write(tmp_path, [{"content": "I know Python",
                           "annotation": [_annotation("Skills", 99, 105, "Python")]}])
    resumes, stats = load_goldset(p)
    assert resumes[0].skill_spans == []
    assert stats["points_dropped"] == 1 and stats["dropped_pct"] == 100.0


def test_labels_other_than_skills_are_kept_but_separable(tmp_path):
    p = _write(tmp_path, [{"content": "Jane at Acme", "annotation": [
        _annotation("Name", 0, 3, "Jane"),
        _annotation("Companies worked at", 8, 11, "Acme"),
    ]}])
    resume = load_goldset(p)[0][0]
    assert resume.skill_spans == []
    assert [s.label for s in resume.spans_for("Name")] == ["Name"]


def test_missing_file_names_where_to_get_it(tmp_path):
    with pytest.raises(FileNotFoundError, match="kaggle"):
        load_goldset(tmp_path / "absent.json")


def test_blank_lines_are_skipped(tmp_path):
    p = tmp_path / "g.json"
    p.write_text('{"content":"a","annotation":[]}\n\n{"content":"b","annotation":[]}\n')
    assert len(load_goldset(p)[0]) == 2


# ----------------------------------------------------------------- evaluation

def _vocab(names):
    terms = [SkillTerm(n, normalize_term(n), "software", "technical", 100, False, False)
             for n in names]
    return SkillVocabulary(terms, {})


def test_detection_counts_a_region_containing_a_known_skill():
    content = "Skills: Python and Tableau"
    gold = [GoldResume(0, content, [GoldSpan("Skills", "Python and Tableau", 8, 26)])]
    report = evaluate_extraction(LexicalExtractor(_vocab(["Python", "Tableau"])), gold)
    assert report["span_detection_rate_pct"] == 100.0


def test_a_region_with_nothing_known_lowers_detection_and_the_ceiling_together():
    """The two moving together is what says 'vocabulary gap', not 'matcher bug'."""
    content = "Skills: Mainframe"
    gold = [GoldResume(0, content, [GoldSpan("Skills", "Mainframe", 8, 17)])]
    report = evaluate_extraction(LexicalExtractor(_vocab(["Python"])), gold)
    assert report["span_detection_rate_pct"] == 0.0
    assert report["vocabulary_ceiling_pct"] == 0.0


def test_hallucination_rate_is_zero_because_matches_are_spans_of_the_source():
    content = "Skills: Python, Tableau, and more Python"
    gold = [GoldResume(0, content, [GoldSpan("Skills", "Python, Tableau", 8, 23)])]
    report = evaluate_extraction(LexicalExtractor(_vocab(["Python", "Tableau"])), gold)
    assert report["hallucination"]["rate_pct"] == 0.0
    assert report["hallucination"]["n_matches"] > 0


def test_resumes_without_skill_annotations_are_not_scored():
    gold = [GoldResume(0, "no annotations here", [])]
    report = evaluate_extraction(LexicalExtractor(_vocab(["Python"])), gold)
    assert report["n_resumes_scored"] == 0 and report["n_skill_spans"] == 0


def test_matches_outside_an_annotated_region_do_not_count_against_detection():
    """Annotations are not exhaustive, so an unmarked region is not a false positive."""
    content = "Summary: I use Tableau daily. Skills: Python"
    gold = [GoldResume(0, content, [GoldSpan("Skills", "Python", 38, 44)])]
    report = evaluate_extraction(LexicalExtractor(_vocab(["Python", "Tableau"])), gold)
    assert report["span_detection_rate_pct"] == 100.0


def test_diagnosis_flags_a_reachable_region_the_engine_missed():
    """A region the engine misses but the vocabulary can reach is the actionable kind, and
    the diagnosis names it and what the vocabulary would have found there. F40."""
    content = "Skills: Tableau"
    gold = [GoldResume(0, content, [GoldSpan("Skills", "Tableau", 8, 15)])]
    report = evaluate_extraction(
        LexicalExtractor(_vocab(["Python"])), gold, vocab=_vocab(["Python", "Tableau"]))
    d = report["diagnosis"]
    assert d["missed_but_reachable"] == 1
    assert d["missed_vocabulary_gap"] == 0
    assert d["reachable_miss_examples"][0]["vocabulary_would_find"] == ["Tableau"]


def test_diagnosis_flags_a_vocabulary_gap_when_nothing_can_reach_the_region():
    content = "Skills: Mainframe"
    gold = [GoldResume(0, content, [GoldSpan("Skills", "Mainframe", 8, 17)])]
    d = evaluate_extraction(LexicalExtractor(_vocab(["Python"])), gold)["diagnosis"]
    assert d["missed_vocabulary_gap"] == 1
    assert d["missed_but_reachable"] == 0


def test_diagnosis_summary_reports_a_clean_run():
    content = "Skills: Python"
    gold = [GoldResume(0, content, [GoldSpan("Skills", "Python", 8, 14)])]
    d = evaluate_extraction(LexicalExtractor(_vocab(["Python"])), gold)["diagnosis"]
    assert d["n_missed"] == 0
    assert "every one" in d["summary"]
