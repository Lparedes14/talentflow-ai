"""Turn CMU-MOSEI computational sequences into a text,label table for the sentiment eval.

CMU-MOSEI ships as .csd files (HDF5) from the CMU-MultimodalSDK. Two of them matter here: the
labels sequence, whose first feature per segment is the sentiment from -3 to +3, and the
timestamped-words sequence, whose features are the spoken words with their time intervals.

We read the HDF5 directly rather than through the SDK's aligner, because the file layout is
stable and simple while the SDK's alignment API shifts between versions. For each labeled
segment we join the words whose time falls inside it, which gives one transcript per label.
That table is exactly what scripts/18_eval_sentiment.py consumes.
"""
from __future__ import annotations

import csv
from pathlib import Path


def _read_csd(path: str | Path) -> dict:
    """Read one .csd file into {video_id: (features, intervals)}."""
    try:
        import h5py
    except ImportError as exc:  # pragma: no cover
        raise ImportError(
            "Reading .csd files needs h5py. It is in the MOSEI optional group:\n"
            "    uncomment it in requirements.txt, then pip install -r requirements.txt"
        ) from exc
    out = {}
    with h5py.File(str(path), "r") as f:
        seq = list(f.keys())[0]            # a .csd holds exactly one computational sequence
        data = f[seq]["data"]
        for vid in data.keys():
            out[str(vid)] = (data[vid]["features"][()], data[vid]["intervals"][()])
    return out


def _decode_word(row) -> str:
    """A word row may be bytes, a 1-element array of bytes, or a string."""
    if isinstance(row, bytes):
        return row.decode("utf-8", "ignore")
    if isinstance(row, str):
        return row
    try:
        parts = []
        for e in row:
            parts.append(e.decode("utf-8", "ignore") if isinstance(e, (bytes, bytearray))
                         else str(e))
        return "".join(parts)
    except TypeError:
        return str(row)


def _sentiment(label_row) -> float:
    """Sentiment is the first value of a label row, clamped to the -3 to +3 scale."""
    try:
        value = float(label_row[0])
    except (TypeError, IndexError):
        value = float(label_row)
    return max(-3.0, min(3.0, value))


def align_mosei(labels_path: str | Path, words_path: str | Path,
                limit: int | None = None) -> list[tuple[str, float]]:
    """Join words into their labeled segments. Returns (transcript, sentiment) pairs."""
    labels = _read_csd(labels_path)
    words = _read_csd(words_path)

    samples: list[tuple[str, float]] = []
    for vid, (label_feats, label_ivals) in labels.items():
        if vid not in words:
            continue
        word_feats, word_ivals = words[vid]
        midpoints = [(float(word_ivals[i][0]) + float(word_ivals[i][1])) / 2
                     for i in range(len(word_ivals))]
        tokens = [_decode_word(word_feats[i]).strip() for i in range(len(word_feats))]

        for si in range(len(label_ivals)):
            start, end = float(label_ivals[si][0]), float(label_ivals[si][1])
            words_here = [tokens[i] for i in range(len(tokens))
                          if start <= midpoints[i] < end and tokens[i] and tokens[i] != "sp"]
            if not words_here:
                continue
            samples.append((" ".join(words_here), _sentiment(label_feats[si])))
            if limit and len(samples) >= limit:
                return samples
    return samples


def write_csv(samples, out_path: str | Path) -> Path:
    """Write (text, label) pairs as the CSV the sentiment eval reads."""
    out_path = Path(out_path)
    with out_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["text", "label"])
        writer.writerows(samples)
    return out_path
