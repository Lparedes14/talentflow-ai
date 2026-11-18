# Glossary

Plain-language definitions, each tied back to where the idea appears in the ISM6422 lectures.
If a document uses a word you do not recognize, it should be here.

---

## The one that caused the most confusion

TalentFlow extracts skills from a resume **two different ways**, on purpose, so we can measure
what each is worth. Those two ways used to be called a mix of "lexical", "in-house", "ours",
"the LLM" and "the model", which is four names for two things plus one word that meant
something else entirely. From now on they have exactly one name each.

### The Dictionary Matcher

Looks up words from the resume in a fixed list of 9,065 real skill names published by the US
Department of Labor (O*NET). If a word is on the list, it is a skill. If it is not on the
list, the Dictionary Matcher cannot see it, ever.

Runs on your laptop. No internet, no API key, no cost. **It cannot invent a skill**, because
every result it returns is a span of text it can point at in your document.

> **From the lectures, and the honest boundary of it.** The Dictionary Matcher uses
> *tokenization* from week 2, and nothing else from the course. It uses it properly, not as
> decoration: `SkillVocabulary.match()` tokenizes the resume, then matches token n-grams
> longest-first, so `Microsoft SQL Server` is one three-token hit rather than three
> overlapping ones. **Both sides use the same tokenizer**, which is the load-bearing part:
> O*NET's term names go through the same `tokenize()` the resume does, because if they were
> normalized differently then `C++` in O*NET and `C++` in a resume would produce different
> keys and never match.
>
> What it does **not** use: no BPE, no embeddings, no word2vec or LSA, no cosine similarity,
> no attention, no probability. Once the tokens exist it is exact dictionary lookup. That is
> the point. It is the classical NLP baseline the neural methods are measured against, and
> claiming more for it would weaken the comparison it exists to enable.
>
> **The embeddings are elsewhere in the system**, and it is worth knowing where: in the
> similar-resumes retrieval (chunking, LSA, cosine similarity), and in the `OnetMapper`,
> which belongs to the LLM Reader path only.

In code and in JSON output this is `lexical` and `LexicalExtractor`.

### The LLM Reader

Sends the whole resume to a large language model and asks it, in a prompt, to list the
skills it sees and quote the exact text that proves each one. It can name skills that are not
on any list.

Needs an API key and an internet connection, and costs money or quota per resume. **It can
invent a skill**, which is why we make it quote the document and then check the quote really
appears. Anything unquotable is thrown away before scoring.

> **From the lectures:** this is the week 4 and 5 material, end to end. A *prompt* with
> instructions and a required output format, *temperature* set to 0 so the same resume gives
> the same answer twice, and a *grounding* requirement so the model cites rather than
> recalls. The skills it returns are then matched to the O*NET list using *embeddings and
> cosine similarity*, which is the *RAG* pattern: retrieve the authoritative term, do not
> trust the model to remember it.

In code and in JSON output this is `llm` and `LLMExtractor`.

---

## Engine, provider, model. Three different things

These get mixed up constantly. They are nested, largest first.

| Word | Means | Examples |
|---|---|---|
| **Engine** | Which of the two approaches above | Dictionary Matcher, LLM Reader |
| **Provider** | The company whose API we call | Google, OpenAI, Anthropic |
| **Model** | The specific LLM at that provider | `gemini-3.5-flash-lite`, `gpt-4o-mini` |

So: "the LLM Reader engine, using the Gemini provider, running the `gemini-3.5-flash-lite`
model." Changing the model does not change the engine. The Dictionary Matcher has no provider
and no model at all.

`.env` sets the provider (`LLM_PROVIDER`) and the model (`GEMINI_MODEL`). The engine is chosen
by the toggle in the app, or by which script you run.

---

## Words about text

**Token.** A piece of text treated as one unit. Roughly a word, but ours keeps `C++`, `.NET`
and `CI/CD` whole instead of splitting them.

> **From the lectures:** week 2, and we deliberately did *not* use BPE, the subword method
> taught there. Ours keeps character positions so we can highlight evidence in your original
> document, which BPE would destroy. The full reasoning is in COURSE_CONCEPTS.md item 1.

**Chunk.** A passage of about 180 tokens, used as the unit we turn into numbers. Chunks never
cross a section boundary, so a Java chunk and a nursing chunk stay separate.

**Section.** One labeled part of a resume: header, summary, skills, experience, education, and
four more. Nine in total.

**Span.** A start and end character position in the original document. Every skill we report
carries one, which is what lets the app highlight the exact words that produced it.

---

## Words about meaning

**Embedding.** A list of numbers that stands for a piece of text, arranged so that texts about
similar things end up with similar numbers.

> **From the lectures:** week 2. The lecture teaches word2vec, a neural method. We use LSA,
> a matrix method, because this environment cannot download pretrained models. Same idea,
> older technique, and we measured that it beats the plain word-count baseline by 1.59 points.
> COURSE_CONCEPTS.md item 2.

**Cosine similarity.** How close two embeddings are, from 0 to 1. The measure of "these two
pieces of text are about the same thing."

**RAG, retrieval augmented generation.** Look the answer up in a trusted source instead of
asking the model to remember it.

> **From the lectures:** week 4, and it is the backbone of this project. We use it twice.
> Once to map a free-text skill onto an official O*NET term, and once to compare a resume
> against job postings.

**Vocabulary.** Our list of skill names and their aliases, 29,561 entries built from O*NET.

**Alias.** Another way of writing a skill name. `Apache Cassandra` also matches `cassandra`.
Aliases are what make matching work, and are also where several bugs came from.

---

## Words about measurement

**Gold set.** 220 resumes where a human marked which parts are skills. The answer key.

**Span detection rate.** Of the regions a human marked as a skill, what share did we find
something in? Higher is better.

**Vocabulary ceiling.** Of those same regions, what share contain any skill O*NET knows about
at all? **This is the highest score the Dictionary Matcher could possibly get**, because it
can only find things on its list. Currently 58.3%.

**Detection against ceiling.** Detection divided by ceiling. How good the matching is, with
the vocabulary's limits taken out. The Dictionary Matcher scores 98.4% here, which says its
remaining misses are almost entirely words O*NET has never heard of, not matching mistakes.

**Token coverage.** Of the words inside a marked region, what share did we account for.
Different question from detection: detection asks *did you notice this*, coverage asks *how
much of it did you get*.

**Hallucination rate.** How often an engine reports a skill that is not actually in the
document. The Dictionary Matcher is 0% by construction. The LLM Reader produced 0.18%, all of
which the quote check caught before scoring.

> **From the lectures:** hallucination is the first item on the practical-challenges slide in
> the intro deck. Our answer to it is the grounding requirement described under LLM Reader.

---

## Words about running it

**Prompt.** The instructions sent to a model along with the resume.

> **From the lectures:** the intro deck's four-rung ladder is simple prompt, few-shot, chain
> of thought, and optimized. We are on rung one.

**Temperature.** How much randomness the model is allowed. We use 0, the lowest, because the
same resume must produce the same skills twice or no result can be reproduced.

**Rate limit.** How many requests per minute you may send. Hitting one is normal and the code
waits it out.

**Quota.** How many requests you may send per day, or how much credit is left on the account.
Running out is not a rate limit and waiting does not fix it.

**Cache.** Saved model responses on disk. Rerunning a comparison reuses them instead of paying
again. Changing the model empties it on purpose, since one model must never be credited with
another's answers.
