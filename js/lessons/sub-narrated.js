(function registerSubNarrated(DSL) {
  "use strict";

  // Narrated mode for subqueries and CTEs: the focused version, on the scenes from sub-guided.js.
  // Lines live in narration/sub.json.

  const S = DSL.SubScenes;
  const { exercise } = DSL.SqlScenes;

  function makeChapters() {
    const M = DSL.SubModel;
    const story = (n, scene, board) => DSL.Narrator.story(n, scene, board);

    return [
      {
        id: "hook",
        title: "The question behind the question",
        async script(n, scene) {
          scene.innerHTML = `<div class="gp-hook"><div class="gp-question" style="--i:0"><b>Which products cost more than average?</b><code>?</code></div><div class="gp-question nb-first" style="--i:1"><b>First: what's the average?</b><code>AVG</code></div></div>`;
          await n.say("hook.1");
          await n.say("hook.2");
          await n.say("hook.3");
        },
      },
      {
        id: "scalar",
        title: "A value from a query",
        async script(n, scene) {
          const frame = story(n, scene, S.scalarStory());
          await frame("scalar.1", 0);
          await frame("scalar.2", 1);
          await frame("scalar.3", 2);
          await n.say("scalar.4");
          await n.say("scalar.5");
        },
      },
      {
        id: "later",
        title: "Your turn: after Lena",
        async script(n) {
          await exercise(n, S.laterChallenge(), "later", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      {
        id: "list",
        title: "A list, with IN",
        async script(n, scene) {
          const frame = story(n, scene, S.listStory());
          await n.say("list.1");
          await frame("list.2", 0);
          await frame("list.3", 1);
        },
      },
      {
        id: "corr",
        title: "Once per row",
        async script(n, scene) {
          const frame = story(n, scene, S.corrStory());
          await frame("corr.1", 0);
          await frame("corr.2", 1);
          await n.say("corr.3");
          await n.say("corr.ask");
          const guess = await n.choose([["two", "2"], ["four", "4"], ["six", "6"]], { label: "Predict" });
          await n.say(`corr.${guess}`);
          await frame("corr.4", 2);
        },
      },
      {
        id: "exists",
        title: "Is there any row?",
        async script(n, scene) {
          const frame = story(n, scene, S.existsStory());
          await n.say("exists.1");
          await frame("exists.2", 0);
          await frame("exists.3", 1);
        },
      },
      {
        id: "never",
        title: "Your turn: no paid orders",
        async script(n) {
          await exercise(n, S.neverChallenge(), "never", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      {
        id: "cte",
        title: "Name the steps",
        async script(n, scene) {
          const frame = story(n, scene, S.cteStory());
          await frame("cte.1", 0);
          await n.say("cte.2");
          await frame("cte.3", 1);
          await frame("cte.4", 2);
          await n.say("cte.5");
          await n.say("cte.6");
        },
      },
      {
        id: "above",
        title: "Your turn: above average",
        async script(n) {
          await exercise(n, S.aboveChallenge(), "above", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      DSL.Narrator.quizChapter({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Vocab.reviewChapter("sub"),
      {
        id: "finish",
        title: "Wrap-up",
        async script(n) {
          n.mount(DSL.Guided.finishBeat({
            lessonId: "sub",
            badges: [["🪆", "Nest", "a value or a list"], ["🔁", "Per row", "correlated, EXISTS"], ["🏷️", "Name it", "WITH, step by step"]],
          }));
          await n.say("finish.1");
          await n.say("finish.2");
        },
      },
    ];
  }

  DSL.registerNarrated("sub", () => DSL.Narrator.run({
    lessonId: "sub",
    title: `${DSL.lessonNumber("sub")} · Subqueries and CTEs`,
    chapters: makeChapters(),
  }), { complete: true });
})(window.DataSystemsLab);
