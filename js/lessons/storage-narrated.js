(function registerStorageNarrated(DSL) {
  "use strict";

  // Narrated mode for lesson 02, on the same scenes and beats as Guided mode.
  // Lines live in narration/pages.json.

  const S = DSL.StorageScenes;
  const { retrigger, burst } = DSL.LabKit;

  // Resolves with the id of the row the learner taps (only rows that aren't disabled).
  const tapRow = (shelf) => (finish) => shelf.addEventListener("click", (event) => {
    const row = event.target.closest(".st-row");
    if (row && !row.disabled) finish(Number(row.dataset.id));
  });

  // Put a storyboard on stage; frame(line, i) speaks a line while frame i animates.
  function storyStage(n, scene, story) {
    scene.innerHTML = `<div class="gd-story-stage"></div>`;
    const ctx = story.build(scene.firstElementChild);
    return (line, i) => Promise.all([n.say(line), n.show(() => story.frames[i].enter(ctx, n))]);
  }

  function makeChapters() {
    const M = DSL.StorageModel;
    const B = Object.fromEntries(S.beats().map((beat) => [beat.id, beat]));

    return [
      {
        id: "teach-page",
        title: "What is a page?",
        async script(n, scene) {
          const frame = storyStage(n, scene, S.pageStory(M));
          await frame("teach-page.1", 0);
          await frame("teach-page.2", 1);
          await frame("teach-page.3", 2);
          await n.say("teach-page.why-ask");
          const why = await n.choose([["why", "Why 8 KB, though?"], ["go", "Makes sense. Keep going."]]);
          if (why === "why") {
            await n.say("teach-page.why");
            await n.say("teach-page.why-2");
          } else {
            await n.say("teach-page.skip");
          }
          await frame("teach-page.4", 3);
          await frame("teach-page.5", 4);
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
        id: "teach-cache",
        title: "Memory is a cache",
        async script(n, scene) {
          const frame = storyStage(n, scene, S.cacheStory(M));
          for (let i = 0; i < 5; i += 1) await frame(`teach-cache.${i + 1}`, i);
          await n.say("teach-cache.6");
        },
      },
      {
        id: "hit",
        title: "Miss, then hit",
        async script(n) {
          const done = n.mount(B.hit, { onEvent: (name) => { if (name === "miss") n.react("hit.miss"); } });
          await n.say("hit.1");
          await n.say("hit.ask");
          await n.ask(done, { hint: "hit.hint", highlight: ".gd-big" });
          await n.say("hit.hit");
          await n.say("hit.outro");
        },
      },
      {
        id: "bet",
        title: "Place your bets",
        async script(n) {
          let result = { score: 0, total: 0 };
          const done = n.mount(B.bet, {
            onEvent(name, data) {
              if (name === "bet") n.react(`bet.${data.right ? "right" : "wrong"}-${data.outcome}`);
              if (name === "score") result = data;
            },
          });
          await n.say("bet.1");
          await n.say("bet.2");
          await n.say("bet.ask");
          await n.ask(done, { hint: "bet.hint", highlight: ".bp-slots .bp-card", label: "Your bets" });
          await n.say(result.score >= 5 ? "bet.sharp" : "bet.ok", result);
        },
      },
      {
        id: "teach-evict",
        title: "Who gets evicted?",
        async script(n, scene) {
          const frame = storyStage(n, scene, S.evictStory(M));
          await frame("teach-evict.1", 0);
          await frame("teach-evict.2", 1);
          await n.say("teach-evict.ask");
          const pick = await n.choose([["p1", "P1: it arrived first"], ["p5", "P5: nobody's used it lately"]]);
          await n.say(`teach-evict.${pick}`);
          await frame("teach-evict.3", 2);
          await frame("teach-evict.4", 3);
          await frame("teach-evict.5", 4);
        },
      },
      {
        id: "evict",
        title: "You pick the victim",
        async script(n) {
          let right = false;
          const done = n.mount(B.evict, { onEvent: (name, data) => { if (name === "evict") right = data.right; } });
          await n.say("evict.1");
          await n.say("evict.ask");
          await n.ask(done, { hint: "evict.hint", highlight: ".gd-pick" });
          await n.say(right ? "evict.right" : "evict.wrong");
        },
      },
      {
        id: "race",
        title: "FIFO vs LRU",
        async script(n) {
          let reads = { lru: 0, fifo: 0 };
          const done = n.mount(B.race, { onEvent: (name, data) => { if (name === "race") reads = data; } });
          await n.say("race.1");
          await n.say("race.predict");
          const guess = await n.choose([["fifo", "FIFO"], ["lru", "LRU"], ["same", "About the same"]], { label: "Predict" });
          await n.say("race.guess");
          await n.say("race.ask");
          await n.ask(done, { hint: "race.hint", highlight: ".gd-big" });
          await n.say("race.result", reads);
          if (guess === "lru") await n.say("race.called-it");
          await n.say("race.explain");
        },
      },
      {
        id: "teach-locality",
        title: "Where do rows live?",
        async script(n, scene) {
          const frame = storyStage(n, scene, S.localityStory(M));
          for (let i = 0; i < 4; i += 1) await frame(`teach-locality.${i + 1}`, i);
        },
      },
      {
        id: "head",
        title: "Be the read head",
        async script(n) {
          const done = n.mount(B.head, { onEvent: (name) => { if (name === "phase") n.react("head.phase"); } });
          await n.say("head.1");
          await n.say("head.ask");
          await n.ask(done, { hint: "head.hint", highlight: ".gd-target" });
          await n.say("head.result");
          await n.say("head.outro");
        },
      },
      {
        id: "cache",
        title: "Cold vs warm",
        async script(n) {
          const done = n.mount(B.cache);
          await n.say("cache.1");
          await n.say("cache.ask");
          await n.ask(done, { hint: "cache.hint", highlight: ".gd-switch" });
          await n.say("cache.warm");
          await n.say("cache.2");
          const reply = await n.choose([["ram", "So… just buy more RAM?"], ["got", "Got it."]]);
          await n.say(`cache.${reply}`);
        },
      },
      {
        id: "quiz",
        title: "Quick check",
        async script(n, scene) {
          scene.innerHTML = `<div class="gd-quiz nr-quiz">
            <span class="gd-q-count"></span>
            <div class="nr-marks">${M.QUIZ.map(() => "<i></i>").join("")}</div>
          </div>`;
          const count = scene.querySelector(".gd-q-count");
          const marks = [...scene.querySelectorAll(".nr-marks i")];
          let right = 0;
          await n.say("quiz.intro");
          for (const [i, question] of M.QUIZ.entries()) {
            count.textContent = `Question ${i + 1} of ${M.QUIZ.length}`;
            marks[i].className = "current";
            await n.say(`quiz.q${i + 1}`);
            const pick = await n.choose(question.options.map((option, j) => [String(j), option]), { label: "Your answer" });
            const correct = Number(pick) === question.answer;
            marks[i].className = correct ? "ok" : "bad";
            marks[i].textContent = correct ? "✓" : "✗";
            retrigger(marks[i], "gd-pop");
            if (correct) {
              right += 1;
              burst(marks[i], { count: 12 });
              await n.say(`quiz.right${(i % 3) + 1}`);
            } else {
              await n.say(`quiz.q${i + 1}-why`);
            }
          }
          count.textContent = `${right} / ${M.QUIZ.length}`;
          const passed = right >= 3;
          if (passed) M.progress.complete("quiz");
          await n.say(passed ? "quiz.pass" : "quiz.retry", { right });
        },
      },
      {
        id: "finish",
        title: "Wrap-up",
        async script(n) {
          n.mount(DSL.Guided.finishBeat({
            lessonId: "pages",
            badges: [["📄", "Whole pages", "one row costs 8 KB"], ["⚡", "Hits are cheap", "RAM is 80× faster"], ["🎯", "Neighbours win", "locality beats luck"]],
          }));
          await n.say("finish.1");
          await n.say("finish.2");
        },
      },
    ];
  }

  DSL.registerNarrated("pages", () => DSL.Narrator.run({
    lessonId: "pages",
    title: `${DSL.lessonNumber("pages")} · Pages, not rows`,
    chapters: makeChapters(),
    onLab: (id) => DSL.StorageModel.progress.complete(id),
  }), { complete: true });
})(window.DataSystemsLab);
