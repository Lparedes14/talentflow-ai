# Documentation

Ten documents, which is a lot. This page is how you avoid reading nine of them.

**New to the project? Read [GLOSSARY.md](GLOSSARY.md) first.** It is short, it defines
every term the other documents use, and it ties each one back to the lecture where the
idea came from.

## Find what you need

| I want to... | Read |
|---|---|
| Understand a word I keep seeing | [GLOSSARY.md](GLOSSARY.md) |
| Run it, on a Mac or on Windows | [PIPELINE.md](PIPELINE.md) |
| Understand what it does, in plain language | [HOW_IT_WORKS.md](HOW_IT_WORKS.md) |
| Pick the project back up after a break | [HANDOFF.md](HANDOFF.md) |
| Know what is done and what is left | [STATUS.md](STATUS.md) |
| Quote a number in the report | [RESULTS.md](RESULTS.md) |
| Show the work maps onto the course | [COURSE_CONCEPTS.md](COURSE_CONCEPTS.md) |
| Explain where the LLM fits | [ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md) |
| Know why something was built the way it was | [BUILD_LOG.md](BUILD_LOG.md) |
| Fix an error I am seeing | [PIPELINE.md, section 8](PIPELINE.md#8-when-something-breaks) |

## What each one is for

**[GLOSSARY.md](GLOSSARY.md)** defines the vocabulary, including the two extraction
engines and the difference between an engine, a provider and a model. Every entry says
where the idea appears in the lectures, so it doubles as revision.

**[PIPELINE.md](PIPELINE.md)** is the manual. Setup for both platforms, every pipeline stage
with an explanation of what it actually does, the LLM configuration, evaluation, packaging, a
troubleshooting table, and the code layout. If you only read one, read this.

**[HOW_IT_WORKS.md](HOW_IT_WORKS.md)** explains the ideas rather than the commands, with no
jargon. Written for the report and the presentation.

**[HANDOFF.md](HANDOFF.md)** is the "where were we" document. What is blocked, what to do
first, what has never been run.

**[STATUS.md](STATUS.md)** tracks the prototype against the proposal's four tasks, ten
metrics and ten test cases. This is where you find out that a metric is not measurable as
written, before a grader does.

**[RESULTS.md](RESULTS.md)** holds the measured numbers and the defects found in the data.
**Quote from here, not from memory.** These numbers have gone stale before, once (F33).

**[COURSE_CONCEPTS.md](COURSE_CONCEPTS.md)** maps every concept in the two lecture decks onto
the code, labeled BUILT, DIVERGED, NOT USED or GAP. The requirement is that the solution be
built on class concepts, so this is the document that proves it.

**[ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md)** is the short argument for where
the LLM belongs and where it deliberately does not.

**[BUILD_LOG.md](BUILD_LOG.md)** is the long one, in the order things happened. Every
decision with the alternative it rejected, every finding with a number, and the reversals.
When another document says "see F32", this is where F32 is. Skim the headings; do not read it
front to back.

## Adding to the build log

It is the working record, not a summary written afterwards. **Add to it in the same commit as
the change it describes.**

Entries are tagged:

- **D** for a decision. Name the alternative you rejected. A decision without one is a
  default, not a decision.
- **F** for a finding. It must carry a number or a concrete example.
- **X** for a reversal or dead end. **Never delete these.** They are the only record of a
  mistake the team would otherwise repeat.

Number them continuously so the report can cite them.

## A rule the project learned the hard way

**A number published in more than one place goes stale.** The extraction accuracy figure sat
in five documents while the code that produced it changed underneath, for two sessions
(F33). If you quote a measured number outside RESULTS.md, link back to it rather than
copying it.
