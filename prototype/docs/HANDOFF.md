# Where we left off

Written 2026-08-29 at the end of a long session. Read this first when picking the project
back up, then `STATUS.md` for numbers and `BUILD_LOG.md` for why anything is the way it is.

238 tests passing (`pytest tests/ -q -m "not slow"`).

---

## Read this first

**New here? [GLOSSARY.md](GLOSSARY.md) before anything else.** It defines the two extraction
engines and the difference between an engine, a provider and a model, which is what most
confusion has been about. Then [PIPELINE.md](PIPELINE.md) to run it.

## Where the project actually is

**The head-to-head is done.** That was the open question for five sessions and it is closed.
152 gold resumes, both engines, identical data (F37):

| engine | span detection | token coverage | hallucination |
|---|---|---|---|
| Dictionary Matcher | **57.4%** | 18.4% | 0%, impossible by design |
| LLM Reader (`gemini-3.5-flash-lite`) | 35.2% | **52.8%** | 0.18% produced, 0% after the check |

Against the vocabulary ceiling of 58.3%: Dictionary Matcher **98.4%**, LLM Reader 60.3%.

**TC6 fairness is measured, and it failed before it passed.** 40 of 40 resumes changed their
skills when the name on them changed, because O*NET contains vendor products named after
people. Fixed by excluding the header from skill search, now 2 of 200 (F32).

### The three things worth doing next, in order

1. **A pretrained sentence encoder, with a corrected expectation (F41).** The old note here
   said 527 skills came back unmapped and that they were `Java`, `SQL`, `C++`, `Jenkins`,
   `Selenium`. That is wrong for the current code, and it was checked: those all map now as
   exact aliases. Replaying F37's own cached responses through the current mapper, 18.4% of
   the LLM's skill mentions go unmapped, and they are modern tools (`HTML5`, `CSS3`,
   `AngularJS`), abbreviations (`VLAN`, `RSTP`, `RDBMS`), and terms O*NET simply lacks
   (`Log4j`, `Cucumber`, `Dell Boomi`, `Mainframe`). Unmapped skills become `weak` and are cut
   at the default `alias` filter, so this does pull LLM detection down. A sentence encoder can
   help the near-synonyms (`HTML5` -> `HTML`), not the terms O*NET has no entry for, so expect
   a few points, not a rewrite. Uncomment `sentence-transformers` in `requirements.txt` and
   reinstall (`pip install -r requirements.txt`) on the Mac, since HuggingFace is blocked in the
   build shells, then `python scripts/09_compare_extractors.py --map-backend st`.
   The Gemini responses are cached, so that run reuses them and costs nothing; only the mapper
   changes. Compare its detection to F37 before rewriting anything.
2. **One 2 to 3 minute recording.** Still the largest zero in the project and still blocked
   on nothing but a file existing. Task 1 is 4 of the proposal's 10 metrics and none of it
   can start until there is audio.
3. **Exhaustive-extraction prompt.** The LLM Reader returns 16 skills per resume against the
   Dictionary Matcher's 26. Its problem is selectivity, not capability, which is a prompt
   change rather than a model change. Open question 37.

### Providers, and what has actually been verified

`.env` is the only place keys live, with rotation links in the comments. `LLM_PROVIDER` picks
between them, `<PROVIDER>_MODEL` picks the model, `<PROVIDER>_RPM` sets the pacing.

| Provider | Key | Model | Verified? |
|---|---|---|---|
| Gemini | present | `gemini-3.5-flash-lite` | **Yes.** 152 resumes extracted, 2026-08-30 |
| OpenAI | present | `gpt-4o-mini` | Key valid, **account has no credits** |
| Anthropic | not obtained | `claude-sonnet-4` | Path exercised, no key |

Gemini free tier: 500 requests/day, 15/minute. The client paces itself to the minute limit and
caches every response, so a rerun of a finished comparison costs nothing.

**Rotate both keys when the project is done.** They were pasted into a chat transcript.

**Copilot is not an option**: an IDE assistant with no public API a script can call. GitHub
*Models* is the separate product that does.

## What is done

| Piece | State |
|---|---|
| Resume ingestion, 2,484 PDFs, any format | Done, measured |
| Tokenization, chunking, embeddings | Done, measured |
| O*NET vocabulary, 9,065 terms | Done, measured against the gold set |
| Lexical skill extraction | Done, 57.4% detection, 0.0% hallucination |
| **Matching, both directions** | **Done, unmeasured.** Needs 50 hand-labeled pairs |
| LLM skill extraction | **Run and measured.** F37 |
| Streamlit UI with an engine toggle | Done, plus an Under the hood tab showing tokenization |
| Skills from 29,067 job postings | Done |
| Company scoping | Done |

## What is not done

| Task | Blocked on |
|---|---|
| Matching accuracy | 50 hand-labeled pairs (a person's job) |
| ~~LLM comparison~~ | Done, F37 |
| LLM posting classifier | An API key |
| Video, sentiment, career directions | **No audio exists.** One 2 to 3 minute recording unblocks it. |
| Learning content, task 4 | No dataset sourced |

---

## Matching: BUILT (session 11)

```bash
python scripts/11_match.py --demo --postings data/interim/posting_skills_capital_one.jsonl
```

Both directions work. Scores are arithmetic over skill sets, so **TC6 is guaranteed rather
than tested**: a name is not a skill, so changing it moves the score by exactly zero. Every
result reports what no candidate in the pool has, which makes the corpus vintage gap visible
per match instead of letting it look like a poor fit.

**Unmeasured.** Accuracy needs the 50 hand-labeled resume and posting pairs the proposal
commits to. That is the next thing matching needs, and it is a person's job, not a script's.

Both sides live in one vocabulary:

- 2,542 distinct skills across 2,484 resumes
- 3,242 distinct skills across 29,067 technical postings
- **2,128 skills on both sides**, which is the matchable vocabulary

The design decisions are already made and recorded: ranking stays deterministic (D26, for
cost, reproducibility, and because TC6's fairness test can be *guaranteed* rather than hoped
for), the LLM explains the score rather than producing it, and ground truth is two-tier
(D29): a cheap proxy for iteration, plus 50 hand-labeled pairs for the number in the report.

---

## Company scoping, as it stands

Run:

```bash
python scripts/10_extract_posting_skills.py \
  --company "Capital One" --company Amazon --company DataAnnotation --company Microsoft
```

Output: `data/interim/posting_skills_amazon_capital_one_dataannotation_microsoft.jsonl`

| Company | Postings | Distinct skills | Read |
|---|---|---|---|
| **Capital One** | 254 | 111 | Best POC candidate. Python, SQL, Java, Scala, NoSQL, Docker, Kubernetes, Spark. A real engineering stack. |
| Amazon | 168 | 217 | Most varied. **But see the warning below.** |
| Microsoft | 35 | 114 | Small but clean. C#, C++, Java, JavaScript, Python. |
| DataAnnotation | 205 | 8 | **Do not use.** See below. |

### DataAnnotation is unusable, and now provably so

Every one of its 8 skills fires on exactly 205 postings. That is not a skill profile, it is
the same advert duplicated 205 times. It contributes no matching signal and would inflate
any corpus statistic it appears in.

### Amazon has an unresolved false positive

`Geographic information system GIS software` fires on **135 of 168** Amazon postings (80%).
That is almost certainly wrong and is the same class of bug as the Capital One ones fixed in
D42: an alias that sits below the pruning threshold globally but spikes inside one employer.
It was found at the end of the session and is **not fixed**.

Diagnose it the way the others were diagnosed:

```python
# which alias is actually firing?
import json
from collections import Counter
al = Counter()
for line in open("data/interim/posting_skills_amazon_capital_one_dataannotation_microsoft.jsonl"):
    r = json.loads(line)
    if r["company"] != "Amazon":
        continue
    for s in r["skills"]:
        if "Geographic" in s["name"]:
            al[s["matched_text"].lower()] += 1
print(al.most_common(5))
```

Then check it against the D42 rules: is the alias under 3 characters, is every token an
everyday English word, does it start or end with a function word? If it passes all three and
is still wrong, that is a **new** rule, and it belongs in the build log with its evidence.

---

## The recurring bug in this project, in one paragraph

The same mistake has now appeared four times in different clothes, and it is worth
recognising on sight because it will appear again.

**A threshold calibrated on one distribution is not valid on another, and pooling
distributions hides the problem instead of solving it.**

1. **X1**: a 12-query benchmark had 60 judgments, so one document moved the mean 1.7 points.
   It reported the *opposite* ranking to the 12,415-judgment benchmark.
2. **D39**: calibrating aliases on resumes left `equal employment` and `leverage` firing all
   over job postings. Pooling the two corpora diluted the rate; judging by the worst corpus
   fixed it, and also caught `experience in` at **41.6%**.
3. **D39 again**: technical postings needed to be their own corpus, because `apis` and
   `pipelines` are everywhere in engineering adverts and absent from warehouse adverts.
4. **D42**: `open source` and `one software` spike inside Capital One and vanish globally.
   Here the fix could *not* be another corpus split, because a company-specific vocabulary
   would break the comparison it exists to enable, so the rule had to become structural.

When a number looks wrong, ask what population it was calibrated on before asking whether the
code is broken.

---

## Two things the report has to say, and neither is optional

**1. The proposal's F1 target is not measurable as written.** The gold set annotators marked
*some* regions of each resume, not every skill in it, so a skill found in an unmarked region
is not a false positive and precision cannot be computed. Report span detection, vocabulary
ceiling and hallucination rate instead, and say why. This needs raising with Juan.

**2. The resume corpus is about five years older than the postings, and it biases every
match.** The most-demanded skills that *no* resume has are Terraform (599), Kafka (487),
Snowflake (372), Figma (210) and PyTorch (201). All went mainstream after the resumes were
collected. Candidates will appear to lack modern tooling because of dataset vintage, not
because of anything about the people. Options are restricting matching to the 2,128 shared
skills, reporting coverage alongside every match, or finding a newer resume set. **A team
decision, not a technical one.**

---

## Rebuilding from nothing

```bash
python scripts/01_extract_pdfs.py       # ~3 min, resumable
python scripts/02_build_corpus.py       # ~1 s
python scripts/03_build_chunks.py       # ~20 s
python scripts/04_build_index.py --backend lsa
python scripts/05_eval_retrieval.py     # retrieval numbers
python scripts/06_extract_skills.py     # resume skills
python scripts/08_eval_extraction.py    # accuracy vs the gold set
python scripts/10_extract_posting_skills.py   # posting skills
```

`data/` is gitignored and fully regenerable. `data/interim/posting_sample*.jsonl` are
calibration caches: **delete them after changing anything about the vocabulary**, or
calibration silently reuses stale samples.

## Candidate replacement datasets, evaluated

A ten-item list was reviewed in session 12. Summary: **item 3 is the corpus we already use**,
and the highest-value item is not a corpus at all.

**Do this first if you return to the data question:** verify whether
`huggingface.co/datasets/yashpwr/resume-ner-training-data` is human-annotated (check its
linked GitHub repo). It is token-level BIO tagged, which is normally exhaustive, and an
exhaustive gold set would make the proposal's F1 target measurable for the first time. That
is worth more than any corpus swap, because it fixes an unmeasurable claim rather than an
already-mitigated bias.

**Then**: test whether ResumeAtlas (13,389 resumes) overlaps our corpus. Its categories match
ours exactly, which suggests it may contain rather than replace the Kaggle set. Hash a sample
of our 2,484 against theirs; ten minutes, and it decides everything else.

Full evaluation in `BUILD_LOG.md` F26 and F27.

## Open questions

29 of them, at the end of `BUILD_LOG.md`. The three that matter most:

- **#17** Does the LLM beat 57.4% detection, and at what hallucination rate?
- **#25** Does the 2019 to 2024 vintage gap need a corrective?
- **#11** Does the embedding stage close the activity-phrasing gap (`Requirement Analysis`,
  `Test Planning`) that the Dictionary Matcher structurally cannot reach?
