# Adding a lesson

How a new lesson gets into the course, from a stub to a narrated lesson with audio. Lesson 02 (`pages`) and lesson 01 (`modeling`) are the reference: copy their shape, not their content.

## 0. Plan it: Narrated first

Every lesson has three modes, and they are written in this order:

1. **Narrated**: the focused lesson and the course's default. It sets what the lesson teaches: 3 big ideas, 8 to 12 minutes, at most 8 keywords (`narration/STYLE.md`). Write its chapter outline and script first.
2. **Guided**: the same ideas, silent and self-paced, with more written explanation (a `why` on beats, fuller captions).
3. **Explore**: the most detail: free-form labs, deeper asides, edge cases and engine differences, the quiz, a cheat sheet.

Each mode goes deeper than the one before, but none may contradict it. If something only fits in Explore, it isn't one of the 3 big ideas.

**Existing lessons are not a constraint.** When giving an existing lesson a Narrated or Guided version, check its content first: rewrite anything inaccurate, outdated or hard for a learner to follow instead of carrying it over, and fix the Explore page to match. List the corrections in the PR.

The sections below follow the order the files **load** in (Explore defines the lesson's model, Guided builds the scenes, Narrated plays them), not the order you design them in. A lesson must always register an Explore renderer, because the router uses it to find the lesson; a thin one is fine until the full Explore page is written.

## 1. Register it

**`js/core.js`**: add an entry to `lessons` at the spot where it belongs in the course:

```js
{ id: "select", module: "SQL you'll be asked to write", title: "SELECT, filtering and sorting", minutes: 10 },
```

- The position is the lesson number. Numbers, the sidebar, the course map, Next links and flashcard groups all follow from this list, so nothing else needs renumbering.
- Consecutive lessons with the same `module` string form one module. A new module name also needs a card in `MODULE_CARDS` in `js/lessons/welcome.js` (title and one-line blurb); without one the card falls back to the first lesson's title.
- Refer to other lessons by id, never by number: `DSL.lessonRef("pages")` → "Lesson 02", `DSL.labLabel("pages", "A")` → "Lab 02A". Narration never says numbers at all (see `narration/STYLE.md`).

**`index.html`**: add script tags after the components and before `app.js`, in dependency order (Explore, then Guided, then Narrated, then the generated narration):

```html
<script src="js/lessons/select.js?v=20261009"></script>
<script src="js/lessons/select-guided.js?v=20261009"></script>
<script src="js/lessons/select-narrated.js?v=20261009"></script>
<script src="narration/select.js?v=20261009"></script>
```

Add a stylesheet under `styles/` only if the lesson needs its own visuals, and link it in `<head>`. Bump `?v=` on every file you change, so returning browsers don't run stale copies.

**`README.md`**: add the lesson to "Course structure" in course order.

## 2. Explore mode: `js/lessons/<name>.js`

The free-form page: labs, asides, a quiz, and the footer. It also owns the lesson's model (data, rules, quiz questions) and exposes it for the other two modes.

```js
(function registerSelectLesson(DSL) {
  "use strict";

  const { setStatus, wonder, labSide } = DSL.LabKit;
  const progress = DSL.LabKit.createProgress({
    lessonId: "select",
    labs: [{ id: "filter", name: `${DSL.lessonNumber("select")}A Filter` }, { id: "quiz", name: "Quiz" }],
  });

  const QUIZ = [
    { prompt: "…", options: ["…", "…", "…"], answer: 1, why: "…" },
  ];

  function render() {
    const lesson = DSL.getLesson("select");
    DSL.elements.root.innerHTML = `
      <article class="lesson">
        ${DSL.lessonHeader(lesson, "SELECT, filtering and sorting", "One-line lede.")}
        ${progress.markup()}
        <section class="lab" id="lab-filter">…</section>
        <section class="lab" id="lab-quiz">
          <div class="lab-top">…<button class="button" type="button" data-quiz-reset>Reset answers</button></div>
          <div id="select-quiz">${DSL.Quiz.render(QUIZ, "SELECT review")}</div>
        </section>
        ${DSL.lessonFooter("select")}
      </article>`;
    progress.mount();
    DSL.Quiz.mount(document.getElementById("select-quiz"), QUIZ, {
      onComplete: ({ passed }) => { if (passed) progress.complete("quiz"); },
    });
  }

  DSL.SelectModel = Object.freeze({ QUIZ, progress });
  DSL.registerRenderer("select", render);
})(window.DataSystemsLab);
```

Rules that keep lessons from interfering with each other:

- **Saved data goes through `DSL.store`** (`get(key, fallback)` / `set(key, value)`; it adds the `dsl-` prefix). Never touch `localStorage` directly: Back up / Restore only carries `dsl-` keys, and `store` survives blocked or full storage.
- **Timers use `DSL.setTimer`**, and anything else that outlives the screen (document listeners, audio) is torn down in `DSL.onLeave(fn)`. The router clears both on every navigation.
- Lab progress (`createProgress`) saves under `labs-<lessonId>`; call `progress.complete(labId)` when a lab's goal is reached. Guided and Narrated call the same function through `onLab`, so progress is shared across modes.
- Status lines under a lab use `LabKit.setStatus(el, message, tone)`.

## 3. Guided mode: `js/lessons/<name>-guided.js`

A sequence of one-screen beats (`beat = { id, prompt, why?, continues?, mount(scene, api) }`); a beat calls `api.done()` when the learner reaches its goal. Teaching beats use `DSL.Guided.storyboard`; the lesson ends with the shared `DSL.Guided.quizBeat({ questions, passScore, onPass })` and `DSL.Guided.finishBeat({ lessonId, badges })`.

Build the scenes and storyboards here as functions, and expose them so Narrated mode can reuse them:

```js
DSL.SelectScenes = Object.freeze({ filterStory, beats: makeBeats });
DSL.registerGuided("select", () => DSL.Guided.run({
  lessonId: "select",
  title: `${DSL.lessonNumber("select")} · SELECT, filtering and sorting`,
  beats: makeBeats(),
  onLab: (id) => DSL.SelectModel.progress.complete(id),
}));
```

## 4. Narrated mode: `js/lessons/<name>-narrated.js`

Chapters (`{ id, title, continues?, script(n, scene) }`) that play like a film on the Guided scenes. The narration object `n` has `say`, `react`, `choose`, `ask`, `mount`, `show`, `wait` and `lab`; the comments at the top of `js/components/narrator.js` describe each one. Shared helpers:

- `DSL.Narrator.story(n, scene, board)` puts a Guided storyboard on stage and returns `frame(lineId, i)`.
- `DSL.Narrator.throttled(n, lineId)` reacts to repeated mistakes without talking over every tap.
- `DSL.Narrator.quizChapter({ questions, passScore, onPass })`: the end-of-lesson quiz.
- `DSL.Vocab.reviewChapter("<lesson>")`: the "Words to keep" chapter, just before the wrap-up.

The last three chapters are always the same, as in `storage-narrated.js`:

```js
DSL.Narrator.quizChapter({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
DSL.Vocab.reviewChapter("select"),
{ id: "finish", title: "Wrap-up", async script(n) {
  n.mount(DSL.Guided.finishBeat({ lessonId: "select", badges: [/* 3 badges: the 3 big ideas */] }));
  await n.say("finish.1");
  await n.say("finish.2");
} },
```

Register it; pass `{ complete: true }` only once every chapter is written and voiced, since that makes Narrated the lesson's default:

```js
DSL.registerNarrated("select", () => DSL.Narrator.run({
  lessonId: "select",
  title: `${DSL.lessonNumber("select")} · SELECT, filtering and sorting`,
  chapters: makeChapters(),
  onLab: (id) => DSL.SelectModel.progress.complete(id),
}), { complete: true });
```

## 5. Narration script: `narration/<lesson>.json`

Every line the narrator says, plus the lesson's speakers and keywords. Read `narration/STYLE.md` first: it sets the budget (8 to 12 minutes, at most 3 big ideas and 8 keywords), the tutor and interviewer voices, the story (Maya's bakery), and how lines and keywords are written.

- `"lesson"` must match the lesson id; the file name is the id too.
- Line ids are `chapter.name`, matching the chapter ids in the narrated file.
- The shared chapters need these lines: `quiz.intro`, `quiz.q1`…`quiz.qN` (with `"speaker": "interviewer"`) and `quiz.q1-why`…, `quiz.right1`–`quiz.right3`, `quiz.pass`, `quiz.retry`; `keywords.1`, `keywords.ask`, `keywords.hint`, `keywords.done`; `finish.1` (recap) and `finish.2` ("Next up", naming the next lesson's idea).

Then:

```bash
uv run tools/voice.py lint narration/select.json    # the STYLE.md rules
uv run tools/voice.py build narration/select.json   # renders changed lines to audio/, regenerates narration/select.js
```

Commit the `.json` and the generated `.js`. Audio stays out of git: after the PR merges, run `uv run tools/voice.py deploy` so the live site can play it. Never run `wrangler pages …`.

## 6. Check it

There are no committed tests yet. Before opening the PR:

- `find . -name '*.js' -print0 | xargs -0 -n1 node --check`
- Serve the site (`python3 -m http.server 8000`) and play the lesson through in headless Chrome in all three modes: every lab reaches its goal and ticks the checklist, the quiz passes and fails at the right score, and "Mark complete" saves. In Narrated mode, mute the narrator (the lines then hold for their reading time, and tapping the caption skips one), play every chapter to the end, and check that keywords light up and the "Words to keep" deck shows them all.
- Open the course map, the sidebar and `#/flashcards`: the lesson appears in its module, numbers after it shifted by one, and its keywords are grouped under it.

## 7. Record it

- Update the lesson's item in `docs/roadmap/data.js`: `status: "progress"` with the PR number when the PR opens, `"done"` when it merges. In the course map at the bottom of that file, give the lesson its id and modes.
- If the lesson changes what comes next for an existing lesson, update that lesson's `finish.2` "Next up" line and rebuild its audio.
