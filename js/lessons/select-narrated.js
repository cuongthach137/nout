(function registerSelectNarrated(DSL) {
  "use strict";

  // Narrated mode for the SELECT lesson: the focused version, on the scenes from select-guided.js.
  // Lines live in narration/select.json.

  const S = DSL.SelectScenes;

  // A written exercise: wait for a match, reacting to each wrong run without talking over the learner.
  async function exercise(n, beat, chapter) {
    const reactions = new Map(["error", "timeout", "extra", "duplicates", "missing", "rows", "columns", "order"].map((reason) => {
      const line = { error: "error", timeout: "error", extra: "extra", duplicates: "extra", missing: "missing", rows: "missing", columns: "columns", order: "order" }[reason];
      return [reason, DSL.Narrator.throttled(n, `${chapter}.${line}`, 2500)];
    }));
    const done = n.mount(beat, {
      onEvent(name, data) {
        if (name === "result" && reactions.has(data.reason)) reactions.get(data.reason)();
      },
    });
    await n.say(`${chapter}.1`);
    await n.say(`${chapter}.ask`);
    await n.ask(done, { hint: `${chapter}.hint`, highlight: ".sql-editor" });
    await n.say(`${chapter}.done`);
  }

  function makeChapters() {
    const M = DSL.SelectModel;
    const story = (n, scene, board) => DSL.Narrator.story(n, scene, board);

    return [
      {
        id: "hook",
        title: "Ask the tables",
        async script(n, scene) {
          scene.innerHTML = `<div class="sq-hook">${["customers", "products", "orders", "order_items"].map((name, i) => `<div class="sq-hook-table" style="--i:${i}"><b>${name}</b><span></span></div>`).join("")}</div>`;
          DSL.Sql.describe("bakery").then((tables) => {
            tables.forEach((table) => {
              const card = [...scene.querySelectorAll(".sq-hook-table")].find((el) => el.querySelector("b").textContent === table.name);
              if (card) card.querySelector("span").innerHTML = table.columns.map((column) => `<code>${column.name}</code>`).join("");
            });
          });
          await n.say("hook.1");
          await n.say("hook.2");
          await n.say("hook.3");
        },
      },
      {
        id: "query",
        title: "A query is a question",
        async script(n, scene) {
          const frame = story(n, scene, S.queryStory());
          await frame("query.1", 0);
          await frame("query.2", 1);
          await frame("query.3", 2);
          await frame("query.4", 3);
          await n.say("query.5");
          await n.say("query.6");
        },
      },
      {
        id: "pick",
        title: "Pick the columns",
        async script(n) {
          const said = new Set();
          const done = n.mount(S.pickBeat(), {
            onEvent(name, data) {
              if (name !== "pick" || data.ok) return;
              const line = data.choice === "*" ? "pick.star" : "pick.name";
              if (!said.has(line)) { said.add(line); n.react(line); }
            },
          });
          await n.say("pick.1");
          await n.say("pick.ask");
          await n.ask(done, { hint: "pick.hint", highlight: ".sq-chip" });
          await n.say("pick.done");
          await n.say("pick.2");
        },
      },
      {
        id: "shape",
        title: "Shape the answer",
        async script(n, scene) {
          const frame = story(n, scene, S.shapeStory());
          await frame("shape.1", 0);
          await frame("shape.2", 1);
          await frame("shape.3", 2);
          await n.say("shape.ask");
          const guess = await n.choose([["six", "6"], ["seven", "7"], ["ten", "10"]], { label: "Predict" });
          await n.say(`shape.${guess}`);
          await frame("shape.4", 3);
        },
      },
      {
        id: "where",
        title: "Keep only some rows",
        async script(n, scene) {
          const frame = story(n, scene, S.whereStory());
          await frame("where.1", 0);
          await frame("where.2", 1);
          await frame("where.3", 2);
          await frame("where.4", 3);
          await n.say("where.5");
          await n.say("where.6");
        },
      },
      {
        id: "filter",
        title: "Your turn: filter",
        async script(n) {
          await exercise(n, S.filterChallenge(), "filter");
        },
      },
      {
        id: "andor",
        title: "AND, OR and brackets",
        async script(n, scene) {
          const frame = story(n, scene, S.andorStory());
          await n.say("andor.1");
          await frame("andor.2", 0);
          await n.say("andor.ask");
          const guess = await n.choose([["one", "One: Maya's pending order"], ["two", "Two"]], { label: "Predict" });
          await n.say(`andor.${guess}`);
          await frame("andor.3", 1);
          await frame("andor.4", 2);
          await frame("andor.5", 3);
          await frame("andor.6", 4);
          await n.say("andor.7");
        },
      },
      {
        id: "order",
        title: "Sort, then cut",
        async script(n, scene) {
          const frame = story(n, scene, S.orderStory());
          await frame("order.1", 0);
          await frame("order.2", 1);
          await frame("order.3", 2);
          await frame("order.4", 3);
          await n.say("order.5");
        },
      },
      {
        id: "recent",
        title: "Your turn: newest first",
        async script(n) {
          await exercise(n, S.recentChallenge(), "recent");
        },
      },
      {
        id: "logic",
        title: "The order SQL runs in",
        async script(n, scene) {
          const frame = story(n, scene, S.logicStory());
          await frame("logic.1", 0);
          await frame("logic.2", 1);
          await frame("logic.3", 2);
          await frame("logic.4", 3);
          await n.say("logic.5");
        },
      },
      DSL.Narrator.quizChapter({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Vocab.reviewChapter("select"),
      {
        id: "finish",
        title: "Wrap-up",
        async script(n) {
          n.mount(DSL.Guided.finishBeat({
            lessonId: "select",
            badges: [["🧾", "Shape", "SELECT, AS, DISTINCT"], ["🔎", "Filter", "WHERE, with brackets"], ["🏁", "Sort, then cut", "ORDER BY, LIMIT"]],
          }));
          await n.say("finish.1");
          await n.say("finish.2");
        },
      },
    ];
  }

  DSL.registerNarrated("select", () => DSL.Narrator.run({
    lessonId: "select",
    title: `${DSL.lessonNumber("select")} · SELECT, filter, sort`,
    chapters: makeChapters(),
  }), { complete: true });
})(window.DataSystemsLab);
