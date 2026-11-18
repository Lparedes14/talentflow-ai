"""Smoke test for the Streamlit UI.

Streamlit apps fail at runtime, not at import: a bad widget argument or a renamed function
raises only once the script actually executes in a session. AppTest executes it the same way
a real browser connection does, so this catches breakage that `py_compile` cannot.

Marked slow because it builds the real vocabulary (about 20 seconds).
"""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

pytest.importorskip("streamlit")
from streamlit.testing.v1 import AppTest  # noqa: E402

CORPUS = ROOT / "data" / "interim" / "resumes.jsonl"


@pytest.mark.slow
@pytest.mark.skipif(not CORPUS.exists(), reason="corpus not built")
def test_app_starts_without_error():
    at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=300)
    at.run()

    assert not at.exception, f"app raised: {at.exception}"
    assert not at.error, f"app showed an error: {[e.value for e in at.error]}"
    assert "TalentFlow" in at.title[0].value


@pytest.mark.slow
@pytest.mark.skipif(not CORPUS.exists(), reason="corpus not built")
def test_app_offers_the_controls_a_tester_needs():
    at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=300)
    at.run()

    assert at.get("file_uploader"), "no upload control"
    assert at.sidebar.select_slider, "no confidence control"
    assert at.sidebar.checkbox, "no generic-terms toggle"
    # Before an upload the page should say what to do, not look broken.
    assert any("Upload" in i.value for i in at.info)


@pytest.mark.slow
@pytest.mark.skipif(not CORPUS.exists(), reason="corpus not built")
def test_app_offers_the_engine_toggle_and_degrades_without_a_key():
    """With no API key the LLM engine must be visibly unavailable, not silently broken."""
    at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=300)
    at.run()

    radios = at.sidebar.radio
    assert radios, "no engine selector"
    # There are two sidebar radios now: the Resume/Video mode selector and the engine
    # selector. Find the engine one by its label rather than assuming its position.
    engine = next((r for r in radios if "Extraction engine" in (r.label or "")), None)
    assert engine is not None, "no extraction-engine selector"
    assert "Dictionary Matcher" in engine.options and "LLM Reader" in engine.options

    # Ask the same question the app asks, rather than checking one provider's variable.
    # An earlier version only looked for ANTHROPIC_API_KEY and failed the moment an OpenAI
    # key was configured, reporting working behaviour as a bug.
    from talentflow.llm import load_client

    if load_client() is None:
        assert engine.disabled, "engine selector should be disabled with no key"
        assert any("API key" in c.value for c in at.sidebar.caption), \
            "should explain why the LLM Reader is unavailable"
    else:
        assert not engine.disabled, "engine selector should be live when a key exists"
        assert any("Model:" in c.value for c in at.sidebar.caption), \
            "should name the model in use"
    assert not at.exception


@pytest.mark.slow
@pytest.mark.skipif(not CORPUS.exists(), reason="corpus not built")
def test_vocabulary_wait_names_its_steps():
    """Twenty seconds of unexplained spinner reads as broken."""
    at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=300)
    at.run()
    statuses = at.get("status")
    assert statuses, "the vocabulary build should report progress"
    assert "aliases" in statuses[0].label, "the finished state should report what was built"


@pytest.mark.slow
@pytest.mark.skipif(not CORPUS.exists(), reason="corpus not built")
def test_analysis_tools_are_separated_from_the_resume_tabs():
    """Three tabs answer 'what is in this document'. The corpus search and the engine
    comparison ask different questions of a different audience, and equal billing hid that."""
    at = AppTest.from_file(str(ROOT / "app.py"), default_timeout=300)
    at.run()
    assert not at.exception
