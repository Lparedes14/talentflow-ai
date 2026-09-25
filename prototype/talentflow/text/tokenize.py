"""Tokenization for resume and job-posting text.

Why a custom tokenizer instead of `text.split()` or `\\w+`:

A skills project lives or dies on technology names, and the obvious tokenizers destroy
them. `\\w+` turns 'C++' into 'c', 'ASP.NET' into 'asp' + 'net', 'CI/CD' into 'ci' + 'cd',
and '.NET' into 'net'. Every one of those is a distinct, searchable skill, and once the
token is gone no amount of clever matching downstream gets it back.

So the pattern is an ordered alternation, most specific first, that keeps the shapes real
technology names actually take. Order matters: 'ASP.NET' must be tried as a dotted
identifier before the plain-word branch can claim just 'ASP'.

Every token carries its character offsets. That is not decoration -- the proposal requires
each extracted skill to point back at the text that supports it, and offsets are what make
that citation exact instead of a fuzzy re-search that can land on the wrong occurrence.
"""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Iterable, Iterator

# Ordered alternation. Each branch is a shape seen in real resumes; the comment names it.
_TOKEN_PATTERN = "|".join([
    r"[A-Za-z]\+\+",                          # C++
    r"[A-Za-z]#",                             # C#, F#
    r"[A-Za-z][A-Za-z0-9]*&[A-Za-z][A-Za-z0-9]*",         # P&L, R&D, M&A, AT&T, S&P
    r"\.[A-Za-z][A-Za-z0-9]*",                # .NET
    r"[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)+",   # Node.js, ASP.NET, scikit.learn
    r"[A-Za-z][A-Za-z0-9]*(?:/[A-Za-z][A-Za-z0-9]*)+",    # CI/CD, TCP/IP, A/B
    r"[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+",            # MS-SQL, e-commerce, full-time
    r"[A-Za-z][A-Za-z0-9]*",                  # SQL, Python, Office365
    r"[0-9]+[A-Za-z]+",                       # 3D, 401k
    r"[0-9]+(?:[.,][0-9]+)*",                 # 2024, 1.5, 10,000
])
_TOKEN_RE = re.compile(_TOKEN_PATTERN)

# Trailing punctuation that the alternation can absorb but which is never part of a term:
# 'Python.' at the end of a sentence would otherwise become a dotted identifier attempt.
_TRAILING_JUNK_RE = re.compile(r"[.\-/]+$")

# --- compound refinement ------------------------------------------------------
#
# The alternation above is deliberately greedy, because a greedy match can be split apart
# afterwards while a lost one cannot be recovered. Two greedy matches then need undoing:
#
# 1. Dotted run-ons. PDF extraction drops the space after a sentence-ending period, so
#    'AutoCAD. Created drawings' arrives as 'autocad.created' and looks exactly like a
#    dotted identifier. Real ones have a known suffix ('.net', '.js'), run-ons do not.
# 2. Slash lists. Resumes write tool inventories as 'Word/Excel/PowerPoint/Visio'. Kept
#    whole, that is one token matching nothing; a query for 'excel' misses every one of
#    them. A handful of slash terms are genuine names, so those are named explicitly.

_DOTTED_SUFFIXES = frozenset({
    "net", "js", "py", "io", "ai", "sql", "com", "org", "gov", "edu", "ts", "jsx", "tsx",
    "css", "html", "htm", "xml", "json", "csv", "sh", "exe", "dll", "aspx", "php", "rb",
})

_SLASH_KEEP = frozenset({
    "ci/cd", "tcp/ip", "a/b", "p/l", "i/o", "r/d", "and/or", "24/7", "ap/ar", "w/o",
    "os/2", "s/4hana", "km/h", "n/a", "he/she", "his/her", "w/", "b/w",
})


def _split_keeping_offsets(raw: str, start: int, sep: str) -> list[tuple[str, int]]:
    """Split on `sep`, returning (part, absolute_start) so offsets survive the split."""
    out, pos = [], 0
    for part in raw.split(sep):
        if part:
            out.append((part, start + pos))
        pos += len(part) + len(sep)
    return out


def _refine(raw: str, start: int) -> list[Token]:
    """Turn one greedy match into the tokens it should actually be.

    Recursive because a match can be compound in more than one way ('autocad/ms.word').
    """
    if raw.startswith("."):  # .NET -- a leading dot is part of the name
        return [Token(raw, start, start + len(raw))]

    if "&" in raw:  # P&L, R&D, AT&T -- always a name, never a list
        return [Token(raw, start, start + len(raw))]

    if "/" in raw and raw.lower() not in _SLASH_KEEP:
        parts = _split_keeping_offsets(raw, start, "/")
        if len(parts) > 1:
            return [t for part, off in parts for t in _refine(part, off)]

    if "." in raw:
        pieces = raw.split(".")
        if not all(p.lower() in _DOTTED_SUFFIXES for p in pieces[1:]):
            parts = _split_keeping_offsets(raw, start, ".")
            if len(parts) > 1:
                return [t for part, off in parts for t in _refine(part, off)]

    return [Token(raw, start, start + len(raw))]


@dataclass(frozen=True)
class Token:
    """One token plus where it came from. Offsets index into the text passed to the tokenizer."""

    text: str
    start: int
    end: int

    @property
    def lower(self) -> str:
        return self.text.lower()


def tokenize_spans(text: str) -> list[Token]:
    """Tokenize, keeping character offsets. The primitive everything else is built on."""
    tokens: list[Token] = []
    for m in _TOKEN_RE.finditer(text):
        trimmed = _TRAILING_JUNK_RE.sub("", m.group(0))
        if trimmed:
            tokens.extend(_refine(trimmed, m.start()))
    return tokens


def tokenize(text: str, lower: bool = True) -> list[str]:
    """Tokenize to plain strings. Use this when offsets are not needed."""
    return [t.lower if lower else t.text for t in tokenize_spans(text)]


def count_tokens(text: str) -> int:
    """Token count. The unit the chunker budgets in.

    Counts refined tokens, not raw regex matches -- refinement splits compounds, so the
    two differ and the chunker must budget in the same units the index is built from.
    """
    return len(tokenize_spans(text))


def build_vocabulary(texts: Iterable[str], lower: bool = True) -> Counter[str]:
    """Token frequencies across a set of documents."""
    vocab: Counter[str] = Counter()
    for text in texts:
        vocab.update(tokenize(text, lower=lower))
    return vocab


def iter_sentences(text: str) -> Iterator[tuple[str, int, int]]:
    """Yield (sentence, start, end).

    Resumes are mostly newline-delimited bullets rather than flowing prose, so a line
    break is a stronger boundary signal here than a period -- and periods are unreliable
    anyway when '.NET' and 'Node.js' are legitimate tokens. Lines are therefore split
    first, then long lines are broken at sentence-ending punctuation.
    """
    for line_match in re.finditer(r"[^\n]+", text):
        line, base = line_match.group(0), line_match.start()
        pos = 0
        for sent in re.split(r"(?<=[.!?])\s+(?=[A-Z])", line):
            if not sent.strip():
                pos += len(sent) + 1
                continue
            start = base + line.index(sent, pos)
            yield sent.strip(), start, start + len(sent)
            pos = (start - base) + len(sent)
