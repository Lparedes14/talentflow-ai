"""Hybrid retrieval: fuse a lexical index and a dense index into one ranking.

Measured on this corpus, neither backend dominates:

- TF-IDF wins topical retrieval (P@5 0.717 vs 0.667). Its power comes from rare,
  discriminative terms -- 'blueprints', 'photoshop', 'litigation' -- and truncated SVD
  spends its axes on *common* variance, so those terms load weakly and get blurred away.
- LSA wins vocabulary mismatch. Querying 'MS SQL database administration' it ranked a real
  'SQL Server 6.5, 7, 2000' chunk first at 0.588, where TF-IDF scored 0.327 on a chunk that
  merely happened to repeat the letters SQL.

Those are different failures, which is the precondition for fusion helping: the two rankings
have to be wrong about different documents. Both fusion strategies here are implemented so
the choice can be measured rather than argued.

Reciprocal rank fusion is the default. It combines positions rather than scores, so it needs
no calibration between a sparse cosine and a dense cosine -- two quantities that are not on
the same scale and whose distributions differ sharply.
"""
from __future__ import annotations

from typing import Sequence

from .index import SearchHit, VectorIndex

RRF_K = 60  # standard damping constant; larger flattens the contribution of top ranks


def reciprocal_rank_fusion(
    rankings: Sequence[Sequence[SearchHit]],
    weights: Sequence[float] | None = None,
    k: int = 10,
    rrf_k: int = RRF_K,
) -> list[SearchHit]:
    """Fuse ranked lists by 1/(rrf_k + rank).

    Rank based on purpose. A document ranked 3rd by one backend and 400th by the other
    should not be rescued by the second backend's raw cosine happening to be numerically
    large -- sparse and dense cosines are not comparable quantities.
    """
    weights = list(weights) if weights else [1.0] * len(rankings)
    fused: dict[str, float] = {}
    seen: dict[str, SearchHit] = {}

    for ranking, weight in zip(rankings, weights):
        for rank, hit in enumerate(ranking, start=1):
            fused[hit.chunk_id] = fused.get(hit.chunk_id, 0.0) + weight / (rrf_k + rank)
            seen.setdefault(hit.chunk_id, hit)

    top = sorted(fused.items(), key=lambda kv: -kv[1])[:k]
    # The fused value replaces the cosine: it is a rank-fusion score, not a similarity,
    # and callers must not compare it against a cosine threshold.
    return [
        SearchHit(
            score=score, chunk_id=cid, resume_id=seen[cid].resume_id,
            category=seen[cid].category, section=seen[cid].section, text=seen[cid].text,
            char_start=seen[cid].char_start, char_end=seen[cid].char_end,
        )
        for cid, score in top
    ]


def weighted_score_fusion(
    rankings: Sequence[Sequence[SearchHit]],
    weights: Sequence[float] | None = None,
    k: int = 10,
) -> list[SearchHit]:
    """Fuse by weighted sum of min-max normalized scores.

    Keeps the magnitude information RRF throws away -- a hit at 0.9 really is a better
    match than one at 0.3 -- at the cost of needing normalization per query, which is
    unstable when one backend returns a flat band of near-identical scores.
    """
    weights = list(weights) if weights else [1.0] * len(rankings)
    fused: dict[str, float] = {}
    seen: dict[str, SearchHit] = {}

    for ranking, weight in zip(rankings, weights):
        if not ranking:
            continue
        scores = [h.score for h in ranking]
        lo, hi = min(scores), max(scores)
        span = (hi - lo) or 1.0  # a flat band contributes equally rather than dividing by 0
        for hit in ranking:
            fused[hit.chunk_id] = fused.get(hit.chunk_id, 0.0) + weight * (hit.score - lo) / span
            seen.setdefault(hit.chunk_id, hit)

    top = sorted(fused.items(), key=lambda kv: -kv[1])[:k]
    return [
        SearchHit(
            score=score, chunk_id=cid, resume_id=seen[cid].resume_id,
            category=seen[cid].category, section=seen[cid].section, text=seen[cid].text,
            char_start=seen[cid].char_start, char_end=seen[cid].char_end,
        )
        for cid, score in top
    ]


class HybridIndex:
    """Presents several indexes as one searchable surface.

    Deliberately duck-types `VectorIndex.search` / `group_by_resume` so the evaluation
    harness scores it through exactly the same code path as a single backend. A comparison
    is only trustworthy when the thing being compared is the only thing that changed.
    """

    def __init__(
        self,
        indexes: Sequence[VectorIndex],
        weights: Sequence[float] | None = None,
        strategy: str = "rrf",
    ):
        if not indexes:
            raise ValueError("HybridIndex needs at least one index")
        first = indexes[0]
        for other in indexes[1:]:
            # Fusion combines row positions across indexes, so a mismatch here would
            # silently fuse unrelated chunks rather than failing.
            if len(other.metadata) != len(first.metadata):
                raise ValueError("member indexes have different chunk counts")
        if strategy not in ("rrf", "score"):
            raise ValueError(f"unknown strategy {strategy!r}; use 'rrf' or 'score'")
        self.indexes = list(indexes)
        self.weights = list(weights) if weights else [1.0] * len(indexes)
        self.strategy = strategy

    def __len__(self) -> int:
        return len(self.indexes[0])

    @property
    def matrix(self):
        """Shape only, for reporting. There is no single fused matrix."""
        return self.indexes[0].matrix

    @property
    def metadata(self) -> list[dict]:
        """Chunk metadata, shared by every member index.

        All members are built from the same chunk list in the same order, so row i means
        the same chunk everywhere -- which is what makes fusing their rankings valid at all.
        """
        return self.indexes[0].metadata

    def search(self, query: str, k: int = 5, fetch: int | None = None, **kw) -> list[SearchHit]:
        """Fetch deeper from each backend than k, because fusion reorders what it is given."""
        fetch = fetch or max(k * 4, 100)
        rankings = [ix.search(query, k=fetch, **kw) for ix in self.indexes]
        fuse = reciprocal_rank_fusion if self.strategy == "rrf" else weighted_score_fusion
        return fuse(rankings, self.weights, k=k)

    def score_matrix(self, queries):
        """Fused (n_chunks, n_queries) scores, by rank across backends.

        Ranks are computed per backend per query and combined with the same reciprocal
        formula `search` uses, so batched evaluation and single-query search agree. Working
        in rank space also sidesteps the incomparability of sparse and dense cosines.
        """
        import numpy as np

        fused = None
        for index, weight in zip(self.indexes, self.weights):
            scores = index.score_matrix(queries)
            if self.strategy == "score":
                lo = scores.min(axis=0, keepdims=True)
                span = scores.max(axis=0, keepdims=True) - lo
                np.maximum(span, 1e-12, out=span)
                contribution = weight * (scores - lo) / span
            else:
                # rank 0 = best. argsort twice turns scores into ranks per column.
                order = np.argsort(-scores, axis=0)
                ranks = np.empty_like(order)
                np.put_along_axis(
                    ranks, order,
                    np.arange(scores.shape[0])[:, None].repeat(scores.shape[1], axis=1),
                    axis=0,
                )
                contribution = weight / (RRF_K + ranks + 1)
            fused = contribution if fused is None else fused + contribution
        return fused

    def group_by_resume(self, hits, reduce=max):
        return self.indexes[0].group_by_resume(hits, reduce=reduce)
