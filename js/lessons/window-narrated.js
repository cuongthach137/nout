(function registerWindowNarrated(DSL) {
  "use strict";

  // Narrated mode for window functions: the focused version, on the scenes from window-guided.js.
  // Lines live in narration/window.json.

  const S = DSL.WindowScenes;
  const { exercise } = DSL.SqlScenes;

  function makeChapters() {
    const M = DSL.WindowModel;
    const story = (n, scene, board) => DSL.Narrator.story(n, scene, board);

    return [
      {
        id: "hook",
        title: "Keep every row",
        async script(n, scene) {
          scene.innerHTML = `<div class="gp-hook">${[["Each product vs its category", "AVG … OVER"], ["Each product, ranked", "RANK"], ["Revenue so far, day by day", "SUM … OVER"]].map(([question, tool], i) => `<div class="gp-question" style="--i:${i}"><b>${question}</b><code>${tool}</code></div>`).join("")}</div>`;
          await n.say("hook.1");
          await n.say("hook.2");
          await n.say("hook.3");
        },
      },
      {
        id: "over",
        title: "OVER and PARTITION BY",
        async script(n, scene) {
          const frame = story(n, scene, S.overStory());
          await frame("over.1", 0);
          await frame("over.2", 1);
          await frame("over.3", 2);
          await n.say("over.4");
        },
      },
      {
        id: "avg",
        title: "Your turn: category averages",
        async script(n) {
          await exercise(n, S.avgChallenge(), "avg", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      {
        id: "rank",
        title: "Numbers with ties",
        async script(n, scene) {
          const frame = story(n, scene, S.rankStory());
          await frame("rank.1", 0);
          await frame("rank.2", 1);
          await frame("rank.3", 2);
          await n.say("rank.ask");
          const guess = await n.choose([["five", "5"], ["six", "6"], ["seven", "7"]], { label: "Predict" });
          await frame(`rank.${guess}`, 3);
          await n.say("rank.4");
        },
      },
      {
        id: "top",
        title: "Top N per group",
        async script(n, scene) {
          const frame = story(n, scene, S.topStory());
          await n.say("top.1");
          await frame("top.2", 0);
          await frame("top.3", 1);
          await frame("top.4", 2);
        },
      },
      {
        id: "top2",
        title: "Your turn: top two",
        async script(n) {
          await exercise(n, S.top2Challenge(), "top2", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      {
        id: "run",
        title: "Running totals",
        async script(n, scene) {
          const frame = story(n, scene, S.runStory());
          await frame("run.1", 0);
          await frame("run.2", 1);
          await n.say("run.3");
        },
      },
      {
        id: "lag",
        title: "Look back a row",
        async script(n, scene) {
          const frame = story(n, scene, S.lagStory());
          await frame("lag.1", 0);
          await frame("lag.2", 1);
          await frame("lag.3", 2);
          await n.say("lag.4");
        },
      },
      {
        id: "gap",
        title: "Your turn: the previous order",
        async script(n) {
          await exercise(n, S.gapChallenge(), "gap", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      DSL.Narrator.quizChapter({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Vocab.reviewChapter("window"),
      {
        id: "finish",
        title: "Wrap-up",
        async script(n) {
          n.mount(DSL.Guided.finishBeat({
            lessonId: "window",
            badges: [["🪟", "OVER", "every row kept"], ["🥇", "Rank", "ties, and top N"], ["📈", "Along the rows", "totals and LAG"]],
          }));
          await n.say("finish.1");
          await n.say("finish.2");
        },
      },
    ];
  }

  DSL.registerNarrated("window", () => DSL.Narrator.run({
    lessonId: "window",
    title: `${DSL.lessonNumber("window")} · Window functions`,
    chapters: makeChapters(),
  }), { complete: true });
})(window.DataSystemsLab);
