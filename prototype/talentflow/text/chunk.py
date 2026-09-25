"""Split resumes into embedding-sized chunks.

Three rules, each for a concrete reason:

1. Never cross a section boundary. A chunk spanning the end of Experience and the start
   of Education embeds as a blend of two unrelated things and retrieves well for neither.
   Sections are already segmented at ingest, so the boundary is free.
2. Never cut mid-sentence. Chunks are packed out of whole lines and sentences. A fragment
   like 'Managed a team of' embeds as noise.
3. Carry char offsets end to end. A retrieved chunk has to name the exact span of the
   source resume it came from, because the proposal requires every claimed skill to cite
   supporting text. Offsets make that citation exact; re-searching for the chunk text
   later can land on the wrong occurrence.

Sizing. Corpus median is 755 tokens per resume, and Experience alone is 69% of all tokens.
The 180-token default is set against typical sentence-embedding context windows (256
word-pieces, roughly 1.3 word-pieces per token here) and yields a handful of chunks per
resume rather than one blob that averages away every specific skill.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Iterable

from .tokenize import count_tokens, iter_sentences, tokenize_spans

DEFAULT_TARGET_TOKENS = 180
DEFAULT_OVERLAP_TOKENS = 30
DEFAULT_MIN_TOKENS = 20


@dataclass
class Chunk:
    """One embeddable unit of a resume, traceable to its exact source span."""

    resume_id: str
    category: str
    section: str
    chunk_index: int
    text: str
    char_start: int
    char_end: int
    n_tokens: int

    @property
    def chunk_id(self) -> str:
        return f"{self.resume_id}:{self.chunk_index}"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["chunk_id"] = self.chunk_id
        return d


def _split_oversized(text: str, start: int, target: int) -> list[tuple[str, int, int]]:
    """Break one over-long unit at token boundaries.

    Needed because the Skills section is often a single comma-separated line hundreds of
    tokens long, which no sentence rule will divide. Splitting at token boundaries keeps
    whole terms intact -- cutting by character would slice 'PowerPoint' in half.
    """
    toks = tokenize_spans(text)
    if len(toks) <= target:
        return [(text, start, start + len(text))]

    out = []
    for i in range(0, len(toks), target):
        window = toks[i:i + target]
        a, b = window[0].start, window[-1].end
        out.append((text[a:b], start + a, start + b))
    return out


def _units(section_text: str, section_start: int, target: int) -> list[tuple[str, int, int]]:
    """The atoms a chunk is packed from: whole sentences, each within the token budget."""
    units = []
    for sent, rel_start, rel_end in iter_sentences(section_text):
        abs_start = section_start + rel_start
        if count_tokens(sent) > target:
            units.extend(_split_oversized(sent, abs_start, target))
        else:
            units.append((sent, abs_start, abs_start + len(sent)))
    return units


def chunk_section(
    resume_id: str,
    category: str,
    section: str,
    text: str,
    char_start: int,
    target_tokens: int = DEFAULT_TARGET_TOKENS,
    overlap_tokens: int = DEFAULT_OVERLAP_TOKENS,
    min_tokens: int = DEFAULT_MIN_TOKENS,
    start_index: int = 0,
) -> list[Chunk]:
    """Pack one section into chunks. Returns them in document order."""
    units = _units(text, char_start, target_tokens)
    if not units:
        return []

    chunks: list[Chunk] = []
    buf: list[tuple[str, int, int]] = []
    buf_tokens = 0
    idx = start_index

    def flush() -> None:
        nonlocal buf, buf_tokens, idx
        if not buf:
            return
        body = "\n".join(u[0] for u in buf)
        chunks.append(Chunk(
            resume_id=resume_id, category=category, section=section, chunk_index=idx,
            text=body, char_start=buf[0][1], char_end=buf[-1][2], n_tokens=buf_tokens,
        ))
        idx += 1

    for unit in units:
        n = count_tokens(unit[0])
        if buf and buf_tokens + n > target_tokens:
            flush()
            # Carry the tail of the previous chunk forward so a skill sitting on a
            # boundary appears in both, and neither chunk loses its context.
            tail, tail_tokens = [], 0
            for prev in reversed(buf):
                t = count_tokens(prev[0])
                if tail_tokens + t > overlap_tokens:
                    break
                tail.insert(0, prev)
                tail_tokens += t
            buf, buf_tokens = tail, tail_tokens
        buf.append(unit)
        buf_tokens += n

    flush()

    # A trailing scrap gets folded back into its predecessor rather than embedded alone,
    # where it would be too short to carry meaning and would pollute retrieval.
    if len(chunks) > 1 and chunks[-1].n_tokens < min_tokens:
        last = chunks.pop()
        prev = chunks[-1]
        prev.text = prev.text + "\n" + last.text
        prev.char_end = last.char_end
        prev.n_tokens += last.n_tokens

    return chunks


def chunk_resume(
    record: dict,
    target_tokens: int = DEFAULT_TARGET_TOKENS,
    overlap_tokens: int = DEFAULT_OVERLAP_TOKENS,
    min_tokens: int = DEFAULT_MIN_TOKENS,
) -> list[Chunk]:
    """Chunk one corpus record, section by section, in document order."""
    chunks: list[Chunk] = []
    for section in record["sections"]:
        chunks.extend(chunk_section(
            resume_id=record["resume_id"],
            category=record["category"],
            section=section["name"],
            text=section["text"],
            char_start=section["char_start"],
            target_tokens=target_tokens,
            overlap_tokens=overlap_tokens,
            min_tokens=min_tokens,
            start_index=len(chunks),
        ))
    return chunks


def chunk_corpus(records: Iterable[dict], **kw) -> Iterable[Chunk]:
    """Stream chunks for a whole corpus."""
    for record in records:
        yield from chunk_resume(record, **kw)
