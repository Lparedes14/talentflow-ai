"""Aligning CMU-MOSEI .csd files into text,label pairs (D58). Uses a synthetic HDF5, so no
real MOSEI download is needed to test the alignment."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
pytest.importorskip("h5py")
import h5py  # noqa: E402

from talentflow.eval.mosei import _sentiment, align_mosei, write_csv


def _make_csd(path, seq_name, vid, features, intervals):
    with h5py.File(path, "w") as f:
        g = f.create_group(seq_name).create_group("data").create_group(vid)
        g.create_dataset("features", data=features)
        g.create_dataset("intervals", data=np.array(intervals, dtype=float))


def test_words_are_joined_into_their_labeled_segments(tmp_path):
    labels = tmp_path / "labels.csd"
    words = tmp_path / "words.csd"
    # two labeled segments: [0,5] positive, [5,10] negative
    _make_csd(labels, "CMU_MOSEI_Labels", "vid1",
              np.array([[2.0], [-1.0]]), [[0.0, 5.0], [5.0, 10.0]])
    # three words: "i"@0.5 and "love"@1.5 fall in segment 1; "bad"@6.5 in segment 2
    _make_csd(words, "CMU_MOSEI_TimestampedWords", "vid1",
              np.array([[b"i"], [b"love"], [b"bad"]]),
              [[0.0, 1.0], [1.0, 2.0], [6.0, 7.0]])
    out = align_mosei(labels, words)
    assert out == [("i love", 2.0), ("bad", -1.0)]


def test_pause_tokens_and_empty_segments_are_dropped(tmp_path):
    labels = tmp_path / "l.csd"
    words = tmp_path / "w.csd"
    _make_csd(labels, "L", "v", np.array([[3.0], [0.5]]), [[0.0, 5.0], [5.0, 10.0]])
    # segment 2 has only a pause token, so it produces nothing
    _make_csd(words, "W", "v", np.array([[b"great"], [b"sp"]]),
              [[1.0, 2.0], [6.0, 7.0]])
    out = align_mosei(labels, words)
    assert out == [("great", 3.0)]


def test_sentiment_is_first_value_and_clamped():
    assert _sentiment([2.0, 0.1, 0.0]) == 2.0     # first of a multi-emotion label row
    assert _sentiment([9.0]) == 3.0               # clamped to the scale
    assert _sentiment([-9.0]) == -3.0


def test_write_csv_round_trips_into_the_loader(tmp_path):
    from talentflow.eval.sentiment import load_sentiment_dataset
    p = write_csv([("good day", 2.0), ("bad day", -2.0)], tmp_path / "m.csv")
    s = load_sentiment_dataset(p)
    assert [x.label for x in s] == [2.0, -2.0]
    assert s[0].text == "good day"
