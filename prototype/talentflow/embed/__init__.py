"""Stage 2c: vector representations of chunks, and similarity search over them."""
from .base import Embedder, get_embedder, list_backends
from .hybrid import HybridIndex, reciprocal_rank_fusion, weighted_score_fusion
from .index import SearchHit, VectorIndex

__all__ = [
    "Embedder", "get_embedder", "list_backends",
    "VectorIndex", "SearchHit",
    "HybridIndex", "reciprocal_rank_fusion", "weighted_score_fusion",
]
