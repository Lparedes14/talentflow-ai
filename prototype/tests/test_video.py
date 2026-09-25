"""Task 1 video pipeline: discovery, the transcriber seam, and the analysis parsing.

All mock-based. No model download, no ffmpeg, no network, so this runs anywhere the rest of
the suite does."""
import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.llm import MockClient
from talentflow.video import (find_media, get_transcriber, process_media, MockTranscriber)
from talentflow.video.analyze import _parse_json_object, analyze_transcript


# --------------------------------------------------------------------- discovery

def test_find_media_returns_a_single_file():
    p = Path("clip.mp4")
    # a bare filename that does not exist is neither file nor dir, so nothing comes back
    assert find_media("does_not_exist.mp4") == []


def test_find_media_lists_a_folder_newest_first(tmp_path):
    old = tmp_path / "old.mp4"
    new = tmp_path / "new.mov"
    old.write_bytes(b"x")
    new.write_bytes(b"x")
    os.utime(old, (1000, 1000))
    os.utime(new, (2000, 2000))
    found = find_media(tmp_path)
    assert [f.name for f in found] == ["new.mov", "old.mp4"]


def test_find_media_ignores_non_media(tmp_path):
    (tmp_path / "notes.txt").write_text("hi")
    (tmp_path / "talk.wav").write_bytes(b"x")
    assert [f.name for f in find_media(tmp_path)] == ["talk.wav"]


def test_find_media_on_a_single_non_media_file_is_empty(tmp_path):
    f = tmp_path / "resume.pdf"
    f.write_bytes(b"x")
    assert find_media(f) == []


# ------------------------------------------------------------------- transcriber

def test_get_transcriber_unknown_backend_lists_the_options():
    with pytest.raises(ValueError, match="unknown transcriber"):
        get_transcriber("banana")


def test_mock_transcriber_returns_its_text():
    t = get_transcriber("mock", text="hello world").transcribe("anything.mp4")
    assert t.text == "hello world" and t.backend == "mock"


# --------------------------------------------------------------------- analysis

def test_parse_json_object_handles_a_fence_and_preamble():
    assert _parse_json_object('here you go:\n```json\n{"a": 1}\n```')["a"] == 1


def test_parse_json_object_raises_without_an_object():
    with pytest.raises(ValueError):
        _parse_json_object("no json here")


def test_analyze_transcript_runs_both_reads():
    sentiment = json.dumps({"overall": "positive", "confidence": "high",
                            "evidence": "I love it", "summary": "Positive."})
    career = json.dumps({"current_role": "analyst", "target_directions": [],
                         "skills_to_learn": ["Python"], "summary": "Wants growth."})
    out = analyze_transcript(MockClient([sentiment, career]), "I love it. I want to grow.")
    assert out["sentiment"]["overall"] == "positive"
    assert out["career"]["skills_to_learn"] == ["Python"]


def test_analyze_transcript_short_circuits_on_empty_text():
    out = analyze_transcript(MockClient("{}"), "   ")
    assert out["sentiment"] is None and out["note"] == "empty transcript"


def test_analyze_transcript_survives_an_unparsable_response():
    out = analyze_transcript(MockClient("not json at all"), "some words")
    assert "error" in out["sentiment"]


# --------------------------------------------------------------------- pipeline

def test_process_media_transcribes_and_analyzes():
    sentiment = json.dumps({"overall": "neutral", "confidence": "low",
                            "evidence": "", "summary": "Mixed."})
    career = json.dumps({"current_role": "", "target_directions": [],
                         "skills_to_learn": [], "summary": "Unclear."})
    result = process_media("clip.mp4", MockTranscriber("some transcript"),
                           MockClient([sentiment, career]))
    assert result["transcript"] == "some transcript"
    assert result["backend"] == "mock"
    assert result["analysis"]["sentiment"]["overall"] == "neutral"


def test_process_media_without_a_client_stops_at_the_transcript():
    result = process_media("clip.mp4", MockTranscriber("words"), None)
    assert result["transcript"] == "words"
    assert "analysis" not in result
