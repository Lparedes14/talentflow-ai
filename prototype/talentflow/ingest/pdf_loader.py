"""PDF -> raw text, with the per-file signals we need to judge extraction quality.

pdfplumber is the extractor. It is slower than pypdf but keeps word ordering sane on
the multi-column layouts that show up in a minority of these resumes, and a bad word
order silently corrupts every downstream stage.

Nothing here cleans text. Extraction and normalization stay separate so a change to the
cleaning rules does not force a re-parse of 2,484 PDFs.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import pdfplumber

log = logging.getLogger(__name__)


@dataclass
class RawResume:
    """One extracted PDF, before normalization."""

    resume_id: str
    category: str
    source_path: str
    n_pages: int
    raw_text: str
    page_char_counts: list[int] = field(default_factory=list)
    error: str | None = None

    @property
    def n_chars(self) -> int:
        return len(self.raw_text)

    @property
    def is_empty(self) -> bool:
        """True when extraction produced nothing usable -- almost always a scanned page."""
        return self.n_chars < 50


def extract_pdf(path: Path, category: str) -> RawResume:
    """Extract one resume. Never raises: a failure is recorded, not thrown.

    A single malformed PDF must not abort a 2,484-file corpus build, so the error is
    captured on the record and the caller decides what to do with it.
    """
    resume_id = path.stem
    try:
        with pdfplumber.open(path) as pdf:
            pages = [(p.extract_text() or "") for p in pdf.pages]
        return RawResume(
            resume_id=resume_id,
            category=category,
            source_path=str(path),
            n_pages=len(pages),
            raw_text="\n".join(pages),
            page_char_counts=[len(p) for p in pages],
        )
    except Exception as exc:  # noqa: BLE001 - deliberately broad, see docstring
        log.warning("extract failed for %s: %s", path.name, exc)
        return RawResume(
            resume_id=resume_id,
            category=category,
            source_path=str(path),
            n_pages=0,
            raw_text="",
            error=f"{type(exc).__name__}: {exc}",
        )


def iter_resume_paths(pdf_root: Path) -> list[tuple[Path, str]]:
    """List every resume PDF as (path, category).

    The Kaggle layout is data/<CATEGORY>/<id>.pdf, so the parent directory name is the
    ground-truth job family label the proposal uses for match relevance.
    """
    paths = sorted(pdf_root.glob("*/*.pdf"))
    return [(p, p.parent.name) for p in paths]
