"""TalentFlow prototype: a small web UI for testing the pipeline on real resumes.

Run it:

    streamlit run app.py

Or double-click `Launch TalentFlow.command` in Finder, which installs what is missing and
opens this in a browser.

The point of this page is not to look finished. It is to let anyone drop in a resume and
see, in one screen, exactly what the system extracted and exactly which words on the page
made it say so. Every claim is checkable.
"""
from __future__ import annotations

import html
import sys
import time
from pathlib import Path

import streamlit as st

sys.path.insert(0, str(Path(__file__).resolve().parent))

from talentflow.config import INTERIM_DIR
from talentflow.report import (alias_match_rows, highlight_html, summarize_matches,
                               token_stream_html, tokenizer_comparison)
from talentflow.ingest.corpus import iter_corpus, read_jsonl
from talentflow.ingest.document import SUPPORTED_SUFFIXES, UnsupportedFormat, load_resume
from talentflow.llm import load_client
from talentflow.skills.extractor import LLMExtractor, LexicalExtractor, OnetMapper
from talentflow.skills.build import build_skill_vocabulary
from talentflow.text.chunk import chunk_resume

CORPUS_PATH = INTERIM_DIR / "resumes.jsonl"
CHUNKS_PATH = INTERIM_DIR / "chunks.jsonl"

CATEGORY_HELP = {
    "technical": "Tools, software, and domain knowledge.",
    "soft": "Interpersonal and cognitive abilities.",
    "process": "Ways of working and coordinating.",
}

CONFIDENCE_HELP = {
    "exact": "Matched the full official O*NET name. Trust these.",
    "alias": "Matched a known nickname, like AutoCAD for Autodesk AutoCAD.",
    "weak": "Matched a word that is also an everyday word, like Go or Design. "
            "Often wrong without surrounding context.",
}

st.set_page_config(page_title="TalentFlow prototype", page_icon="::", layout="wide")


# --------------------------------------------------------------------------- setup

@st.cache_resource(show_spinner=False)
def get_vocabulary():
    """Build and calibrate the skill vocabulary once per server process.

    This takes about 20 seconds: it reads 2,484 resumes to measure how common each word is,
    then prunes aliases that fire too often for the product they point at. Cached, because
    doing it on every upload would make the page unusable.
    """
    from talentflow.skills.build import load_prebuilt_vocabulary
    prebuilt = load_prebuilt_vocabulary()
    if prebuilt is not None:
        return prebuilt
    if not CORPUS_PATH.exists():
        return None, None
    return build_skill_vocabulary(cache_path=INTERIM_DIR / "vocab_cache.pkl")


@st.cache_resource(show_spinner=False)
def get_llm():
    """The API client, or None when no key is configured. No key is a supported state."""
    return load_client()


@st.cache_resource(show_spinner=False)
def get_mapper(_vocab):
    """Embeddings over the 9,065 O*NET term names, for mapping free text back to the
    vocabulary. Cached because it is rebuilt on every rerun otherwise, and Streamlit reruns
    the whole script on every widget interaction."""
    return OnetMapper(_vocab)


@st.cache_resource(show_spinner=False)
def get_index(backend: str = "lsa"):
    """Build the retrieval index. Only used by the 'Similar resumes' tab, so it is built
    lazily rather than on page load."""
    if not CHUNKS_PATH.exists():
        return None
    from talentflow.embed import VectorIndex, get_embedder

    chunks = list(read_jsonl(CHUNKS_PATH))
    kw = {"n_components": 128} if backend == "lsa" else {}
    return VectorIndex.build(get_embedder(backend, **kw), chunks)


@st.cache_resource(show_spinner=False)
def get_matcher():
    """Build the matching pool once: every candidate profile plus the Capital One roles.

    Only the "Skills to learn next" tool needs it, so it is built lazily on first use rather
    than on page load."""
    from talentflow.matching import Matcher, load_posting_profiles, load_resume_profiles

    cap = INTERIM_DIR / "posting_skills_capital_one.jsonl"
    resumes = load_resume_profiles()
    postings = load_posting_profiles(cap if cap.exists() else None)
    return Matcher(resumes, postings)


@st.cache_resource(show_spinner=False)
def get_resume_skillsets():
    """resume_id -> the set of skills each reference resume has. Used to show *why* a resume
    ranked as similar: the skills it shares with the uploaded one."""
    path = INTERIM_DIR / "resume_skills.jsonl"
    if not path.exists():
        return {}
    out = {}
    for rec in read_jsonl(path):
        rid = str(rec.get("resume_id") or rec.get("job_id"))
        out[rid] = {s["name"] for s in rec.get("skills", [])}
    return out


def render_video_page(client):
    """Task 1: transcribe a local recording, then read its sentiment and career directions.

    Independent of the resume corpus, so it works before the pipeline is built."""
    from talentflow.video import find_media, get_transcriber, process_media

    st.subheader("Video and audio understanding (task 1)")
    st.caption(
        "Point this at a recording on this machine. It transcribes the speech, then reads "
        "the sentiment and career directions off the transcript. Transcription runs locally "
        "by default; the sentiment and career reads use your LLM key."
    )

    backend = st.selectbox(
        "Transcriber", ["faster-whisper", "openai-whisper", "gemini"],
        help="faster-whisper is local and light. openai-whisper is local and heavier. "
             "gemini sends the audio to the API and needs a key.",
    )

    # A folder browser, because typing a full path is miserable. Streamlit runs in a browser
    # and cannot open a native macOS file dialog, so this walks folders on the server side.
    if "video_dir" not in st.session_state:
        st.session_state.video_dir = str(Path.home())
    cur = Path(st.session_state.video_dir)
    st.caption(f"Folder: {cur}")

    up_col, into_col = st.columns([1, 3])
    if up_col.button("Up one level", use_container_width=True):
        st.session_state.video_dir = str(cur.parent)
        st.rerun()
    try:
        subdirs = sorted(d.name for d in cur.iterdir()
                         if d.is_dir() and not d.name.startswith("."))
    except (PermissionError, OSError):
        subdirs = []
    into = into_col.selectbox("Open a subfolder", ["(stay here)"] + subdirs)
    if into != "(stay here)":
        st.session_state.video_dir = str(cur / into)
        st.rerun()

    found = find_media(cur)
    chosen = None
    if found:
        names = [f.name for f in found]
        picked = st.selectbox(f"{len(found)} recording(s) in this folder, newest first", names)
        chosen = found[names.index(picked)]
    else:
        st.caption("No recordings in this folder. Open a subfolder above, or upload one below.")

    upload = st.file_uploader(
        "Or upload a recording",
        type=["mp4", "mov", "m4a", "mp3", "wav", "mkv", "webm"],
        help="Handy for a small clip. Large files copy slowly through the browser; the folder "
             "browser above is better for those.",
    )
    if upload is not None:
        tmp = Path("/tmp") / upload.name
        tmp.write_bytes(upload.getbuffer())
        chosen = tmp

    if chosen is None:
        return

    run_analysis = st.checkbox(
        "Also read sentiment and career directions", value=client is not None,
        disabled=client is None)
    if client is None:
        st.caption("No API key found, so only the transcript will be produced. Add one to "
                   ".env for the sentiment and career reads.")

    if st.button("Transcribe and analyze"):
        with st.spinner(f"Transcribing with {backend}. The first run downloads the model."):
            try:
                transcriber = get_transcriber(backend)
                result = process_media(chosen, transcriber, client if run_analysis else None)
            except Exception as exc:  # noqa: BLE001 - a failed run must not blank the page
                st.error(f"{type(exc).__name__}: {exc}")
                return

        meta = f"{result['backend']}"
        if result.get("language"):
            meta += f" · {result['language']}"
        if result.get("duration_s"):
            meta += f" · {result['duration_s']:.0f}s"
        st.markdown(f"**Transcript**  ·  {meta}")
        st.write(result["transcript"] or "(the transcript came back empty)")

        analysis = result.get("analysis")
        if analysis:
            s = analysis.get("sentiment") or {}
            c = analysis.get("career") or {}
            st.markdown(
                f"**Sentiment:** {s.get('overall', '?')} "
                f"({s.get('confidence', '?')} confidence): {s.get('summary', '')}"
            )
            if s.get("evidence"):
                st.caption(f'evidence: "{s["evidence"]}"')
            st.markdown(f"**Career directions:** {c.get('summary', '')}")
            if c.get("current_role"):
                st.caption(f"now: {c['current_role']}")
            for d in c.get("target_directions", []):
                st.markdown(f"- wants **{d.get('direction', '')}**: "
                            f'"{d.get("quote", "")}"')
            if c.get("skills_to_learn"):
                st.markdown(f"skills to learn: {', '.join(c['skills_to_learn'])}")


# --------------------------------------------------------------------------- style

# Deliberately small. A prototype should look like one, and the gap between this and good
# is information hierarchy, not decoration. This does three things only: give the page an
# accent that is not Streamlit's default red, tighten table rows so more fits on a screen,
# and make the one number that matters look like the one number that matters.
ACCENT = "#1a7f37"

st.markdown(f"""<style>
  .stApp {{ --tf-accent: {ACCENT}; }}
  h1 {{ font-weight: 700; letter-spacing: -0.02em; }}
  [data-testid="stMetricValue"] {{ font-size: 2.6rem; font-weight: 700; line-height: 1.1; }}
  [data-testid="stMetricLabel"] {{
      font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.09em; opacity: 0.65;
  }}
  .stTabs [data-baseweb="tab-list"] {{ gap: 0.25rem; }}
  .stTabs [aria-selected="true"] {{ color: {ACCENT}; }}
  .stTabs [data-baseweb="tab-highlight"] {{ background-color: {ACCENT}; }}
  [data-testid="stDataFrame"] td {{ padding-top: 0.3rem; padding-bottom: 0.3rem; }}
  .tf-quiet {{ font-size: 0.86rem; opacity: 0.7; }}
  /* Token boxes. The point is the boundaries, so every token gets a visible edge. */
  .tf-tokens {{ line-height: 2.1; margin: 0.4rem 0 0.8rem; }}
  .tf-tok {{
      display: inline-block; padding: 0.05rem 0.34rem; margin: 0 0.16rem 0.2rem 0;
      border: 1px solid rgba(128,128,128,0.32); border-radius: 3px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem;
  }}
  .tf-tok-special {{
      border-color: {ACCENT}; color: {ACCENT}; font-weight: 600;
      background: rgba(26,127,55,0.07);
  }}
  .tf-cmp {{ width:100%; border-collapse:collapse; font-size:0.8rem; margin-top:0.2rem; }}
  .tf-cmp th, .tf-cmp td {{ border-bottom:1px solid rgba(128,128,128,0.2); padding:2px 6px; }}
  .tf-cmp .c {{ text-align:center; color:{ACCENT}; font-weight:700; width:42px; }}
  .tf-cmp-title {{ font-weight:600; margin:0.4rem 0 0.2rem; }}
</style>""", unsafe_allow_html=True)

# Confidence as a shape, not a word. The tier exists for triage -- trust these, spot-check
# those -- and triage means reading it in peripheral vision. A text column has to be read
# row by row, which defeats the purpose of having tiers at all.
CONFIDENCE_MARK = {"exact": "●●●", "alias": "●●○", "weak": "●○○"}
CONFIDENCE_RANK = {"exact": 0, "alias": 1, "weak": 2}


def _cmp_table(title, rows):
    """A compact HTML table: skill, then a check under each engine that found it."""
    body = "".join(
        f"<tr><td>{html.escape(s)}</td>"
        f"<td class='c'>{'✓' if d else ''}</td>"
        f"<td class='c'>{'✓' if l else ''}</td></tr>"
        for s, d, l in rows
    ) or "<tr><td colspan='3' style='opacity:.6'>none</td></tr>"
    return (f"<div class='tf-cmp-title'>{html.escape(title)} ({len(rows)})</div>"
            f"<table class='tf-cmp'><thead><tr><th>Skill</th>"
            f"<th class='c'>Dict</th><th class='c'>LLM</th></tr></thead>"
            f"<tbody>{body}</tbody></table>")


# ---------------------------------------------------------------------------- page

st.title("TalentFlow prototype")
st.caption(
    "Drop in a resume and see what the system extracts. Every skill points back at the "
    "exact words that produced it."
)

mode = st.sidebar.radio(
    "What to analyze",
    ["Resume", "Video (task 1)"],
    help="Resume reads a resume and extracts skills. Video transcribes a recording and "
         "reads its sentiment and career directions.",
)
if mode == "Video (task 1)":
    render_video_page(get_llm())
    st.stop()

if not CORPUS_PATH.exists():
    st.error(
        f"No corpus found at `{CORPUS_PATH}`.\n\n"
        "Run the pipeline first:\n\n"
        "```\npython scripts/01_extract_pdfs.py\npython scripts/02_build_corpus.py\n"
        "python scripts/03_build_chunks.py\n```"
    )
    st.stop()

with st.sidebar:
    st.header("Settings")

    llm_client = get_llm()
    engine_choice = st.radio(
        "Extraction engine",
        options=["Dictionary Matcher", "LLM Reader"],
        help="Dictionary Matcher looks each word up in a fixed list of 9,065 official "
             "skill names. LLM Reader asks a language model to read the resume and quote "
             "its evidence. Same scoring either way, so the two are comparable.",
        disabled=llm_client is None,
    )
    if llm_client is None:
        engine_choice = "Dictionary Matcher"
        st.caption(
            "LLM Reader needs an API key. Add one to a `.env` file in the project folder "
            "and restart."
        )
    else:
        st.caption(f"Model: `{llm_client.model}`")

    st.divider()
    min_confidence = st.select_slider(
        "Minimum confidence",
        options=["weak", "alias", "exact"],
        value="alias",
        help="How sure the system has to be before it reports a skill.",
    )
    st.caption(CONFIDENCE_HELP[min_confidence])

    skip_generic = st.checkbox(
        "Hide generic terms", value=False,
        help="Drops catch-all entries like 'Email software' that match almost everyone.",
    )
    st.divider()
    st.caption(f"Accepts {', '.join(sorted(SUPPORTED_SUFFIXES))}")
    st.caption("Legacy .doc needs LibreOffice installed.")

# Twenty seconds of unexplained spinner reads as broken. Naming the steps turns a wait into
# a progress report, and these are the real steps.
with st.status("Preparing the skill vocabulary...", expanded=False) as status:
    st.write("Loading 9,065 O*NET skill names")
    st.write("Measuring how common each word is across 2,484 resumes and 5,000 postings")
    st.write("Calibrating: pruning aliases that fire too often for the tool they name")
    vocab, calibration = get_vocabulary()
    if vocab is not None:
        status.update(
            label=f"Vocabulary ready: {len(vocab.aliases):,} names and aliases",
            state="complete",
        )

if vocab is None:
    st.error("Could not build the vocabulary. Is the O*NET folder in place?")
    st.stop()

uploaded = st.file_uploader(
    "Upload a resume",
    type=[s.lstrip(".") for s in sorted(SUPPORTED_SUFFIXES)],
    help="Nothing is sent anywhere. The file is processed on this machine.",
)

if uploaded is None:
    st.info("Upload a resume above to begin. Yours works fine.")
    with st.expander("What this does, in short"):
        st.markdown(
            "1. **Reads the file** and repairs the encoding damage documents carry.\n"
            "2. **Finds the sections** so a word under Skills counts differently from one "
            "under Interests.\n"
            "3. **Splits into words** without destroying `C++`, `.NET` or `P&L`.\n"
            "4. **Names the skills** using O*NET, the US Department of Labor's "
            "occupational database, so everyone's wording maps to one vocabulary.\n"
            "5. **Shows the evidence** for every single skill.\n\n"
            "Full walkthrough in `docs/HOW_IT_WORKS.md`."
        )
    st.stop()

tmp_path = Path(st.session_state.get("_tmpdir", "/tmp")) / uploaded.name
try:
    tmp_path.write_bytes(uploaded.getbuffer())
except OSError as exc:
    st.error(f"Could not save the upload: {exc}")
    st.stop()

started = time.monotonic()
try:
    record = load_resume(tmp_path)
except (UnsupportedFormat, FileNotFoundError) as exc:
    st.error(str(exc))
    st.stop()

if record["extract_error"]:
    st.error(f"Could not read the file: {record['extract_error']}")
    st.stop()

if record["n_words"] < 20:
    st.warning(
        f"Only {record['n_words']} words came out of this file. If it is a scanned image "
        "there is no text layer to read, and it would need OCR first."
    )
    st.stop()

chunks = chunk_resume(record)


def build_extractor(engine: str):
    """Both engines behind one interface, so the rest of the page does not branch."""
    if engine == "LLM Reader" and llm_client is not None:
        return LLMExtractor(llm_client, vocab, mapper=get_mapper(vocab))
    return LexicalExtractor(vocab, min_confidence=min_confidence, skip_generic=skip_generic)


extractor = build_extractor(engine_choice)
with st.spinner("Reading the resume..." if engine_choice == "LLM Reader" else ""):
    try:
        matches = extractor.extract(record)
    except Exception as exc:  # noqa: BLE001 - a failed call must not blank the page
        st.error(f"{engine_choice} failed: {exc}")
        st.stop()

if engine_choice == "LLM Reader":
    matches = [m for m in matches if not (skip_generic and m.term.is_generic)]
    from talentflow.skills.extractor import filter_by_confidence
    matches = filter_by_confidence(matches, min_confidence)
    if len(record["text"]) > extractor.max_chars:
        st.warning(
            f"This resume is {len(record['text']):,} characters and the LLM Reader only "
            f"reads the first {extractor.max_chars:,}. Skills that show up only after that "
            "cut may be missed. The Dictionary Matcher reads the whole file."
        )

elapsed = time.monotonic() - started
best, mentions = summarize_matches(matches)

# One number, because one number is the answer. Word count and section count are facts
# about the file, not about the result, and giving four numbers equal weight claimed they
# mattered equally. They do not.
headline, spacer = st.columns([1, 3])
headline.metric("Skills found", len(best))
spacer.markdown(
    f"<div class='tf-quiet' style='padding-top:2.1rem'>"
    f"{uploaded.name} &nbsp;·&nbsp; {record['n_words']:,} words &nbsp;·&nbsp; "
    f"{len(record['sections'])} sections &nbsp;·&nbsp; {len(chunks)} chunks "
    f"&nbsp;·&nbsp; {engine_choice.lower()}, {elapsed:.1f}s</div>",
    unsafe_allow_html=True,
)

tab_skills, tab_compare, tab_evidence, tab_doc, tab_hood = st.tabs(
    ["Skills", "Both engines", "Evidence in context", "Document breakdown", "Under the hood"]
)

# ------------------------------------------------------------------------ skills

with tab_skills:
    if not best:
        # The empty state is where a user most needs guidance, so it gets a real one.
        st.warning("No skills matched this document.")
        st.markdown(
            "**Things worth trying, in order:**\n\n"
            "- Slide **Minimum confidence** down to `weak` in the sidebar. Borderline "
            "matches are hidden by default.\n"
            "- Uncheck **Hide generic terms**.\n"
            "- Check the **Document breakdown** tab. If no sections were found, the file "
            "may have extracted as one unstructured block.\n\n"
            "If the resume is mostly prose describing work rather than naming tools, word "
            "matching will struggle by design. That is the gap the LLM Reader exists to close."
        )
    else:
        # One table, not three. Category was never what anyone decides on; confidence is,
        # because the tiers exist for triage. Three tables also meant three stacked scroll
        # regions and forced a reader to scan all of them to answer one question.
        rows = sorted(
            (
                {
                    "": CONFIDENCE_MARK.get(m.confidence, "○○○"),
                    "Skill": name,
                    "Type": m.term.category,
                    "Mentions": mentions[name],
                    "Section": m.section or "",
                    "Matched text": m.matched_text,
                    "Confidence": m.confidence,
                }
                for name, m in best.items()
            ),
            key=lambda r: (CONFIDENCE_RANK.get(r["Confidence"], 9), -r["Mentions"], r["Skill"]),
        )

        st.caption(
            "●●● matched a full official name · ●●○ a known nickname · ●○○ also an "
            "everyday word. **Select a row to see the sentence it came from.**"
        )

        selection = st.dataframe(
            rows,
            use_container_width=True,
            hide_index=True,
            on_select="rerun",
            selection_mode="single-row",
            column_config={
                "": st.column_config.TextColumn("", width="small"),
                "Skill": st.column_config.TextColumn(width="large"),
                "Mentions": st.column_config.NumberColumn(width="small"),
                "Confidence": None,   # ranked and rendered as marks; the word adds nothing
            },
        )

        # The interaction that was missing: a skill you cannot trace is a skill you cannot
        # check, and the evidence was buried behind a tab most people never opened.
        picked = getattr(selection, "selection", {}).get("rows", [])
        if picked:
            chosen = rows[picked[0]]["Skill"]
            st.markdown(f"**Where `{chosen}` came from**")
            for m in [x for x in matches if x.name == chosen][:4]:
                lo = max(0, m.char_start - 130)
                hi = min(len(record["text"]), m.char_end + 130)
                before = " ".join(record["text"][lo:m.char_start].split())
                hit = record["text"][m.char_start:m.char_end]
                after = " ".join(record["text"][m.char_end:hi].split())
                st.markdown(
                    f"<div style='font-family:ui-monospace,monospace;font-size:0.82rem;"
                    f"line-height:1.7;border-left:3px solid {ACCENT};padding:0.5rem 0.9rem;"
                    f"margin:0.4rem 0;opacity:0.92'>"
                    f"...{html.escape(before)}"
                    f"<mark style='background:{ACCENT}22;border-bottom:2px solid {ACCENT};"
                    f"padding:1px 3px;border-radius:3px'>{html.escape(hit)}</mark>"
                    f"{html.escape(after)}...<br>"
                    f"<span style='opacity:0.55;font-size:0.75rem'>section: "
                    f"{m.section} · characters {m.char_start}-{m.char_end}</span></div>",
                    unsafe_allow_html=True,
                )
        else:
            st.caption("Nothing selected. Click any row above.")

with tab_compare:
    if llm_client is None:
        st.info(
            "This runs the Dictionary Matcher and the LLM Reader on this resume and lines up "
            "what each found. It needs an API key. Add one to `.env` and restart."
        )
    else:
        with st.spinner("Running the LLM Reader so both engines can be compared..."):
            from talentflow.skills.extractor import filter_by_confidence
            lex_cmp = LexicalExtractor(
                vocab, min_confidence=min_confidence, skip_generic=skip_generic
            ).extract(record)
            llm_ex = LLMExtractor(llm_client, vocab, mapper=get_mapper(vocab))
            llm_cmp = [m for m in llm_ex.extract(record)
                       if not (skip_generic and m.term.is_generic)]
            llm_cmp = filter_by_confidence(llm_cmp, min_confidence)

        lex_names = {m.name for m in lex_cmp}
        llm_names = {m.name for m in llm_cmp}
        both = sorted(lex_names & llm_names)
        only = sorted(lex_names ^ llm_names)

        m1, m2, m3 = st.columns(3)
        m1.metric("Dictionary Matcher", len(lex_names))
        m2.metric("LLM Reader", len(llm_names))
        m3.metric("Agreed", len(both))
        st.caption(
            "Every skill either engine found on this resume. The left table is the ones both "
            "engines agreed on. The right is where only one found it, with a check under the "
            "engine that did. Runs automatically; the LLM response is cached, so it is free "
            "to re-read."
        )
        left, right = st.columns(2)
        left.markdown(_cmp_table("Both engines agreed", [(s, True, True) for s in both]),
                      unsafe_allow_html=True)
        right.markdown(
            _cmp_table("Only one engine found it",
                       [(s, s in lex_names, s in llm_names) for s in only]),
            unsafe_allow_html=True)

        stats = llm_ex.stats()
        if stats["unquotable"]:
            st.warning(
                f"The LLM Reader returned {stats['unquotable']} skill(s) it could not quote "
                f"from the resume ({stats['hallucination_rate_pct']}%). Those were dropped. "
                "The Dictionary Matcher cannot do this, because every result it gives is a "
                "span of the document."
            )
        else:
            st.success("Every skill the LLM Reader returned was quotable from the document.")
        if stats["unmapped_to_onet"]:
            st.info(f"{stats['unmapped_to_onet']} skill(s) had no O*NET match and are kept as "
                    "unmapped rather than dropped.")

with tab_evidence:
    st.caption(
        "Every highlighted span is a skill the system claims you have. Hover to see which "
        "one. Green is an exact O*NET name, purple a nickname, amber a low-confidence match."
    )
    rendered = highlight_html(record["text"], matches)
    st.markdown(
        f'<div style="font-family:ui-monospace,monospace;font-size:13px;line-height:1.7;'
        f'border:1px solid rgba(128,128,128,.28);border-radius:8px;padding:16px;'
        f'max-height:640px;overflow-y:auto">{rendered}</div>',
        unsafe_allow_html=True,
    )

with tab_doc:
    st.subheader("Sections found")
    st.caption(
        "A skill listed under Skills is a stronger claim than the same word under Interests."
    )
    st.dataframe(
        [
            {
                "Section": s["name"],
                "Heading on the page": s["heading"] or "(none)",
                "Words": len(s["text"].split()),
                "Skills found here": sum(1 for m in matches if m.section == s["name"]),
            }
            for s in record["sections"]
        ],
        use_container_width=True, hide_index=True,
    )

    st.subheader("Chunks")
    st.caption(
        f"Cut into {len(chunks)} overlapping pieces for comparison. Chunks never cross a "
        "section boundary or cut a sentence in half."
    )
    st.dataframe(
        [{"#": c.chunk_index, "Section": c.section, "Words": c.n_tokens,
          "Starts with": " ".join(c.text.split())[:70] + "..."} for c in chunks],
        use_container_width=True, hide_index=True,
    )

    if record["residual_artifacts"]:
        st.warning(
            f"{record['residual_artifacts']} characters in this file were already damaged "
            "beyond repair before we read it. Usually a lost accent or symbol."
        )

# --------------------------------------------------------------------- under the hood

with tab_hood:
    st.caption(
        "What the pipeline actually did to this file, before any skill was named. "
        "Every stage below keeps character positions, which is what makes the evidence "
        "highlighting on the other tabs possible."
    )

    # ---------------------------------------------------------------- tokenization
    st.subheader("1. Tokenization")
    st.markdown(
        "Text has to become discrete units before anything can be looked up. A standard "
        "word-splitter keeps letters and digits and throws away everything else, which is "
        "fine for prose and destroys technology names."
    )

    comparison = tokenizer_comparison(record["text"])
    a, b, c = st.columns(3)
    a.metric("Tokens, ours", f"{comparison['n_ours']:,}")
    b.metric("Tokens, standard", f"{comparison['n_naive']:,}")
    c.metric("Names it would break", len(comparison["damaged"]))

    if comparison["damaged"]:
        st.markdown("**What a standard tokenizer would do to this resume:**")
        st.dataframe(
            [{"On the page": d["token"],
              "Standard tokenizer sees": ", ".join(d["becomes"]) or "(nothing)",
              "Times in this file": d["count"]}
             for d in comparison["damaged"]],
            use_container_width=True, hide_index=True,
        )
        st.caption(
            f"{sum(d['count'] for d in comparison['damaged'])} mentions in this one file. "
            "Across all 2,484 reference resumes it is more than 650, and nothing warns you: "
            "the skills are simply not there any more."
        )
    else:
        st.info(
            "Nothing in this file would break under a standard tokenizer. That happens with "
            "resumes that name no technologies containing punctuation."
        )

    st.markdown("**The first 400 tokens, with the boundaries drawn.** "
                "Green ones are the kind a standard tokenizer would damage.")
    st.markdown(token_stream_html(record["text"]), unsafe_allow_html=True)

    with st.expander("Why not BPE, the method from the lecture?"):
        st.markdown(
            "The Transformer lecture teaches **byte pair encoding**, which builds a "
            "vocabulary by repeatedly merging the most frequent adjacent character pairs. "
            "It is what the LLM Reader's provider uses on every call, and it is why you pay "
            "an API by the token.\n\n"
            "We did not use it here because **our tokens are evidence, not model input.** "
            "BPE would split `C++` into `C` and `++`, and it does not preserve the character "
            "positions that let this app highlight the exact words behind each skill. Both "
            "kinds of tokenization are in this project, doing different jobs."
        )

    # ---------------------------------------------------------------- chunking
    st.subheader("2. Chunking")
    st.markdown(
        f"This resume became **{len(chunks)} chunks** of about 180 tokens. Chunks never "
        "cross a section boundary, because pooling an Experience section together with an "
        "Education section produces a vector that describes neither."
    )
    st.dataframe(
        [{"#": ch.chunk_index, "Section": ch.section, "Tokens": ch.n_tokens,
          "First words": " ".join(ch.text.split())[:64] + "..."} for ch in chunks],
        use_container_width=True, hide_index=True, height=200,
    )

    # ---------------------------------------------------------------- lookup
    st.subheader("3. Vocabulary lookup")
    st.markdown(
        "Each token sequence is checked against 29,561 vocabulary entries built from "
        "O*NET, **longest match first**. That is why `Microsoft SQL Server` appears once as "
        "a three-token match rather than three times as overlapping shorter ones."
    )
    if matches:
        st.dataframe(alias_match_rows(matches), use_container_width=True, hide_index=True)
        multi = sum(1 for m in matches if len(m.alias.split()) > 1)
        st.caption(
            f"{len(matches)} matches, {multi} of them spanning more than one token. "
            "Without the longest-match rule each of those would have produced several "
            "overlapping, mostly wrong, shorter matches instead."
        )
    else:
        st.info("No vocabulary matches in this document, so there is nothing to show here.")


# --------------------------------------------------------- beyond this resume

# Separated from the tabs above on purpose. Those three answer "what is in this document".
# These two ask about the corpus and about the system itself, which is a different job and
# a different audience, and giving them equal billing in one tab bar hid that.
st.divider()
st.subheader("Beyond this resume")

with st.expander("Find similar resumes in the reference set"):
    st.caption(
        "The closest resumes out of 2,484, ranked by how similar their text is to yours. "
        "The reference set is anonymized, so each shows only its job family, plus the "
        "specific skills you have in common, which is the real reason it ranked."
    )
    if not CHUNKS_PATH.exists():
        st.info("Run `python scripts/03_build_chunks.py` to enable this.")
    elif st.button("Search the reference set"):
        with st.spinner("Building the search index (about 10 seconds, first run only)..."):
            index = get_index()
        if index is None:
            st.info("No index available.")
        else:
            query = "\n".join(
                s["text"] for s in record["sections"]
                if s["name"] in ("summary", "skills", "header")
            ) or record["text"][:2000]
            hits = index.search(query, k=200)
            ranked = index.group_by_resume(hits)[:10]
            category_of = {h.resume_id: h.category for h in hits}
            skillsets = get_resume_skillsets()
            uploaded_names = {m.name for m in matches}
            st.dataframe(
                [{"Rank": i, "Resume": rid, "Job family": category_of.get(rid, "?"),
                  "Similarity": round(score, 3),
                  "Skills you share": ", ".join(
                      sorted(uploaded_names & skillsets.get(rid, set()))[:8])
                      or "no exact skill overlap; matched on wording and context"}
                 for i, (rid, score) in enumerate(ranked, 1)],
                use_container_width=True, hide_index=True,
                column_config={"Skills you share": st.column_config.TextColumn(width="large")},
            )
            st.caption(
                "Similarity is how alike the two resumes read. The last column is the concrete "
                "why: the O*NET skills your resume and that one both contain. A high score with "
                "few shared skills means they are written alike but name different tools."
            )

with st.expander("Skills to learn next"):
    st.caption(
        "The skills this resume is missing that would open the most roles, ranked by how "
        "much each would raise the fit across the Capital One posting pool. This is Task 4: "
        "turning a gap into a plan."
    )
    cap_postings = INTERIM_DIR / "posting_skills_capital_one.jsonl"
    resume_skills = INTERIM_DIR / "resume_skills.jsonl"
    if not (cap_postings.exists() and resume_skills.exists()):
        st.info(
            "Run `python scripts/06_extract_skills.py` and `python "
            "scripts/10_extract_posting_skills.py --company \"Capital One\"` to enable this."
        )
    elif st.button("Find high-leverage skills"):
        from talentflow.matching import (SkillProfile, rank_skill_leverage,
                                         summarize_leverage)
        from talentflow.matching.profile import SkillEvidence
        with st.spinner("Building the candidate pool and ranking gaps..."):
            matcher = get_matcher()
            candidate = SkillProfile(uploaded.name, "resume", label="uploaded resume")
            for m in matches:
                if m.name not in candidate.skills:
                    candidate.skills[m.name] = SkillEvidence(
                        m.matched_text, m.section, m.char_start, m.char_end, m.confidence)
                    candidate.categories[m.name] = m.term.category
            ranked = rank_skill_leverage(matcher, candidate, top_k=10)
        if not ranked:
            st.success("This resume already covers every skill the roles in the pool ask for.")
        else:
            st.markdown(f"**{summarize_leverage(ranked, candidate)}**")
            st.dataframe(
                [{"Skill": x.skill,
                  "Roles that need it": x.roles_requiring,
                  "Leverage": round(x.score_gain, 2),
                  "Candidates who have it": x.held_by_candidates,
                  "Example roles": ", ".join(x.example_roles[:2])}
                 for x in ranked],
                use_container_width=True, hide_index=True,
            )
            st.caption(
                "Leverage is the total match-score lift from learning the skill across every "
                "role. A skill zero candidates have and many roles want is a gap across the "
                "whole pool, which the ~2019 resume vintage (F18) helps explain."
            )

st.divider()
counts = {}
for m in matches:
    counts[m.confidence] = counts.get(m.confidence, 0) + 1
conf_text = ", ".join(f"{k}: {v}" for k, v in sorted(counts.items())) or "none"
st.caption(f"Engine: {engine_choice}")
st.caption(f"Confidence breakdown: {conf_text}")
st.caption(f"Vocabulary: {len(vocab.aliases):,} names and aliases, "
           f"{calibration['n_pruned']} pruned during calibration")
st.caption("Nothing here was invented. Every skill points at real words in the file.")
