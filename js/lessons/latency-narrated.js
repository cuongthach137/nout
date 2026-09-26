(function registerLatencyNarrated(DSL) {
  "use strict";

  // Narrated mode for latency, throughput and percentiles: the focused version, on the scenes
  // from latency-guided.js. Lines live in narration/latency.json.

  const S = DSL.LatencyScenes;
  const { exercise } = DSL.SqlScenes;

  function makeChapters() {
    const M = DSL.LatencyModel;
    const story = (n, scene, board) => DSL.Narrator.story(n, scene, board);
    const reactions = ["error", "extra", "missing", "columns"];

    return [
      {
        id: "hook",
        title: "Fast, on average",
        async script(n, scene) {
          scene.innerHTML = `<div class="gp-hook"><div class="gp-question" style="--i:0"><b>Dashboard: average page</b><code>170 ms</code></div><div class="gp-question" style="--i:1"><b>Customer: “the site is slow”</b><code>?</code></div></div>`;
          await n.say("hook.1");
          await n.say("hook.2");
        },
      },
      {
        id: "terms",
        title: "Latency and throughput",
        async script(n, scene) {
          const frame = story(n, scene, S.flowStory());
          await frame("terms.1", 0);
          await frame("terms.2", 1);
          await frame("terms.3", 2);
          await frame("terms.4", 3);
        },
      },
      {
        id: "dist",
        title: "A distribution, not a number",
        async script(n, scene) {
          const frame = story(n, scene, S.histStory());
          await frame("dist.1", 0);
          await frame("dist.2", 1);
          await frame("dist.3", 2);
          await n.say("dist.ask");
          const guess = await n.choose([["mean", "170 ms"], ["median", "101 ms"], ["fifty", "50 ms"]], { label: "Predict" });
          await frame(`dist.${guess}`, 3);
          await n.say("dist.4");
        },
      },
      {
        id: "tail",
        title: "The tail",
        async script(n, scene) {
          const frame = story(n, scene, S.histStory());
          await frame("tail.1", 4);
          await frame("tail.2", 5);
          await n.say("tail.3");
          await n.say("tail.4");
        },
      },
      {
        id: "p99",
        title: "Your turn: the p99",
        async script(n) { await exercise(n, S.p99Challenge(), "p99", { reactions }); },
      },
      {
        id: "amp",
        title: "Fan-out",
        async script(n, scene) {
          const frame = story(n, scene, S.ampStory());
          await frame("amp.1", 0);
          await n.say("amp.2");
          await n.say("amp.ask");
          const guess = await n.choose([["one", "About 1%"], ["ten", "About 10%"], ["half", "About 50%"]], { label: "Predict" });
          await frame(`amp.${guess}`, 1);
          await frame("amp.3", 2);
        },
      },
      {
        id: "queue",
        title: "Waiting in line",
        async script(n, scene) {
          const frame = story(n, scene, S.queueStory());
          await frame("queue.1", 0);
          await frame("queue.2", 1);
          await frame("queue.3", 2);
          await n.say("queue.4");
        },
      },
      {
        id: "checkout",
        title: "Your turn: the promise",
        async script(n) { await exercise(n, S.checkoutChallenge(), "checkout", { reactions }); },
      },
      DSL.Narrator.quizChapter({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Vocab.reviewChapter("latency"),
      {
        id: "finish",
        title: "Wrap-up",
        async script(n) {
          n.mount(DSL.Guided.finishBeat({
            lessonId: "latency",
            badges: [["📊", "Percentiles", "not averages"], ["🐢", "The tail", "p99 is a person"], ["🚦", "Headroom", "queues explode near 100%"]],
          }));
          await n.say("finish.1");
          await n.say("finish.2");
        },
      },
    ];
  }

  DSL.registerNarrated("latency", () => DSL.Narrator.run({
    lessonId: "latency",
    title: `${DSL.lessonNumber("latency")} · Latency and percentiles`,
    chapters: makeChapters(),
  }), { complete: true });
})(window.DataSystemsLab);
