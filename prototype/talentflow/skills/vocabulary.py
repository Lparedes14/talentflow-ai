"""Alias generation and phrase matching against the O*NET vocabulary.

## The problem this solves

O*NET writes tools vendor-first. Resumes do not.

| O*NET | Resume |
|---|---|
| Autodesk AutoCAD | AutoCAD |
| Intuit QuickBooks | QuickBooks |
| Oracle Java | Java |
| Adobe Photoshop | Photoshop |
| Structured query language SQL | SQL |

Matching the surface forms directly misses essentially all of them. So every term is
expanded into the aliases a person might actually write: the full term, and each trailing
subsequence of it ('autodesk autocad' also indexes as 'autocad').

## Why trailing subsequences, and not a vendor list

The obvious fix is a list of vendor names to strip. We tried deriving one from the data and
it does not separate: the most common first tokens are `microsoft`, `oracle`, `ibm`,
`autodesk`, `adobe` -- but also `scientific`, `computer`, `the`, `national`, `medical`,
`online`. Any hand-drawn line through that list is arbitrary, and it has to be maintained
forever as O*NET adds terms. Trailing subsequences need no list and no maintenance.

## The danger, and the two-signal test

Trailing subsequences generate garbage aliases. `Microsoft Word` yields `word`;
`Microsoft Access` yields `access`; `Microsoft Office` yields `office`. Indexed naively,
every resume in the corpus "has" Microsoft Word.

Neither obvious filter works alone. We measured both:

| token | general-English zipf | corpus doc freq | want |
|---|---|---|---|
| word | 5.26 | 30.3% | block |
| excel | 3.73 | 38.6% | block |
| photoshop | 3.78 | 8.3% | **keep** |
| python | 3.78 | 1.6% | **keep** |
| java | 4.00 | 2.7% | **keep** |
| autocad | 2.56 | 4.1% | **keep** |

`excel` and `photoshop` are indistinguishable by English frequency (3.73 vs 3.78), and a
document-frequency cut low enough to catch `excel` also kills `autocad`, `photoshop` and
`sql`. So a single-token alias is dropped only when it is common in general English **and**
common in this corpus. Both conditions are required, which means a coined product name
(low English frequency) is never dropped, and a rare English word (low corpus frequency) is
never dropped either.

Multi-token aliases skip the test entirely -- 'microsoft word' is unambiguous.
"""
from __future__ import annotations

import logging
from collections import Counter
from dataclasses import dataclass
from typing import Collection, Iterable, Sequence

from ..text.tokenize import Token, tokenize, tokenize_spans
from .onet import SkillTerm

log = logging.getLogger(__name__)

try:
    from wordfreq import zipf_frequency as _zipf
except ImportError:  # pragma: no cover
    _zipf = None

# Two English-frequency bars, because one is not enough (see the calibration table in the
# module docstring and the second one below).
#
# Anything this common in general English cannot identify a product on its own, whatever
# our corpus says: `server` 4.46, `cloud` 4.46, `enterprise` 4.38, `backup` 4.21.
ALWAYS_COMMON_ZIPF = 4.05

# Moderately common English words are rejected only when they also collide in this corpus.
# This is the bar that catches `excel` (zipf 3.73, df 38.6%) while sparing `photoshop`
# (zipf 3.78, df 8.3%) -- two tokens English frequency alone cannot separate.
COMMON_ENGLISH_ZIPF = 3.5
COMMON_IN_CORPUS_DF = 0.10

# Suffix aliasing applies only to concrete products. A vendor prefix is droppable
# ('Autodesk AutoCAD' -> 'AutoCAD'); a descriptive phrase is not. Suffixing
# 'Handling and Moving Objects' yields the alias 'Objects', which is not a skill.
_SUFFIXABLE_DOMAINS = frozenset({"software"})

# Confidence tiers, strongest first. A lexical matcher cannot resolve every ambiguity, so
# it reports how much to trust each hit instead of pretending they are equal.
#
#   exact  the full multi-token O*NET term, or a single-token term that is not an ordinary
#          English word: 'Microsoft Visual Studio', 'Python', 'Kubernetes'.
#   alias  a vendor-stripped alias: 'AutoCAD' for 'Autodesk AutoCAD'. Safe, but derived.
#   weak   a single-token term that IS an ordinary English word. O*NET genuinely contains
#          'Go', 'R', 'C', 'Design', 'Writing' and 'Science'. Every one is a real entry and
#          every one fires constantly on ordinary prose. No frequency threshold separates
#          the language Go from the verb; only surrounding context does, which is the job
#          of the retrieval and LLM stages, not of a word matcher.
CONFIDENCE_ORDER = ("weak", "alias", "exact")

# Function words. A derived alias starting with one is a sentence fragment, not a name:
# 'Thomson Reuters Web of Science' yields 'of science', which then matches every
# "Bachelor of Science" in the corpus.
_FUNCTION_WORDS = frozenset({
    "of", "and", "or", "for", "the", "a", "an", "in", "on", "to", "with", "by", "at",
})

# Calibration thresholds (see SkillVocabulary.calibrate).
CALIBRATION_MIN_DF = 0.02        # an alias firing on fewer resumes than this is left alone
CALIBRATION_MIN_OCCUPATIONS = 10  # ...otherwise its term must be this widely used

# Longest alias we will try to match, in tokens. Bounds the matcher's inner loop.
MAX_ALIAS_TOKENS = 8

# Shortest a derived alias may be. Two characters is never a distinctive product name, and
# 'Exact Software Macola ES' was claiming the alias `es` on 48% of one employer's postings.
MIN_ALIAS_CHARS = 3


@dataclass(frozen=True)
class SkillMatch:
    """One skill found in a document, with the span that proves it.

    `char_start`/`char_end` are the offsets of the matched text in the source. That is the
    evidence citation the proposal requires -- not a re-search that could land on a
    different occurrence of the same word.
    """

    term: SkillTerm
    matched_text: str
    alias: str
    char_start: int
    char_end: int
    section: str | None = None
    confidence: str = "exact"
    engine: str = "lexical"   # which extractor produced it; the A/B needs to distinguish

    @property
    def name(self) -> str:
        return self.term.term


def _trailing_subsequences(tokens: Sequence[str]) -> list[str]:
    """Every suffix of the token list, longest first. ['a','b','c'] -> 'a b c','b c','c'."""
    return [" ".join(tokens[i:]) for i in range(len(tokens))]


def _leading_subsequences(tokens: Sequence[str]) -> list[str]:
    """Every proper prefix, longest first. ['a','b','c'] -> 'a b','a'.

    Suffixes alone are not enough, and the gold set is what proved it. O*NET writes some
    products vendor-first ('Autodesk AutoCAD') and others product-first ('Teradata
    Database', 'Salesforce software'), so the distinctive word is sometimes at the front.
    With suffixes only, 'Teradata Database' indexes as 'database' -- rejected as an everyday
    word -- and the term becomes unreachable even though O*NET contains it. 'Teradata' was
    one of the most frequent misses in the 220-resume evaluation.

    Prefixes face the same safety test and the same calibration as suffixes, so the vendor
    words this generates ('microsoft', 'google') are filtered by the machinery already there.
    """
    return [" ".join(tokens[:i]) for i in range(len(tokens) - 1, 0, -1)]


# The resume sections that hold identity rather than experience. Skills are not looked for
# here. See F32: a candidate's surname can otherwise be read as a vendor product name.
IDENTITY_SECTIONS = frozenset({"header"})


class SkillVocabulary:
    """The O*NET terms plus their aliases, and a matcher over them."""

    def __init__(
        self,
        terms: Iterable[SkillTerm],
        corpus_doc_freq: dict[str, float] | None = None,
        zipf_threshold: float = COMMON_ENGLISH_ZIPF,
        df_threshold: float = COMMON_IN_CORPUS_DF,
    ):
        self.terms = list(terms)
        self.corpus_doc_freq = corpus_doc_freq or {}
        self.zipf_threshold = zipf_threshold
        self.df_threshold = df_threshold
        self.aliases: dict[str, list[SkillTerm]] = {}
        self.alias_confidence: dict[str, str] = {}
        self.rejected_aliases: dict[str, str] = {}
        self._build_aliases()

    # ------------------------------------------------------------------ building

    def _all_tokens_are_common_english(self, alias: str) -> bool:
        """True when every token in a multi-token alias is an everyday English word.

        The single-token rule alone left a hole: multi-token aliases skipped the English
        test entirely on the reasoning that 'microsoft word' is unambiguous. It is, but
        'open source' and 'one software' are not, and both are trailing or leading
        subsequences of real O*NET products (`Open Source Matters Joomla!`,
        `ONE Software KidsONE`). They fired on 37% and 21% of one employer's postings.

        Calibration could not catch them, because they sit under 2% across postings
        generally and only spike inside one company. Recalibrating per company would make
        the vocabulary company-specific and break the comparison it exists to enable, so the
        fix has to be structural instead: **a name made entirely of everyday words is not a
        name.** Measured, the rarest token in a bad alias scores 4.77 or above, while the
        rarest token in a good one ('analytics' 3.77, 'api' 3.68, 'sql' 3.38) stays below.

        Deliberately NOT an occupation-count rule, which was the obvious alternative and is
        wrong: O*NET lags on modern tooling, so Snowflake has 6 occupations, PyTorch 4 and
        TensorFlow 5. Requiring popularity would delete exactly the tools that matter most.
        """
        tokens = alias.split()
        return len(tokens) > 1 and all(self._is_common_english(t) for t in tokens)

    def _is_common_english(self, token: str) -> bool:
        """True when a bare token is an everyday English word, so a hit on it proves little.

        Tokens carrying symbols are exempt. No English word contains '++', '#', '.' or '&'
        mid-token, so 'c++', 'c#', '.net' and 'p&l' are unambiguous skill names by
        construction. The exemption is also a correctness fix: wordfreq strips the symbols
        before looking a token up, so it scores 'c++' as 'c' (zipf 5.33) and would flag one
        of the least ambiguous names in the vocabulary as an everyday word.
        """
        if _zipf is None:
            return False
        if not token.isalnum():
            return False
        return _zipf(token, "en") >= ALWAYS_COMMON_ZIPF

    def _is_safe_single_token(self, token: str) -> tuple[bool, str]:
        """Can this one token stand alone as a skill name? Returns (safe, reason).

        Applied only to aliases we *derived* by stripping a vendor prefix. A term O*NET
        itself lists as a single token is that skill's real name -- 'Python', 'Linux',
        'Tableau' -- and is indexed without argument.
        """
        if token.isdigit():
            # From 'Pulse Software ChiroPulse 365'. A bare number is never a skill.
            return False, "numeric"

        if _zipf is None:
            # Without English frequency data the test cannot run, so fall back to the
            # conservative side: no derived single-token aliases at all. Under-matching is
            # recoverable; a vocabulary where every resume "has" Microsoft Word is not.
            return False, "no wordfreq available"

        english = _zipf(token, "en")
        if english >= ALWAYS_COMMON_ZIPF:
            return False, f"common English (zipf {english:.2f})"

        in_corpus = self.corpus_doc_freq.get(token, 0.0)
        if english >= self.zipf_threshold and in_corpus >= self.df_threshold:
            return False, f"common English (zipf {english:.2f}) and corpus (df {in_corpus:.1%})"

        return True, ""

    def _build_aliases(self) -> None:
        """Index every term under its full form and each trailing subsequence."""
        for term in self.terms:
            tokens = term.key.split()
            if not tokens or len(tokens) > MAX_ALIAS_TOKENS:
                continue

            # The full term is always indexed, exactly as O*NET writes it -- we never
            # second-guess O*NET's own naming. But a one-word term that is also an ordinary
            # English word is flagged, so callers can require better evidence.
            self.aliases.setdefault(term.key, []).append(term)
            self.alias_confidence[term.key] = (
                "weak" if len(tokens) == 1 and self._is_common_english(term.key) else "exact"
            )

            if term.onet_domain not in _SUFFIXABLE_DOMAINS:
                continue

            derived = _trailing_subsequences(tokens)[1:] + _leading_subsequences(tokens)
            for alias in derived:
                if len(alias) < MIN_ALIAS_CHARS:
                    self.rejected_aliases.setdefault(alias, "too short to be distinctive")
                    continue
                if self._all_tokens_are_common_english(alias):
                    self.rejected_aliases.setdefault(
                        alias, "every token is an everyday English word")
                    continue
                parts = alias.split()
                if parts[0] in _FUNCTION_WORDS or parts[-1] in _FUNCTION_WORDS:
                    # A fragment, not a name. Leading: 'of science' from 'Web of Science'.
                    # Trailing: 'power and' from 'Power and Precision', which then matches
                    # every "power, and" in ordinary prose.
                    self.rejected_aliases.setdefault(alias, "starts or ends with a function word")
                    continue
                if alias.count(" ") == 0:
                    safe, reason = self._is_safe_single_token(alias)
                    if not safe:
                        self.rejected_aliases.setdefault(alias, reason)
                        continue
                self.aliases.setdefault(alias, []).append(term)
                # Never downgrade an alias that is some other term's exact name.
                self.alias_confidence.setdefault(alias, "alias")

        # An alias mapping to several terms is ambiguous. Prefer the term used by the most
        # occupations, with the shorter name breaking ties.
        #
        # Ordering by name length first looks tidier and is wrong: the alias 'sql' then
        # resolves to 'Windent SQL', a niche dental product with a two-word name, instead of
        # 'Structured query language SQL'. A resume saying "SQL" means the common one, and
        # occupation coverage is exactly the measure of common.
        for alias, matched in self.aliases.items():
            matched.sort(key=lambda t: (-t.n_occupations, t.n_tokens))

    # ------------------------------------------------------------------ matching

    def match(self, text: str, section: str | None = None) -> list[SkillMatch]:
        """Find every vocabulary term in `text`, longest match first.

        Longest-first so 'Microsoft SQL Server' is reported as itself rather than as three
        separate hits for 'server', 'sql server' and 'microsoft sql server'. Matched tokens
        are consumed, so spans never overlap.
        """
        tokens: list[Token] = tokenize_spans(text)
        lowered = [t.lower for t in tokens]
        matches: list[SkillMatch] = []

        i = 0
        while i < len(tokens):
            longest = None
            # Try the longest n-gram first; stop at the first hit.
            for length in range(min(MAX_ALIAS_TOKENS, len(tokens) - i), 0, -1):
                candidate = " ".join(lowered[i:i + length])
                if candidate in self.aliases:
                    longest = (length, candidate)
                    break

            if longest is None:
                i += 1
                continue

            length, alias = longest
            start, end = tokens[i].start, tokens[i + length - 1].end
            matches.append(SkillMatch(
                term=self.aliases[alias][0],
                matched_text=text[start:end],
                alias=alias,
                char_start=start,
                char_end=end,
                section=section,
                confidence=self.alias_confidence.get(alias, "alias"),
            ))
            i += length

        return matches

    def match_resume(
        self,
        record: dict,
        skip_generic: bool = True,
        min_confidence: str = "alias",
        skip_sections: Collection[str] = IDENTITY_SECTIONS,
    ) -> list[SkillMatch]:
        """Match section by section, so every hit carries where in the resume it came from.

        `skip_generic` drops category terms like 'Email software' and 'Web browser
        software'. On a resume they fire on nearly everyone and carry no information. They
        stay in the vocabulary because on a *posting* they are legitimate requirements.

        `min_confidence` defaults to excluding weak hits, because on a resume a bare 'go'
        or 'design' is far more often the English word than the skill. Pass 'weak' to see
        everything -- useful for measuring what the filter costs in recall.

        `skip_sections` excludes the header, which is where a resume puts a person's name.
        O*NET is full of vendor products named after people (`Booker Software SpaBooker`,
        `Anand Systems ASI FrontDesk`, `Patterson Dental Supply`), so a surname in the
        header can be scored as a skill. F32 measured this: every resume tested changed its
        skill set when the name on it changed. Pass an empty collection to search the whole
        document, which is what a posting wants, since a posting has no header section.
        """
        floor = CONFIDENCE_ORDER.index(min_confidence)
        skip_sections = set(skip_sections or ())
        out: list[SkillMatch] = []
        for section in record["sections"]:
            if section["name"] in skip_sections:
                continue
            for m in self.match(section["text"], section=section["name"]):
                if skip_generic and m.term.is_generic:
                    continue
                if CONFIDENCE_ORDER.index(m.confidence) < floor:
                    continue
                # Section offsets are relative to the section; shift to the full document.
                out.append(SkillMatch(
                    term=m.term, matched_text=m.matched_text, alias=m.alias,
                    char_start=m.char_start + section["char_start"],
                    char_end=m.char_end + section["char_start"],
                    section=section["name"], confidence=m.confidence,
                ))
        return out

    # --------------------------------------------------------------- calibration

    def calibrate(
        self,
        *corpora: Iterable[dict],
        min_df: float = CALIBRATION_MIN_DF,
        min_occupations: int = CALIBRATION_MIN_OCCUPATIONS,
        max_rounds: int = 5,
    ) -> dict:
        """Prune derived aliases that fire often but point at obscure products.

        The failure this fixes, found by ranking aliases by how many resumes they hit:

        | alias | resumes | resolves to | O*NET occupations |
        |---|---|---|---|
        | proficient | 21.7% | Infinity QS ProFicient | 2 |
        | project management | 22.3% | Oracle Primavera P6 ... | 2 |
        | human resources | 11.4% | Ellucian Banner Human Resources | 1 |
        | powerpoint | 18.2% | Microsoft PowerPoint | **629** |
        | autocad | 4.1% | Autodesk AutoCAD | **171** |

        Software vendors name products after the job the product does, so the tail of a
        product name is very often a plain description of that job. `ProFicient` is a real
        SPC product used by 2 occupations; letting it own the word "proficient" hands it a
        fifth of all resumes.

        Occupation coverage separates the two groups cleanly -- 1 to 2 for every false
        positive, 84 to 784 for every true one -- so the rule is: **a common alias has to
        be earned.** An alias firing on fewer than `min_df` of resumes is left alone,
        however niche its term; above that, the term must be used by at least
        `min_occupations` occupations.

        The test applies to exact O*NET names too, not just derived aliases. An earlier
        version exempted them on the principle of not second-guessing O*NET's naming, and
        that let through the worst single case in the corpus: O*NET lists a product called
        **Analyze**, used by exactly 1 occupation, which then claimed the word "analyze" on
        525 resumes. `Ledger` and `Resource Management` failed the same way. The principle
        was wrong -- what deserves protection is not being an official name, it is being
        widely used, and occupation coverage already measures that. Genuine taxonomy names
        ('Time Management', 'Troubleshooting', 'Attention to Detail') span hundreds of
        occupations and clear the bar untouched.

        Pass one corpus per positional argument. An alias is judged by the **highest** rate
        it reaches in any single corpus, never by the pooled rate across all of them. Pooling
        dilutes: `automation` fires on 9% of job postings and almost no resumes, and averaged
        over 2,484 resumes plus 3,000 postings that becomes 0.7%, safely under the threshold
        and left in place. It is still wrong on every posting. Unsafe in one corpus is unsafe.

        Runs to a fixed point rather than once. The matcher takes the longest alias at each
        position, so pruning one alias uncovers the shorter ones hiding beneath it: removing
        'general ledger' lets the bare 'ledger' start firing on the same 178 resumes, and it
        was invisible in the first round precisely because the longer alias was winning. One
        pass therefore leaves the same false positive in place under a shorter name.

        Returns a report of what was pruned and why.
        """
        materialized = [list(c) for c in corpora if c is not None]
        materialized = [c for c in materialized if c]
        if not materialized:
            return {"n_records": 0, "n_pruned": 0, "n_rounds": 0, "converged": True,
                    "pruned": [], "corpus_sizes": [],
                    "thresholds": {"min_df": min_df, "min_occupations": min_occupations}}

        pruned: list[dict] = []
        rounds = 0

        for rounds in range(1, max_rounds + 1):
            # Highest rate in any one corpus, not the pooled rate. See the docstring.
            worst_df: dict[str, float] = {}
            for corpus in materialized:
                hits: Counter[str] = Counter()
                for record in corpus:
                    hits.update(
                        {m.alias for m in self.match_resume(record, min_confidence="weak")}
                    )
                size = len(corpus) or 1
                for alias, count in hits.items():
                    rate = count / size
                    if rate > worst_df.get(alias, 0.0):
                        worst_df[alias] = rate

            round_pruned = []
            for alias, df in worst_df.items():
                if df < min_df:
                    continue
                if alias not in self.aliases:
                    continue
                term = self.aliases[alias][0]
                if term.n_occupations >= min_occupations:
                    continue
                round_pruned.append({
                    "alias": alias, "worst_corpus_df": round(df, 4), "round": rounds,
                    "term": term.term, "n_occupations": term.n_occupations,
                })
                del self.aliases[alias]
                self.alias_confidence.pop(alias, None)
                self.rejected_aliases[alias] = (
                    f"fires on {df:.1%} of documents in at least one corpus but "
                    f"'{term.term}' covers only {term.n_occupations} occupations"
                )

            pruned.extend(round_pruned)
            if not round_pruned:
                break

        pruned.sort(key=lambda r: -r["worst_corpus_df"])
        return {
            "n_records": sum(len(c) for c in materialized),
            "corpus_sizes": [len(c) for c in materialized],
            "n_pruned": len(pruned),
            "n_rounds": rounds,
            "converged": rounds < max_rounds,
            "pruned": pruned,
            "thresholds": {"min_df": min_df, "min_occupations": min_occupations},
        }

    def to_dict(self) -> dict:
        """Serialize to a plain dict for shipping a prebuilt vocabulary. corpus_doc_freq is
        left out: it is only used while building, and matching does not need it."""
        return {
            "terms": [{
                "term": t.term, "key": t.key, "onet_domain": t.onet_domain,
                "category": t.category, "n_occupations": t.n_occupations,
                "is_hot_technology": t.is_hot_technology, "is_generic": t.is_generic,
            } for t in self.terms],
            "aliases": {a: [t.key for t in terms] for a, terms in self.aliases.items()},
            "alias_confidence": self.alias_confidence,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "SkillVocabulary":
        """Rebuild from to_dict() output without reading the corpus or re-calibrating."""
        obj = cls.__new__(cls)
        obj.terms = [SkillTerm(**td) for td in data["terms"]]
        by_key = {t.key: t for t in obj.terms}
        obj.aliases = {a: [by_key[k] for k in keys if k in by_key]
                       for a, keys in data["aliases"].items()}
        obj.alias_confidence = dict(data["alias_confidence"])
        obj.corpus_doc_freq = {}
        obj.zipf_threshold = COMMON_ENGLISH_ZIPF
        obj.df_threshold = COMMON_IN_CORPUS_DF
        obj.rejected_aliases = {}
        return obj

    def stats(self) -> dict:
        return {
            "n_terms": len(self.terms),
            "n_aliases": len(self.aliases),
            "n_rejected_aliases": len(self.rejected_aliases),
            "ambiguous_aliases": sum(1 for v in self.aliases.values() if len(v) > 1),
            "by_confidence": dict(Counter(self.alias_confidence.values())),
        }


def corpus_document_frequency(records: Iterable[dict]) -> dict[str, float]:
    """Share of documents each token appears in. The corpus half of the two-signal test."""
    counts: Counter[str] = Counter()
    n = 0
    for record in records:
        n += 1
        counts.update(set(tokenize(record["text"])))
    return {token: c / n for token, c in counts.items()} if n else {}
