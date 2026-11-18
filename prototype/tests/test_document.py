"""Unit tests for multi-format resume loading."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.ingest.document import (
    SUPPORTED_SUFFIXES, UnsupportedFormat, extract_document, load_resume,
)

RESUME = """JANE DOE
Summary
Systems administrator experienced with Microsoft Active Directory.
Skills
Python, SQL, AutoCAD, VMware
Education
BS Information Technology
"""


def _docx(path: Path, paragraphs, table_rows=None):
    import docx
    d = docx.Document()
    for p in paragraphs:
        d.add_paragraph(p)
    if table_rows:
        t = d.add_table(rows=len(table_rows), cols=len(table_rows[0]))
        for r, row in enumerate(table_rows):
            for c, val in enumerate(row):
                t.cell(r, c).text = val
    d.save(str(path))
    return path


def test_plain_text_loads(tmp_path):
    p = tmp_path / "r.txt"
    p.write_text(RESUME)
    assert "Active Directory" in extract_document(p).raw_text


def test_docx_paragraphs_load(tmp_path):
    p = _docx(tmp_path / "r.docx", RESUME.split("\n"))
    assert "AutoCAD" in extract_document(p).raw_text


def test_docx_table_cells_are_read():
    """Many resume templates lay the whole document out in a borderless table. Reading only
    paragraphs returns an empty string on a resume that looks completely normal."""
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        p = _docx(Path(tmp) / "t.docx", [], [["Skills", "Python, SQL"], ["Tools", "AutoCAD"]])
        text = extract_document(p).raw_text
        assert "Python, SQL" in text and "AutoCAD" in text


def test_unsupported_extension_is_rejected_with_a_useful_message(tmp_path):
    p = tmp_path / "r.pages"
    p.write_text("x")
    with pytest.raises(UnsupportedFormat, match="Supported"):
        extract_document(p)


def test_missing_file_raises_file_not_found(tmp_path):
    with pytest.raises(FileNotFoundError):
        extract_document(tmp_path / "nope.pdf")


def test_a_corrupt_file_is_recorded_not_raised(tmp_path):
    """Mirrors the PDF loader: a bad file must never abort a batch."""
    p = tmp_path / "broken.docx"
    p.write_bytes(b"this is not a zip archive")
    out = extract_document(p)
    assert out.error and out.raw_text == ""


def test_load_resume_returns_a_corpus_record(tmp_path):
    """A user's own resume must flow through the same code the corpus does, so the demo
    cannot behave differently from the thing we measured."""
    p = tmp_path / "r.txt"
    p.write_text(RESUME)
    rec = load_resume(p)
    assert rec["n_words"] > 10
    assert {"summary", "skills", "education"} <= set(rec["section_names"])
    for s in rec["sections"]:
        assert rec["text"][s["char_start"]:s["char_end"]].strip()


def test_common_resume_formats_are_supported():
    assert {".pdf", ".docx", ".doc", ".txt"} <= SUPPORTED_SUFFIXES
