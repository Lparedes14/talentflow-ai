# What is built, and what it measures

One section per piece, with the defects found and the numbers measured.
The reasoning behind each choice is in `BUILD_LOG.md`.

## Skill extraction, head to head (2026-08-30)

152 gold resumes, both engines, identical data. `gemini-3.5-flash-lite`, temperature 0.0,
83 live calls plus 69 cached. Full analysis in BUILD_LOG F37.

| engine | span detection | token coverage | hallucination | matches |
|---|---|---|---|---|
| lexical | **57.4%** | 18.4% | 0.0% after the guardrail | 3,927 |
| llm | 35.2% | 52.8% | 0.18% produced, 0.0% after | 2,085 |

Detection against the vocabulary ceiling (58.3%): Dictionary Matcher **98.4%**, LLM Reader 60.3%.

**Read the two columns together or not at all.** The LLM finds fewer of the marked regions
and covers far more of each one it finds. Its token coverage is partly inflated by quoting
whole sentences (median quote 9 words), so treat 52.8% as directional.

**Do not write "the LLM is worse at extraction."** This is one small model on one prompt.
The model was chosen for its free-tier allowance, not its accuracy. See open questions 36
and 37.


## Piece 1: ingestion

2,484 Kaggle resume PDFs across 24 categories. Working from the PDFs, not the shipped CSV.

**Five defects found in the data, all fixed:**

| Defect | Example | Fix |
|---|---|---|
| Double-encoded UTF-8 | `â€“` for an en dash | ftfy |
| Truncated UTF-8 | `ï¼` -- third byte dropped by the PDF | corpus-specific rule; ftfy can't, nothing valid is left to decode |
| Zero-width characters | invisible, split tokens | stripped first |
| `U+FFFD` as a bullet | `� Oversees accounting` | dropped at line start, kept mid-word |
| Bullet regex ate blank lines | -- | `[^\S\n]`; section detection needs paragraph breaks |

Mid-word `U+FFFD` is kept on purpose. Deleting it would hide real data loss, so it is
counted instead and reported.

**Section segmentation** uses an explicit header allowlist, not a heuristic. These resumes
put bare skill names on their own short title-case lines ("Microsoft Office"), so any
"short line looks like a header" rule shreds the skills section.

**Quality, all 2,484:** 0 extraction errors. 1 empty (`12632728`, a scanned image with no
text layer). 6 resumes with residual artifacts, 21 characters total. Median 759 words.
Coverage: experience 99.4%, education 98.7%, skills 98.2%, summary 89.6%.

## Piece 2: tokenization, chunking, embeddings

### Tokenizer

A `\w+` tokenizer turns `C++` into `c` and `P&L` into `p` + `l`. On this corpus that
silently deletes 650+ real skill mentions before anything downstream can see them.

| Term | ours | `\w+` |
|---|---|---|
| c++ | 147 | 0 |
| c# | 121 | 0 |
| .net | 93 | 0 |
| asp.net | 80 | 0 |
| tcp/ip | 87 | 0 |
| e-commerce | 106 | 0 |
| p&l, r&d, at&t | kept | 0 |

The pattern is greedy, then refined, because a greedy match can be split afterwards while a
lost one cannot be recovered. Two greedy matches get undone:

- **Slash lists.** `Word/Excel/PowerPoint/Visio` is a tool inventory, not a name. Kept
  whole it matches nothing. Split -- except for genuine slash terms (`CI/CD`, `TCP/IP`,
  `P/L`), which are named explicitly.
- **Dotted run-ons.** PDF extraction drops the space after a period, so `AutoCAD. Created`
  arrives as `autocad.created` and looks exactly like `asp.net`. Real ones have a known
  suffix; run-ons do not.

Every token carries char offsets, because the proposal requires each extracted skill to
cite the text supporting it. Offsets make that exact; re-searching for the text later can
land on the wrong occurrence.

Corpus: 2,005,324 tokens, 45,913 vocabulary, median 755 tokens per resume.

### Chunking

24,534 chunks, mean 9.9 per resume, 180-token target. Three rules: never cross a section
boundary, never cut mid-sentence, always carry offsets. Oversized single lines -- the
Skills section is often one comma-separated line hundreds of tokens long -- split at token
boundaries, so `PowerPoint` never gets sliced in half.

### Retrieval results

Leave-one-out over all 2,484 resumes: each resume queries for others in its own category.
12,415 judgments. Paired bootstrap, 2,000 resamples.

| system | P@5 | vs tfidf |
|---|---|---|
| tfidf (baseline) | 0.3228 | -- |
| lsa, 128 dims | 0.3386 | **+1.59 pts**, CI95 [+0.62, +2.51] |
| hybrid rrf | 0.3410 | **+1.83 pts**, CI95 [+1.01, +2.58] |

Hybrid over LSA alone is +0.24 points, CI95 [-0.45, +0.86] -- within noise. The dense
representation is doing the work; fusion adds nothing measurable.

**Read this honestly.** The dense backend beats the Dictionary Matcher baseline significantly but by
under 2 points. The proposal sets a 10-point bar, and LSA does not clear it. That bar was
written for *neural* embeddings, which are untested here: this environment's egress blocks
Hugging Face, so sentence-transformers weights cannot be fetched. The backend registry has
a slot for it and nothing else has to change.

Why LSA gains so little: TF-IDF's power on this task comes from rare discriminative terms
(`blueprints`, `photoshop`, `litigation`), and truncated SVD spends its axes on *common*
variance, so those terms load weakly and blur. Where LSA clearly wins is vocabulary
mismatch -- querying `MS SQL database administration` it ranked a real `SQL Server 6.5, 7,
2000` chunk first at 0.588, where TF-IDF scored 0.327 on a chunk that merely repeated the
letters SQL. Different failure modes, which is why they were worth fusing even though the
fusion did not pay off here.

**On benchmark size.** An earlier version used 12 hand-written queries -- 60 judgments, so
one document moved the mean by 1.7 points. On that benchmark TF-IDF "won" 0.717 to 0.667,
which was noise reported as a result. It survives as `--quick` for smoke testing only.

## Piece 3: skill vocabulary and the Dictionary Matcher

The proposal's `O*NET word match` baseline. No model, no embeddings: a controlled
vocabulary and longest-match-first scanning. Its value is that it is fast, fully
explainable, and every hit carries the exact span that produced it.

### Vocabulary

9,065 terms from 8 O*NET 31.0 tables. 8,753 are concrete tools (`Microsoft Excel`,
`Atlassian JIRA`); the rest are the broad taxonomy (abilities, knowledge, work activities).
Ratings columns are left behind - they say how much an occupation needs a skill, not what
the skill is called.

### The problem that shaped this piece

O*NET writes tools vendor-first and resumes do not:

| resume writes | O*NET writes |
|---|---|
| AutoCAD | Autodesk AutoCAD |
| QuickBooks | Intuit QuickBooks |
| Photoshop | Adobe Photoshop |
| SQL | Structured query language SQL |

Exact matching finds almost none of them. So every term also indexes under its trailing
subsequences. That in turn yields `word` from `Microsoft Word`, which would match every
resume in the corpus, so an alias has to pass two tests to be admitted - see
`BUILD_LOG.md` F11 for the calibration table showing why one test is not enough.

### Calibration

The vocabulary is **fitted to the corpus**, not just loaded. Aliases that fire on more than
2% of resumes must point at a term used by at least 10 occupations. This removed 81 aliases,
including `proficient` (21.7% of resumes, resolving to a product used by 2 occupations) and
`project management` (22.3%, resolving to Oracle Primavera).

Calibration iterates to a fixed point, because the matcher is longest-match-first and
pruning one alias uncovers shorter ones beneath it.

### Confidence

Some ambiguity has no threshold. O*NET really does contain `Go`, `R`, `C`, `Design` and
`Writing`. Matches are therefore tagged `exact`, `alias`, or `weak`, and resume extraction
excludes `weak` by default.

### Results, all 2,484 resumes

| Metric | Result |
|---|---|
| Skills per resume | median 5 (p25 3, p75 9, p95 19, max 64) |
| Resumes with no skills | 81 (3.3%) |
| Matches by confidence | exact 8,163 / alias 20,137 |
| Matches by category | technical 25,301 / soft 2,963 / process 36 |

Only 36 process matches, which is an open question - work activities are long descriptive
phrases resumes never write verbatim. That is exactly the gap embeddings should close.

**Precision is unmeasured.** Everything above was verified by inspection, which finds gross
errors but does not produce a number. That needs the labeled gold set.

## Any resume, any format

`.pdf`, `.docx`, `.doc`, `.odt`, `.rtf`, `.txt`, `.md`. Legacy `.doc` converts through
LibreOffice. `.docx` tables are read as well as paragraphs, because many resume templates
lay the whole document out in a borderless table and a paragraphs-only read returns nothing.

```bash
python scripts/07_analyze_resume.py ~/Documents/my_resume.pdf --show-evidence
```

A user's resume flows through the identical code path as the corpus, so the demo cannot
behave differently from the thing we measured.


## Measured accuracy, against the 220-resume gold set

`scripts/08_eval_extraction.py`. Read `talentflow/eval/extraction.py` before interpreting it.

**Precision is not computable from this dataset.** Annotators marked some regions of each
resume, not every skill in it, so a skill found in an unmarked region is not a false
positive. The proposal's F1 target is not measurable as written. What is reported instead:

| Metric | Result |
|---|---|
| Span detection rate | 57.4% |
| Vocabulary ceiling | 58.3% |
| **Detection against ceiling** | **98.4%** |
| Hallucination rate | **0.0%** (0 of 3,927 matches), target was 3% |

152 resumes with usable skill annotations, 432 annotated regions.

**The third row is the finding.** The matcher finds essentially everything the vocabulary
makes findable, so the remaining gap is O*NET coverage, not matching logic. Smarter matching
would buy at most 1.5 points. That is the quantified case for the embedding stage, and it
says clearly what not to work on next.

Three gotchas in the gold set, all silent, all documented in `talentflow/skills/goldset.py`:
its `end` offsets are inclusive (so normal Python slicing truncates every span), 6.3% of
points have broken offsets, and the annotation unit is inconsistent.

## Job postings: what roles demand

29,067 technical postings (LinkedIn `IT` and `ENG` codes), extracted with the same engine
that reads resumes. A posting is loaded into the same record shape a resume becomes, so both
sides of a future match speak one vocabulary.

| Metric | Result |
|---|---|
| Postings extracted | 29,067 |
| Skills per posting | median 5 (p25 3, p75 8, p95 15, max 68) |
| Postings with no skills | 1,174 (4.0%) |
| Matches | technical 242,253 / soft 18,113 / process 43 |

Top demanded: Troubleshooting, Python, SQL, Java, Google Analytics, RESTful API, JavaScript,
Linux, Git, Kubernetes, C#, C++, Docker, Jenkins CI.

### This run invalidated the vocabulary we had been using

The first extraction returned `Equal employment opportunity EEO compliance software` as a
top demanded skill, matching on the equal-opportunity paragraph nearly every posting carries.
Alongside it: `leverage`, `translate`, `automation`, `pipelines`, `apis`. All common in
job-advert prose, all rare in resumes, so resume-only calibration had never questioned them.

Fixing it required judging each alias by the **highest** rate it reaches in any single
corpus rather than the pooled rate. Pooling dilutes: an alias firing on 9% of postings and
no resumes averages to 0.7% and survives. That change also pruned `experience in`, which at
**41.6%** had been firing on nearly half of all documents since Piece 3.

Full reasoning in `BUILD_LOG.md` D39. The general lesson, worth carrying into the report: a
threshold calibrated on one distribution is not valid on another, and pooling hides the
problem rather than solving it.

### The two sides do not share a vocabulary

| | count |
|---|---|
| Distinct skills demanded by postings | 3,242 |
| Distinct skills held by resumes | 2,542 |
| **On both sides, so matchable** | **2,128** |
| Demanded but held by nobody | 1,114 |

The most-demanded skills **no resume in the corpus has**: `IBM Terraform` (599),
`Apache Kafka` (487), `Snowflake` (372), `Figma` (210), `PyTorch` (201).

Every one became mainstream *after* the resume corpus was collected. The Kaggle resumes are
from around 2019; the postings are 2023 to 2024. **This is a systematic bias in any matching
result, and the report must state it:** candidates will appear to lack modern tooling because
the corpus predates it, not because of anything about the people. It also sets a ceiling, as
no matching method can match a skill present on only one side.

## Scoping to one company

An internal talent marketplace is one company. Matching across all of LinkedIn is a job
board. **The highest-volume posters in this dataset are not employers**: Dice (343),
TEKsystems (256), Apex Systems (221), Insight Global (174) are staffing agencies with no
internal workforce.

Real employers:

| Company | All | Technical | Titles | Notes |
|---|---|---|---|---|
| **Capital One** | 496 | **254** | 183 | 51% technical, 960-word descriptions |
| Amazon | 343 | 168 | 286 | most varied titles |
| Wells Fargo | 388 | 84 | 235 | broad, less technical |
| Cogent Communications | 476 | 207 | 69 | 82% duplicate titles |
| DataAnnotation | 265 | 205 | 11 | 97% duplicates, effectively 7 adverts |

Recommendation is **Capital One**: highest technical volume, a genuine 51/49 technical to
non-technical split so cross-function mobility is demonstrable, and the richest descriptions.

```bash
python scripts/10_extract_posting_skills.py --company "Capital One"
```

Company runs write their own output files and never overwrite the full corpus.

### What scoping to one company exposed

Three aliases that calibration is structurally unable to catch, because they sit under the
2% threshold globally and spike only inside one employer:

| alias | resolves to | at Capital One | across all technical postings |
|---|---|---|---|
| `es` | Exact Software Macola ES | 48% | 0.9% |
| `open source` | Open Source Matters Joomla! | 37% | 1.2% |
| `one software` | ONE Software KidsONE | 21% | 0.4% |

`one software` comes from "Capital **One** **Software** Engineer". Recalibrating per company
would have fixed it and broken the shared vocabulary, so the fix is structural: a derived
alias must be at least 3 characters, and **a name made entirely of everyday words is not a
name**. Full reasoning in `BUILD_LOG.md` D42, including why an occupation-count rule was
rejected (it would delete Snowflake, PyTorch and TensorFlow).

Separately, **a company's own name contaminates its profile**: Ingersoll Rand's postings all
returned `Rand McNally World Digital Database`.

**Capital One after the fixes**: Python (181), SQL (132), Java (127), Scala (110), NoSQL
(100), Docker (88), Kubernetes (86), JavaScript, Node.js, Apache Spark, HTML, CSS, RESTful
API, Kafka, Hive, Linux, PyTorch. The first output in this project that can be checked
against outside knowledge rather than only against itself.

## The technical skills list

Already in hand, and no external source is needed. Of 9,065 O*NET terms, **8,917 are
technology or technical knowledge** (8,753 concrete tools, 131 categories, 33 knowledge
areas). `load_vocabulary(technical_only=True)`, or `--technical-skills-only` on script 10.

**Off by default, deliberately.** Postings genuinely demand Troubleshooting, Attention to
Detail and Time Management, and a candidate who has them should get credit.

Modern tooling is present: Terraform, Kafka, Snowflake, Figma, PyTorch, Kubernetes, Docker,
Airflow, TensorFlow, React, Git. So the vintage gap noted above is a property of the 2019
resume corpus, not of the vocabulary.

## What is not done

See [STATUS.md](STATUS.md), which tracks that against the proposal's four tasks, ten metrics and ten test cases.
