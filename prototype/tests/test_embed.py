"""Unit tests for embedding backends, the vector index, and fusion."""
import sys
from pathlib import Path

import numpy as np
import pytest
from scipy import sparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from talentflow.embed import (
    HybridIndex, VectorIndex, get_embedder, list_backends,
    reciprocal_rank_fusion, weighted_score_fusion,
)
from talentflow.embed.base import l2_normalize

DOCS = [
    "python sql database engineering",
    "pastry baking kitchen menu cooking",
    "java spring backend microservices",
    "sql server database administration",
    "menu planning restaurant kitchen staff",
]


def _chunks(texts=DOCS):
    return [
        {"chunk_id": f"c{i}", "resume_id": f"r{i}", "category": "IT" if i % 2 == 0 else "CHEF",
         "section": "skills", "text": t, "char_start": 0, "char_end": len(t), "n_tokens": 4}
        for i, t in enumerate(texts)
    ]


def _index(backend="tfidf"):
    kw = {"min_df": 1} if backend == "tfidf" else {"n_components": 3, "min_df": 1}
    return VectorIndex.build(get_embedder(backend, **kw), _chunks())


# --------------------------------------------------------------------- backends

def test_registry_exposes_both_offline_backends():
    assert {"tfidf", "lsa"} <= set(list_backends())


def test_unknown_backend_names_the_available_ones():
    with pytest.raises(ValueError, match="lsa"):
        get_embedder("word2vec")


@pytest.mark.parametrize("backend,kw", [("tfidf", {"min_df": 1}), ("lsa", {"n_components": 3, "min_df": 1})])
def test_rows_are_unit_length(backend, kw):
    """The index treats a dot product as a cosine; that is only true for unit rows."""
    e = get_embedder(backend, **kw).fit(DOCS)
    m = e.encode(DOCS)
    dense = np.asarray(m.todense()) if sparse.issparse(m) else m
    assert np.allclose(np.linalg.norm(dense, axis=1), 1.0, atol=1e-5)


def test_tfidf_stays_sparse():
    """Densifying 45k dimensions over the real corpus would cost 4.4GB."""
    assert sparse.issparse(get_embedder("tfidf", min_df=1).fit(DOCS).encode(DOCS))


def test_l2_normalize_leaves_zero_rows_alone():
    """An all-out-of-vocabulary chunk must score 0 against everything, not divide by zero."""
    out = l2_normalize(np.array([[0.0, 0.0], [3.0, 4.0]]))
    assert np.allclose(out[0], 0.0)
    assert np.isclose(np.linalg.norm(out[1]), 1.0)


def test_lsa_reports_explained_variance():
    e = get_embedder("lsa", n_components=2, min_df=1).fit(DOCS)
    assert 0.0 < e.explained_variance <= 1.0


def test_tokenizer_feeds_the_vectorizer():
    """sklearn's default pattern drops one-char tokens and shreds 'C++' and 'C#'."""
    e = get_embedder("tfidf", min_df=1).fit(["C++ and C# work", "python work"])
    assert {"c++", "c#"} <= set(e._vec.vocabulary_)


# ------------------------------------------------------------------------ index

def test_search_ranks_the_topically_matching_chunk_first():
    hits = _index().search("database sql work", k=2)
    assert hits[0].resume_id in {"r0", "r3"}


def test_search_returns_offsets_for_citation():
    hit = _index().search("kitchen menu", k=1)[0]
    assert DOCS[int(hit.resume_id[1:])][hit.char_start:hit.char_end] == hit.text


def test_filters_restrict_results_to_the_requested_field():
    hits = _index().search("kitchen menu database", k=5, filters={"category": "CHEF"})
    assert hits and all(h.category == "CHEF" for h in hits)


def test_filter_matching_nothing_returns_empty_not_garbage():
    assert _index().search("database", k=3, filters={"category": "AVIATION"}) == []


def test_min_score_drops_weak_hits():
    assert _index().search("zzz unrelated nonsense", k=5, min_score=0.99) == []


def test_grouping_by_resume_takes_the_best_chunk():
    """A long resume must not dilute its own strongest match by averaging."""
    ix = _index()
    hits = ix.search("database sql", k=5)
    grouped = ix.group_by_resume(hits)
    assert [s for _, s in grouped] == sorted((s for _, s in grouped), reverse=True)


def test_metadata_length_mismatch_is_rejected():
    e = get_embedder("tfidf", min_df=1).fit(DOCS)
    with pytest.raises(ValueError, match="metadata"):
        VectorIndex(e, e.encode(DOCS), _chunks()[:2])


def test_batched_search_matches_single_search():
    ix = _index()
    single = ix.search("database sql", k=3)
    batched = ix.search_many(["database sql", "kitchen menu"], k=3)[0]
    assert [h.chunk_id for h in single] == [h.chunk_id for h in batched]


def test_score_matrix_shape_and_agreement_with_search():
    ix = _index()
    m = ix.score_matrix(["database sql", "kitchen menu"])
    assert m.shape == (len(ix), 2)
    assert ix.search("database sql", k=1)[0].chunk_id == ix.metadata[int(np.argmax(m[:, 0]))]["chunk_id"]


def test_save_and_load_round_trip(tmp_path):
    ix = _index()
    ix.save(tmp_path)
    back = VectorIndex.load(tmp_path, ix.embedder)
    assert len(back) == len(ix)
    assert [h.chunk_id for h in back.search("database", k=3)] == \
           [h.chunk_id for h in ix.search("database", k=3)]


# ----------------------------------------------------------------------- fusion

def _hits(ix, q, k=5):
    return ix.search(q, k=k)


def test_rrf_promotes_a_document_both_backends_rank_well():
    a = _hits(_index("tfidf"), "database sql")
    b = _hits(_index("lsa"), "database sql")
    fused = reciprocal_rank_fusion([a, b], k=3)
    assert fused and fused[0].chunk_id in {h.chunk_id for h in a[:3]} | {h.chunk_id for h in b[:3]}


def test_fusion_score_is_not_a_cosine():
    """RRF returns 1/(60+rank) sums. Comparing that to a similarity threshold is a bug."""
    fused = reciprocal_rank_fusion([_hits(_index(), "database")], k=1)
    assert fused[0].score < 0.1


def test_score_fusion_handles_a_flat_score_band():
    """Min-max normalization divides by the range, which is zero when every score ties."""
    hits = _hits(_index(), "database sql")
    flat = [type(h)(**{**h.__dict__, "score": 0.5}) for h in hits]
    fused = weighted_score_fusion([flat], k=10)
    assert len(fused) == len(flat)
    assert all(np.isfinite(h.score) for h in fused)


def test_hybrid_rejects_indexes_over_different_chunk_sets():
    """Fusion combines row positions; mismatched members would fuse unrelated chunks."""
    small = VectorIndex.build(get_embedder("tfidf", min_df=1), _chunks(DOCS[:2]))
    with pytest.raises(ValueError, match="chunk counts"):
        HybridIndex([_index(), small])


def test_hybrid_rejects_an_unknown_strategy():
    with pytest.raises(ValueError, match="strategy"):
        HybridIndex([_index()], strategy="magic")


def test_hybrid_exposes_the_same_surface_as_a_single_index():
    """The evaluation must score a hybrid through the identical code path."""
    h = HybridIndex([_index("tfidf"), _index("lsa")])
    assert len(h.metadata) == len(h)
    assert h.score_matrix(["database sql"]).shape == (len(h), 1)
    # At most k. Fewer is correct when the corpus holds fewer chunks sharing any signal --
    # member search drops zero-similarity hits before fusion ever sees them.
    hits = h.search("database sql", k=3)
    assert 0 < len(hits) <= 3


def test_hybrid_batched_scores_agree_with_single_query_search():
    """search() and score_matrix() must rank identically or the benchmark measures a
    different system than the one that ships."""
    h = HybridIndex([_index("tfidf"), _index("lsa")])
    m = h.score_matrix(["database sql"])
    assert h.search("database sql", k=1)[0].chunk_id == h.metadata[int(np.argmax(m[:, 0]))]["chunk_id"]


def test_the_neural_backend_is_offered_even_when_it_is_not_installed():
    """A teammate should discover the option and be told how to enable it, rather than not
    know it exists. The install instruction lives in the constructor's error."""
    from talentflow.embed.base import list_backends

    assert "st" in list_backends()


def test_the_neural_backend_explains_itself_when_the_package_is_missing():
    import importlib.util

    if importlib.util.find_spec("sentence_transformers") is not None:
        import pytest
        pytest.skip("sentence-transformers is installed here, so there is no error to check")

    from talentflow.embed.base import get_embedder

    try:
        get_embedder("st")
    except ImportError as exc:
        assert "pip install sentence-transformers" in str(exc)
    else:
        raise AssertionError("expected an ImportError naming the install command")
