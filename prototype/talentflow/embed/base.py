"""The embedding interface every backend implements.

There is one interface with several backends because the project has to *compare* them.
The proposal sets TF-IDF as the baseline that a denser representation must beat by 10
points of Precision@5 to justify its cost. That comparison is only honest if both run
through identical chunking, identical indexing, and identical scoring -- so the only thing
that differs between runs is the vector.

Backends available offline today:

- `tfidf`  sparse bag-of-words. The baseline. No notion of meaning, only word overlap.
- `lsa`    TF-IDF reduced by truncated SVD. A dense embedding learned from this corpus's
           own co-occurrence, so 'MS SQL' lands near 'SQL Server' without either term
           having been seen in the same document.

A neural sentence-transformer backend registers here too when model weights are reachable.
This environment's egress blocks Hugging Face, so it is not installed; nothing else in the
codebase has to change when it is.
"""
from __future__ import annotations

from typing import Callable, Protocol, Sequence, Union, runtime_checkable

import numpy as np
from scipy.sparse import csr_matrix

# A backend may return dense or sparse rows. Both support `@`, which is all the index
# needs, and forcing TF-IDF dense would cost 4.4GB for this corpus at 45k dimensions.
Matrix = Union[np.ndarray, csr_matrix]


@runtime_checkable
class Embedder(Protocol):
    """Turns text into vectors.

    `fit` exists because corpus-derived backends (TF-IDF, LSA) learn their vocabulary and
    axes from the data. Pretrained backends implement it as a no-op, so callers never have
    to know which kind they hold.
    """

    name: str

    @property
    def dim(self) -> int:
        """Vector dimensionality. Only meaningful after fit()."""

    def fit(self, texts: Sequence[str]) -> "Embedder":
        """Learn whatever the backend needs from the corpus. Returns self."""

    def encode(self, texts: Sequence[str]) -> Matrix:
        """Encode texts as a (len(texts), dim) matrix of L2-normalized rows.

        Rows are normalized by contract so cosine similarity is a plain dot product and
        every backend is scored the same way. Dense or sparse is the backend's choice.
        """


_REGISTRY: dict[str, Callable[..., Embedder]] = {}


def register(name: str) -> Callable[[type], type]:
    """Class decorator adding a backend to the registry."""
    def wrap(cls: type) -> type:
        _REGISTRY[name] = cls
        return cls
    return wrap


def _load_backends() -> None:
    """Import backend modules so their @register decorators run.

    Deferred rather than imported at module scope: base.py must stay importable without
    scikit-learn, so a backend with a heavy or missing dependency cannot break the
    interface for the others.
    """
    from . import sklearn_backends  # noqa: F401

    # Optional, and silently absent when sentence-transformers is not installed. A missing
    # optional dependency must not stop the backends that are present from registering.
    try:
        from . import neural_backend  # noqa: F401
    except ImportError:
        pass


def list_backends() -> list[str]:
    _load_backends()
    return sorted(_REGISTRY)


def get_embedder(name: str, **kwargs) -> Embedder:
    """Build a backend by name. Raises with the available names rather than a KeyError."""
    _load_backends()
    if name not in _REGISTRY:
        raise ValueError(f"unknown embedder {name!r}; available: {list_backends()}")
    return _REGISTRY[name](**kwargs)


def l2_normalize(matrix: np.ndarray) -> np.ndarray:
    """Scale rows to unit length so a dot product is a cosine.

    Zero rows -- a chunk whose every token was out of vocabulary -- would divide by zero,
    so their norm is clamped to 1 and they stay zero. A zero vector scores 0 against
    everything, which is the correct answer for a chunk we cannot represent.
    """
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    np.maximum(norms, 1e-12, out=norms)
    return (matrix / norms).astype(np.float32)
