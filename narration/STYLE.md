# Narration style guide

How narrated lessons sound, read, and pace. `uv run tools/voice.py lint narration/<lesson>.json` checks the rules marked **(lint)**; `build` refuses to render a script with lint errors.

## Who is speaking

- **The tutor** teaches. Voice: MiniMax `English_WiseScholar` (scripts with `"engine": "minimax"`), or Kokoro `af_heart` in scripts not yet moved to MiniMax. Warm, direct, a little dry. Speaks to one learner as "you".
- **The interviewer** (MiniMax `English_expressive_narrator`, or Kokoro `bm_george`; `"speaker": "interviewer"`) only asks questions, in drills, quizzes, and mock interviews. Neutral and brief; never explains or hints. The tutor gives every explanation.
- Add a speaker under `"speakers"` in the script with a `voice` and a `label`; its captions show that label. **(lint: unknown speakers)**

## The story

The course follows Maya's bakery as it grows: a paper notebook (Level 1), one server once it goes online (Level 2), a chain with many stores (Level 3). Open each lesson with the bakery's current problem and close it with a one-line recap.

- Recurring people: **Maya** (a regular customer), **Omar** and **Ana** (other customers). Reuse them before inventing new names.
- A closing "Next up" line names the next lesson's idea, not its number. When the course order in `js/core.js` changes, check each lesson's closing line still matches what comes next.
- Call back to earlier lessons by idea ("remember Maya's two phone numbers?"), never by number. **(lint: no "lesson 3" or "lab two")** Numbers change whenever the course is reordered; the site computes them, the audio can't.

## Lesson budget

A lesson that tries to teach everything teaches nothing. Every lesson stays inside:

- **8 to 12 minutes** narrated, hands-on parts included.
- **At most 3 big ideas.** If a topic needs a fourth, it's two lessons.
- **At most 8 keywords.** **(lint: warns over 8)**

When a lesson runs over, split it at an idea boundary and let the next lesson open with a one-line callback.

## Keywords

Keywords are the vocabulary a learner should be able to use in an interview. They're highlighted as the narrator says them, collected in the lesson's Keywords panel, reviewed in a "Words to keep" chapter at the end, and practised as flashcards.

- Define them under `"keywords"` in the script: `"read-amplification": { "term": "Read amplification", "def": "…" }`. Each id belongs to one lesson. **(lint)**
- Mark them in the caption where the tutor first names them: `<k>read amplification</k>`, or `<k id="page">pages</k>` for another form of the word. **(lint: unknown ids; warns if a keyword is never marked)**
- A definition is one or two plain sentences a learner could say out loud. Explain it by what it does, not by other jargon.
- Name the idea only after the learner has seen it; the keyword marks that moment.
- A lesson with keywords needs the review lines `keywords.1`, `keywords.ask`, `keywords.hint`, and `keywords.done`, and a `DSL.Vocab.reviewChapter("<lesson>")` chapter before the wrap-up. **(lint)**
- The voice ignores `<k>`, so marking a word never re-renders audio. When a keyword isn't spoken, add it to the caption and keep the original `voice` text.

## Lines

- One idea per line, **30 words at most**. Split anything longer. **(lint: warns over 30)**
- Write for the ear: short sentences, contractions, no parentheses or semicolons.
- The caption and the voice can differ. Put markup, symbols, and exact figures in the `caption` (`<b>8 KB</b>`, `#11`, `GET /orders`) and the spoken form in `voice` ("Eight kilobytes", "customer eleven").
- A caption with `{placeholders}` must have a `voice` text, since audio is pre-rendered and can't fill them in. **(lint)**
- Say numbers the way a person would. "Eighty times faster", not "80×". "Eight kilobyte pages" works better spoken than "8 KB pages"; write it out in `voice` when a unit comes before a noun.
- Line ids are `chapter.name`: lowercase, digits, dashes (`teach-page.3`, `bet.right-hit`). **(lint: warns otherwise)**

## Pronunciation

`narration/lexicon.json` respells terms in the voice text only, so captions keep the real names:

- `words`: whole-word swaps, case-sensitive (`InnoDB` → "Inno D B", `SQL` → "S Q L", `B-tree` → "B tree").
- `patterns`: number-and-unit rules (`8 ms` → "8 milliseconds").

When a new term is misread, preview it with `uv run tools/voice.py say "..."`, add it to the lexicon, and rebuild. Only lines whose spoken text changes are re-rendered.

## Pacing

A narrated lesson runs **8 to 12 minutes**. Within it:

- The learner acts (tap, pick, type) at least every **60 to 90 seconds**. Narration that runs longer is a lecture; cut it or add a moment to act.
- A choice (`n.choose`) every couple of minutes, ideally one that branches ("Why 8 KB, though?" / "Makes sense. Keep going.").
- Predict before revealing when you can: ask what will happen, then show it.
- Every chapter ends on a line that sums up what just happened.

## Chapter shape

1. **Hook**: the bakery's problem, in one or two lines.
2. **Show**: an explainer, one caption per visual step.
3. **Do**: the learner acts; the tutor reacts to what they did (right, wrong, surprising).
4. **Name it**: give the real term only after the learner has seen the idea ("That ratio is called read amplification").
5. **Recap**: one line.

## Build and publish

```bash
uv run tools/voice.py lint narration/pages.json    # check the rules above
uv run tools/voice.py build narration/pages.json   # render changed lines, regenerate narration/pages.js
uv run tools/voice.py deploy                       # publish audio/ to the audio host
```

Commit `narration/<lesson>.json` and the generated `narration/<lesson>.js`; audio lives on the audio host, not in git.
