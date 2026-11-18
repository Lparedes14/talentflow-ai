"""Segment a normalized resume into canonical sections.

Why bother instead of treating a resume as one blob:

- Evidence. The proposal requires every claimed skill to point back to the source text,
  and a section label makes that citation far more useful than a raw offset.
- Retrieval. Sections are the natural chunk boundary for the embedding index. Chunking
  blindly at N tokens splits an employer's bullet list across two chunks.
- Precision. A term under 'Skills' is an asserted skill. The same term under 'Interests'
  usually is not. Downstream extraction gets to use that difference.

Header detection is an explicit allowlist, not a heuristic. Resumes here also put bare
skill names on their own short title-case lines ('Microsoft Office'), so any 'short line
looks like a header' rule shreds the skills section.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

# Surface form (lowercased) -> canonical section name.
_HEADER_MAP: dict[str, str] = {}


def _register(canonical: str, *variants: str) -> None:
    for v in variants:
        _HEADER_MAP[v.lower()] = canonical


_register("summary", "summary", "professional summary", "executive summary",
          "career overview", "executive profile", "profile", "objective",
          "career focus", "professional profile", "overview", "professional overview")
_register("experience", "experience", "professional experience", "work experience",
          "work history", "employment history", "employment", "career history",
          "relevant experience", "professional background")
_register("education", "education", "education and training", "academic background",
          "educational background", "education & training", "academics")
_register("skills", "skills", "highlights", "skill highlights", "core qualifications",
          "technical skills", "core competencies", "qualifications", "key skills",
          "areas of expertise", "competencies", "computer skills", "summary of skills")
_register("accomplishments", "accomplishments", "core accomplishments", "achievements",
          "key accomplishments", "select accomplishments")
_register("certifications", "certifications", "licenses", "certifications and licenses",
          "licenses and certifications", "training", "certificates")
_register("affiliations", "professional affiliations", "affiliations", "memberships",
          "professional memberships", "organizations")
_register("additional", "additional information", "interests", "personal information",
          "languages", "publications", "references", "activities", "awards",
          "honors", "volunteer experience", "community involvement")

CANONICAL_SECTIONS = sorted(set(_HEADER_MAP.values()))

# A header line carries only the header: allow trailing ':' and stray spacing, nothing else.
_HEADER_LINE_RE = re.compile(r"^\s*([A-Za-z][A-Za-z &/'-]{2,45})\s*:?\s*$")


@dataclass
class Section:
    """One labeled span of the resume. char_start/char_end index into the source text."""

    name: str
    heading: str | None
    text: str
    char_start: int
    char_end: int

    @property
    def n_chars(self) -> int:
        return len(self.text)


def classify_header(line: str) -> str | None:
    """Return the canonical section name for a header line, or None if it is body text."""
    m = _HEADER_LINE_RE.match(line)
    if not m:
        return None
    return _HEADER_MAP.get(m.group(1).strip().lower())


def split_sections(text: str) -> list[Section]:
    """Split normalized resume text into canonical sections.

    Text before the first recognized header becomes a 'header' section. In this corpus
    that is reliably the job title line, which is a useful signal on its own.

    Repeated headers ('Experience' appearing twice) each open a new Section rather than
    being merged, so char offsets stay contiguous and citations stay exact.
    """
    lines = text.split("\n")
    # Absolute char offset of the start of each line in `text`.
    offsets, pos = [], 0
    for line in lines:
        offsets.append(pos)
        pos += len(line) + 1

    # (line_index, canonical_name, heading_text)
    marks: list[tuple[int, str, str]] = []
    for i, line in enumerate(lines):
        name = classify_header(line)
        if name:
            marks.append((i, name, line.strip()))

    sections: list[Section] = []

    def _add(name: str, heading: str | None, start_line: int, end_line: int) -> None:
        body = "\n".join(lines[start_line:end_line]).strip()
        if not body:
            return
        start = offsets[start_line] if start_line < len(offsets) else len(text)
        end = offsets[end_line] if end_line < len(offsets) else len(text)
        sections.append(Section(name, heading, body, start, min(end, len(text))))

    if not marks:
        _add("unsectioned", None, 0, len(lines))
        return sections

    if marks[0][0] > 0:
        _add("header", None, 0, marks[0][0])

    for idx, (line_i, name, heading) in enumerate(marks):
        end = marks[idx + 1][0] if idx + 1 < len(marks) else len(lines)
        _add(name, heading, line_i + 1, end)  # +1 skips the header line itself

    return sections


def sections_to_dict(sections: list[Section]) -> dict[str, str]:
    """Flatten to {canonical_name: joined_text}, merging repeats. Convenience for analysis."""
    out: dict[str, list[str]] = {}
    for s in sections:
        out.setdefault(s.name, []).append(s.text)
    return {k: "\n".join(v) for k, v in out.items()}
