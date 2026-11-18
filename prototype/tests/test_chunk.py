"""Unit tests for section-aware chunking."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.text.chunk import chunk_resume, chunk_section
from talentflow.text.tokenize import count_tokens


def _record(sections):
    text, out, pos = "", [], 0
    for name, body in sections:
        out.append({"name": name, "text": body, "char_start": pos,
                    "char_end": pos + len(body), "heading": None})
        text += body + "\n"
        pos = len(text)
    return {"resume_id": "r1", "category": "IT", "text": text, "sections": out}


def test_chunks_never_span_two_sections():
    """A chunk blending Experience and Education embeds as neither and retrieves as neither."""
    rec = _record([("experience", "Built reports. " * 20), ("education", "BS Statistics")])
    for c in chunk_resume(rec, target_tokens=1000):
        assert c.section in ("experience", "education")
    assert {c.section for c in chunk_resume(rec)} == {"experience", "education"}


def test_respects_the_token_budget():
    body = "\n".join(f"Line number {i} describing some work that was done." for i in range(60))
    for c in chunk_section("r1", "IT", "experience", body, 0, target_tokens=100):
        assert c.n_tokens <= 100


def test_offsets_resolve_back_to_the_source_text():
    rec = _record([("experience", "\n".join(f"Did task {i} carefully." for i in range(40)))])
    for c in chunk_resume(rec, target_tokens=50):
        assert rec["text"][c.char_start:c.char_end].strip()


def test_consecutive_chunks_overlap():
    """A skill sitting on a boundary must appear in both neighbours, not fall between them."""
    body = "\n".join(f"Sentence {i} about the work performed here." for i in range(60))
    chunks = chunk_section("r1", "IT", "experience", body, 0,
                           target_tokens=80, overlap_tokens=20)
    assert len(chunks) > 1
    assert chunks[1].char_start < chunks[0].char_end


def test_splits_a_single_oversized_line():
    """The Skills section is often one comma-separated line that no sentence rule divides."""
    body = ", ".join(f"skill{i}" for i in range(400))
    chunks = chunk_section("r1", "IT", "skills", body, 0, target_tokens=100)
    assert len(chunks) > 1
    assert all(c.n_tokens <= 100 for c in chunks)


def test_oversized_split_keeps_whole_terms():
    """Splitting by character would slice 'PowerPoint' in half."""
    body = " ".join(["PowerPoint"] * 300)
    for c in chunk_section("r1", "IT", "skills", body, 0, target_tokens=50):
        assert "PowerPoint" in c.text
        assert not c.text.startswith("erPoint")


def test_trailing_scrap_is_folded_into_its_predecessor():
    body = "\n".join(f"Sentence {i} about work done." for i in range(21))
    chunks = chunk_section("r1", "IT", "experience", body, 0,
                           target_tokens=60, overlap_tokens=0, min_tokens=20)
    assert all(c.n_tokens >= 20 for c in chunks)


def test_chunk_indexes_are_unique_and_ordered_across_sections():
    rec = _record([("summary", "A summary line."), ("experience", "Work I did."),
                   ("education", "A degree.")])
    idx = [c.chunk_index for c in chunk_resume(rec)]
    assert idx == sorted(idx) == list(range(len(idx)))


def test_token_count_matches_the_tokenizer():
    rec = _record([("skills", "Python, SQL, C++, Word/Excel")])
    for c in chunk_resume(rec):
        assert c.n_tokens == count_tokens(c.text)


def test_empty_section_produces_no_chunks():
    assert chunk_section("r1", "IT", "skills", "", 0) == []


def test_chunk_id_identifies_resume_and_position():
    rec = _record([("summary", "A line of summary text.")])
    assert chunk_resume(rec)[0].chunk_id == "r1:0"
