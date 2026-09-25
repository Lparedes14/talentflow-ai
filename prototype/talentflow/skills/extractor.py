"""Two skill extractors behind one interface, so they can be compared honestly.

The proposal requires a baseline that any better method has to beat, and the team contract
gives Juan "the head-to-head comparison of our two solutions". That comparison is only
trustworthy if the engine is the *only* thing that differs, so both implementations return
the same `SkillMatch` objects and are scored by the same harness, exactly as the embedding
backends already are.

## What each engine can and cannot do

**Lexical.** Scans for O*NET names and known aliases. Cannot hallucinate, because every
result is literally a span of the document, and measured hallucination is 0.0% by
construction. Its ceiling is the vocabulary: it reaches 98.5% of what O*NET makes findable,
and its misses are terms O*NET lacks (`Mainframe`) or phrases nobody writes
(`Analyzing Data or Information` for `Requirement Analysis`).

**LLM.** Reads the resume and names skills in its own words. Not bounded by the vocabulary,
which is exactly the point. But it *can* invent things, so this is the first component in the
system where hallucination is a real risk rather than a theoretical one.

## The design that keeps the LLM honest: make it quote

The model is required to return a verbatim quote from the resume alongside every skill. That
one requirement does three jobs at once:

1. **It gives us character offsets.** We find the quote in the source, and the skill inherits
   that span, so LLM results carry the same evidence citation lexical results do.
2. **It makes hallucination measurable rather than assumed.** A skill whose quote is not in
   the document is a hallucination, detected automatically, counted, and dropped. The
   proposal's 3% target becomes a number we compute instead of a claim we make.
3. **It suppresses hallucination in the first place.** A model asked to cite its source
   invents less than one asked only for a list.

Quotes are matched with whitespace normalized. A model that reflows a line break has not
invented anything, and penalising that would inflate the hallucination rate with noise.

## Mapping free text back to O*NET (the RAG step)

The LLM returns "Mainframe administration". Matching needs a shared vocabulary, so that
string has to become an O*NET name or be flagged. Three tiers, most confident first:

1. **Exact alias.** The phrase is already a name or nickname we know.
2. **Nearest neighbour by embedding.** The phrase is embedded and compared against all 9,065
   O*NET term names; above a similarity threshold, the closest wins. This is the retrieval
   step, and it is what finally gives the vector index a job inside extraction.
3. **Unmapped.** Reported as unmapped and kept, never silently dropped. That is TC8.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Protocol, Sequence

from ..llm.client import LLMClient
from .onet import SkillTerm, normalize_term
from .vocabulary import CONFIDENCE_ORDER, IDENTITY_SECTIONS, SkillMatch, SkillVocabulary

log = logging.getLogger(__name__)

# Below this cosine similarity, a nearest neighbour is a coincidence rather than a mapping.
DEFAULT_MAP_THRESHOLD = 0.55

SYSTEM_PROMPT = (
    "You are a precise resume analyst. You extract only what the document states, and you "
    "quote the document to prove every claim. You never infer a skill from a job title, and "
    "you never add skills a reader would merely expect for the role."
)

EXTRACTION_PROMPT = """Read this resume and list the skills it demonstrates.

For every skill return:
- "skill": the skill's common name (e.g. "Python", "Project Management", "Active Directory")
- "quote": text copied EXACTLY from the resume that shows this skill. Copy it character for
  character. Do not paraphrase, correct, or shorten it.
- "category": exactly one of "technical", "soft", or "process"

Rules:
- Every quote must appear verbatim in the resume. A skill you cannot quote must be omitted.
- Do not infer skills from the job title alone. "Accountant" does not by itself mean the
  person has "Financial Reporting".
- Prefer the specific over the generic: "Microsoft Excel" rather than "spreadsheets".
- If the resume is thin, return few skills. Returning few is correct; padding is not.

Return only a JSON array, with no commentary before or after it:

[{{"skill": "...", "quote": "...", "category": "technical"}}]

RESUME:
{resume}
"""


class SkillExtractor(Protocol):
    """What both engines implement."""

    name: str

    def extract(self, record: dict) -> list[SkillMatch]:
        """Extract skills from a corpus record. Returns matches with source offsets."""


class LexicalExtractor:
    """The O*NET word-match baseline. Wraps SkillVocabulary behind the shared interface."""

    name = "lexical"

    def __init__(self, vocab: SkillVocabulary, min_confidence: str = "alias",
                 skip_generic: bool = True, skip_sections=IDENTITY_SECTIONS):
        self.vocab = vocab
        self.min_confidence = min_confidence
        self.skip_generic = skip_generic
        # Default excludes the header, where the name lives. F32.
        self.skip_sections = skip_sections

    def extract(self, record: dict) -> list[SkillMatch]:
        return self.vocab.match_resume(
            record, skip_generic=self.skip_generic, min_confidence=self.min_confidence,
            skip_sections=self.skip_sections,
        )


class OnetMapper:
    """Maps free-text skill names onto O*NET terms by embedding similarity.

    The index is built over the 9,065 O*NET *term names*, not over resume chunks. A term name
    is a handful of words, so this is small and fast to build, and comparing a phrase against
    phrases is a fairer comparison than a phrase against a paragraph.
    """

    def __init__(self, vocab: SkillVocabulary, backend: str = "lsa",
                 threshold: float = DEFAULT_MAP_THRESHOLD, n_components: int = 128):
        from ..embed import get_embedder

        self.vocab = vocab
        self.threshold = threshold
        self.terms: list[SkillTerm] = list(vocab.terms)
        names = [t.term for t in self.terms]
        kw = {"n_components": min(n_components, len(names) - 1)} if backend == "lsa" else {}
        self.embedder = get_embedder(backend, min_df=1, **kw).fit(names)
        self.matrix = self.embedder.encode(names)

    def map(self, phrase: str) -> tuple[SkillTerm | None, float]:
        """Return (term, similarity), or (None, score) when nothing clears the threshold."""
        import numpy as np
        from scipy import sparse

        key = normalize_term(phrase)
        if key in self.vocab.aliases:
            return self.vocab.aliases[key][0], 1.0

        scores = self.matrix @ self.embedder.encode([phrase]).T
        scores = np.asarray(scores.todense() if sparse.issparse(scores) else scores).ravel()
        best = int(np.argmax(scores))
        score = float(scores[best])
        return (self.terms[best], score) if score >= self.threshold else (None, score)


def _unmapped_term(name: str, category: str) -> SkillTerm:
    """A placeholder for a skill with no O*NET equivalent.

    Kept rather than dropped, because TC8 requires an unknown skill to be reported as
    unmapped and never to disappear in silence. `n_occupations` is 0 so it can never win an
    alias tie-break against a real term.
    """
    return SkillTerm(
        term=name, key=normalize_term(name), onet_domain="unmapped",
        category=category if category in ("technical", "soft", "process") else "technical",
        n_occupations=0, is_hot_technology=False, is_generic=False,
    )


def _normalized_find(haystack: str, needle: str) -> tuple[int, int] | None:
    """Locate `needle` in `haystack`, ignoring differences in whitespace runs.

    A model that reflows a line break has not invented anything. Matching on exact characters
    would count that as a hallucination and inflate the rate with formatting noise.
    """
    if not needle.strip():
        return None
    direct = haystack.find(needle)
    if direct >= 0:
        return direct, direct + len(needle)

    pattern = r"\s+".join(re.escape(part) for part in needle.split())
    match = re.search(pattern, haystack)
    return (match.start(), match.end()) if match else None


class LLMExtractor:
    """Asks a model to read the resume, then grounds every answer back to the document."""

    name = "llm"

    def __init__(
        self,
        client: LLMClient,
        vocab: SkillVocabulary,
        mapper: OnetMapper | None = None,
        max_chars: int = 12000,
    ):
        self.client = client
        self.vocab = vocab
        self.mapper = mapper
        self.max_chars = max_chars
        self.n_truncated = 0
        self.n_hallucinated = 0
        self.n_returned = 0
        self.n_unmapped = 0
        self.parse_failures = 0

    # ------------------------------------------------------------------ parsing

    @staticmethod
    def _complete_objects(text: str) -> list[dict]:
        """Every complete `{...}` object in a truncated array, ignoring the severed tail.

        A response cut off at the token limit is not a bad response. It is a good response
        with an ending missing, and the twenty skills that did arrive are as valid as they
        would have been had the twenty-first fit. Discarding them loses real recall to an
        accounting problem. See F34.

        Brace counting rather than a regex, because a quote inside a value ("skill": "C++
        {embedded}") would defeat anything simpler, and the whole point of this parser is
        that it does not fail on text a model happened to produce.
        """
        objects: list[dict] = []
        depth = 0
        start = -1
        in_string = False
        escaped = False
        for i, ch in enumerate(text):
            if in_string:
                if escaped:
                    escaped = False
                elif ch == "\\":
                    escaped = True
                elif ch == '"':
                    in_string = False
                continue
            if ch == '"':
                in_string = True
            elif ch == "{":
                if depth == 0:
                    start = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and start >= 0:
                    try:
                        item = json.loads(text[start:i + 1])
                    except json.JSONDecodeError:
                        pass
                    else:
                        if isinstance(item, dict):
                            objects.append(item)
                    start = -1
        return objects

    @staticmethod
    def parse_response(text: str) -> list[dict]:
        """Pull the JSON array out of a response.

        Tolerant of a fenced code block or a sentence of preamble, because instructing a
        model not to add commentary reduces it but does not eliminate it, and losing a whole
        resume's extraction to a stray "Here you go:" is not an acceptable failure mode.

        Also tolerant of an array that was cut off at the token limit, which is what
        actually happened on the first live run. Every complete object before the cut is
        kept. Nothing is invented to close the array: a half-written object is dropped, and
        every surviving skill still has to pass the verbatim-quote check afterwards, so
        salvage cannot manufacture a skill the document does not contain.
        """
        text = text.strip()
        fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
        if fence:
            text = fence.group(1).strip()
        start, end = text.find("["), text.rfind("]")
        if start < 0:
            raise ValueError("no JSON array in response")

        if end > start:
            try:
                parsed = json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, list):
                return [item for item in parsed if isinstance(item, dict)]
            if parsed is not None:
                raise ValueError("response JSON is not a list")

        salvaged = LLMExtractor._complete_objects(text[start:])
        if not salvaged:
            raise ValueError("no complete objects in response (truncated before the first?)")
        log.warning("response was truncated; salvaged %d complete skills", len(salvaged))
        return salvaged

    # --------------------------------------------------------------- extraction

    def _section_of(self, record: dict, position: int) -> str | None:
        for section in record["sections"]:
            if section["char_start"] <= position < section["char_end"]:
                return section["name"]
        return None

    def extract(self, record: dict) -> list[SkillMatch]:
        text = record["text"]
        if len(text) > self.max_chars:
            # The resume is longer than the model's input budget, so we cut it here. A skill
            # that shows up only past the cut can't be found, so we count the cut and warn
            # about it rather than losing skills without a word. See F39.
            self.n_truncated += 1
            log.warning("resume %s is %d chars; cut to %d for the model",
                        record.get("resume_id"), len(text), self.max_chars)
        prompt = EXTRACTION_PROMPT.format(resume=text[:self.max_chars])

        try:
            raw = self.client.complete(prompt, system=SYSTEM_PROMPT, temperature=0.0)
            items = self.parse_response(raw)
        except (ValueError, json.JSONDecodeError) as exc:
            self.parse_failures += 1
            log.warning("could not parse response for %s: %s", record.get("resume_id"), exc)
            return []

        matches: list[SkillMatch] = []
        for item in items:
            name = str(item.get("skill", "")).strip()
            quote = str(item.get("quote", "")).strip()
            if not name:
                continue
            self.n_returned += 1

            span = _normalized_find(text, quote)
            if span is None:
                # The quote is not in the document. This is the hallucination check, and it
                # is why the prompt demands a quote at all.
                self.n_hallucinated += 1
                log.debug("unquotable skill %r (quote %r) in %s",
                          name, quote[:60], record.get("resume_id"))
                continue

            start, end = span
            term, score = (self.mapper.map(name) if self.mapper
                           else (self.vocab.aliases.get(normalize_term(name), [None])[0], 1.0))

            if term is None:
                term = _unmapped_term(name, str(item.get("category", "technical")))
                confidence = "weak"
                self.n_unmapped += 1
            else:
                confidence = "exact" if score >= 0.999 else "alias"

            matches.append(SkillMatch(
                term=term, matched_text=text[start:end], alias=name,
                char_start=start, char_end=end,
                section=self._section_of(record, start),
                confidence=confidence, engine="llm",
            ))

        return matches

    def stats(self) -> dict:
        """Counters for the report. Hallucination rate is the proposal's own metric."""
        return {
            "skills_returned": self.n_returned,
            "truncated_resumes": self.n_truncated,
            "unquotable": self.n_hallucinated,
            "hallucination_rate_pct": round(100 * self.n_hallucinated / self.n_returned, 2)
            if self.n_returned else 0.0,
            "unmapped_to_onet": self.n_unmapped,
            "parse_failures": self.parse_failures,
        }


def filter_by_confidence(matches: Sequence[SkillMatch], min_confidence: str) -> list[SkillMatch]:
    """Shared confidence filter, so both engines are cut at the same line."""
    floor = CONFIDENCE_ORDER.index(min_confidence)
    return [m for m in matches if CONFIDENCE_ORDER.index(m.confidence) >= floor]
