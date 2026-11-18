"""Corpus-derived embedding backends: TF-IDF (baseline) and LSA (dense).

Both feed on our own tokenizer rather than scikit-learn's default `\\w\\w+` pattern. That
default drops every one-character token and splits 'C++', 'C#', '.NET' and 'CI/CD' into
nothing -- which on this corpus silently deletes several hundred real skill mentions
before the vectorizer ever sees them.
"""
from __future__ import annotations

from typing import Sequence

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer

from ..text.tokenize import tokenize
from .base import Embedder, l2_normalize, register


def _vectorizer(min_df: int, max_df: float) -> TfidfVectorizer:
    """Shared TF-IDF settings.

    min_df drops terms appearing in fewer than N chunks. Half this corpus's vocabulary is
    hapax -- typos, mangled names, one-off strings -- and keeping them adds tens of
    thousands of dimensions that can never help a match.

    sublinear_tf dampens raw counts: a resume naming 'sales' twenty times is not twenty
    times more about sales than one naming it once.
    """
    return TfidfVectorizer(
        analyzer=lambda text: tokenize(text),
        min_df=min_df,
        max_df=max_df,
        sublinear_tf=True,
        dtype=np.float32,
    )


@register("tfidf")
class TfidfEmbedder:
    """Sparse bag-of-words. The baseline the proposal requires.

    Matches only on literal shared terms: a resume saying 'SQL Server' and a posting saying
    'MS SQL' score zero against each other. That blindness is the point -- it is what the
    dense backends have to beat.
    """

    name = "tfidf"

    def __init__(self, min_df: int = 3, max_df: float = 0.6):
        self._vec = _vectorizer(min_df, max_df)
        self._dim = 0

    @property
    def dim(self) -> int:
        return self._dim

    def fit(self, texts: Sequence[str]) -> "TfidfEmbedder":
        self._vec.fit(texts)
        self._dim = len(self._vec.vocabulary_)
        return self

    def encode(self, texts: Sequence[str]):
        """Sparse by design. TfidfVectorizer already L2-normalizes rows, and densifying
        45k dimensions across this corpus would cost 4.4GB to store mostly zeros."""
        return self._vec.transform(texts)


@register("lsa")
class LsaEmbedder:
    """TF-IDF reduced by truncated SVD -- latent semantic analysis.

    SVD factors the term-document matrix and keeps the strongest axes of variation. Terms
    that keep company with each other collapse onto the same axis, so 'MS SQL' ends up near
    'SQL Server' purely from how they co-occur in this corpus -- no pretrained model, no
    downloads. That is the difference from the TF-IDF baseline: it can match meaning that
    the two documents never spell the same way.

    Cost: the axes describe *this* corpus. Vocabulary it never saw is invisible, which is
    exactly where a pretrained neural backend would win.
    """

    name = "lsa"

    def __init__(self, n_components: int = 256, min_df: int = 3, max_df: float = 0.6,
                 random_state: int = 42):
        self._vec = _vectorizer(min_df, max_df)
        self._svd = TruncatedSVD(n_components=n_components, random_state=random_state)
        self._n_components = n_components

    @property
    def dim(self) -> int:
        return self._n_components

    @property
    def explained_variance(self) -> float:
        """Share of TF-IDF variance the kept axes retain. Tells you if n_components is sane."""
        return float(self._svd.explained_variance_ratio_.sum())

    def fit(self, texts: Sequence[str]) -> "LsaEmbedder":
        self._svd.fit(self._vec.fit_transform(texts))
        return self

    def encode(self, texts: Sequence[str]) -> np.ndarray:
        # Re-normalized after SVD: the reduction does not preserve unit length, and the
        # index contract is that a dot product is a cosine.
        return l2_normalize(self._svd.transform(self._vec.transform(texts)))
