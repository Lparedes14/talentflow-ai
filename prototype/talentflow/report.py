"""Turning matches into something a person can read and check.

Lives in the package rather than in `app.py` so it can be unit tested. Presentation code
that decides *what the user sees* is real logic: an off-by-one here silently highlights the
wrong words, which is worse than highlighting nothing, because it looks like evidence.
"""
from __future__ import annotations

import html
import re
from typing import Sequence

CONFIDENCE_COLORS = {
    "exact": "#1a7f37",   # green
    "alias": "#8250df",   # purple
    "weak": "#9a6700",    # amber
}
_DEFAULT_COLOR = "#57606a"


def dedupe_spans(matches: Sequence) -> list:
    """Drop any span that overlaps one already kept, earliest first.

    The matcher consumes tokens as it goes, so spans never overlap within a section. Across
    sections they are built from different offset bases, and a bug there would produce
    overlapping spans that corrupt the rendered output rather than failing loudly.
    """
    kept, last_end = [], -1
    for m in sorted(matches, key=lambda m: (m.char_start, -m.char_end)):
        if m.char_start >= last_end:
            kept.append(m)
            last_end = m.char_end
    return kept


def highlight_html(text: str, matches: Sequence, max_chars: int = 20000) -> str:
    """Render `text` as HTML with every matched skill marked in place.

    The whole document is escaped as it is copied, never after markup is inserted, so a
    resume containing '<script>' is shown as text and cannot inject anything.
    """
    limit = min(len(text), max_chars)
    pieces, cursor = [], 0

    for m in dedupe_spans(matches):
        if m.char_start >= limit:
            break
        end = min(m.char_end, limit)
        pieces.append(html.escape(text[cursor:m.char_start]))
        colour = CONFIDENCE_COLORS.get(m.confidence, _DEFAULT_COLOR)
        title = html.escape(f"{m.name} ({m.confidence})", quote=True)
        pieces.append(
            f'<mark style="background:{colour}22;border-bottom:2px solid {colour};'
            f'padding:1px 2px;border-radius:3px" title="{title}">'
            f'{html.escape(text[m.char_start:end])}</mark>'
        )
        cursor = end

    pieces.append(html.escape(text[cursor:limit]))
    out = "".join(pieces).replace("\n", "<br>")
    if len(text) > max_chars:
        out += "<br><em>... truncated for display ...</em>"
    return out


def summarize_matches(matches: Sequence) -> tuple[dict, dict]:
    """Return (best evidence per skill, mention count per skill).

    One row per skill rather than per mention: a resume naming Python six times has one
    Python skill, and the count is the interesting part.
    """
    best: dict[str, object] = {}
    mentions: dict[str, int] = {}
    for m in matches:
        mentions[m.name] = mentions.get(m.name, 0) + 1
        best.setdefault(m.name, m)
    return best, mentions


# --------------------------------------------------------------------- tokenization view
# These exist so the UI can show what tokenization actually does, on the user's own file.
# The argument for our tokenizer has always been made in prose and in the build log; this
# lets someone see it happen to their own resume, which is a different kind of convincing.

_NAIVE_TOKEN_RE = re.compile(r"[a-z0-9]+")


def naive_tokens(text: str) -> list[str]:
    """What a standard word-splitter produces: letters and digits, everything else dropped.

    This is not a straw man. It is what `\\w+` or `str.split()` plus punctuation stripping
    does, which is the default in most tutorials and in scikit-learn's own analyzer.
    """
    return _NAIVE_TOKEN_RE.findall(text.lower())


def tokenizer_comparison(text: str) -> dict:
    """What the naive tokenizer would destroy in this document.

    Returns the damaged tokens with what each becomes, so the UI can show the loss rather
    than assert it. A token counts as damaged when our tokenizer keeps it whole and the
    naive one does not produce it at all.
    """
    from .text.tokenize import tokenize_spans

    ours = tokenize_spans(text)
    naive = set(naive_tokens(text))

    damaged: dict[str, dict] = {}
    for token in ours:
        low = token.lower
        if low in naive:
            continue
        # What the naive tokenizer turns this token into, if anything.
        becomes = naive_tokens(token.text)
        if becomes == [low]:
            continue
        entry = damaged.setdefault(token.text, {
            "token": token.text,
            "becomes": becomes,
            "count": 0,
        })
        entry["count"] += 1

    return {
        "n_ours": len(ours),
        "n_naive": len(naive_tokens(text)),
        "damaged": sorted(damaged.values(), key=lambda d: (-d["count"], d["token"])),
    }


def token_stream_html(text: str, limit: int = 400) -> str:
    """The first `limit` tokens as visible boxes, technology-bearing ones marked.

    Shows the boundaries, which is the whole point: a reader who has only ever seen text
    cannot see where one token stops and the next starts until it is drawn.
    """
    from .text.tokenize import tokenize_spans

    out = []
    for token in tokenize_spans(text)[:limit]:
        special = any(ch in token.text for ch in "+#./&-") and any(
            ch.isalnum() for ch in token.text)
        cls = "tf-tok tf-tok-special" if special else "tf-tok"
        out.append(f"<span class='{cls}'>{html.escape(token.text)}</span>")
    return "<div class='tf-tokens'>" + "".join(out) + "</div>"


def alias_match_rows(matches) -> list[dict]:
    """One row per skill found: the text that matched, the alias, and the O*NET term.

    Makes the lookup legible. `Microsoft SQL Server` appearing once as a three-token match,
    rather than three times as overlapping shorter ones, is the longest-match rule visible.
    """
    return [
        {
            "Text in your resume": m.matched_text,
            "Tokens": len(m.alias.split()),
            "Matched vocabulary entry": m.alias,
            "Official O*NET term": m.name,
            "Confidence": m.confidence,
            "Section": m.section or "",
        }
        for m in matches
    ]
