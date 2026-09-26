(function registerModelingNarrated(DSL) {
  "use strict";

  // Narrated mode for lesson 01, on the same stories and beats as Guided mode.
  // Lines live in narration/modeling.json.

  const S = DSL.ModelingScenes;

  function makeChapters() {
    const M = DSL.ModelingModel;
    const B = Object.fromEntries(S.beats().map((beat) => [beat.id, beat]));

    return [
      DSL.Practice.goalsChapter(M.PRACTICE),
      {
        id: "teach-copies",
        title: "What goes wrong with copies?",
        async script(n, scene) {
          const frame = DSL.Narrator.story(n, scene, S.copiesStory(M));
          await frame("teach-copies.1", 0);
          await frame("teach-copies.2", 1);
          await n.say("teach-copies.ask");
          const guess = await n.choose([["one", "Someone updates only one copy"], ["fine", "Nothing. It's just a phone number"]], { label: "Predict" });
          await n.say(`teach-copies.${guess}`);
          await frame("teach-copies.3", 2);
          await frame("teach-copies.4", 3);
          await frame("teach-copies.5", 4);
          await n.say("teach-copies.6");
        },
      },
      {
        id: "hunt",
        title: "Fix every copy",
        async script(n) {
          let result = { found: false, missed: 0 };
          const wrong = DSL.Narrator.throttled(n, "hunt.wrong");
          const done = n.mount(B.hunt, {
            onEvent(name, data) {
              if (name === "wrong-ticket") wrong();
              if (name === "hunt") result = data;
            },
          });
          await n.say("hunt.1");
          await n.say("hunt.ask");
          await n.ask(done, { hint: "hunt.hint", highlight: ".gm-start", label: "Your turn" });
          await n.say(result.found ? "hunt.found" : "hunt.missed", result);
          await n.say("hunt.outro");
        },
      },
      {
        id: "cancel",
        title: "Cancel Ana's order",
        async script(n) {
          const done = n.mount(B.cancel);
          await n.say("cancel.1");
          await n.say("cancel.ask");
          await n.ask(done, { hint: "cancel.hint", highlight: ".gm-trash:not(:disabled)" });
          await n.say("cancel.gone");
          await n.say("cancel.2");
        },
      },
      {
        id: "teach-lists",
        title: "One list per kind of thing",
        async script(n, scene) {
          const frame = DSL.Narrator.story(n, scene, S.listsStory(M));
          await frame("teach-lists.1", 0);
          await frame("teach-lists.2", 1);
          await frame("teach-lists.3", 2);
          await frame("teach-lists.4", 3);
          await n.say("teach-lists.ask");
          const guess = await n.choose([["one", "One"], ["two", "Two, one per order"]], { label: "Predict" });
          await n.say(`teach-lists.${guess}`);
          await frame("teach-lists.5", 4);
          await n.say("teach-lists.6");
        },
      },
      {
        id: "sort",
        title: "Sort the facts",
        async script(n) {
          const wrong = DSL.Narrator.throttled(n, "sort.wrong");
          const done = n.mount(B.sort, { onEvent: (name) => { if (name === "sort-wrong") wrong(); } });
          await n.say("sort.1");
          await n.say("sort.ask");
          await n.ask(done, { hint: "sort.hint", highlight: ".gm-bin", label: "Your turn" });
          await n.say("sort.done");
        },
      },
      {
        id: "one-edit",
        title: "One edit",
        async script(n) {
          const done = n.mount(B["one-edit"], { onEvent: (name) => { if (name === "edited") n.react("edit.edited"); } });
          await n.say("edit.1");
          await n.say("edit.ask");
          await n.ask(done, { hint: "edit.hint", highlight: ".gm-edit, .gm-trash:not(:disabled)" });
          await n.say("edit.kept");
        },
      },
      {
        id: "teach-join",
        title: "Reading it back: joins",
        async script(n, scene) {
          const frame = DSL.Narrator.story(n, scene, S.joinStory(M));
          for (let i = 0; i < 4; i += 1) await frame(`teach-join.${i + 1}`, i);
          await n.say("teach-join.ask");
          const reply = await n.choose([["yes", "Yes. The data is always right"], ["slow", "Sounds slow"]]);
          await n.say(`teach-join.${reply}`);
        },
      },
      {
        id: "assemble",
        title: "Join by hand",
        async script(n) {
          const wrong = DSL.Narrator.throttled(n, "assemble.wrong");
          const done = n.mount(B.assemble, {
            onEvent(name, data) {
              if (name === "wrong-row") wrong();
              if (name === "lookup" && data.n < 3) n.react(`assemble.l${data.n}`);
            },
          });
          await n.say("assemble.1");
          await n.say("assemble.ask");
          await n.ask(done, { hint: "assemble.hint", highlight: "[data-pick]", label: "Your turn" });
          await n.say("assemble.done");
        },
      },
      {
        id: "teach-owner",
        title: "Copies, on purpose",
        async script(n, scene) {
          const frame = DSL.Narrator.story(n, scene, S.ownerStory(M));
          for (let i = 0; i < 5; i += 1) await frame(`teach-owner.${i + 1}`, i);
          await n.say("teach-owner.6");
        },
      },
      {
        id: "fix-report",
        title: "Fix the slow report",
        async script(n) {
          const done = n.mount(B["fix-report"], { onEvent: (name, data) => { if (name === "month") n.react(`fix.${data.key}`); } });
          await n.say("fix.1");
          await n.say("fix.ask");
          await n.ask(done, { hint: "fix.hint", highlight: ".response-card", label: "Your call" });
          await n.say("fix.outro");
        },
      },
      DSL.Practice.recapChapter(M.PRACTICE),
      DSL.Practice.checkChapter(M.PRACTICE, { onPass: () => M.progress.complete("quiz") }),
      DSL.Practice.interviewChapter(M.PRACTICE),
      DSL.Vocab.reviewChapter("modeling"),
      {
        id: "finish",
        title: "Wrap-up",
        async script(n) {
          n.mount(DSL.Guided.finishBeat({
            lessonId: "modeling",
            before: () => DSL.Practice.goalsSummary(M.PRACTICE),
            badges: [["🧾", "One fact, one place", "an edit stays one edit"], ["🔗", "Pointers, not copies", "keys link the lists"], ["🧷", "Copies need an owner", "or they drift"]],
          }));
          await n.say("finish.1");
          await n.say("finish.2");
        },
      },
    ];
  }

  DSL.registerNarrated("modeling", () => DSL.Narrator.run({
    lessonId: "modeling",
    title: `${DSL.lessonNumber("modeling")} · One fact, one place`,
    chapters: makeChapters(),
    onLab: (id) => DSL.ModelingModel.progress.complete(id),
  }), { complete: true });
})(window.DataSystemsLab);
