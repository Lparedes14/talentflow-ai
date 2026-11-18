"""A pretrained sentence-encoder backend.

The course's embedding material is neural: word2vec in the Transformer deck, then
contextualized sentence encoders in its closing section. Everything we shipped until now was
count-based (TF-IDF) or matrix-factorized (LSA), for one reason that was never about the
method: the build environment denies `huggingface.co`, so no pretrained weights could be
fetched. Recorded as the one honest GAP in COURSE_CONCEPTS.md item 2.

That block is a property of one machine, not of the project. On a normal network this
backend works, and it is deliberately thin so that the only question it puts to the
evaluation is "do neural embeddings beat LSA on our corpus", with everything else held
constant.

Not installed by default. `pip install sentence-transformers` and it works.

It registers as a backend either way, on purpose: a teammate running `--backend st` without
the package gets a one-line install instruction, which is more useful than the option being
invisible and the feature being undiscoverable. Nothing constructs it unless asked, so its
absence cannot break the backends that are present.

Two things to know before reading the result:

- **It ignores our tokenizer.** The model brings its own subword vocabulary, which is BPE or
  WordPiece depending on the model. So this backend is also the project's only place where
  the lecture's actual tokenization method is used on our own text.
- **384 dimensions against LSA's 128** is not the interesting difference. The interesting
  difference is that these vectors come from a model trained on billions of sentences, and
  ours come from 2,484 resumes.
"""
from __future__ import annotations

from typing import Sequence

import numpy as np

from .base import Embedder, l2_normalize, register

DEFAULT_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


@register("st")
class SentenceTransformerEmbedder:
    """Pretrained sentence embeddings. Needs `sentence-transformers` and one download.

    `fit` is a no-op and that is the point: nothing is learned from our corpus, so unlike
    TF-IDF and LSA this backend cannot overfit to it. It is also why it can encode a job
    posting and a resume into the same space without being shown either first.
    """

    name = "st"

    def __init__(self, model_name: str = DEFAULT_MODEL, batch_size: int = 64):
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:  # pragma: no cover - depends on the machine
            raise ImportError(
                "The 'st' backend needs sentence-transformers:\n"
                "    pip install sentence-transformers\n"
                "The model downloads itself on first use and is cached after that."
            ) from exc

        self._model = SentenceTransformer(model_name)
        self.model_name = model_name
        self.batch_size = batch_size

    @property
    def dim(self) -> int:
        return int(self._model.get_sentence_embedding_dimension())

    def fit(self, texts: Sequence[str]) -> "SentenceTransformerEmbedder":
        """Nothing to fit. The model was trained long before it met this corpus."""
        return self

    def encode(self, texts: Sequence[str]):
        vectors = self._model.encode(
            list(texts),
            batch_size=self.batch_size,
            convert_to_numpy=True,
            show_progress_bar=False,
        ).astype(np.float32)
        # Normalize ourselves rather than trusting the flag, so cosine similarity downstream
        # means the same thing for every backend.
        return l2_normalize(vectors)
