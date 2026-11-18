"""The O*NET skill vocabulary: the shared language both sides of a match speak.

Why a controlled vocabulary at all. A resume says "MS Excel", a posting says "Microsoft
Excel", a third document says "spreadsheets". Comparing raw strings, those are three
different skills and nobody matches anybody. Mapping all three onto one O*NET term is what
makes "this candidate has 7 of the 9 required skills" a sentence that means something.

O*NET 31.0 ships 46 CSVs. Eight carry vocabulary; the rest are ratings, scales, and
crosswalks. What we take from each:

| Source | Terms | What they are |
|---|---|---|
| software_skills (Workplace Example) | 8,753 | concrete tools -- Microsoft Excel, Atlassian JIRA, Autodesk AutoCAD |
| software_skills (Element Name) | 134 | tool categories -- "Customer relationship management CRM software" |
| knowledge | 33 | domains -- Economics and Accounting, Sales and Marketing |
| abilities | 52 | Oral Comprehension, Manual Dexterity |
| essential_skills | 10 | Reading Comprehension, Active Listening |
| transferable_skills | 25 | Negotiation, Persuasion, Social Perceptiveness |
| work_styles | 21 | Attention to Detail, Initiative |
| work_activities | 41 | Getting Information, Coordinating the Work of Others |

The ratings columns (Importance, Level, standard errors) are deliberately left behind here.
They describe how much an occupation needs a skill, which matters for ranking roles later;
they are not part of naming the skill.

Two fields are worth the extra care:

`onet_domain` keeps the source table, and `category` maps it onto the technical / soft /
process buckets the proposal commits to reporting. Both are kept because the mapping is
lossy and reversing it later would be guesswork.

`is_generic` flags terms that are categories wearing a tool's clothes -- "Email software",
"Web browser software", "Database software". Matched literally against a resume they fire
on almost everybody and mean nothing. Flagged rather than dropped, because for *postings*
they are legitimate requirements; only resume-side extraction should suppress them.
"""
from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from pathlib import Path

import pandas as pd

from ..config import ONET_ROOT
from ..text.tokenize import tokenize

log = logging.getLogger(__name__)

# source file -> (column holding the term, onet_domain, proposal category)
_TERM_SOURCES: list[tuple[str, str, str, str]] = [
    ("software_skills.csv", "Workplace Example", "software", "technical"),
    ("software_skills.csv", "Element Name", "software_category", "technical"),
    ("knowledge.csv", "Element Name", "knowledge", "technical"),
    ("abilities.csv", "Element Name", "ability", "soft"),
    ("essential_skills.csv", "Element Name", "essential_skill", "soft"),
    ("transferable_skills.csv", "Element Name", "transferable_skill", "soft"),
    ("work_styles.csv", "Element Name", "work_style", "soft"),
    ("work_activities.csv", "Element Name", "work_activity", "process"),
]

# A term is generic when it names a *kind* of tool rather than a product. These head nouns
# appear as the whole term ("Email software"), never as part of a product name
# ("Microsoft Excel"), so a trailing-word test separates them cleanly.
_GENERIC_HEADS = frozenset({
    "software", "systems", "system", "tools", "tool", "applications", "application",
    "programs", "program", "packages", "package", "suites", "suite", "utilities",
})

# ...unless the term is specific enough that its head noun is incidental. Anything with a
# brand-looking capitalized word survives; this list catches the rest.
_GENERIC_MAX_TOKENS = 4


@dataclass(frozen=True)
class SkillTerm:
    """One entry in the controlled vocabulary."""

    term: str                 # surface form as O*NET writes it
    key: str                  # normalized form used for matching
    onet_domain: str          # source table: software, ability, work_activity, ...
    category: str             # proposal bucket: technical | soft | process
    n_occupations: int        # how many O*NET occupations list it
    is_hot_technology: bool   # O*NET's own "in demand" flag, software only
    is_generic: bool          # a category wearing a tool's clothes

    @property
    def n_tokens(self) -> int:
        return len(self.key.split())


def normalize_term(term: str) -> str:
    """Normalized matching key: our tokenizer, lowercased, single-spaced.

    Uses the same tokenizer as the resume side on purpose. If the vocabulary were
    normalized differently from the text being searched, 'C++' in O*NET and 'C++' in a
    resume would produce different keys and never match -- the exact failure this
    vocabulary exists to prevent.
    """
    return " ".join(tokenize(term))


def _is_generic(key: str) -> bool:
    """True when the term names a kind of tool rather than a product."""
    parts = key.split()
    if not parts or len(parts) > _GENERIC_MAX_TOKENS:
        return False
    return parts[-1] in _GENERIC_HEADS


# The domains that name a concrete technology or a technical body of knowledge, as opposed
# to a human capability. Filtering to these is what "technical skills only" means here.
TECHNICAL_DOMAINS = frozenset({"software", "software_category", "knowledge"})


def load_vocabulary(onet_root: Path = ONET_ROOT,
                    technical_only: bool = False) -> list[SkillTerm]:
    """Build the controlled vocabulary from the O*NET CSV distribution.

    A term appearing in several sources keeps the most specific one. Ordering in
    `_TERM_SOURCES` encodes that: concrete tools beat categories, and both beat the broad
    taxonomy, because 'Microsoft Excel' tells you far more than 'Spreadsheet software'.

    `technical_only` narrows to the 8,884 terms that name a technology or a technical
    domain, dropping the 181 human-capability terms (abilities, work styles, work
    activities). Useful for a technical-roles proof of concept, but **off by default and it
    should stay that way for matching**: job postings genuinely demand Troubleshooting,
    Attention to Detail and Time Management, and a candidate who has them should get credit.
    """
    if not onet_root.exists():
        raise FileNotFoundError(
            f"O*NET not found at {onet_root}. Download the CSV distribution from "
            "https://www.onetcenter.org/database.html and unzip it there."
        )

    seen: dict[str, SkillTerm] = {}
    hot_by_term: dict[str, bool] = {}

    for filename, column, domain, category in _TERM_SOURCES:
        path = onet_root / filename
        if not path.exists():
            log.warning("missing %s -- skipping %s terms", filename, domain)
            continue

        usecols = [column, "O*NET-SOC Code"]
        if filename == "software_skills.csv" and column == "Workplace Example":
            usecols.append("Hot Technology")
        frame = pd.read_csv(path, usecols=usecols).dropna(subset=[column])

        if "Hot Technology" in frame.columns:
            for term, flag in zip(frame[column], frame["Hot Technology"]):
                if flag == "Y":
                    hot_by_term[term] = True

        # An occupation can list the same term twice (once per rating scale), so count
        # distinct occupations rather than rows.
        counts = frame.groupby(column)["O*NET-SOC Code"].nunique()

        for term, n_occ in counts.items():
            key = normalize_term(str(term))
            if not key or key in seen:
                continue
            seen[key] = SkillTerm(
                term=str(term).strip(),
                key=key,
                onet_domain=domain,
                category=category,
                n_occupations=int(n_occ),
                is_hot_technology=bool(hot_by_term.get(term, False)),
                is_generic=_is_generic(key),
            )

    terms = list(seen.values())
    if technical_only:
        terms = [t for t in terms if t.onet_domain in TECHNICAL_DOMAINS]
    return sorted(terms, key=lambda t: (-t.n_occupations, t.key))


def vocabulary_frame(terms: list[SkillTerm]) -> pd.DataFrame:
    """Vocabulary as a DataFrame, for saving and for eyeballing."""
    return pd.DataFrame([asdict(t) for t in terms])
