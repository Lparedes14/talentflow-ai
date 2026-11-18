# Where the LLM goes

Architecture decisions from 2026-08-29. Full reasoning is in `BUILD_LOG.md` as D24 through
D30; this is the summary for the team.

Everything built so far is deterministic: word matching, TF-IDF, SVD. That was the right
order, because the proposal requires a baseline any LLM result has to beat. This page is
where the LLM gets added, and where it deliberately does not.

## The placement map

| Stage | Engine | Why |
|---|---|---|
| Read the document | deterministic | No judgment involved |
| Sections, tokens, chunks | deterministic | Rules, measured, reproducible |
| Skill extraction | **both, toggleable** | This is the head-to-head |
| Map free text to O*NET | **LLM over retrieval** | This is the RAG box |
| Posting to required skills | **both, toggleable** | Same component, other input |
| Classify technical postings | **LLM, offline** | A labeling function, run once |
| Fit score and ranking | deterministic | Cost, reproducibility, TC6 fairness |
| Explanation of the match | **LLM** | Irreducibly generative |
| Transcription | Whisper (not an LLM) | Speech recognition |
| Sentiment, career directions | **LLM** | Runs on the transcript, after Whisper |

**Correction worth recording:** Whisper is speech recognition, not a language model. The LLM
work in task 1 happens afterwards, on the transcript. The proposal's metrics table already
separates them (word error rate vs sentiment accuracy), so conflating them would misreport
two different results.

## D24. Two extraction engines, one interface, a UI toggle

Joel's proposal. Right for three reasons beyond the obvious one.

1. **It is already a contract deliverable.** The team contract gives Juan "the head-to-head
   comparison of our two solutions". A UI toggle is that comparison made visible instead of
   buried in a notebook.
2. **The codebase is already shaped for it.** The embedding layer is one interface with two
   backends, so evaluation scores both through identical code with the vector as the only
   variable. Extraction copies that exact pattern: a `SkillExtractor` interface, a Dictionary Matcher
   implementation and an LLM implementation, scored by the same harness unchanged.
3. **The headroom is already measured.** The Dictionary Matcher reaches 98.4% of its vocabulary
   ceiling, and the misses are `Mainframe` (absent from O*NET) and `Requirement Analysis`
   (present but formally phrased). Both are things an LLM handles well. The LLM goes where
   the measurement says the value is, not where the syllabus says to put one.

### Built, 2026-08-29

Both engines exist behind one `SkillExtractor` interface and are scored by one harness
(D35). The UI has an engine toggle plus a "Compare engines" tab. Everything runs and is
tested without an API key, using a mock client.

**Provider is Anthropic, decided by measurement not preference (D31):** this environment's
egress proxy reaches `api.anthropic.com` and denies `api.openai.com`.

**The prompt requires a verbatim quote for every skill (D32).** That gives LLM results the
same character offsets Dictionary Matcher results have, makes hallucination detectable automatically,
and reduces it at the source. A skill whose quote is not in the document is dropped and
counted.

**Responses are cached on disk (D33)**, keyed on model, prompt, system prompt and
temperature, so iterating on the prompt does not re-bill and a scored run is reproducible
offline.

**Still unmeasured:** the comparison needs an API key. Everything else is ready.

## D25. RAG's job is mapping free text onto the O*NET vocabulary

Before this decision, retrieval had no role in the extraction path. The vector index existed
and was measured, but nothing downstream used it, which made the Week 4 RAG box the least
justified part of the architecture.

When the LLM returns "Mainframe administration", that string still has to reach the shared
vocabulary or matching breaks, because matching only works when both sides speak one
language. The flow: embed the extracted phrase, retrieve the nearest O*NET candidates from
the index, let the LLM pick one or answer "unmapped". That is retrieval-augmented generation
doing actual work, and it satisfies TC8 directly: "reported as unmapped, never dropped in
silence".

## D26. Ranking stays deterministic. The LLM explains the score, never produces it.

Cost and reproducibility both matter, but fairness is what decides it.

TC6 requires the match score to move under 5 points when the name, pronouns and school
change, and the top 5 order to hold. With a numeric scorer over skill vectors that is
**guaranteed**, because identity terms are not in the vector. With an LLM producing the score
it is a property you can only hope for and then test. The prototype makes fairness claims on
screen, so it needs to be a guarantee.

## D27. LLM as a labeling function for technical postings

Joel's idea: have the LLM read postings and classify them as technical, rather than writing
our own filter rules. Run once, offline, cached as a column. Adopted with two conditions.

**A labeling function needs its own validation.** If the LLM labels the data and nobody
checks it, every matching result rests on unverified labels, and a bad labeler would look
exactly like a bad matcher. Hand-label a sample, report agreement, then use the labels.

**Which produces a second experiment, effectively for free.** Three sources of truth exist
for "is this posting technical": LinkedIn's own `IT` and `ENG` skill codes, the LLM's
classification, and a human sample. Comparing all three answers a question worth reporting:
*does an LLM label better than the platform's own metadata?* Publishable either way, and it
fits Juan's contract role running the LLM-as-a-judge harness.

**Cost design: classify on titles first.** 124,000 full descriptions is roughly 124M input
tokens. Titles are about five words, so the whole set is on the order of 1M tokens, cents
rather than tens of dollars, and a title carries most of the signal for this question.
Descriptions get read only for the ambiguous tail.

**Also the safest first place to put an LLM.** One label per row, errors visible at a glance,
a human can check a hundred in fifteen minutes. Compare that to extraction, where an error
hides inside a list of 40 skills.

## D28. Filter to technical roles for the POC

For evaluation clarity, not for compute. Matching a CHEF resume against engineering postings
produces noise that then has to be explained away. The resume corpus has 120
INFORMATION-TECHNOLOGY and 118 ENGINEERING resumes to match against.

Built parameterized, so extending to all 24 categories is a flag rather than a rewrite.

## D29. Two-tier ground truth for matching

Matching needs relevance labels, and LinkedIn postings carry no Kaggle category label.

- **A cheap automatic proxy** (LinkedIn skill codes mapped onto resume categories, or the
  LLM labels from D27) for fast iteration. Runs on every change.
- **50 hand-labeled resume and posting pairs, double-annotated**, for the number that goes in
  the report. Already committed to in the proposal.

Same shape as the retrieval evaluation, for the reason X1 taught: a proxy you can run hourly
guides the work, and a small trustworthy set is what you actually defend. The mistake to
avoid is reporting the proxy as though it were the trustworthy one.

## D30. The agent wraps what exists. No multi-agent yet.

The contract gives Luis "the orchestration that routes between the extraction, matching,
assessment and planning tools".

**The modules built so far are those tools.** `load_resume`, `match_resume`,
`VectorIndex.search` and `evaluate_extraction` are tool definitions waiting for a wrapper.
The "no LLM yet" gap is narrower than it appears, because the layer an agent calls is the
layer that already exists and is tested.

Multi-agent routing is deferred. One well-prompted call, measured against the baseline,
comes first; a second pass gets added if and only if the measurement asks for it.
Multi-agent systems are easy to build and hard to evaluate, and this project is graded on
evaluation.

## Build order

1. Mine skills from technical postings, using the extractor that already exists
2. LLM labeling function (D27) with its validation sample
3. Matching, both directions, against the proxy ground truth (D29)
4. LLM Reader behind the toggle (D24) with RAG mapping (D25)
5. Explanations

The video track (task 1) is independent of all of this and can run in parallel.

## Blocking decision

**An Anthropic API key.** Step 4 is built and tested; it needs a key to produce a number.
Step 2 (the labeling function) needs the same key.

Put it in a `.env` file at the project root, copying `.env.example`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

`.env` is gitignored. The team contract is explicit that keys never go in GitHub.

Then:

```bash
python scripts/09_compare_extractors.py --limit 20   # a cheap first look
python scripts/09_compare_extractors.py              # the full gold set
```

Responses cache to disk, so a rerun costs nothing.
