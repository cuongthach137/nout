(function registerNullNarrated(DSL) {
  "use strict";

  // Narrated mode for NULL traps: the focused version, on the scenes from null-guided.js.
  // Lines live in narration/null.json.

  const S = DSL.NullScenes;
  const { exercise } = DSL.SqlScenes;

  function makeChapters() {
    const M = DSL.NullModel;
    const story = (n, scene, board) => DSL.Narrator.story(n, scene, board);

    return [
      {
        id: "hook",
        title: "The gaps in the data",
        async script(n, scene) {
          scene.innerHTML = `<div class="gp-hook">${[["Raj's city", "NULL"], ["Three phones", "NULL"], ["Two orders' customer", "NULL"]].map(([what, value], i) => `<div class="gp-question" style="--i:${i}"><b>${what}</b><code>${value}</code></div>`).join("")}</div>`;
          await n.say("hook.1");
          await n.say("hook.2");
          await n.say("hook.3");
        },
      },
      {
        id: "unknown",
        title: "NULL means unknown",
        async script(n, scene) {
          const frame = story(n, scene, S.unknownStory());
          await frame("unknown.1", 0);
          await n.say("unknown.2");
          await frame("unknown.3", 1);
          await n.say("unknown.4");
          await frame("unknown.5", 2);
        },
      },
      {
        id: "not",
        title: "Not equal drops NULLs",
        async script(n, scene) {
          scene.innerHTML = `<div class="sq-predict"><pre class="sq-code">${DSL.Sql.highlight(S.Q.notLisbon)}</pre></div>`;
          await n.say("not.1");
          await n.say("not.ask");
          const guess = await n.choose([["seven", "7"], ["six", "6"], ["three", "3"]], { label: "Predict" });
          const frame = story(n, scene, S.notStory());
          await frame(`not.${guess}`, 0);
          await frame("not.2", 1);
          await frame("not.3", 2);
          await n.say("not.4");
        },
      },
      {
        id: "away",
        title: "Your turn: outside Lisbon",
        async script(n) {
          await exercise(n, S.awayChallenge(), "away", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      {
        id: "notin",
        title: "The NOT IN trap",
        async script(n, scene) {
          const frame = story(n, scene, S.notinStory());
          await frame("notin.1", 0);
          await n.say("notin.ask");
          const guess = await n.choose([["two", "2"], ["zero", "0"], ["ten", "10"]], { label: "Predict" });
          await n.say(`notin.${guess}`);
          await frame("notin.2", 1);
          await frame("notin.3", 2);
          await n.say("notin.4");
          await frame("notin.5", 3);
        },
      },
      {
        id: "never",
        title: "Your turn: fix NOT IN",
        async script(n) {
          await exercise(n, S.neverChallenge(), "never", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      {
        id: "expr",
        title: "NULL spreads",
        async script(n, scene) {
          const frame = story(n, scene, S.exprStory());
          await frame("expr.1", 0);
          await n.say("expr.2");
          await frame("expr.3", 1);
        },
      },
      {
        id: "avg",
        title: "NULL in averages",
        async script(n, scene) {
          const frame = story(n, scene, S.avgStory());
          await n.say("avg.1");
          await frame("avg.2", 0);
          await frame("avg.3", 1);
          await n.say("avg.4");
        },
      },
      {
        id: "phone",
        title: "Your turn: a default",
        async script(n) {
          await exercise(n, S.phoneChallenge(), "phone", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      DSL.Narrator.quizChapter({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Vocab.reviewChapter("null"),
      {
        id: "finish",
        title: "Wrap-up",
        async script(n) {
          n.mount(DSL.Guided.finishBeat({
            lessonId: "null",
            badges: [["❓", "Unknown", "test with IS NULL"], ["🚫", "NOT IN", "breaks on a NULL"], ["🩹", "COALESCE", "a default, on purpose"]],
          }));
          await n.say("finish.1");
          await n.say("finish.2");
        },
      },
    ];
  }

  DSL.registerNarrated("null", () => DSL.Narrator.run({
    lessonId: "null",
    title: `${DSL.lessonNumber("null")} · NULL traps`,
    chapters: makeChapters(),
  }), { complete: true });
})(window.DataSystemsLab);
