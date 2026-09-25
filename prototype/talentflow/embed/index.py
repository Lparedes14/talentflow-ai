"""Vector index: cosine similarity search over chunk embeddings.

Deliberately a matrix multiply and a partial sort, not a vector database. The corpus is
24,536 chunks; at 256 dimensions the whole index is 25MB and a full scan is one BLAS call
in a few milliseconds. An approximate-nearest-neighbour library here would add a
dependency, a build step, and recall error in exchange for speed nothing needs.

Because every backend returns L2-normalized rows, cosine similarity is exactly `matrix @ q`.

`filters` matters more than it looks: the proposal's evaluation ranks postings for one
employee and candidates for one posting, and both need retrieval restricted to a section,
a category, or a resume. Doing that at search time beats over-fetching and filtering after.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Sequence

import numpy as np
from scipy import sparse

from .base import Embedder


@dataclass
class SearchHit:
    """One result: the score, and the chunk metadata that traces it to its source."""

    score: float
    chunk_id: str
    resume_id: str
    category: str
    section: str
    text: str
    char_start: int
    char_end: int

    @classmethod
    def from_meta(cls, score: float, meta: dict) -> "SearchHit":
        return cls(
            score=score,
            chunk_id=meta["chunk_id"], resume_id=meta["resume_id"],
            category=meta["category"], section=meta["section"], text=meta["text"],
            char_start=meta["char_start"], char_end=meta["char_end"],
        )


class VectorIndex:
    """Embeddings plus the metadata needed to trace a hit back to its source text."""

    def __init__(self, embedder: Embedder, matrix, metadata: list[dict]):
        if matrix.shape[0] != len(metadata):
            raise ValueError(
                f"matrix has {matrix.shape[0]} rows but {len(metadata)} metadata records"
            )
        self.embedder = embedder
        self.matrix = matrix
        self.metadata = metadata

    def __len__(self) -> int:
        return len(self.metadata)

    @classmethod
    def build(cls, embedder: Embedder, chunks: Sequence[dict], fit: bool = True) -> "VectorIndex":
        """Fit the backend on the chunk texts and encode them all."""
        texts = [c["text"] for c in chunks]
        if fit:
            embedder.fit(texts)
        return cls(embedder, embedder.encode(texts), list(chunks))

    # ------------------------------------------------------------------ search

    def _mask(self, filters: dict[str, Any] | None) -> np.ndarray | None:
        """Boolean row mask from field filters. A value may be a scalar or a collection."""
        if not filters:
            return None
        mask = np.ones(len(self.metadata), dtype=bool)
        for field, wanted in filters.items():
            allowed = {wanted} if isinstance(wanted, str) else set(wanted)
            mask &= np.array([m.get(field) in allowed for m in self.metadata])
        return mask

    def search(
        self,
        query: str,
        k: int = 5,
        filters: dict[str, Any] | None = None,
        min_score: float = 0.0,
    ) -> list[SearchHit]:
        """Top-k chunks most similar to `query`."""
        return self.search_many([query], k=k, filters=filters, min_score=min_score)[0]

    def search_many(
        self,
        queries: Sequence[str],
        k: int = 5,
        filters: dict[str, Any] | None = None,
        min_score: float = 0.0,
    ) -> list[list[SearchHit]]:
        """Batched search. One matrix multiply for all queries, which is why it is separate."""
        if not queries:
            return []

        q = self.embedder.encode(list(queries))
        scores = self.matrix @ q.T                      # (n_chunks, n_queries)
        scores = np.asarray(scores.todense() if sparse.issparse(scores) else scores)

        mask = self._mask(filters)
        if mask is not None:
            if not mask.any():
                return [[] for _ in queries]
            scores = np.where(mask[:, None], scores, -np.inf)

        results = []
        for col in range(scores.shape[1]):
            column = scores[:, col]
            # argpartition finds the top k without sorting all 24k rows.
            top = np.argpartition(-column, min(k, len(column) - 1))[:k]
            top = top[np.argsort(-column[top])]
            results.append([
                SearchHit.from_meta(float(column[i]), self.metadata[i])
                for i in top if np.isfinite(column[i]) and column[i] > min_score
            ])
        return results

    def score_matrix(self, queries: Sequence[str]) -> np.ndarray:
        """Dense (n_chunks, n_queries) similarity matrix.

        The batched primitive the evaluation harness scores through. Exists so a hybrid
        index can expose the same operation and be measured identically -- a comparison
        is only trustworthy when the backend is the only thing that differs.
        """
        scores = self.matrix @ self.embedder.encode(list(queries)).T
        return np.asarray(scores.todense() if sparse.issparse(scores) else scores)

    def group_by_resume(
        self, hits: Sequence[SearchHit], reduce: Callable[[list[float]], float] = max,
    ) -> list[tuple[str, float]]:
        """Collapse chunk hits to resume-level scores, best first.

        Retrieval is over chunks but the proposal's metrics are over people, so the two
        need bridging. `max` by default: one strongly matching chunk is real evidence,
        and averaging would let a long resume dilute its own best match.
        """
        by_resume: dict[str, list[float]] = {}
        for h in hits:
            by_resume.setdefault(h.resume_id, []).append(h.score)
        return sorted(
            ((rid, reduce(scores)) for rid, scores in by_resume.items()),
            key=lambda x: -x[1],
        )

    # ------------------------------------------------------------------- io

    def save(self, directory: Path) -> Path:
        """Persist vectors and metadata. The fitted backend is not saved -- see load()."""
        directory.mkdir(parents=True, exist_ok=True)
        if sparse.issparse(self.matrix):
            sparse.save_npz(directory / "vectors.npz", self.matrix.tocsr())
        else:
            np.save(directory / "vectors.npy", self.matrix)
        with (directory / "metadata.jsonl").open("w") as fh:
            for m in self.metadata:
                fh.write(json.dumps(m) + "\n")
        (directory / "info.json").write_text(json.dumps({
            "backend": self.embedder.name,
            "n_chunks": len(self.metadata),
            "dim": int(self.matrix.shape[1]),
        }, indent=2))
        return directory

    @classmethod
    def load(cls, directory: Path, embedder: Embedder) -> "VectorIndex":
        """Reload vectors and metadata.

        The caller supplies a *fitted* embedder, because searching requires encoding the
        query with the same vocabulary the vectors were built from. Loading an index with
        a fresh backend would silently return nonsense, so it is not made easy to do.
        """
        npz, npy = directory / "vectors.npz", directory / "vectors.npy"
        matrix = sparse.load_npz(npz) if npz.exists() else np.load(npy)
        with (directory / "metadata.jsonl").open() as fh:
            metadata = [json.loads(line) for line in fh if line.strip()]
        return cls(embedder, matrix, metadata)
