"""Task 3: matching people to roles, and roles to people."""
from .profile import SkillProfile, load_posting_profiles, load_resume_profiles
from .match import MatchResult, Matcher
from .gaps import SkillLeverage, rank_skill_leverage, summarize_leverage

__all__ = [
    "SkillProfile", "load_resume_profiles", "load_posting_profiles",
    "Matcher", "MatchResult",
    "SkillLeverage", "rank_skill_leverage", "summarize_leverage",
]
