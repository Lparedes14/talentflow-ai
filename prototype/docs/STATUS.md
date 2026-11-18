# Status

Last updated 2026-08-31. 265 tests (260 run anywhere; 5 slow ones need the O*NET folder).

## The four proposal tasks

| Task | State |
|---|---|
| 1. Video understanding (transcribe, sentiment, career directions) | **Built and demonstrated** (`video/`, script 16, app Video mode). Ran end to end on two real 4.3-minute clips (F44): clean transcripts plus grounded sentiment and career directions. For the word-error-rate number, transcribe one clip against a reference, or at two model sizes. |
| 2. Resume parsing and skill extraction | **Built and measured** |
| 3. Bi-directional skill matching | **Built, unmeasured.** Needs 50 hand-labeled pairs |
| 4. Skill gap to learning content | **Leverage ranking built and live** (`gaps.py`, script 14, app tool): the skills a candidate should learn next, ranked by what they unlock. The learning-content write-up is the optional LLM layer on top. |

Note for whoever is editing the proposal: it says "3 machine learning tasks" and then lists
four. Task 4 also has no metric in the metrics table while the other three do.

## Session 15 additions (2026-09-03)

Two more. The app now ships a prebuilt, calibrated vocabulary
(`talentflow/skills/onet_vocab.json.gz`, built by `scripts/17_build_vocab_cache.py`), so it
starts instantly and reads no resumes and no O*NET; that also let the full test suite, app
tests included, run to 289 green. And the sentiment half of task 1 is built:
`talentflow/eval/sentiment.py` plus `scripts/18_eval_sentiment.py` score accuracy, F1
(positive vs negative), and MAE with a VADER baseline and an LLM scorer. VADER runs offline;
the real numbers need the MOSEI transcripts, which come from the CMU-MultimodalSDK on a normal
machine as a text-and-label CSV.

## Session 14 additions (2026-08-31)

A fresh-model review added: a truncation alert on the LLM Reader (F39); a written diagnosis
from the extraction metric, missed regions and why (F40); the Task 4 leverage feature (D52);
a correction to the stale mapper claim plus a `--map-backend` flag (F41); LLM-path fairness
testing (F42); and a working prompt-injection demo with a hidden-text detector (F43).

Two runs are queued for a normal machine, because the build shells reach only Anthropic:
`scripts/09_compare_extractors.py --map-backend st` (reuses the cache, free) to see if a
sentence encoder lifts LLM detection, and `scripts/13_eval_fairness.py --engine llm --limit 5`
for the LLM fairness numbers.

## Against the proposal's 10 metrics

- **2 met**: hallucination 0.18% produced and 0.0% after the guardrail, against a 3%
  target, on both engines. Skill extraction head to head is complete (F37).
- **1 failed, then fixed, now 99%**: TC6 fairness. Measured for the first time in
  session 13 and it failed on 40 of 40 resumes. See F32. Do not describe this test as
  passing without the 1% residual beside it.
- **1 not measurable as written**: skill extraction F1, see below
- **1 partially done**: retrieval P@5, measured resume-to-resume rather than resume-to-posting
- **7 not started**: video, sentiment, career directions, both matching directions

Of the 10 test cases, only TC3 (messy layout), TC8 (unknown skill) and TC10 (thin resume) are
runnable today. The rest need matching or video.

## Measured accuracy

Scored against the 220-resume labeled gold set: 152 resumes with usable annotations, 432
marked skill regions.

| Metric | Result |
|---|---|
| Span detection rate | 57.4% |
| Vocabulary ceiling | 58.3% |
| **Detection against ceiling** | **98.4%** |
| Hallucination rate | **0.0%** (0 of 3,927), target was 3% |

**The third row is the finding.** The matcher finds essentially everything the O*NET
vocabulary makes findable. Smarter matching would buy at most 1.5 points; the whole remaining
gap is vocabulary coverage. That is the quantified case for the LLM extraction stage, and it
says clearly what not to work on next.

**Precision is not computable from this dataset, and the report has to say so.** Annotators
marked some regions of each resume, not every skill in it, so a skill found in an unmarked
region is not a false positive. **The proposal's "F1 at or above 0.75" target is not
measurable as written.** Needs raising with Juan: report what was measured and why, rather
than publishing a different number under the old name.

## Retrieval

Leave-one-out over 2,484 resumes, 12,415 judgments, paired bootstrap.

| system | P@5 | vs tfidf |
|---|---|---|
| tfidf (baseline) | 0.3228 | n/a |
| lsa, 128 dims | 0.3386 | +1.59 pts, CI95 [+0.62, +2.51] |
| hybrid rrf | 0.3410 | +1.83 pts, CI95 [+1.01, +2.58] |

Two caveats for the report. The proposal's 10-point threshold is **untested, not failed**: it
was written for neural embeddings and this environment blocks Hugging Face. And an earlier
12-query benchmark gave the opposite ranking on 60 judgments, which is written up as X1 in
the build log.

## Environment constraints

The egress proxy denies `onetcenter.org`, `huggingface.co`, and
`openaipublic.blob.core.windows.net` (tiktoken's vocabulary, which is why we wrote our own
tokenizer). PyPI and GitHub are reachable.

## Blocked

- **API access decision.** Blocks steps 2, 4 and 5 of the build order.
- **LinkedIn skills are unusably coarse.** `job_skills.csv` maps postings to 35
  abbreviations, not skill names. The posting side needs skills mined from descriptions.
- **CMU-MOSEI** and the 20 team recordings, for the video track.
- **No learning-content dataset** sourced for task 4.

## Next

Ranked by what each unlocks, not by effort:

1. **Record 2 to 3 minutes of audio.** Ten minutes of one person's time, and it is the only
   thing standing between this project and 4 of its 10 metrics. Nothing about task 1 can be
   built, tested or demonstrated until one file exists. It is the largest zero on this page
   and the cheapest to clear.
2. ~~TC6 fairness.~~ **Done, session 13, and it failed before it passed.** See F32. The
   remaining work is a paragraph in the report, not code.
3. **50 hand-labeled resume-to-posting pairs.** Turns matching from built into measured.
   This is a person's judgment, not a script, and it is Juan's to scope as QA lead.
4. **The LLM posting classifier**, once a provider actually answers.

Sixteen open questions are listed at the end of `BUILD_LOG.md`.
