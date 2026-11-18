# TalentFlow prototype

Resume in, skills out, matched against real job postings, with the evidence for every claim.
Built for ISM6422 piece by piece, each stage small enough to test on its own.

Maps onto the course build order: **tokenization and embeddings (Week 2), RAG retrieval
(Week 4), prompts and extraction, agent and tools (Week 5), reflect and evaluate (Week 7).**
Which course concept lives where in the code is in
[docs/COURSE_CONCEPTS.md](docs/COURSE_CONCEPTS.md).

## Try it in two minutes

**macOS:** double-click `Launch TalentFlow.command` in Finder. It builds a private Python
environment inside this folder and opens the app in your browser. First run takes a couple of
minutes; after that, seconds.

**Windows:**

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
streamlit run app.py
```

Upload any resume (`.pdf`, `.docx`, `.doc`, `.odt`, `.rtf`, `.txt`, `.md`) and you get the
extracted skills, the evidence for each highlighted in your original text, the section
breakdown, and the nearest resumes in the 2,484-resume reference set.

Everything installs into `./.venv`. Deleting that folder undoes it; your system Python is
never touched.

**Full setup and command-line instructions, macOS and Windows, are in
[docs/PIPELINE.md](docs/PIPELINE.md).**

## Documentation

| Read this | When |
|---|---|
| [**GLOSSARY.md**](docs/GLOSSARY.md) | A word does not make sense. Every term defined, each tied to the lecture it came from. |
| [**PIPELINE.md**](docs/PIPELINE.md) | You want to run it. Setup, every stage explained, troubleshooting, code layout. |
| [**HOW_IT_WORKS.md**](docs/HOW_IT_WORKS.md) | You are new, or writing the report or the presentation. Plain language, no jargon. |
| [**HANDOFF.md**](docs/HANDOFF.md) | You are picking this back up after a break. What is blocked and what to do first. |
| [**STATUS.md**](docs/STATUS.md) | What is done, what is measured, what is blocked, against the proposal. |
| [**RESULTS.md**](docs/RESULTS.md) | The numbers, and the defects found in the data. |
| [**COURSE_CONCEPTS.md**](docs/COURSE_CONCEPTS.md) | Every concept from the lectures, and whether we used it, diverged from it, or skipped it. |
| [**ARCHITECTURE_DECISIONS.md**](docs/ARCHITECTURE_DECISIONS.md) | Where the LLM goes, and where it deliberately does not. |
| [**BUILD_LOG.md**](docs/BUILD_LOG.md) | The reasoning behind everything, in the order it happened. Decisions with their rejected alternatives, findings with numbers, and the reversals. |

The build log is the running record. **Add to it in the same commit as the change it
describes.** Entries are tagged **D**ecision, **F**inding or **X** (reversal). Reversals are
never deleted, because they are the only record of a mistake we would otherwise repeat.

## Quick reference

| | macOS and Linux | Windows |
|---|---|---|
| Build everything, once | `./scripts/build_all.sh` | `.\scripts\build_all.ps1` |
| The app | `streamlit run app.py` | `streamlit run app.py` |
| Video, task 1 | `python scripts/16_video.py --scan ~/Desktop` | `python scripts\16_video.py --scan .` |
| Run a stage, keep the log | `./scripts/run.sh 09 --limit 220` | `.\scripts\run.ps1 09 --limit 220` |
| One resume | `./scripts/run.sh 07 my_resume.pdf` | `.\scripts\run.ps1 07 my_resume.pdf` |
| Tests | `pytest tests/ -q -m "not slow"` | `pytest tests/ -q -m "not slow"` |
| Package a zip | `./scripts/package.sh` | `./scripts/package.sh` (Git Bash) |

The run wrapper saves the full session to `data/runs/latest.log` with keys redacted. Point at
that file when you need help with a failure, rather than copying out of the terminal.

## Two engines, and only one of them needs a key

TalentFlow extracts skills two ways, so we can measure what each is worth.

- **The Dictionary Matcher** looks each word up in a fixed list of 9,065 official skill names
  from the US Department of Labor. No key, no network, no cost, and it cannot invent a skill.
- **The LLM Reader** asks a language model to read the resume and quote the text that proves
  each skill. Needs a key, costs quota, and can name skills no list contains.

Both are defined properly, with the lecture material behind each, in
[docs/GLOSSARY.md](docs/GLOSSARY.md). The Dictionary Matcher runs out of the box; everything
below is only needed for the LLM Reader.

To turn it on, copy `.env.example` to `.env` and fill in one key. Anthropic, OpenAI and
Gemini are all supported. `.env` is gitignored, and the team contract is explicit that keys
never reach GitHub.

Setup, model choice and rate limits are covered in
[docs/PIPELINE.md, section 5](docs/PIPELINE.md#5-turning-on-the-llm-engine).
