(function registerModelsNarrated(DSL) {
  "use strict";

  // Narrated mode for relational, document and graph models: the focused version, on the scenes
  // from models-guided.js. Lines live in narration/models.json.

  const S = DSL.ModelsScenes;
  const { exercise } = DSL.SqlScenes;

  function makeChapters() {
    const M = DSL.ModelsModel;
    const story = (n, scene, board) => DSL.Narrator.story(n, scene, board);
    const reactions = ["error", "extra", "missing", "columns"];

    return [
      {
        id: "hook",
        title: "Three shapes",
        async script(n, scene) {
          scene.innerHTML = `<div class="md-picks">${[["🗃️", "Tables"], ["📄", "Documents"], ["🕸️", "Graphs"]].map(([icon, name], i) => `<div class="md-pick on" style="--i:${i}"><span>${icon}</span><b>${name}</b></div>`).join("")}</div>`;
          await n.say("hook.1");
          await n.say("hook.2");
          await n.say("hook.3");
        },
      },
      {
        id: "rel",
        title: "Tables",
        async script(n, scene) {
          const frame = story(n, scene, S.relStory());
          await frame("rel.1", 0);
          await frame("rel.2", 1);
        },
      },
      {
        id: "doc",
        title: "Documents",
        async script(n, scene) {
          const frame = story(n, scene, S.docStory());
          await frame("doc.1", 0);
          await frame("doc.2", 1);
          await frame("doc.3", 2);
          await n.say("doc.ask");
          const guess = await n.choose([["one", "1"], ["four", "4"], ["sixteen", "16"]], { label: "Predict" });
          await frame(`doc.${guess}`, 3);
          await n.say("doc.4");
        },
      },
      {
        id: "names",
        title: "Your turn: inside a document",
        async script(n) { await exercise(n, S.namesChallenge(), "names", { reactions }); },
      },
      {
        id: "schema",
        title: "Schema on write, or on read",
        async script(n, scene) {
          const frame = story(n, scene, S.schemaStory());
          await frame("schema.1", 0);
          await frame("schema.2", 1);
          await frame("schema.3", 2);
          await n.say("schema.4");
        },
      },
      {
        id: "graph",
        title: "Graphs",
        async script(n, scene) {
          const frame = story(n, scene, S.graphStory());
          await frame("graph.1", 0);
          await frame("graph.2", 1);
          await frame("graph.3", 2);
          await frame("graph.4", 3);
          await n.say("graph.5");
        },
      },
      {
        id: "net",
        title: "Your turn: traverse",
        async script(n) { await exercise(n, S.netChallenge(), "net", { reactions }); },
      },
      {
        id: "pick",
        title: "Which shape when",
        async script(n, scene) {
          const frame = story(n, scene, S.pickStory());
          await n.say("pick.1");
          await frame("pick.2", 0);
          await frame("pick.3", 1);
          await frame("pick.4", 2);
          await n.say("pick.ask");
          const guess = await n.choose([["relational", "Relational"], ["document", "Document"], ["graph", "Graph"]], { label: "Your call" });
          await n.say(`pick.${guess}`);
          await n.say("pick.5");
        },
      },
      DSL.Narrator.quizChapter({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Vocab.reviewChapter("models"),
      {
        id: "finish",
        title: "Wrap-up",
        async script(n) {
          n.mount(DSL.Guided.finishBeat({
            lessonId: "models",
            badges: [["🗃️", "Tables", "each fact once"], ["📄", "Documents", "read together, stored together"], ["🕸️", "Graphs", "links to any depth"]],
          }));
          await n.say("finish.1");
          await n.say("finish.2");
        },
      },
    ];
  }

  DSL.registerNarrated("models", () => DSL.Narrator.run({
    lessonId: "models",
    title: `${DSL.lessonNumber("models")} · Tables, documents, graphs`,
    chapters: makeChapters(),
  }), { complete: true });
})(window.DataSystemsLab);
