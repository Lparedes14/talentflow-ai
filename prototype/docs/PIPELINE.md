# Running TalentFlow

Two things happen in this project: a **build** that prepares the data once, and a **run** that
uses it, either the app or a command-line tool. This page starts with the one command that
does the whole build, then the app, then everything underneath in case you want a single piece.

- [1. Build everything, one command](#1-build-everything-one-command)
- [2. Start the app](#2-start-the-app)
- [3. Build versus run](#3-build-versus-run)
- [4. The video tool, task 1](#4-the-video-tool-task-1)
- [5. Analyze one resume from the command line](#5-analyze-one-resume-from-the-command-line)
- [6. Turn on the LLM Reader](#6-turn-on-the-llm-reader)
- [7. The build, stage by stage](#7-the-build-stage-by-stage)
- [8. The other tools](#8-the-other-tools)
- [9. Evaluation and fairness](#9-evaluation-and-fairness)
- [10. Optional add-ons](#10-optional-add-ons)
- [11. The run wrapper](#11-the-run-wrapper)
- [12. Packaging it for someone else](#12-packaging-it-for-someone-else)
- [13. When something breaks](#13-when-something-breaks)
- [14. Where the code lives](#14-where-the-code-lives)

You need Python 3.10 or newer. Everything installs into a `.venv` folder inside the project,
so your system Python is never touched, and deleting `.venv` undoes the setup.

---

## 1. Build everything, one command

This makes the virtual environment, installs the packages, and builds the corpus and the skill
data. First run is a few minutes, mostly reading the 2,484 PDFs. It is safe to run again: each
stage only redoes its own work.

**macOS and Linux**

```bash
cd prototype
./scripts/build_all.sh
```

**Windows (PowerShell)**

```powershell
cd prototype
.\scripts\build_all.ps1
```

That is the whole setup. When it finishes it prints the next commands. If you only want to
click around the app and never touch the command line, skip even this and read the next
section, because the launcher builds what it needs on its own.

---

## 2. Start the app

The app is `app.py`, a Streamlit page. It is where you upload a resume and see the skills, the
evidence for each highlighted in your own text, and the tools built on top.

**macOS, the easy way:** double-click `Launch TalentFlow.command` in Finder. It sets up the
environment, offers to build the corpus the first time, and opens the app in your browser.

**Any platform, from a terminal:**

```bash
streamlit run app.py
```

The app has two modes, chosen with the selector at the top of the sidebar:

- **Resume.** Upload a `.pdf`, `.docx`, `.doc`, `.odt`, `.rtf`, `.txt` or `.md`. You get the
  extracted skills, the sentence behind each one, the section breakdown, the nearest resumes
  in the reference set, and the "Skills to learn next" tool.
- **Video (task 1).** Point it at a recording on your machine, or a folder to scan, and it
  transcribes the speech and reads the sentiment and career directions. Covered in section 4.

---

## 3. Build versus run

Keeping these two apart is the whole mental model.

**Build** reads the raw data and writes to `data/`. You do it once, or again only when you
change a stage. `build_all.sh` runs it end to end; section 7 breaks it into the individual
stages if you want to run or re-run just one. Everything in `data/` is regenerable and
gitignored.

The app itself needs neither the corpus nor O*NET to start: it loads a shipped, calibrated vocabulary from `talentflow/skills/onet_vocab.json.gz`, so the first launch is instant. Rebuild that file with `python scripts/17_build_vocab_cache.py` after you change the vocabulary, the corpus, or the O*NET data.

**Run** uses what the build wrote. The app, analyzing one resume (section 5), matching
(section 7, stage J), the skill-gap tool (section 8), and the video tool (section 4) are all
runs. The video tool is the one exception that needs no build at all, because it works off a
recording, not the corpus.

---

## 4. The video tool, task 1

Task 1 is video understanding: transcribe a recording, then read its sentiment and career
directions off the transcript. Transcription is speech recognition; the sentiment and career
reads are the language-model step that runs on the transcript afterwards.

It needs no corpus, so it works before or without the build. The default transcriber,
faster-whisper, installs with `pip install -r requirements.txt`; you also need `ffmpeg` on
PATH (`brew install ffmpeg`). The Gemini backend needs neither, only a key. openai-whisper is
an optional heavier alternative, see section 10.

**In the app:** pick **Video (task 1)** in the sidebar, choose a transcriber, type a path to a
recording or a folder to scan, pick the file, and run.

**From the command line:**

```bash
python scripts/16_video.py ~/Desktop/my_clip.mp4
python scripts/16_video.py --scan ~/Desktop
python scripts/16_video.py my_clip.m4a --transcriber gemini
```

Three transcription backends, the same choice of local versus the API:

- **faster-whisper**, the default. Local, about 200 MB, no PyTorch.
- **openai-whisper**. Local, the reference package, pulls in PyTorch, about 2 GB.
- **gemini**. Sends the audio to the API, so it needs a key and a network but no download.

The sentiment and career reads use whatever LLM key is in `.env` (section 6). Add
`--no-analysis` to stop at the transcript. Output is saved to `data/interim/video_<name>.json`.

For what to record, `docs/demos/video_questions.md` has a question set that exercises all three
parts and fits in 2 to 3 minutes.

---

## 5. Analyze one resume from the command line

Your own, a teammate's, any file. Same formats the app accepts.

```bash
./scripts/run.sh 07 my_resume.pdf --show-evidence
```

```powershell
.\scripts\run.ps1 07 my_resume.pdf --show-evidence
```

---

## 6. Turn on the LLM Reader

**The Dictionary Matcher needs no key and no network.** The LLM Reader is an alternative
extractor, and the sentiment and career reads in the video tool also use it, so this is what
turns those on. Copy `.env.example` to `.env` and fill in one key. `.env` is gitignored, and
the team contract is explicit that keys never reach GitHub.

```
LLM_PROVIDER=gemini            # which one to use when several keys are present
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_RPM=15
```

Three providers are supported: `anthropic`, `openai`, `gemini`. `LLM_PROVIDER` chooses when
you have more than one key; leave it blank and the first key found wins.

`<PROVIDER>_MODEL` picks the model. Leave it blank for the code default. Precedence is
`--model`, then `.env`, then the constant. `<PROVIDER>_RPM` is the per-minute limit the client
paces itself to; `0` disables pacing, which is what a paid tier wants.

**Which models can this key actually call?**

```bash
./scripts/run.sh 12
```

One API call. Asks the provider directly and warns if the model in your `.env` is not in the
list. Run this first whenever a call returns a 404 naming a model.

**Responses are cached** to `data/llm_cache/`, keyed on model, prompt, system prompt and
temperature. Rerunning a comparison re-reads them instead of paying again, which is what makes
a 220-resume run possible on a free tier. Changing the model invalidates the cache on purpose.

---

## 7. The build, stage by stage

`build_all.sh` runs these in order. Run one on its own only when you changed it; each reads
what the previous one wrote and writes to `data/`.

| Stage | Command | What it does | Time |
|---|---|---|---|
| A | `run.sh 01` | Read the 2,484 resume PDFs. The slow one, and the only one that touches the originals. Resumable. | ~3 min |
| B | `run.sh 02` | Clean the text, repair mangled characters, label the 9 sections. | ~1 s |
| C | `run.sh 03` | Cut each resume into 180-token chunks that never cross a section boundary. | ~20 s |
| D | `run.sh 04 --backend lsa` | Build the vector index for "find resumes like this one." | ~7 s |
| E | `run.sh 05` | Score retrieval by hiding a resume and asking if its category is found. 12,415 judgments. | ~35 s |
| F | `run.sh 06` | Load 9,065 O*NET names, build and calibrate aliases, extract skills from every resume. | ~60 s |
| G | `run.sh 08` | Score extraction against the 220-resume gold set. The headline accuracy numbers. | ~90 s |
| H | `run.sh 09 --limit 220` | The head-to-head: Dictionary Matcher versus the LLM Reader. Needs a key, section 6. | minutes |
| I | `run.sh 10 --company "Capital One"` | Mine required skills from job postings, so both sides of a match share a vocabulary. | ~2 min |
| J | `run.sh 11 --demo` | Match people to roles and roles to people, both directions. | seconds |

`build_all.sh` runs A, B, C, D, F and I, which is everything the app needs. E, G and H are
evaluation, run them when you want the numbers.

---

## 8. The other tools

| Tool | Command | What it does |
|---|---|---|
| Skills to learn next | `run.sh 14 --demo --postings data/interim/posting_skills_capital_one.jsonl` | Task 4: the skills a candidate is missing that would open the most roles. Also in the app. |
| Prompt-injection demo | `run.sh 15` | Reads the crafted resume in `docs/demos/`, shows both engines picking up hidden white-text skills, and flags the hidden text. |
| Video, task 1 | `python scripts/16_video.py --scan ~/Desktop` | Transcribe a recording and read its sentiment and career directions. Section 4. |
| List models | `run.sh 12` | Which model names your key can actually call. |

---

## 9. Evaluation and fairness

```bash
./scripts/run.sh 08                    # extraction accuracy vs the gold set
./scripts/run.sh 05                    # retrieval accuracy
./scripts/run.sh 13 --audit-only       # fairness, vocabulary only, ~30s
./scripts/run.sh 13 --limit 200        # fairness, the deterministic engine
./scripts/run.sh 13 --engine llm --limit 5   # fairness, the LLM engine (needs a key)
./scripts/run.sh 18 --data docs/demos/sentiment_sample.csv --scorer vader  # sentiment harness, sample
./scripts/run.sh 13 --search-header    # reproduce the defect this test found (F32)
```

Sentiment (task 1) is scored by `scripts/18_eval_sentiment.py` against a CSV of text and a -3 to +3 label. VADER is the baseline and needs no key; add a key for the LLM scorer. The MOSEI transcripts and labels come from the CMU-MultimodalSDK, which downloads from a CMU server, so gather them on a normal machine and export a `text,label` CSV, then point `--data` at it. `docs/demos/sentiment_sample.csv` is a tiny sample for checking the harness runs.

### The tests

```bash
pytest tests/ -q -m "not slow"    # about 275 tests, ~1.5 seconds
pytest tests/ -q                  # adds the slow UI tests
```

Same on both platforms.

---

## 10. Optional add-ons

Everything optional lives in one place: the bottom of `requirements.txt`. Uncomment the lines
you want and run `pip install -r requirements.txt` again. There is no separate install command
to remember.

- **Pretrained sentence embeddings** (the `st` embedding backend, and the mapper's
  `--map-backend st`). Uncomment `sentence-transformers`. It pulls in PyTorch, about 2 GB, and
  the model weights download from HuggingFace the first time you use it. Then:

  ```bash
  ./scripts/run.sh 04 --backend st      # build the index with it, downloads on first run
  ./scripts/run.sh 05                   # score every backend against each other
  ```

- **A heavier transcriber**, the reference openai-whisper (pulls in PyTorch). The default
  faster-whisper is already installed and covers the same models, so most people never need
  this. Uncomment `openai-whisper` if you want it.

Two system tools are not pip packages and are listed at the top of `requirements.txt`:
LibreOffice, for legacy `.doc` and `.odt` resumes, and `ffmpeg`, for the video backends.

---

## 11. The run wrapper

`./scripts/run.sh` (and `run.ps1` on Windows) runs any stage and keeps the whole session in a
log. Prefer it over calling Python directly.

```bash
./scripts/run.sh 09 --limit 220      # runs scripts/09_compare_extractors.py
./scripts/run.sh                     # lists the stages
```

It saves the run to `data/runs/latest.log` with stderr merged in order and API keys redacted,
so when you need help with a failure you point at that file instead of copying the terminal.
The name can be partial: `09`, `09_compare` and the full filename all resolve.

---

## 12. Packaging it for someone else

```bash
./scripts/package.sh
```

On Windows, run this in Git Bash. It runs the tests, excludes `.venv`, `data/` and `.env`,
scans every file for API-key patterns, and refuses to build a zip that contains a key.
`--no-tests` skips the test run; `--force` replaces an existing zip from the same day.

---

## 13. When something breaks

| What you see | What it means | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'pdfplumber'` | The venv is not active in this window | Activate it: `source .venv/bin/activate` |
| `CERTIFICATE_VERIFY_FAILED` | The python.org macOS builds ship without a CA bundle | Reinstall inside the venv: `pip install -r requirements.txt` (certifi is included) (F28) |
| `No module named 'faster_whisper'` | The install predates it becoming a default dep | Reinstall: `pip install -r requirements.txt` |
| `ffmpeg not found` | A Whisper backend cannot read the audio | Install ffmpeg (`brew install ffmpeg`), or use the `gemini` backend |
| `404 ... model does not exist` | Wrong model name, or one retired since | `./scripts/run.sh 12` (F29, F31) |
| `429 ... insufficient_quota` | Out of credits, not a rate limit | Add credits, or switch `LLM_PROVIDER` (F30) |
| `429` repeatedly, run continues | Rate limit, being handled | Lower `<PROVIDER>_RPM` in `.env` (F36) |
| Run dies partway through an LLM stage | Anything above | Rerun. Cached responses are reused, so you restart where you stopped |
| PowerShell will not run a `.ps1` | Execution policy | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` |

For anything else, the full log is in `data/runs/latest.log`. The codes above (F28, F30) are
entries in [BUILD_LOG.md](BUILD_LOG.md) with the full story.

---

## 14. Where the code lives

```
app.py                      the Streamlit UI (Resume mode and Video mode)
Launch TalentFlow.command   double-click launcher (macOS)
requirements.txt            all dependencies, required and optional, in one file
.env                        API keys and model settings (gitignored, never committed)

talentflow/
  config.py                 every path, relative to the repo
  ingest/
    pdf_loader.py           PDF -> raw text. Never raises; a bad file is recorded
    normalize.py            mojibake repair, unicode folding, dehyphenation
    sections.py             9 canonical sections with exact character offsets
    document.py             any format in: docx, doc, odt, rtf, txt, md
    hidden_text.py          finds invisible text, the prompt-injection defense (F43)
    corpus.py               both build stages, plus the quality report
  text/
    tokenize.py             technology-aware tokenizer, keeps C++ and .NET whole
    chunk.py                section-aware chunking
  embed/
    base.py                 the Embedder interface and backend registry
    sklearn_backends.py     tfidf (baseline) and lsa (dense)
    neural_backend.py       the 'st' sentence-encoder backend (optional package)
    index.py                cosine search, filters, save and load
    hybrid.py               rank fusion across backends
  skills/
    onet.py                 loads the O*NET vocabulary
    vocabulary.py           alias generation, calibration, matching
    build.py                the single entry point that builds the vocabulary
    extractor.py            LexicalExtractor, LLMExtractor, OnetMapper
    goldset.py              the 220-resume labeled set
  llm/
    client.py               Anthropic, OpenAI, Gemini behind one interface
  matching/
    profile.py              a resume or a posting, reduced to skills with evidence
    match.py                the scoring, both directions
    gaps.py                 task 4: which skills unlock the most roles
  video/
    transcribe.py           task 1: faster-whisper, openai-whisper, gemini transcribers
    analyze.py              task 1: sentiment and career directions from a transcript
  postings/
    load.py                 LinkedIn postings -> the same record shape as a resume
  eval/
    retrieval.py            Precision@k, leave-one-out, paired bootstrap
    extraction.py           scoring against the gold set, with a written diagnosis
    fairness.py             TC6: identity perturbation and the name collision audit
  report.py                 evidence highlighting and match summaries

scripts/
  01 through 16             the build stages and the tools
  build_all.sh / .ps1       the one-command build
  run.sh / run.ps1          the run wrapper, keeps a log
  package.sh                builds a shareable zip, refuses to include a key
tests/                      the test suite
docs/                       all documentation, and demos/ for the injection and video demos
data/                       everything generated, gitignored
```
