(function registerKeysNarrated(DSL) {
  "use strict";

  // Narrated mode for relationships and keys: the focused version, on the scenes from
  // keys-guided.js. Lines live in narration/keys.json.

  const S = DSL.KeysScenes;
  const { exercise } = DSL.SqlScenes;

  function makeChapters() {
    const M = DSL.KeysModel;
    const story = (n, scene, board) => DSL.Narrator.story(n, scene, board);
    const reactions = ["error", "extra", "missing", "columns"];

    return [
      {
        id: "hook",
        title: "Pointers you can trust",
        async script(n, scene) {
          scene.innerHTML = `<div class="gp-hook">${[["Every customer, exactly once", "PRIMARY KEY"], ["No shared phone numbers", "UNIQUE"], ["No order for a customer who isn't there", "FOREIGN KEY"]].map(([what, tool], i) => `<div class="gp-question" style="--i:${i}"><b>${what}</b><code>${tool}</code></div>`).join("")}</div>`;
          await n.say("hook.1");
          await n.say("hook.2");
          await n.say("hook.3");
        },
      },
      {
        id: "pk",
        title: "Primary keys",
        async script(n, scene) {
          const frame = story(n, scene, S.pkStory());
          await frame("pk.1", 0);
          await frame("pk.2", 1);
          await frame("pk.3", 2);
          await n.say("pk.4");
        },
      },
      {
        id: "uniq",
        title: "UNIQUE, and NULL",
        async script(n, scene) {
          const frame = story(n, scene, S.uniqueStory());
          await n.say("uniq.1");
          await frame("uniq.2", 0);
          await n.say("uniq.ask");
          const guess = await n.choose([["yes", "Yes"], ["no", "No"]], { label: "Predict" });
          await frame(`uniq.${guess}`, 1);
          await n.say("uniq.3");
        },
      },
      {
        id: "phone",
        title: "Your turn: no shared phones",
        async script(n) { await exercise(n, S.phoneChallenge(), "phone", { reactions }); },
      },
      {
        id: "fk",
        title: "Foreign keys",
        async script(n, scene) {
          const frame = story(n, scene, S.fkStory());
          await frame("fk.1", 0);
          await frame("fk.2", 1);
          await frame("fk.3", 2);
        },
      },
      {
        id: "del",
        title: "Deleting what's pointed at",
        async script(n, scene) {
          const frame = story(n, scene, S.deleteStory());
          await n.say("del.1");
          await n.say("del.ask");
          const guess = await n.choose([["error", "It's refused"], ["cascade", "Her orders are deleted too"], ["dangle", "Her orders keep pointing at her"]], { label: "Predict" });
          await frame(`del.${guess}`, 0);
          await frame("del.2", 1);
          await frame("del.3", 2);
        },
      },
      {
        id: "addr",
        title: "Your turn: addresses",
        async script(n) { await exercise(n, S.addressChallenge(), "addr", { reactions }); },
      },
      {
        id: "card",
        title: "One, many, many-to-many",
        async script(n, scene) {
          const frame = story(n, scene, S.cardStory());
          await n.say("card.1");
          await frame("card.2", 0);
          await frame("card.3", 1);
          await frame("card.4", 2);
          await n.say("card.5");
          await frame("card.6", 3);
        },
      },
      {
        id: "fav",
        title: "Your turn: favourites",
        async script(n) { await exercise(n, S.favChallenge(), "fav", { reactions }); },
      },
      DSL.Narrator.quizChapter({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Vocab.reviewChapter("keys"),
      {
        id: "finish",
        title: "Wrap-up",
        async script(n) {
          n.mount(DSL.Guided.finishBeat({
            lessonId: "keys",
            badges: [["🔑", "Keys", "unique, never empty"], ["🔗", "Foreign keys", "no pointer to nothing"], ["🧩", "Junctions", "many-to-many, by pairs"]],
          }));
          await n.say("finish.1");
          await n.say("finish.2");
        },
      },
    ];
  }

  DSL.registerNarrated("keys", () => DSL.Narrator.run({
    lessonId: "keys",
    title: `${DSL.lessonNumber("keys")} · Relationships and keys`,
    chapters: makeChapters(),
  }), { complete: true });
})(window.DataSystemsLab);
