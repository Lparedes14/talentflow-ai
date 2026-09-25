"""Shipping a prebuilt vocabulary: to_dict/from_dict must preserve matching (D56)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.skills.onet import SkillTerm, normalize_term
from talentflow.skills.vocabulary import SkillVocabulary


def _vocab():
    terms = [SkillTerm(n, normalize_term(n), "software", "technical", 100, False, False)
             for n in ("Python", "Microsoft Excel", "Autodesk AutoCAD", "Tableau")]
    return SkillVocabulary(terms, {"excel": 0.4})


def _rec(text):
    return {"resume_id": "r", "category": "IT", "text": text,
            "sections": [{"name": "skills", "text": text, "char_start": 0,
                          "char_end": len(text), "heading": None}]}


def test_round_trip_preserves_matching():
    v = _vocab()
    v2 = SkillVocabulary.from_dict(v.to_dict())
    rec = _rec("I use Python and AutoCAD every day.")
    a = sorted({m.name for m in v.match_resume(rec)})
    b = sorted({m.name for m in v2.match_resume(rec)})
    assert a == b and a  # identical and non-empty


def test_round_trip_preserves_aliases_and_confidence():
    v = _vocab()
    v2 = SkillVocabulary.from_dict(v.to_dict())
    assert set(v.aliases) == set(v2.aliases)
    assert v.alias_confidence == v2.alias_confidence
    assert v2.aliases["autocad"][0].term == "Autodesk AutoCAD"   # derived alias survives
