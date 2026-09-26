(function registerGroupNarrated(DSL) {
  "use strict";

  // Narrated mode for GROUP BY and HAVING: the focused version, on the scenes from
  // group-guided.js. Lines live in narration/group.json.

  const S = DSL.GroupScenes;
  const { exercise } = DSL.SqlScenes;

  function makeChapters() {
    const M = DSL.GroupModel;
    const story = (n, scene, board) => DSL.Narrator.story(n, scene, board);

    return [
      {
        id: "hook",
        title: "From rows to numbers",
        async script(n, scene) {
          scene.innerHTML = `<div class="gp-hook">${[["How many orders?", "COUNT"], ["What sells best?", "SUM"], ["Who are the regulars?", "HAVING"]].map(([question, tool], i) => `<div class="gp-question" style="--i:${i}"><b>${question}</b><code>${tool}</code></div>`).join("")}</div>`;
          await n.say("hook.1");
          await n.say("hook.2");
          await n.say("hook.3");
        },
      },
      {
        id: "agg",
        title: "Many rows, one value",
        async script(n, scene) {
          const frame = story(n, scene, S.aggStory());
          await frame("agg.1", 0);
          await frame("agg.2", 1);
          await frame("agg.3", 2);
          await frame("agg.4", 3);
        },
      },
      {
        id: "count",
        title: "COUNT(*) or COUNT(column)",
        async script(n, scene) {
          scene.innerHTML = `<div class="sq-predict"><pre class="sq-code">${DSL.Sql.highlight("SELECT COUNT(phone)\nFROM customers;")}</pre></div>`;
          await n.say("count.ask");
          const guess = await n.choose([["ten", "10"], ["seven", "7"], ["three", "3"]], { label: "Predict" });
          await n.say(`count.${guess}`);
          const frame = story(n, scene, S.countStory());
          await frame("count.1", 0);
        },
      },
      {
        id: "group",
        title: "One row per group",
        async script(n, scene) {
          const frame = story(n, scene, S.groupStory());
          await frame("group.1", 0);
          await frame("group.2", 1);
          await frame("group.3", 2);
          await frame("group.4", 3);
          await n.say("group.5");
        },
      },
      {
        id: "city",
        title: "Your turn: per city",
        async script(n) {
          await exercise(n, S.cityChallenge(), "city", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      {
        id: "bare",
        title: "Grouped or aggregated",
        async script(n, scene) {
          const frame = story(n, scene, S.bareStory());
          await frame("bare.1", 0);
          await n.say("bare.2");
          await frame("bare.3", 1);
          await frame("bare.4", 2);
        },
      },
      {
        id: "having",
        title: "Filter the groups",
        async script(n, scene) {
          const frame = story(n, scene, S.havingStory());
          await frame("having.1", 0);
          await n.say("having.2");
          await frame("having.3", 1);
          await frame("having.4", 2);
          await n.say("having.ask");
          const guess = await n.choose([["yes", "Yes"], ["no", "No"]], { label: "Predict" });
          await frame(`having.${guess}`, 3);
          await frame("having.5", 4);
        },
      },
      {
        id: "best",
        title: "Your turn: best sellers",
        async script(n) {
          await exercise(n, S.bestChallenge(), "best", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      {
        id: "fanout",
        title: "Counting after a join",
        async script(n, scene) {
          const frame = story(n, scene, S.fanoutStory());
          await frame("fanout.1", 0);
          await frame("fanout.2", 1);
          await n.say("fanout.3");
          await frame("fanout.4", 2);
          await n.say("fanout.5");
        },
      },
      DSL.Narrator.quizChapter({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Vocab.reviewChapter("group"),
      {
        id: "finish",
        title: "Wrap-up",
        async script(n) {
          n.mount(DSL.Guided.finishBeat({
            lessonId: "group",
            badges: [["🧮", "Aggregate", "many rows, one value"], ["🗂️", "Group", "one row per group"], ["🚦", "HAVING", "filter the groups"]],
          }));
          await n.say("finish.1");
          await n.say("finish.2");
        },
      },
    ];
  }

  DSL.registerNarrated("group", () => DSL.Narrator.run({
    lessonId: "group",
    title: `${DSL.lessonNumber("group")} · GROUP BY and HAVING`,
    chapters: makeChapters(),
  }), { complete: true });
})(window.DataSystemsLab);
