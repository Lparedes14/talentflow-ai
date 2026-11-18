"""Retrieval evaluation using the corpus's own category labels as ground truth.

The Kaggle folder name is the resume's job family, which the proposal already designates
as the relevance label for matching. That makes this metric free to compute, so it can run
on every change instead of once at the end -- which is the difference between a metric that
guides the work and one that just grades it.

Queries are phrased the way a recruiter would describe the role and deliberately avoid the
category name itself. 'INFORMATION-TECHNOLOGY' as a query would measure string matching,
not retrieval.

Retrieval is over chunks; the metric is over people. Chunk hits are collapsed per resume
before scoring, which is why `fetch` is much larger than `k` -- you need enough chunks to
yield k distinct resumes.
"""
from __future__ import annotations

from typing import Sequence

from ..embed import VectorIndex

QUERIES: list[tuple[str, str]] = [
    ("network administrator active directory windows server support", "INFORMATION-TECHNOLOGY"),
    ("prepared financial statements general ledger account reconciliation", "ACCOUNTANT"),
    ("menu planning food preparation kitchen staff supervision", "CHEF"),
    ("personal training client fitness programs workouts", "FITNESS"),
    ("aircraft maintenance inspection flight operations safety", "AVIATION"),
    ("classroom instruction lesson plans student curriculum assessment", "TEACHER"),
    ("recruiting onboarding employee relations benefits administration", "HR"),
    ("litigation legal research briefs court filings clients", "ADVOCATE"),
    ("construction site supervision blueprints subcontractors safety", "CONSTRUCTION"),
    ("graphic design adobe photoshop illustrator layouts branding", "DESIGNER"),
    ("patient care clinical assessment treatment plans medical records", "HEALTHCARE"),
    ("business development lead generation pipeline closing deals", "BUSINESS-DEVELOPMENT"),
]


def precision_at_k(
    index: VectorIndex,
    queries: Sequence[tuple[str, str]] = QUERIES,
    k: int = 5,
    fetch: int = 200,
    min_chunk_tokens: int = 0,
) -> dict:
    """Mean Precision@k over resumes, plus the per-query detail.

    `min_chunk_tokens` drops very short chunks at search time. Short chunks are a known
    failure mode for reduced representations: after L2 normalization a two-token chunk sits
    at an extreme of the space and scores spuriously high against almost anything. The
    parameter exists so that effect can be measured rather than assumed.
    """
    per_query, correct_total = [], 0
    for query, want in queries:
        hits = index.search(query, k=fetch)
        if min_chunk_tokens:
            hits = [h for h in hits if len(h.text.split()) >= min_chunk_tokens]
        ranked = index.group_by_resume(hits)[:k]
        category_of = {h.resume_id: h.category for h in hits}
        correct = sum(1 for rid, _ in ranked if category_of.get(rid) == want)
        correct_total += correct
        per_query.append({
            "query": query, "target": want,
            "precision": round(correct / k, 3) if k else 0.0,
        })
    return {
        "mean_precision_at_k": round(correct_total / (k * len(queries)), 4),
        "per_query": per_query,
    }


def evaluate_backend(index: VectorIndex, label: str, **kw) -> dict:
    """Score one built index and tag the result with a human-readable label."""
    out = precision_at_k(index, **kw)
    out["label"] = label
    out["n_chunks"] = len(index)
    out["dim"] = int(index.matrix.shape[1])
    return out


# --------------------------------------------------------------------------------
# Leave-one-out evaluation
#
# The 12 hand-written queries above give 60 judgments at k=5. At that size a one-document
# difference moves the mean by 1.7 points, so it cannot distinguish configurations that
# differ by less than about 10 -- which is precisely the size of difference the proposal
# asks us to detect. It is a smoke test, not an experiment.
#
# This gives every resume a turn as the query instead: 2,484 queries, ~12,400 judgments.
# The query is the resume's own summary and skills text, the resume itself is excluded from
# its own results, and a retrieved resume counts as relevant when it shares the query's
# category label. Same ground truth as above, three orders of magnitude more of it.
#
# What it measures is "find me people like this person", which is one of the two directions
# the proposal actually specifies -- so the benchmark and the product are asking the same
# question.
# --------------------------------------------------------------------------------

import numpy as np  # noqa: E402
from scipy import sparse  # noqa: E402


def _query_text(record: dict, sections: tuple[str, ...] = ("summary", "skills", "header")) -> str:
    """Build one resume's query text.

    Summary and skills, not the whole resume: Experience is 69% of all tokens and is
    dominated by employer boilerplate, which drowns the signal that says what this person
    can do. Header carries the job title, which is the single most informative line.
    """
    parts = [s["text"] for s in record["sections"] if s["name"] in sections]
    return "\n".join(parts).strip()


def leave_one_out_precision(
    index,
    records: Sequence[dict],
    k: int = 5,
    batch_size: int = 200,
) -> dict:
    """Precision@k where every resume queries for others of its own category.

    Batched because the score matrix is (n_chunks x n_queries); at 24.5k chunks and 2.5k
    queries a single matmul would materialize 61M floats.
    """
    queries, truth = [], []
    for rec in records:
        text = _query_text(rec)
        if text:
            queries.append((rec["resume_id"], text))
            truth.append(rec["category"])

    chunk_resume = np.array([m["resume_id"] for m in index.metadata])
    chunk_category = np.array([m["category"] for m in index.metadata])

    correct = total = 0
    per_category: dict[str, list[int]] = {}
    per_query_hits: list[int] = []  # kept so two systems can be compared with a paired test

    for start in range(0, len(queries), batch_size):
        batch = queries[start:start + batch_size]
        scores = index.score_matrix([t for _, t in batch])

        for col, (resume_id, _) in enumerate(batch):
            column = scores[:, col].copy()
            # A resume must not retrieve itself; its own chunks are a perfect match.
            column[chunk_resume == resume_id] = -np.inf

            # Walk down by score, collecting distinct resumes until k are found.
            order = np.argsort(-column)
            seen, ranked = set(), []
            for i in order:
                if not np.isfinite(column[i]):
                    break
                rid = chunk_resume[i]
                if rid in seen:
                    continue
                seen.add(rid)
                ranked.append(chunk_category[i])
                if len(ranked) == k:
                    break

            want = truth[start + col]
            hit = sum(1 for c in ranked if c == want)
            correct += hit
            total += k
            per_query_hits.append(hit)
            per_category.setdefault(want, []).append(hit)

    return {
        "n_queries": len(queries),
        "n_judgments": total,
        "mean_precision_at_k": round(correct / total, 4) if total else 0.0,
        "per_category": {
            cat: round(sum(v) / (k * len(v)), 3) for cat, v in sorted(per_category.items())
        },
        "per_query_hits": per_query_hits,
        "query_ids": [rid for rid, _ in queries],
        "k": k,
    }


def paired_comparison(result_a: dict, result_b: dict, label_a: str, label_b: str) -> dict:
    """Paired bootstrap comparing two systems on the same queries.

    Paired because both systems answered the identical query set, so the per-query
    difference removes the variance from queries simply being easier or harder. An
    unpaired comparison of two means this close would be dominated by that variance.

    Bootstrap rather than a t-test: per-query precision at k=5 takes six discrete values
    and is heavily skewed, so a normality assumption is not earned.
    """
    if result_a["query_ids"] != result_b["query_ids"]:
        raise ValueError("systems were scored on different query sets; not comparable")

    k = result_a["k"]
    a = np.array(result_a["per_query_hits"], dtype=float) / k
    b = np.array(result_b["per_query_hits"], dtype=float) / k
    diff = b - a

    rng = np.random.default_rng(42)
    n = len(diff)
    means = np.array([rng.choice(diff, size=n, replace=True).mean() for _ in range(2000)])
    lo, hi = np.percentile(means, [2.5, 97.5])

    return {
        "a": label_a, "b": label_b,
        "mean_a": round(float(a.mean()), 4),
        "mean_b": round(float(b.mean()), 4),
        "delta_points": round(100 * float(diff.mean()), 2),
        "ci95_points": [round(100 * float(lo), 2), round(100 * float(hi), 2)],
        # The interval excluding zero is what licenses calling the difference real.
        "significant": bool(lo > 0 or hi < 0),
        "n_queries": n,
        "b_better": int((diff > 0).sum()),
        "a_better": int((diff < 0).sum()),
        "tied": int((diff == 0).sum()),
    }
