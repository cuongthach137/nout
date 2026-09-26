(function registerJoinsNarrated(DSL) {
  "use strict";

  // Narrated mode for the joins lesson: the focused version, on the scenes from joins-guided.js.
  // Lines live in narration/joins.json.

  const S = DSL.JoinsScenes;
  const { exercise } = DSL.SqlScenes;

  function makeChapters() {
    const M = DSL.JoinsModel;
    const story = (n, scene, board) => DSL.Narrator.story(n, scene, board);

    return [
      {
        id: "hook",
        title: "Tables that point",
        async script(n, scene) {
          const b = S.joinBoard(scene);
          await n.after(b.load());
          await n.say("hook.1");
          b.right.querySelectorAll('.jn-item[data-fk="1"]').forEach((item) => item.classList.add("jn-kept"));
          b.left.querySelector('[data-key="1"]').classList.add("jn-kept");
          await n.say("hook.2");
          await n.say("hook.3");
        },
      },
      {
        id: "inner",
        title: "Inner join",
        async script(n, scene) {
          const frame = story(n, scene, S.innerStory());
          await frame("inner.1", 0);
          await frame("inner.2", 1);
          await frame("inner.3", 2);
          await frame("inner.4", 3);
          await n.say("inner.ask");
          const guess = await n.choose([["sixteen", "16"], ["fourteen", "14"], ["ten", "10"]], { label: "Predict" });
          await n.say(`inner.${guess}`);
          await frame("inner.5", 4);
          await n.say("inner.6");
        },
      },
      {
        id: "left",
        title: "Left join",
        async script(n, scene) {
          const frame = story(n, scene, S.leftStory());
          await frame("left.1", 0);
          await frame("left.2", 1);
          await frame("left.3", 2);
          await n.say("left.4");
        },
      },
      {
        id: "never",
        title: "Your turn: never ordered",
        async script(n) {
          await exercise(n, S.neverChallenge(), "never", { reactions: ["error", "extra", "missing", "columns"], before: ["2"] });
        },
      },
      {
        id: "trap",
        title: "The WHERE trap",
        async script(n, scene) {
          const frame = story(n, scene, S.trapStory());
          await n.say("trap.1");
          await frame("trap.2", 0);
          await n.say("trap.ask");
          const guess = await n.choose([["yes", "Yes: it's a left join"], ["no", "No"]], { label: "Predict" });
          await n.say(`trap.${guess}`);
          await frame("trap.3", 1);
          await n.say("trap.4");
          await frame("trap.5", 2);
          await n.say("trap.6");
        },
      },
      {
        id: "full",
        title: "Right and full joins",
        async script(n, scene) {
          const frame = story(n, scene, S.fullStory());
          await frame("full.1", 0);
          await frame("full.2", 1);
          await n.say("full.3");
        },
      },
      {
        id: "fanout",
        title: "Joins can multiply",
        async script(n, scene) {
          const frame = story(n, scene, S.fanoutStory());
          await frame("fanout.1", 0);
          await frame("fanout.2", 1);
          await frame("fanout.3", 2);
          await frame("fanout.4", 3);
          await n.say("fanout.5");
          await n.say("fanout.6");
        },
      },
      {
        id: "walk",
        title: "Your turn: keep the walk-ins",
        async script(n) {
          await exercise(n, S.walkChallenge(), "walk", { reactions: ["error", "extra", "missing", "columns"] });
        },
      },
      DSL.Narrator.quizChapter({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Vocab.reviewChapter("joins"),
      {
        id: "finish",
        title: "Wrap-up",
        async script(n) {
          n.mount(DSL.Guided.finishBeat({
            lessonId: "joins",
            badges: [["🔗", "Inner", "only matched pairs"], ["🫱", "Outer", "keep a side, pad with NULL"], ["✖️", "Multiply", "fan-out and cross joins"]],
          }));
          await n.say("finish.1");
          await n.say("finish.2");
        },
      },
    ];
  }

  DSL.registerNarrated("joins", () => DSL.Narrator.run({
    lessonId: "joins",
    title: `${DSL.lessonNumber("joins")} · Join types`,
    chapters: makeChapters(),
  }), { complete: true });
})(window.DataSystemsLab);
