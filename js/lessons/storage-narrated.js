(function registerStorageNarrated(DSL) {
  "use strict";

  // Narrated mode for lesson 02, first slice: the page explainer and the first two hands-on
  // steps, on the same scenes as Guided mode. Lines live in narration/pages.json.

  const S = DSL.StorageScenes;

  // Resolves with the id of the row the learner taps (only rows that aren't disabled).
  const tapRow = (shelf) => (finish) => shelf.addEventListener("click", (event) => {
    const row = event.target.closest(".st-row");
    if (row && !row.disabled) finish(Number(row.dataset.id));
  });

  function makeChapters() {
    const M = DSL.StorageModel;

    return [
      {
        id: "teach-page",
        title: "What is a page?",
        async script(n, scene) {
          scene.innerHTML = `<div class="gd-story-stage"></div>`;
          const story = S.pageStory(M);
          const ctx = story.build(scene.firstElementChild);
          const frame = (i) => n.show(() => story.frames[i].enter(ctx, n));

          await Promise.all([n.say("teach-page.1"), frame(0)]);
          await Promise.all([n.say("teach-page.2"), frame(1)]);
          await Promise.all([n.say("teach-page.3"), frame(2)]);
          await n.say("teach-page.why-ask");
          const why = await n.choose([["why", "Why 8 KB, though?"], ["go", "Makes sense. Keep going."]]);
          if (why === "why") {
            await n.say("teach-page.why");
            await n.say("teach-page.why-2");
          } else {
            await n.say("teach-page.skip");
          }
          await Promise.all([n.say("teach-page.4"), frame(3)]);
          await Promise.all([n.say("teach-page.5"), frame(4)]);
          await n.wait(900);
        },
      },
      {
        id: "page",
        title: "Fetch one row",
        async script(n, scene) {
          const st = n.state;
          Object.assign(st, { open: null, wanted: [], asked: 0, read: 0 });
          const ui = S.anatomyScene(M, scene);

          await n.say("page.1");
          await n.say("page.predict");
          st.guess = await n.choose([["row", "Just that one row"], ["page", "The whole page it's on"], ["table", "The whole table"]], { label: "Predict" });
          await n.say(`page.predict-${st.guess}`);
          await n.say("page.ask");
          const id = await n.ask(tapRow(ui.shelf), { hint: "page.hint", highlight: ".st-row" });
          await n.show(() => S.openRow(M, ui, st, id, n));
          await n.say("page.got", { asked: st.asked });
          if (st.guess === "page") await n.say("page.called-it");
          await n.say("page.amp");
        },
      },
      {
        id: "neighbour",
        title: "Its neighbours",
        continues: true,
        async script(n, scene) {
          const st = n.state;
          if (st.open === null || st.open === undefined) Object.assign(st, { open: 2, wanted: [11], asked: M.customer(11).bytes, read: M.PAGE_BYTES });
          const ui = S.anatomyScene(M, scene);
          S.paintAnatomy(M, ui, st, { animate: false });

          await n.say("neighbour.1");
          S.markNeighbours(M, ui, st);
          await n.say("neighbour.ask");
          const id = await n.ask(tapRow(ui.shelf), { hint: "neighbour.hint", highlight: ".st-row.gd-hint" });
          S.readNeighbour(M, ui, st, id);
          n.lab("anatomy");
          await n.say("neighbour.free");
          await n.say("neighbour.2");
          await n.say("neighbour.3");
        },
      },
      {
        id: "end",
        title: "More soon",
        async script(n, scene) {
          scene.innerHTML = `<div class="gd-finish">
            <div class="gd-finish-actions">
              <button type="button" class="button primary" data-mode="guided">Continue in Guided mode →</button>
              <button type="button" class="button ghost" data-mode="explore">Open Explore mode</button>
            </div>
          </div>`;
          await n.say("end.1");
        },
      },
    ];
  }

  DSL.registerNarrated("pages", () => DSL.Narrator.run({
    lessonId: "pages",
    title: "02 · Pages, not rows",
    chapters: makeChapters(),
    onLab: (id) => DSL.StorageModel.progress.complete(id),
  }));
})(window.DataSystemsLab);
