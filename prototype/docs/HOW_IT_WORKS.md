# How TalentFlow works

Written for anyone on the team, technical or not. No prior knowledge assumed.

If you want the engineering reasoning behind each choice, that lives in `BUILD_LOG.md`.
This document is the plain version.

---

## The problem in one paragraph

A recruiter opens a resume, reads it, and decides which lines count as skills. Then they
decide whether those skills carry over to an open role. It takes 10 to 13 hours per 100
resumes. TalentFlow does the reading part automatically, and shows its work: for every
skill it claims you have, it can point at the exact words on your page that say so.

---

## The one-sentence version

**We turn a resume into a clean list of skills, then compare that list against other
people and other jobs.**

Everything below is how we get there without the computer making things up.

---

## Follow one resume through the system

Say you upload a resume with this line in it:

> Drafted custom hand rails using Autodesk AutoCAD.Created shop drawings for the fab team.

Here is what happens to it.

### Stage 1: Read the file

**In:** a PDF or Word file. **Out:** plain text.

Sounds trivial. It is not. Documents carry damage you cannot see when you open them:

- Some characters arrive scrambled. A dash comes through as `â€“`. A name like
  `Andrés` loses its accent and becomes `Andr?s`.
- Invisible characters get inserted that split words in half.
- The space after a period sometimes vanishes, so `AutoCAD. Created` becomes
  `AutoCAD.Created`.

None of this causes an error message. The file just quietly contains slightly wrong text,
and every later step inherits the damage. We found and fixed 5 separate defects of this
kind in the Kaggle resume set.

**Why it matters:** if `AutoCAD` arrives glued to the next sentence, no amount of clever
matching later will find it.

### Stage 2: Find the sections

**In:** plain text. **Out:** the same text, labeled by section.

We split the resume into Summary, Experience, Skills, Education, Certifications, and so on.

This matters more than it sounds. A word under **Skills** is a claim about what you can do.
The same word under **Interests** usually is not. Knowing which section a word came from
changes how much to trust it.

The tricky part: resumes often put a bare skill on its own line, like this:

```
Skills
Microsoft Office
Time management
```

`Microsoft Office` sits on its own short line and looks exactly like a section heading. So
we use a fixed list of real heading names instead of guessing from how a line looks. Guessing
shreds the Skills section into fragments.

### Stage 3: Split into words

> **From the lectures, week 2.** This is *tokenization*. The Transformer deck teaches
> **BPE**, byte pair encoding, which builds a vocabulary by repeatedly merging the most
> frequent adjacent character pairs, and notes that this is why you pay an API by the token.
> We deliberately did something else, and the table below is why: BPE would split `C++` into
> `C` and `++`. Our tokens are *evidence*, not model input, so they have to survive intact and
> carry their position in the page. Both kinds of tokenization are in this project. Ours here,
> BPE on the provider's side every time the LLM Reader makes a call. See COURSE_CONCEPTS.md
> item 1.

**In:** section text. **Out:** a list of words, each remembering where it came from.

Splitting text into words is the most underestimated step in the whole pipeline.

The standard way of doing this throws away punctuation. Watch what that does:

| On the page | Standard tool sees | Real meaning |
|---|---|---|
| `C++` | `c` | a programming language |
| `C#` | `c` | a different programming language |
| `.NET` | `net` | a Microsoft platform |
| `P&L` | `p`, `l` | profit and loss |
| `CI/CD` | `ci`, `cd` | a deployment practice |

Across our 2,484 resumes, the standard approach silently deletes **more than 650 real skill
mentions**. No error, no warning. The skills simply are not there any more.

So we wrote our own word splitter that keeps these intact. It also handles two messier cases:

- `Word/Excel/PowerPoint/Visio` is a **list of four tools**, not one thing. We split it.
- `AutoCAD.Created` is **two sentences with a missing space**, not a product name like
  `ASP.NET`. We split that too. The difference is that real dotted names end in a known
  suffix (`.net`, `.js`), and run-together sentences do not.

Every word also records exactly where on the page it came from. That is what lets us show
you evidence later.

### Stage 4: Cut into chunks

> **From the lectures, week 2.** The Transformer deck's closing section covers *sentence
> encoders* and **pooling**, combining many token vectors into one vector for a passage. The
> rules below are our pooling decision. Rule 1 in particular is the whole argument: pooling an
> entire resume averages a Java section together with a nursing section and produces a vector
> that describes neither.

**In:** the whole resume. **Out:** roughly 10 overlapping pieces.

A whole resume is too big to compare in one go. If you average an entire resume into a
single summary, a person who mentions Python once looks identical to a person who does not
mention it at all. The specific detail gets washed out.

So we cut each resume into pieces of about 180 words. Three rules:

1. **Never mix two sections.** A chunk that is half Experience and half Education
   describes neither.
2. **Never cut mid-sentence.** "Managed a team of" is not a useful piece of text.
3. **Overlap slightly**, so a skill sitting on a boundary lands in both neighbours rather
   than falling between them.

Our 2,484 resumes become 24,534 chunks.

### Stage 5: Turn text into numbers

> **From the lectures, week 2.** This is *embeddings*, and the underlying claim is the
> **distributional hypothesis**: a word is known by the company it keeps. The lecture teaches
> **word2vec**, a neural method trained by prediction. We use **LSA**, which reaches dense
> vectors by factoring a word-count matrix instead, because this environment cannot download
> pretrained models. Different technique, same claim, and we measured that the lecture's claim
> holds on our own data: dense vectors beat raw word counts by 1.59 points, with a confidence
> interval. See COURSE_CONCEPTS.md item 2.

**In:** chunks of text. **Out:** a list of numbers for each chunk.

Computers compare numbers, not words. So each chunk becomes a list of numbers, called an
**embedding**. The useful property is that chunks about similar things end up with similar
numbers, so you can measure how alike two pieces of text are by how close their numbers are.

We built two ways of doing this so we could compare them fairly:

**Word counting (TF-IDF).** Score each chunk by which words it uses, weighting rare words
higher. "Litigation" is worth more than "responsible" because fewer documents contain it.
Simple and strong. Its blind spot: it only matches words that are literally the same. A
resume saying `SQL Server` and a job posting saying `MS SQL` score **zero** against each
other.

**Meaning-based (LSA).** Look at which words tend to appear together across all 2,484
resumes, and use those patterns to place text in a space where related things sit near each
other. This one *can* connect `MS SQL` to `SQL Server`, because it learned they keep the
same company.

**What we measured.** We had every resume search for other resumes in its own job category,
which gave 12,415 test judgments. Meaning-based beat word counting, but only by about 1.6
points out of 100. Real, but small.

> **A mistake worth knowing about.** Our first test used 12 hand-written searches. On that
> test, word counting *won*. But 12 searches is only 60 judgments, so a single document
> moved the score by 1.7 points. The result was noise. When we built the bigger test, the
> answer reversed. This is written up in the build log because it is the kind of mistake
> that turns into a wrong claim in a report.

### Stage 6: Name the skills

> **From the lectures, week 4.** This is **RAG**, retrieval augmented generation, and the
> intro deck introduces it with exactly our problem: what if the answer lies in data the model
> does not have? O*NET is that data. Rather than trusting any model to remember official skill
> names, we retrieve them. The **Dictionary Matcher** does this by direct lookup. The **LLM
> Reader** does it by embedding what the model said and finding the nearest official term,
> using *cosine similarity* from the same week 2 material.

**In:** the resume text. **Out:** a list of named skills, each with evidence.

Now we find actual skills. The problem is that everybody writes them differently. One
resume says `MS Excel`, another says `Microsoft Excel`, a job posting says `spreadsheets`.
Treated as raw text, those are three unrelated things and nobody matches anybody.

So we use a **shared dictionary**: O*NET, the US Department of Labor's occupational
database. It has 9,065 skill names, from concrete tools like `Atlassian JIRA` to broad
abilities like `Active Listening`. Both sides of any comparison get translated into that
one vocabulary.

**The catch nobody warns you about.** O*NET writes tools with the company name first:

| Your resume says | O*NET calls it |
|---|---|
| AutoCAD | Autodesk AutoCAD |
| QuickBooks | Intuit QuickBooks |
| Photoshop | Adobe Photoshop |
| Java | Oracle Java |

Matching these directly finds almost nothing. So we teach the system nicknames: for every
official name, we also accept the shorter endings people actually write.

**And that creates its own problem.** The same trick turns `Microsoft Word` into `word` and
`Microsoft Office` into `office`. Do that naively and every resume in the world "has
Microsoft Word."

Two rules keep it honest, and both are needed:

1. **Is it an ordinary English word?** `autocad` is not. `word` obviously is.
2. **Does it show up everywhere in our resumes?** `photoshop` appears in 8% of them.
   `excel` appears in 39%, mostly as the verb, as in "excel at customer service."

Neither test works alone. In general English, `excel` and `photoshop` are almost exactly as
common as each other. It is the second test that separates them.

**One more trap, and it is a good story.** We ranked nicknames by how often they fired and
found `proficient` matching 22% of all resumes. It was matching a real product called
**Infinity QS ProFicient**, used by exactly 2 of the 1,016 occupations in O*NET. Worse,
`of science` was matching 35% of resumes, because every `Bachelor of Science` was being read
as `Thomson Reuters Web of Science`.

The pattern: **software companies name products after the job the product does.** So the tail
end of a product name is very often just a description of that job.

The fix is a rule you could explain to anyone: *a common nickname has to be earned.* If a
nickname matches lots of resumes, the product it points to has to be one that lots of
occupations actually use. Microsoft PowerPoint is used by 629 occupations, so `powerpoint`
keeps its nickname. Infinity QS ProFicient is used by 2, so it loses `proficient`.

### Stage 7: Say how sure you are

Some things cannot be solved by any rule. O*NET genuinely contains skills named **Go**,
**R**, **C**, **Design** and **Writing**. Every one is a real entry. Every one also appears
constantly in ordinary sentences. Nothing about the word "go" on its own tells you whether
it means the programming language.

So instead of pretending, every skill we find is labeled with how much to trust it:

| Label | Meaning | Example |
|---|---|---|
| **exact** | matched the full official name | `Microsoft Visual Studio` |
| **alias** | matched a known nickname | `AutoCAD` for `Autodesk AutoCAD` |
| **weak** | matched a word that is also an everyday word | `Go`, `Design` |

By default we ignore the weak ones. Resolving those needs the surrounding sentence, which is
what the later AI stages are for.

---

## What comes out

Run it on a resume and you get something like this:

```
  10 skills found

  TECHNICAL  (10)
      x2  Python                                       [skills]
          Microsoft Active Directory                   [summary]
          Structured query language SQL                [skills]
          Autodesk AutoCAD                             [skills]
          Adobe Photoshop                              [skills]
          Tableau                                      [experience]
```

Every line can be expanded to show the exact sentence it came from. **Nothing in that list
was invented.** Each entry points at real words on a real page, and you can check any of
them in a second.

That property is deliberate. It is what makes the system auditable, and it is what lets a
recruiter disagree with it.

---

## Try it on your own resume

**Double-click `Launch TalentFlow.command`** in the `prototype` folder. Your browser opens
with a page you can drop a resume onto.

The first launch takes a couple of minutes while it sets itself up. After that it opens in
seconds.

What you get:

- **Skills**, grouped into technical, soft and process, with how many times each was
  mentioned and which section it came from.
- **Evidence in context**, your resume with every matched skill highlighted in place. Hover
  any highlight to see which skill it produced. Green means an exact official name, purple a
  nickname, amber a low-confidence guess.
- **Document breakdown**, the sections and chunks the system found.
- **Similar resumes**, the closest matches out of the 2,484 reference resumes.

There is a slider in the sidebar for how strict to be. Slide it to `weak` to see the
borderline matches the system normally hides.

Works with `.pdf`, `.docx`, `.doc`, `.odt`, `.rtf`, `.txt` and `.md`.

If you would rather use a terminal, `python scripts/07_analyze_resume.py my_resume.pdf
--show-evidence` does the same thing.

---

## What it cannot do yet

Being straight about the gaps:

- **It cannot tell you how good you are at something.** It finds that you mention Python. It
  has no idea whether you have used it for a week or a decade.
- **It misses skills described rather than named.** "Kept the team's records straight" is a
  real skill and the system will not catch it. Word matching only finds words. This is the
  specific gap the meaning-based stage is meant to close, and we have not measured that yet.
- **It misses skills O*NET has never heard of.** We now have a set of 220 resumes where
  humans marked the skills by hand, so we can check. See the section below.
- **No matching to jobs yet.** The skills come out. Comparing them to open roles is the
  next piece.
- **No video, no career goals.** Not started.

---

## How good is it, really

We now have 220 resumes where a person went through and marked which words are skills. That
lets us check the system instead of guessing.

**One catch first.** The people who made that answer key marked *some* parts of each resume,
not every skill in it. So if our system finds a skill in a part nobody marked, that does not
make it wrong, it just means nobody checked there. This means we can measure what we *find*,
but we cannot fairly measure what we get *wrong*. Worth being straight about, because the
project plan assumed we could measure both.

Here is what we can measure:

| Question | Answer |
|---|---|
| Of the skill areas a human marked, in how many did we find something? | **57%** |
| Of those same areas, how many contain any skill O*NET has ever heard of? | **58%** |
| So: of what was *possible* to find, how much did we find? | **98.4%** |
| Did we ever report a skill that is not actually in the document? | **Never.** 0 out of 3,927 |

**That third row is the important one.** Our system finds almost everything it is capable of
finding. When it misses a skill, it is almost never because the matching logic failed. It is
because the skill is not in O*NET's dictionary, or is in there under wording no human would
write.

That is a useful thing to know, because it says what to work on next. Making the
Dictionary Matcher cleverer would gain us about one and a half percent. The real gain is in handling
skills that are *described* rather than named, which is what the meaning-based stage is for.

Some real examples of what we miss:

- **`Mainframe`.** Simply not in O*NET. Nothing the Dictionary Matcher can do about that.
- **`Requirement Analysis`, `Test Planning`, `Bid management`.** O*NET *does* have entries
  that mean these, but written as formal phrases like "Analyzing Data or Information" that
  nobody puts on a resume. This is the gap the next stage should close.
- **"Sincere and Hardworking in nature".** Marked as a skill by the annotator. Arguably it
  is not one.

And the last row of that table matters for trust: **the system has never once reported a
skill that was not literally written in the document.** That is not luck. Every skill it
reports is a span of text it can point at, so making something up is not a thing it can do.

---

## Where the AI part goes

Everything described above is rules and arithmetic. No AI model has made a single decision
yet. That was deliberate: you cannot claim a smart method is better without a simple method
to compare it against.

### And now we have compared them

152 resumes, both engines, the same answer key.

| | Dictionary Matcher | LLM Reader |
|---|---|---|
| Skill areas it found something in | **57%** | 35% |
| How much of each area it accounted for | 18% | **53%** |
| Skills it invented | 0%, impossible by design | 0.18%, all caught before scoring |

**Neither one wins outright, and that is the honest finding.** The Dictionary Matcher notices
more places in the resume. The LLM Reader understands more of each place it notices, though
some of that number comes from it quoting whole sentences as evidence rather than the skill
phrase itself.

The one comparison that is clean: against the ceiling of what O*NET can express at all, the
Dictionary Matcher reaches **98%** and the LLM Reader reaches **60%**. The Dictionary Matcher
is nearly perfect at its job and is held back by its dictionary. The LLM Reader has no
dictionary holding it back and still finds fewer areas, because it is being *selective*,
listing about 16 skills per resume where the Dictionary Matcher lists 26.

That points at a fix which is a prompt change rather than a better model, and it is the next
thing to try.

> **From the lectures.** The intro deck's prompting slide shows four rungs: a simple prompt,
> few-shot with hand-picked examples, chain of thought, and an optimized prompt written by a
> search process. **We are on rung one.** The selectivity problem above is exactly what rung
> two exists to fix, and we already have the material for it, since the 220-resume answer key
> is a source of hand-picked examples. See COURSE_CONCEPTS.md item 8.

Now that the simple version is built and measured, here is where the
language model gets added and, just as importantly, where it does not.

### Where it helps

**Reading resumes, as an alternative engine.** The system will have two skill extractors and
a switch in the UI to flip between them: the word-matching one described above, and one that
asks a language model to read the resume. Same input, same scoring, so you can see exactly
what the AI gains you and what it costs. We already know roughly where the gain should come
from: the Dictionary Matcher finds 98.4% of what its dictionary allows, so its remaining misses are
things like `Mainframe` (not in the dictionary at all) and `Requirement Analysis` (in there,
but written as "Analyzing Data or Information"). Those are the cases a language model handles
naturally.

**Translating what it finds back into standard names.** If the model says "Mainframe
administration", that phrase still has to become an official O*NET skill name or nothing can
be matched against it. So the system looks up the closest official names and asks the model
to pick one, or to say "I don't know this one" rather than guessing. That last part matters:
an unknown skill should be reported as unknown, never silently dropped.

**Sorting the job postings.** Before matching people to jobs, we need to know which of the
124,000 postings are technical roles. Rather than writing rules for that, we let the model
read each job title and decide. It is a one-time pass, and the answers get saved.

**Explaining the match.** "Why is this person a fit, and what are they missing?" is writing,
and writing is what these models are for.

**Understanding the video introductions.** Whisper turns speech into text. That is not a
language model, it is speech recognition. The model comes in afterwards, reading the
transcript to judge tone and pick out the career directions the person describes.

### Where we are deliberately not using it

**Scoring the match.** The actual number, how well a person fits a role, stays arithmetic.
Three reasons. It is far cheaper. It gives the same answer every time, so results can be
reproduced. And most importantly, it is the only way to *guarantee* the fairness test.

That test works like this: take one resume, change only the name, the pronouns and the
school, and run it again. The score should barely move. With arithmetic over a list of
skills, that is guaranteed, because the person's name is not part of the calculation. With a
language model producing the score, it is something you can only hope for and then check.
The prototype makes fairness claims on screen, so this needs to be a guarantee.

### One rule underneath all of this

The language model is allowed to *find* and *explain* things. It is not allowed to *decide*
things. A person decides who gets an interview. The system ranks, and shows its reasoning.

---

## Where things live

| Thing | Where |
|---|---|
| The app | `app.py`, launched by `Launch TalentFlow.command` |
| Plain-language explanation | `docs/HOW_IT_WORKS.md` (this file) |
| Every decision and why | `docs/BUILD_LOG.md` |
| How to run each stage | `docs/PIPELINE.md` |
| The code | `talentflow/` |
| Runnable steps | `scripts/` |
| Tests | `tests/` |
