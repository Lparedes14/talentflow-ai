"""TC6: does who a candidate is change what the system says about them?

The proposal commits to a fairness test: a candidate's match score must move by less than 5
points when their name, pronouns and school change. D26 argues that this is guaranteed by
construction, because the score is arithmetic over skill sets and identity terms are not
skills. That argument is correct, and it is not a measurement.

It also has a hole, which is the reason this module exists rather than a paragraph saying
the test passes.

**A name can be a skill.** The vocabulary is 29,561 aliases generated from O*NET product and
technology names, and software gets named after people constantly. `Ruby`, `Julia`, `Ada`,
`Cassandra`, `Jenkins`, `Grace`, `Sage`, `Alexa` are all both ordinary given or family names
and real technologies in O*NET. If any of those is a live alias, then a candidate whose name
is Cassandra is credited with Apache Cassandra, and the identity-independence argument fails
at exactly the point where it matters. This is the D42 failure again: a string that is a
name in one context and a word in another.

So TC6 is measured two ways, and the second one is the one that can actually fail:

1. **End-to-end perturbation.** Swap the identity block on real resumes and re-extract.
   Reports the largest change in extracted skills and in match score.
2. **A collision audit of the vocabulary itself.** Every alias that is also a common
   personal name, listed with the O*NET term it resolves to. This does not need a resume,
   a posting or a model. It is a property of the vocabulary, and it names in advance every
   string through which the perturbation test could ever fail.

The name lists below are illustrative, not exhaustive. They span the demographic groups used
in hiring audit studies plus the most common US given names and surnames. A name absent from
them is not evidence of no collision, and the report should say so.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

# Given names spanning the groups hiring audit studies use, plus common US names generally.
# Ordinary names, chosen for frequency and coverage. That several are also technologies is
# the finding, not the selection criterion.
GIVEN_NAMES = {
    # frequently used in audit studies as White-associated
    "allison", "anne", "brad", "brendan", "carrie", "emily", "geoffrey", "greg", "jill",
    "kristen", "laurie", "matthew", "meredith", "neil", "todd",
    # frequently used in audit studies as Black-associated
    "aisha", "darnell", "ebony", "hakim", "jamal", "jermaine", "kareem", "keisha", "lakisha",
    "latonya", "latoya", "leroy", "rasheed", "tamika", "tanisha", "tremayne", "tyrone",
    # Hispanic-associated
    "alejandro", "carmen", "diego", "esteban", "gabriela", "guadalupe", "javier", "jose",
    "juanita", "luis", "mariana", "miguel", "rosa", "santiago", "sofia", "ximena",
    # East and South Asian-associated
    "aditya", "anjali", "chen", "hiroshi", "jin", "kavya", "mei", "min", "priya", "rahul",
    "sanjay", "sunita", "wei", "yuki", "zhang",
    # Arabic and Middle Eastern
    "amir", "fatima", "hassan", "layla", "omar", "yasmin", "zainab",
    # common US given names generally
    "ada", "alexa", "amanda", "amber", "april", "ashley", "barbara", "brooke", "cameron",
    "carol", "cassandra", "catherine", "chelsea", "christina", "dakota", "daisy", "dawn",
    "devon", "diana", "elizabeth", "faith", "grace", "harper", "heather", "holly", "hope",
    "iris", "ivy", "jasmine", "jordan", "joy", "julia", "june", "kelly", "lily", "logan",
    "madison", "margaret", "may", "morgan", "olive", "paige", "pearl", "phoenix", "reagan",
    "rose", "ruby", "sage", "savannah", "scarlett", "sierra", "skye", "summer", "sydney",
    "taylor", "victoria", "violet", "willow",
    "aaron", "adam", "andrew", "austin", "blake", "chase", "chris", "cole", "daniel",
    "david", "dean", "drew", "eric", "forrest", "frank", "gene", "george", "grant", "harry",
    "james", "jason", "jay", "john", "mark", "martin", "mason", "max", "michael", "miles",
    "nathan", "nicholas", "noah", "patrick", "paul", "peter", "philip", "reed", "robert",
    "ryan", "samuel", "sean", "sterling", "stuart", "thomas", "travis", "victor", "vincent",
    "wade", "walker", "warren", "wesley", "william",
}

# Common US surnames. Same reasoning: chosen for frequency, not for whether they collide.
SURNAMES = {
    "adams", "allen", "anderson", "bailey", "baker", "bell", "bennett", "brooks", "brown",
    "bryant", "butler", "campbell", "carter", "chavez", "clark", "coleman", "collins",
    "cook", "cooper", "cox", "cruz", "davis", "diaz", "edwards", "evans", "fisher",
    "flores", "ford", "foster", "garcia", "gibson", "gomez", "gonzalez", "gray", "green",
    "griffin", "hall", "harris", "hayes", "henderson", "hernandez", "hill", "howard",
    "hughes", "jackson", "james", "jenkins", "johnson", "jones", "kelly", "kennedy", "kim",
    "king", "lee", "lewis", "long", "lopez", "marshall", "martin", "martinez", "mcdonald",
    "miller", "mitchell", "moore", "morgan", "morris", "murphy", "myers", "nelson",
    "nguyen", "ortiz", "parker", "patel", "patterson", "perez", "perry", "peterson",
    "phillips", "powell", "price", "ramirez", "reed", "reyes", "richardson", "rivera",
    "roberts", "robinson", "rodriguez", "rogers", "ross", "russell", "sanchez", "sanders",
    "scott", "shaw", "simmons", "smith", "stewart", "sullivan", "taylor", "thomas",
    "thompson", "torres", "turner", "walker", "wallace", "ward", "washington", "watson",
    "white", "williams", "wilson", "wong", "wood", "wright", "young",
}

ALL_NAMES = GIVEN_NAMES | SURNAMES


@dataclass(frozen=True)
class Identity:
    """One identity block to substitute into a resume. Everything TC6 says must not matter."""

    label: str
    name: str
    pronouns: str
    school: str

    def block(self) -> str:
        return f"{self.name}\n{self.school}\nPronouns: {self.pronouns}\n"


# Deliberately varied along every axis TC6 names, and deliberately including one name that
# is also a technology, because a suite where every case passes tests nothing.
IDENTITIES = [
    Identity("baseline", "Alex Taylor", "they/them", "State University"),
    Identity("audit-a", "Emily Walsh", "she/her", "Northwestern University"),
    Identity("audit-b", "Lakisha Washington", "she/her", "Howard University"),
    Identity("audit-c", "Jamal Booker", "he/him", "Morehouse College"),
    Identity("audit-d", "Guadalupe Ramirez", "she/her", "Miami Dade College"),
    Identity("audit-e", "Rahul Anand", "he/him", "Anna University"),
    Identity("audit-f", "Greg Baker", "he/him", "Princeton University"),
    Identity("collision", "Cassandra Jenkins", "she/her", "Ruby Valley College"),
]


@dataclass
class Collision:
    """A vocabulary alias that is also a personal name."""

    alias: str
    term_name: str
    confidence: str
    kind: str            # "given", "surname", or "both"
    n_occupations: int = 0


def name_alias_collisions(vocab, names: Iterable[str] | None = None) -> list[Collision]:
    """Every alias in the vocabulary that is also a common personal name.

    This is the complete list of strings through which a candidate's name can be converted
    into a skill. It needs no resume and no model: it is a property of the vocabulary, so it
    can be rerun after any change to alias generation or calibration and diffed.
    """
    pool = {n.lower() for n in (names if names is not None else ALL_NAMES)}
    out: list[Collision] = []
    for alias, terms in vocab.aliases.items():
        low = alias.lower()
        if low not in pool:
            continue
        kind = ("both" if low in GIVEN_NAMES and low in SURNAMES
                else "given" if low in GIVEN_NAMES else "surname")
        term = terms[0]
        out.append(Collision(
            alias=alias,
            term_name=term.term,
            confidence=vocab.alias_confidence.get(alias, "unknown"),
            kind=kind,
            n_occupations=term.n_occupations,
        ))
    return sorted(out, key=lambda c: (c.confidence, c.alias))


def perturb_identity(record: dict, identity: Identity) -> dict:
    """A copy of the record with an identity block prepended to its first section.

    Prepended rather than substituted because the Kaggle resumes have no reliable name
    field to swap. Adding one is the stronger test anyway: it asks whether introducing
    identity text can change the output, which is the question TC6 is really about.
    """
    sections = [dict(s) for s in record["sections"]]
    if not sections:
        return dict(record)
    block = identity.block()
    # The header is where a real resume puts a name, so that is where the identity goes.
    target = next((i for i, s in enumerate(sections) if s["name"] == "header"), 0)
    sections[target] = {**sections[target], "text": block + sections[target]["text"]}
    return {**record, "sections": sections, "text": block + record.get("text", "")}


@dataclass
class SensitivityResult:
    """What changed across identities for one resume."""

    resume_id: str
    baseline_skills: set[str] = field(default_factory=set)
    per_identity: dict[str, set[str]] = field(default_factory=dict)

    @property
    def changed(self) -> dict[str, set[str]]:
        """Identity label -> the skills that appeared or vanished under it."""
        return {
            label: skills ^ self.baseline_skills
            for label, skills in self.per_identity.items()
            if skills != self.baseline_skills
        }


def identity_sensitivity(extractor, records, identities=None) -> list[SensitivityResult]:
    """Re-extract each record under every identity and record what moved.

    The expected result is that nothing moves, and where something does the collision audit
    above already named the string responsible. A difference this finds that the audit did
    not predict would mean the audit's name list is too small, which is worth knowing.
    """
    identities = list(identities if identities is not None else IDENTITIES)
    baseline, rest = identities[0], identities[1:]
    out = []
    for record in records:
        base_skills = {m.name for m in extractor.extract(perturb_identity(record, baseline))}
        result = SensitivityResult(resume_id=record.get("resume_id") or record.get("id", "?"), baseline_skills=base_skills)
        for identity in rest:
            result.per_identity[identity.label] = {
                m.name for m in extractor.extract(perturb_identity(record, identity))
            }
        out.append(result)
    return out
