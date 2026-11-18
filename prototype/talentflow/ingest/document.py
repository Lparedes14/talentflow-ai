"""Load a resume from any common document format.

The Kaggle corpus is PDFs, but the point of the prototype is that anyone can drop in their
own resume, and real resumes arrive as .docx far more often than as .pdf.

Format support and why each is handled the way it is:

| Extension | Reader | Note |
|---|---|---|
| .pdf | pdfplumber | the corpus format |
| .docx | python-docx | paragraphs *and* tables -- see below |
| .doc | LibreOffice -> .docx | legacy binary format, no usable pure-Python reader |
| .odt | LibreOffice -> .docx | same route |
| .rtf | striprtf | |
| .txt, .md | read directly | |

Two things worth knowing about .docx resumes:

**Tables are not optional.** A large share of resume templates lay the whole document out
in an invisible table, so reading only `document.paragraphs` returns an empty string on a
resume that looks perfectly normal when opened. Cells are read in row order and joined,
which reproduces reading order for the single- and two-column layouts these templates use.

**Legacy .doc needs a converter.** The pre-2007 format is a compound binary file. There is
no maintained pure-Python reader, so we shell out to LibreOffice, which is already present
on most machines and is the same engine Word-compatible tooling uses. If it is missing, the
error says exactly what to install rather than failing with a decode error.
"""
from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

from .pdf_loader import RawResume, extract_pdf

log = logging.getLogger(__name__)

SUPPORTED_SUFFIXES = frozenset({".pdf", ".docx", ".doc", ".odt", ".rtf", ".txt", ".md"})

# Formats with no usable Python reader, converted to .docx first.
_CONVERT_VIA_LIBREOFFICE = frozenset({".doc", ".odt"})

_LIBREOFFICE_TIMEOUT = 120


class UnsupportedFormat(ValueError):
    """Raised for a file extension we have no reader for."""


def _read_docx(path: Path) -> str:
    """Extract text from a .docx, including table cells."""
    import docx  # imported lazily so a PDF-only run needs no python-docx

    document = docx.Document(str(path))
    parts = [p.text for p in document.paragraphs]

    # Many resume templates put the entire document inside a borderless table, so a
    # paragraphs-only read returns nothing at all on a perfectly ordinary-looking resume.
    for table in document.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells if c.text.strip()]
            if cells:
                parts.append("\n".join(cells))

    return "\n".join(p for p in parts if p.strip())


def _read_rtf(path: Path) -> str:
    from striprtf.striprtf import rtf_to_text

    return rtf_to_text(path.read_text(errors="replace"))


def _convert_with_libreoffice(path: Path, out_dir: Path) -> Path:
    """Convert a legacy document to .docx. Returns the converted path."""
    binary = shutil.which("soffice") or shutil.which("libreoffice")
    if not binary:
        raise UnsupportedFormat(
            f"{path.suffix} needs LibreOffice to convert. Install it "
            "(macOS: brew install --cask libreoffice) or save the file as .docx."
        )

    result = subprocess.run(
        [binary, "--headless", "--convert-to", "docx", "--outdir", str(out_dir), str(path)],
        capture_output=True, text=True, timeout=_LIBREOFFICE_TIMEOUT,
    )
    converted = out_dir / (path.stem + ".docx")
    if not converted.exists():
        raise UnsupportedFormat(
            f"LibreOffice could not convert {path.name}: "
            f"{(result.stderr or result.stdout or 'no output').strip()[:200]}"
        )
    return converted


def extract_document(path: Path, category: str = "unknown") -> RawResume:
    """Extract raw text from any supported resume file.

    Returns the same RawResume the PDF loader returns, so a user's own resume flows through
    normalization, segmentation, chunking and matching by exactly the same code the corpus
    does -- no second path to keep in sync, and no chance of the demo behaving differently
    from the thing we measured.
    """
    path = Path(path)
    suffix = path.suffix.lower()

    if not path.exists():
        raise FileNotFoundError(path)
    if suffix not in SUPPORTED_SUFFIXES:
        raise UnsupportedFormat(
            f"{suffix or '(no extension)'} is not supported. "
            f"Supported: {', '.join(sorted(SUPPORTED_SUFFIXES))}"
        )

    if suffix == ".pdf":
        return extract_pdf(path, category)

    try:
        if suffix in _CONVERT_VIA_LIBREOFFICE:
            with tempfile.TemporaryDirectory() as tmp:
                text = _read_docx(_convert_with_libreoffice(path, Path(tmp)))
        elif suffix == ".docx":
            text = _read_docx(path)
        elif suffix == ".rtf":
            text = _read_rtf(path)
        else:
            text = path.read_text(errors="replace")
    except UnsupportedFormat:
        raise
    except Exception as exc:  # noqa: BLE001 -- mirrors extract_pdf: record, never throw
        log.warning("failed to read %s: %s", path.name, exc)
        return RawResume(
            resume_id=path.stem, category=category, source_path=str(path),
            n_pages=0, raw_text="", error=f"{type(exc).__name__}: {exc}",
        )

    return RawResume(
        resume_id=path.stem,
        category=category,
        source_path=str(path),
        n_pages=1,  # only PDFs have a real page count
        raw_text=text,
        page_char_counts=[len(text)],
    )


def load_resume(path: Path, category: str = "unknown") -> dict:
    """Load any resume file into a corpus record, ready for chunking and skill matching."""
    from .corpus import clean_record

    raw = extract_document(path, category)
    return clean_record({
        "resume_id": raw.resume_id, "category": raw.category,
        "source_path": raw.source_path, "n_pages": raw.n_pages,
        "raw_text": raw.raw_text, "extract_error": raw.error,
    })
