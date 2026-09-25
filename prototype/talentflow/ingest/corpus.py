"""Build the resume corpus in two stages.

Stage A (raw)   PDF -> text. Expensive, CPU bound, ~3 minutes for 2,484 files. Run once.
Stage B (clean) text -> normalized + section-segmented records. Pure text, ~10 seconds.

Keeping them apart is the whole point. Normalization and section rules are the parts we
will actually keep changing, and tying them to PDF parsing would make every rule tweak a
three-minute round trip -- which in practice means the rules stop getting tweaked.

Both stages write JSONL: one record per line, so it streams, appends, and greps. A single
JSON array would have to be held in memory whole.
"""
from __future__ import annotations

import json
import logging
import os
import time
from collections import Counter
from dataclasses import asdict
from pathlib import Path
from typing import Iterator

from ..config import INTERIM_DIR, RESUME_PDF_DIR
from .normalize import normalize, residual_mojibake_count
from .pdf_loader import RawResume, extract_pdf, iter_resume_paths
from .sections import split_sections

log = logging.getLogger(__name__)

RAW_PATH = INTERIM_DIR / "resumes_raw.jsonl"
CORPUS_PATH = INTERIM_DIR / "resumes.jsonl"
REPORT_PATH = INTERIM_DIR / "ingest_report.json"


# --------------------------------------------------------------------------- io

def read_jsonl(path: Path) -> Iterator[dict]:
    """Stream a JSONL file. Never loads the whole thing."""
    with path.open() as fh:
        for line in fh:
            if line.strip():
                yield json.loads(line)


def iter_corpus(path: Path = CORPUS_PATH) -> Iterator[dict]:
    """Stream clean corpus records. The entry point every later stage uses."""
    return read_jsonl(path)


def _already_done(path: Path) -> set[str]:
    """Resume ids already written, so a rerun skips them. Tolerates a truncated last line."""
    if not path.exists():
        return set()
    done = set()
    with path.open() as fh:
        for line in fh:
            try:
                done.add(json.loads(line)["resume_id"])
            except (json.JSONDecodeError, KeyError):
                continue
    return done


def repair_jsonl(path: Path) -> int:
    """Drop a trailing partial line left by a killed run. Returns records kept.

    A half-written line is invisible to the resume scan, so without this the same resume
    gets extracted twice and appended twice.
    """
    if not path.exists():
        return 0
    kept = []
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        try:
            json.loads(line)
        except json.JSONDecodeError:
            log.warning("dropping partial line (%d chars) from %s", len(line), path.name)
            continue
        kept.append(line)
    path.write_text("\n".join(kept) + ("\n" if kept else ""))
    return len(kept)


# ------------------------------------------------------------------ stage A: raw

def _extract_one(args: tuple[Path, str]) -> dict:
    """Worker entry point. Module level so it can be pickled to a subprocess."""
    path, category = args
    raw: RawResume = extract_pdf(path, category)
    return {
        "resume_id": raw.resume_id,
        "category": raw.category,
        "source_path": raw.source_path,
        "n_pages": raw.n_pages,
        "page_char_counts": raw.page_char_counts,
        "raw_text": raw.raw_text,
        "extract_error": raw.error,
    }


def build_raw_corpus(
    pdf_root: Path = RESUME_PDF_DIR,
    out_path: Path = RAW_PATH,
    limit: int | None = None,
    resume: bool = True,
    workers: int | None = None,
    max_seconds: float | None = None,
) -> tuple[Path, bool]:
    """Stage A. Extract text from every resume PDF. Returns (path, finished).

    PDF parsing is CPU bound and every file is independent, so it fans out across
    processes. Only the parent writes, which keeps the JSONL append single-writer and
    therefore never interleaved.

    `max_seconds` stops at a record boundary instead of being killed mid-write, so the
    file stays valid and the next run picks up exactly where this one stopped.
    """
    from concurrent.futures import ProcessPoolExecutor

    pairs = iter_resume_paths(pdf_root)
    if limit:
        pairs = pairs[:limit]

    if resume:
        repair_jsonl(out_path)
        done = _already_done(out_path)
    else:
        done = set()
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text("")

    todo = [(p, c) for p, c in pairs if p.stem not in done]
    if not todo:
        log.info("stage A: all %d resumes already extracted", len(pairs))
        return out_path, True

    workers = workers or min(8, os.cpu_count() or 2)
    log.info("stage A: extracting %d of %d on %d workers", len(todo), len(pairs), workers)

    started, finished = time.monotonic(), True
    with out_path.open("a") as fh, ProcessPoolExecutor(max_workers=workers) as pool:
        for i, rec in enumerate(pool.map(_extract_one, todo, chunksize=8), 1):
            fh.write(json.dumps(rec) + "\n")
            if i % 250 == 0:
                fh.flush()
                log.info("  %d/%d", i, len(todo))
            if max_seconds and time.monotonic() - started > max_seconds:
                log.info("time budget reached at %d/%d; rerun to continue", i, len(todo))
                finished = False
                break
    return out_path, finished


# ---------------------------------------------------------------- stage B: clean

def clean_record(raw: dict) -> dict:
    """Normalize and segment one raw record. Pure function -- the unit of stage B."""
    text = normalize(raw["raw_text"])
    sections = split_sections(text)
    return {
        "resume_id": raw["resume_id"],
        "category": raw["category"],
        "source_path": raw["source_path"],
        "n_pages": raw["n_pages"],
        "n_chars_raw": len(raw["raw_text"]),
        "n_chars_clean": len(text),
        "n_words": len(text.split()),
        "text": text,
        "sections": [asdict(s) for s in sections],
        "section_names": sorted({s.name for s in sections}),
        "residual_artifacts": residual_mojibake_count(text),
        "extract_error": raw["extract_error"],
    }


def build_clean_corpus(raw_path: Path = RAW_PATH, out_path: Path = CORPUS_PATH) -> Path:
    """Stage B. Rebuild the clean corpus from raw text. Always a full rebuild.

    No resume logic here on purpose: it runs in seconds, and a partial rebuild after a
    rule change would leave records cleaned by two different rule sets in one file.
    """
    n = 0
    with out_path.open("w") as fh:
        for raw in read_jsonl(raw_path):
            fh.write(json.dumps(clean_record(raw)) + "\n")
            n += 1
    log.info("stage B: wrote %d clean records", n)
    return out_path


# ---------------------------------------------------------------------- quality

def quality_report(path: Path = CORPUS_PATH) -> dict:
    """Summarize corpus health. These numbers gate whether the next stage can start."""
    n = 0
    empty = errors = damaged = unsectioned = 0
    words: list[int] = []
    categories: Counter[str] = Counter()
    section_freq: Counter[str] = Counter()
    problem_ids: dict[str, list[str]] = {"empty": [], "residual_artifacts": [], "unsectioned": []}

    for rec in iter_corpus(path):
        n += 1
        categories[rec["category"]] += 1
        words.append(rec["n_words"])
        if rec["extract_error"]:
            errors += 1
        if rec["n_chars_clean"] < 50:
            empty += 1
            problem_ids["empty"].append(rec["resume_id"])
        if rec["residual_artifacts"] > 0:
            damaged += 1
            problem_ids["residual_artifacts"].append(rec["resume_id"])
        names = set(rec["section_names"])
        if not names - {"unsectioned", "header"}:
            unsectioned += 1
            problem_ids["unsectioned"].append(rec["resume_id"])
        section_freq.update(names)

    words.sort()
    pct = lambda k: round(100 * k / n, 2) if n else 0.0  # noqa: E731

    return {
        "n_resumes": n,
        "n_categories": len(categories),
        "extraction": {"errors": errors, "empty_after_clean": empty, "empty_pct": pct(empty)},
        "encoding": {
            "resumes_with_residual_artifacts": damaged,
            "residual_pct": pct(damaged),
        },
        "segmentation": {
            "no_sections_found": unsectioned,
            "no_sections_pct": pct(unsectioned),
            "section_coverage_pct": {
                name: round(100 * c / n, 1) for name, c in section_freq.most_common()
            },
        },
        "length_words": {
            "min": words[0] if words else 0,
            "p25": words[n // 4] if n else 0,
            "median": words[n // 2] if n else 0,
            "p75": words[3 * n // 4] if n else 0,
            "max": words[-1] if words else 0,
        },
        "per_category": dict(categories.most_common()),
        "problem_ids": problem_ids,
    }
