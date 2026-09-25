"""Text normalization for resume PDFs.

The Kaggle resumes were rendered to PDF from HTML, then extracted. That round trip
leaves three recurring defects, and each one is fixed here rather than downstream:

1. Mojibake. UTF-8 bytes were decoded as cp1252 somewhere upstream, so an en dash
   arrives as 'a EUR "'. Left alone it becomes junk tokens that pollute the vocabulary
   and blow up any embedding of the surrounding span.
2. Unicode variants. Curly quotes, NBSP, ligatures, and half a dozen bullet glyphs all
   mean the same thing to a reader but are distinct tokens to a tokenizer.
3. Layout noise. PDF extraction hard-wraps mid-sentence and hyphenates across lines.

Every function here is pure text-in/text-out so it can be unit tested without a PDF.
"""
from __future__ import annotations

import re
import unicodedata

try:  # ftfy does mojibake repair properly; fall back to a narrow fixer if absent.
    from ftfy import fix_text as _ftfy_fix_text
except ImportError:  # pragma: no cover
    _ftfy_fix_text = None

# Literal sequences seen in this corpus, mapped to what they were before the
# bad decode. Used only when ftfy is unavailable.
_MOJIBAKE = {
    "â": "–",  # en dash
    "â": "—",  # em dash
    "â": "’",  # right single quote
    "â": "‘",  # left single quote
    "â": "“",  # left double quote
    "â": "”",  # right double quote
    "â¦": "…",  # ellipsis
    "â¢": "•",  # bullet
    "Â ": " ",             # nbsp
    "ï¿½": "",        # replacement char
}

# Zero-width characters. Invisible to a reader, but they split tokens and inflate
# vocabulary, so they go before anything else looks at the text.
_ZERO_WIDTH_RE = re.compile(r"[\u200b-\u200f\u2028\u2029\ufeff\u00ad\u2060]")

# Truncated mojibake, specific to this corpus. The source used a fullwidth separator
# (U+FF0D and friends, UTF-8 EF BC xx) between employer and city. PDF extraction dropped
# the third byte, so 'i-diaeresis + a Latin-1 punctuation byte' is all that survives.
# ftfy cannot repair it -- there is no valid sequence left to decode -- so the stub is
# rewritten as the separator it was.
_TRUNCATED_MOJIBAKE_RE = re.compile(r"\u00ef[\u00a0-\u00bf\u0080-\u009f]")

# U+FFFD marks a byte the PDF itself lost -- unrecoverable. At the start of a line it
# was a bullet glyph, so it is structural noise and gets dropped. Inside a word it was
# a real character (an accent, a registered mark); that one is left in place and
# counted by residual_mojibake_count, because silently deleting it would hide real loss.
_FFFD_BULLET_RE = re.compile(r"^[^\S\n]*\ufffd[^\S\n]+", re.MULTILINE)

_LIGATURES = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl"}

# Glyphs used as list bullets in these PDFs, unified so one rule can strip them.
_BULLETS = "•‣▪●◦⁃·∙■❖"

_DEHYPHEN_RE = re.compile(r"(\w)-\n(\w)")
_MULTISPACE_RE = re.compile(r"[ \t  - ]+")
_MULTINEWLINE_RE = re.compile(r"\n{3,}")
# [^\S\n] is "whitespace but not a newline" -- stripping \s here would eat the
# blank lines that separate sections, which sections.py relies on.
_BULLET_LINE_RE = re.compile(rf"^[^\S\n]*[{_BULLETS}][^\S\n]*", re.MULTILINE)
# Keep \n and \t; drop the rest of the C0/C1 control range.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")


def fix_mojibake(text: str) -> str:
    """Repair text that was UTF-8 encoded and then decoded as cp1252/latin-1."""
    if not text:
        return text
    if _ftfy_fix_text is not None:
        return _ftfy_fix_text(text)
    for bad, good in _MOJIBAKE.items():
        text = text.replace(bad, good)
    return text


def fold_unicode(text: str) -> str:
    """Collapse typographic variants onto plain ASCII equivalents.

    NFKC handles most of it; ligatures and dashes are spelled out because NFKC
    leaves them alone. Accented letters survive on purpose -- names and some
    technical terms need them.
    """
    text = unicodedata.normalize("NFKC", text)
    for lig, plain in _LIGATURES.items():
        text = text.replace(lig, plain)
    text = text.translate(str.maketrans({
        "‘": "'", "’": "'", "“": '"', "”": '"',
        "–": "-", "—": "-", "−": "-", "…": "...",
        " ": " ",
    }))
    return text


def dehyphenate(text: str) -> str:
    """Rejoin words the PDF renderer split across a line break ('manage-\\nment')."""
    return _DEHYPHEN_RE.sub(r"\1\2", text)


def strip_bullets(text: str) -> str:
    """Remove leading bullet glyphs. The line break already encodes 'this is an item'."""
    return _BULLET_LINE_RE.sub("", text)


def collapse_whitespace(text: str) -> str:
    """Squeeze runs of spaces and blank lines without destroying paragraph breaks."""
    text = _MULTISPACE_RE.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    text = _MULTINEWLINE_RE.sub("\n\n", text)
    return text.strip()


def normalize(text: str) -> str:
    """Full ingest-time cleanup. Order matters: repair bytes, then fold, then reflow."""
    if not text:
        return ""
    text = _ZERO_WIDTH_RE.sub("", text)
    text = fix_mojibake(text)
    text = _TRUNCATED_MOJIBAKE_RE.sub(" - ", text)
    text = _FFFD_BULLET_RE.sub("", text)
    text = _CONTROL_RE.sub("", text)
    text = fold_unicode(text)
    text = dehyphenate(text)
    text = strip_bullets(text)
    return collapse_whitespace(text)


# Signatures of text that is still broken after normalization. Counted, not fixed --
# the corpus build reports the rate so we know whether ingest is good enough to
# build on, instead of discovering it during evaluation.
_RESIDUAL_MOJIBAKE_RE = re.compile(r"[\u00c2\u00c3\u00e2\u00ef]\s*[\u0080-\u00bf]|\ufffd")


def residual_mojibake_count(text: str) -> int:
    """Count encoding artifacts surviving normalization. A quality metric, not a fix."""
    return len(_RESIDUAL_MOJIBAKE_RE.findall(text))
