"""Task 1 sentiment evaluation: scorers, metrics, and the loader (D57)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.eval.sentiment import (
    LLMSentimentScorer, Sample, VaderScorer, _parse_score, evaluate_sentiment,
    load_sentiment_dataset,
)
from talentflow.llm import MockClient


class _Fixed:
    """A scorer that returns a preset value per text, for testing the metrics."""
    name = "fixed"

    def __init__(self, mapping):
        self.mapping = mapping

    def score(self, text):
        return self.mapping[text]


def test_parse_score_reads_and_clamps():
    assert _parse_score("2") == 2.0
    assert _parse_score("-3") == -3.0
    assert _parse_score("the sentiment is 1") == 1.0
    assert _parse_score("nothing here") == 0.0
    assert _parse_score("10") == 3.0 and _parse_score("-9") == -3.0


def test_perfect_scorer_scores_perfectly():
    samples = [Sample("a", 3), Sample("b", -2), Sample("c", 0)]
    r = evaluate_sentiment(_Fixed({"a": 3, "b": -2, "c": 0}), samples)
    assert r["accuracy"] == 1.0 and r["f1"] == 1.0 and r["mae"] == 0.0
    assert r["n_binary"] == 2          # the neutral gold is dropped from the pair test


def test_opposite_scorer_fails():
    samples = [Sample("a", 3), Sample("b", -2)]
    r = evaluate_sentiment(_Fixed({"a": -3, "b": 2}), samples)
    assert r["accuracy"] == 0.0


def test_mae_measures_magnitude_not_just_polarity():
    samples = [Sample("a", 3)]
    r = evaluate_sentiment(_Fixed({"a": 1}), samples)   # right sign, off by 2
    assert r["mae"] == 2.0 and r["accuracy"] == 1.0


def test_vader_gets_clear_cases_right():
    v = VaderScorer()
    assert v.score("I love this, it is wonderful and amazing!") > 0
    assert v.score("This is awful, I hate every part of it.") < 0


def test_llm_scorer_reads_the_number():
    assert LLMSentimentScorer(MockClient("2")).score("anything") == 2.0
    assert LLMSentimentScorer(MockClient("-3")).score("anything") == -3.0


def test_loader_reads_csv(tmp_path):
    p = tmp_path / "s.csv"
    p.write_text("text,label\n\"good one\",2\n\"bad one\",-2\n", encoding="utf-8")
    s = load_sentiment_dataset(p)
    assert [x.label for x in s] == [2.0, -2.0]


def test_loader_reads_jsonl(tmp_path):
    p = tmp_path / "s.jsonl"
    p.write_text('{"text":"good","label":3}\n{"text":"bad","label":-1}\n', encoding="utf-8")
    s = load_sentiment_dataset(p, limit=1)
    assert len(s) == 1 and s[0].label == 3.0


def test_loader_names_where_to_get_the_data(tmp_path):
    import pytest
    with pytest.raises(FileNotFoundError, match="MOSEI"):
        load_sentiment_dataset(tmp_path / "missing.csv")
