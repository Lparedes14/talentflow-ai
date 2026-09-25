"""Find text a reader cannot see but an extractor still reads.

A resume is a document supplied by the person being judged, and text tools read it whatever
color it is drawn in. So a candidate can paste skills, or an instruction aimed at an LLM, in
white 6pt type, and both engines in this project will read it: the Dictionary Matcher matches
the hidden skill words, and the LLM Reader can be steered by the hidden instruction. The
Introduction deck lists prompt injection as a real risk, and this is the exact shape it takes
here.

The verbatim-quote requirement limits the LLM's exposure but does not close it. An injected
claim still has to appear in the document to survive the quote check, and hidden text is in
the document, so it survives. The honest fix is upstream: catch text that is invisible before
any engine reads it.

This flags characters whose fill color is close to the page background, which is white for a
resume. It is a detector, not a cleaner, so a caller can warn, drop the run, or strip the
spans and re-extract, whichever fits.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pdfplumber

# A character this close to pure white is invisible on a white page. 0.9 leaves room for the
# faint grays some templates use for rules and watermarks without catching real body text,
# which sits at 0.3 or darker.
WHITE_THRESHOLD = 0.90


@dataclass
class HiddenSpan:
    """A run of near-invisible characters found on one page."""

    text: str
    page: int          # 1-based
    color: tuple       # the fill color that made it invisible, for the report


def _whiteness(color) -> float:
    """How close a fill color is to white, 0 (black) to 1 (white). Unknown colors read as
    black, so an odd color space never gets flagged as hidden by mistake."""
    if color is None:
        return 0.0
    if isinstance(color, (int, float)):
        return float(color)                       # DeviceGray: 1.0 is white
    values = list(color)
    if len(values) == 1:
        return float(values[0])
    if len(values) == 3:
        return min(values)                        # RGB: white only if every channel is high
    if len(values) == 4:
        return 1.0 - max(values)                  # CMYK: white is zero ink
    return 0.0


def find_hidden_spans(pdf_path: str | Path, threshold: float = WHITE_THRESHOLD) -> list[HiddenSpan]:
    """Return the runs of near-invisible text in a PDF, in reading order.

    Consecutive hidden characters are joined into one span, so an injected sentence comes back
    as a sentence rather than 200 single letters.
    """
    spans: list[HiddenSpan] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            buffer: list[str] = []
            color = None
            for ch in page.chars:
                if _whiteness(ch.get("non_stroking_color")) >= threshold:
                    buffer.append(ch["text"])
                    color = ch.get("non_stroking_color")
                elif buffer:
                    spans.append(HiddenSpan("".join(buffer).strip(), page_number, color))
                    buffer = []
            if buffer:
                spans.append(HiddenSpan("".join(buffer).strip(), page_number, color))
    return [s for s in spans if s.text]
