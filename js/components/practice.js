(function registerPractice(DSL) {
  "use strict";

  // Lesson goals and the practice that closes each lesson: what you'll be able to do (said at the
  // start), a recap per goal, checks that make you apply each idea, and an interview round (two
  // multiple-choice warm-ups, then one open question with a model answer and a self-rating).
  // Open questions rated "partly" or "missed" join the flashcards.
  //
  // A lesson supplies its data:
  //   practice = {
  //     lessonId,
  //     goals:   [{ id, icon, title, text, snippet, recap, example }],  // 2–3, one per big idea
  //              example = { sql, before?, dataset?, show?, mark?(row, phase) → class, note }, replayed
  //              in the recap. show: rows per table (7 by default). For lessons without SQL, before
  //              and after (in place of sql) are tables { label, columns, rows }, or lists of them.
  //     checks:  [{ id, goal, prompt, options, answer, why }],          // apply an idea, tied to a goal
  //     warmups: [{ id, goal, prompt, options, answer, why }],          // interviewer, multiple choice
  //     open:    { id, goal, prompt, points: [html], answer: html },    // interviewer, open
  //   }
  // Narrated lines it expects, in the lesson's script: goals.intro, goals.1…N; recap.intro,
  // recap.1…N; check.intro, check.q1…N and -why, check.right1–3, check.pass, check.retry;
  // interview.intro, interview.w1…N (speaker interviewer) and -why, interview.right1–2,
  // interview.open (interviewer), interview.think, interview.hint, interview.reveal,
  // interview.rate, interview.got, interview.partly, interview.missed.

  const { retrigger, burst } = DSL.LabKit;
  const key = (lessonId) => `practice-${lessonId}`;
  const read = (lessonId) => {
    const saved = DSL.store.get(key(lessonId), {});
    return { checks: {}, warmups: {}, open: null, ...(saved && typeof saved === "object" ? saved : {}) };
  };
  const write = (lessonId, data) => DSL.store.set(key(lessonId), data);

  function record(lessonId, kind, id, value) {
    const data = read(lessonId);
    if (kind === "open") data.open = value;
    else data[kind][id] = value;
    write(lessonId, data);
  }

  // Per goal: "solid" (every question on it answered right), "revisit" (a miss), or "" (untried).
  function status(practice) {
    const data = read(practice.lessonId);
    return Object.fromEntries(practice.goals.map((goal) => {
      const answers = [
        ...practice.checks.filter((q) => q.goal === goal.id).map((q) => data.checks[q.id]),
        ...practice.warmups.filter((q) => q.goal === goal.id).map((q) => data.warmups[q.id]),
        ...(practice.open && practice.open.goal === goal.id && data.open ? [data.open.rating === "got"] : []),
      ].filter((v) => v !== undefined);
      return [goal.id, !answers.length ? "" : answers.every(Boolean) ? "solid" : "revisit"];
    }));
  }

  // ---------- Flashcards for open questions ----------

  const cardId = (practice) => `iq-${practice.lessonId}-${practice.open.id}`;

  function registerCards(practice) {
    if (!practice.open || !DSL.Vocab || !DSL.Vocab.addCards) return;
    DSL.Vocab.addCards(practice.lessonId, {
      [cardId(practice)]: { term: practice.open.prompt, def: `<ul>${practice.open.points.map((p) => `<li>${p}</li>`).join("")}</ul>`, kind: "interview" },
    });
  }

  function rateOpen(practice, rating, covered) {
    record(practice.lessonId, "open", null, { rating, covered, at: Date.now() });
    if (!DSL.Vocab) return;
    const id = cardId(practice);
    DSL.Vocab.seen(id, practice.lessonId);
    if (rating !== "got") DSL.Vocab.star(id, true);
  }

  // ---------- Markup ----------

  const STATUS_LABEL = { solid: "✓", revisit: "revisit", "": "" };

  // The compact list: the wrap-up's ✓ / revisit summary.
  function goalsMarkup(practice, { withStatus = false, recap = false } = {}) {
    const st = withStatus ? status(practice) : {};
    return `<ol class="pr-goals">${practice.goals.map((goal, i) => `<li class="pr-goal ${st[goal.id] || ""}" data-goal="${goal.id}" style="--i:${i}">
      <span class="pr-num">${goal.icon || i + 1}</span>
      <div><b>${goal.title ? `${goal.title}. ` : ""}</b>${goal.text}${recap ? `<p>${goal.recap}</p>` : ""}</div>
      ${withStatus && st[goal.id] ? `<em>${STATUS_LABEL[st[goal.id]]}</em>` : ""}
    </li>`).join("")}</ol>`;
  }

  // The goal cards: icon, short title, the can-do sentence and a code snippet, joined by a path.
  // recap: add the takeaway and a slot where the goal's example replays.
  function cardsMarkup(practice, { recap = false, compact = false } = {}) {
    const hl = (sql) => (DSL.Sql ? DSL.Sql.highlight(sql) : sql);
    return `<div class="pr-cards ${compact ? "compact" : ""} ${recap ? "recap" : ""}">${practice.goals.map((goal, i) => `<article class="pr-card" data-goal="${goal.id}" data-hue="${i % 3}" style="--i:${i}">
      <header><span class="pr-card-icon" aria-hidden="true">${goal.icon || "🎯"}</span><span class="pr-card-num">Goal ${i + 1}</span><span class="pr-stamp" aria-hidden="true">✓ unlocked</span></header>
      <h3>${goal.title || goal.text}</h3>
      ${goal.title && !recap ? `<p class="pr-card-text">${goal.text}</p>` : ""}
      ${goal.snippet && !recap ? `<code class="pr-snippet">${hl(goal.snippet)}</code>` : ""}
      ${recap ? `<p class="pr-card-recap">${goal.recap}</p><div class="pr-example"></div>` : ""}
    </article>`).join("")}</div>`;
  }

  // Replay a goal's example into its card: an optional "before" step, then the real one.
  async function playExample(card, goal, wait = (ms) => new Promise((r) => setTimeout(r, ms))) {
    const ex = goal.example;
    const host = card.querySelector(".pr-example");
    if (!ex || !host) return;
    const dataset = ex.dataset || "bakery";
    const mini = (result, cls = "") => `<div class="pr-mini ${cls}">${result.label ? `<small class="pr-label">${result.label}</small>` : ""}${result.error ? `<p class="sq-err">${result.error}</p>` : `<table><thead><tr>${result.columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${result.rows.slice(0, ex.show || 7).map((row) => `<tr class="${ex.mark ? ex.mark(row, cls) : ""}">${row.map((v) => `<td>${v === null ? "<i>NULL</i>" : typeof v === "number" && !Number.isInteger(v) ? Number(v.toFixed(2)) : v}</td>`).join("")}</tr>`).join("")}</tbody></table>`}</div>`;
    // A step is a query (shown, then run) or tables shown as they are.
    const step = async (what, cls) => (typeof what === "string"
      ? `<code class="pr-snippet">${DSL.Sql.highlight(what)}</code>${mini(await DSL.Sql.run(dataset, what), cls)}`
      : [].concat(what).map((table) => mini(table, cls)).join(""));
    if (ex.before) {
      host.innerHTML = await step(ex.before, "before");
      retrigger(host, "sq-code-in");
      await wait(1400);
    }
    host.innerHTML = `${await step(ex.after || ex.sql, "after")}${ex.note ? `<small class="pr-note">${ex.note}</small>` : ""}`;
    retrigger(host, "sq-code-in");
  }

  function unlock(card) {
    card.classList.add("pr-lit", "pr-unlocked");
    card.scrollIntoView({ block: "nearest", behavior: DSL.LabKit.reducedMotion() ? "auto" : "smooth" });
    retrigger(card, "gd-pop");
    burst(card.querySelector(".pr-stamp"), { count: 10, spread: 40 });
  }

  const goalTag = (practice, goalId) => {
    const i = practice.goals.findIndex((g) => g.id === goalId);
    return i < 0 ? "" : `<span class="pr-tag">Goal ${i + 1}</span>`;
  };

  // The open question: notes, a one-minute timer, reveal, tick covered points, rate.
  // Returns a promise for the rating; onStep(name) reports "revealed" and "rated".
  function openMarkup(practice) {
    const q = practice.open;
    return `<div class="pr-open">
      <p class="pr-ask"><span class="pr-who">Interviewer</span>${q.prompt}</p>
      <div class="pr-notes"><textarea placeholder="Answer out loud, or jot your points here…" rows="3" aria-label="Your notes"></textarea><span class="pr-timer" aria-hidden="true"><i></i><b>1:00</b></span></div>
      <button type="button" class="button primary pr-reveal">Reveal the model answer</button>
      <div class="pr-model" hidden>
        <p class="pr-model-lede">What an interviewer listens for. Tick what you covered:</p>
        <ul class="pr-points">${q.points.map((p, i) => `<li><label><input type="checkbox" data-point="${i}" /> <span>${p}</span></label></li>`).join("")}</ul>
        <details class="pr-answer"><summary>A model answer</summary><p>${q.answer}</p></details>
        <div class="pr-rate" role="group" aria-label="How did you do?"><span>How did you do?</span>
          <button type="button" data-rate="got">Got it</button><button type="button" data-rate="partly">Partly</button><button type="button" data-rate="missed">Missed</button>
        </div>
      </div>
    </div>`;
  }

  function wireOpen(root, practice, { onStep } = {}) {
    const timer = root.querySelector(".pr-timer");
    let left = 60;
    const tick = window.setInterval(() => {
      if (!root.isConnected) { window.clearInterval(tick); return; }
      left = Math.max(0, left - 1);
      timer.querySelector("b").textContent = `0:${String(left).padStart(2, "0")}`;
      timer.style.setProperty("--p", String(1 - left / 60));
      if (!left) window.clearInterval(tick);
    }, 1000);
    return new Promise((resolve) => {
      root.querySelector(".pr-reveal").addEventListener("click", (event) => {
        event.currentTarget.hidden = true;
        window.clearInterval(tick);
        const model = root.querySelector(".pr-model");
        model.hidden = false;
        retrigger(model, "sq-code-in");
        DSL.Sfx.play("tick");
        if (onStep) onStep("revealed");
      });
      root.querySelector(".pr-points").addEventListener("change", () => DSL.Sfx.play("tick"));
      root.querySelector(".pr-rate").addEventListener("click", (event) => {
        const button = event.target.closest("[data-rate]");
        if (!button) return;
        const covered = root.querySelectorAll(".pr-points input:checked").length;
        root.querySelectorAll(".pr-rate button").forEach((b) => { b.disabled = true; b.classList.toggle("picked", b === button); });
        rateOpen(practice, button.dataset.rate, covered);
        DSL.Sfx.play(button.dataset.rate === "got" ? "correct" : "tick");
        if (button.dataset.rate === "got") burst(button, { count: 14 });
        if (onStep) onStep("rated", button.dataset.rate);
        resolve(button.dataset.rate);
      });
    });
  }

  // ---------- Narrated chapters ----------

  function goalsChapter(practice) {
    return {
      id: "goals",
      title: "What you'll be able to do",
      async script(n, scene) {
        scene.innerHTML = `<div class="pr-scene wide"><p class="pr-kicker">By the end of this lesson, you'll be able to</p>${cardsMarkup(practice)}</div>`;
        const cards = [...scene.querySelectorAll(".pr-card")];
        await n.say("goals.intro");
        for (const [i, card] of cards.entries()) {
          card.classList.add("pr-lit");
          retrigger(card, "gd-pop");
          DSL.Sfx.play("tick");
          await n.say(`goals.${i + 1}`);
        }
      },
    };
  }

  function recapChapter(practice) {
    return {
      id: "recap",
      title: "Recap",
      async script(n, scene) {
        scene.innerHTML = `<div class="pr-scene wide"><p class="pr-kicker">What you can do now</p>${cardsMarkup(practice, { recap: true })}</div>`;
        const cards = [...scene.querySelectorAll(".pr-card")];
        await n.say("recap.intro");
        for (const [i, card] of cards.entries()) {
          unlock(card);
          DSL.Sfx.play("correct", { streak: i + 1 });
          await Promise.all([n.say(`recap.${i + 1}`), n.show(() => playExample(card, practice.goals[i], (ms) => n.wait(ms)))]);
        }
      },
    };
  }

  // Multiple-choice rounds (checks, or interview warm-ups), recorded per question.
  async function choiceRound(n, scene, practice, { kind, questions, lead, speakerLabel, rightLines }) {
    let right = 0;
    for (const [i, q] of questions.entries()) {
      scene.querySelector(".pr-q").innerHTML = `${goalTag(practice, q.goal)}<span class="pr-count">${i + 1} / ${questions.length}</span><p>${speakerLabel ? `<span class="pr-who">${speakerLabel}</span>` : ""}${q.prompt}</p>`;
      retrigger(scene.querySelector(".pr-q"), "gd-card-in");
      await n.say(`${lead}${i + 1}`);
      const pick = await n.choose(q.options.map((option, j) => [String(j), option]), { label: "Your answer" });
      const correct = Number(pick) === q.answer;
      DSL.Sfx.play(correct ? "correct" : "wrong");
      record(practice.lessonId, kind, q.id, correct);
      const mark = scene.querySelectorAll(".pr-marks i")[i];
      mark.className = correct ? "ok" : "bad";
      mark.textContent = correct ? "✓" : "✗";
      if (correct) { right += 1; await n.say(rightLines[i % rightLines.length]); } else { await n.say(`${lead}${i + 1}-why`); }
    }
    return right;
  }

  function checkChapter(practice, { onPass } = {}) {
    return {
      id: "check",
      title: "Check your understanding",
      async script(n, scene) {
        scene.innerHTML = `<div class="pr-scene"><p class="pr-kicker">Check your understanding</p><div class="pr-q gd-quiz"></div><div class="nr-marks pr-marks">${practice.checks.map(() => "<i></i>").join("")}</div></div>`;
        await n.say("check.intro");
        const right = await choiceRound(n, scene, practice, { kind: "checks", questions: practice.checks, lead: "check.q", rightLines: ["check.right1", "check.right2", "check.right3"] });
        const passed = right >= Math.ceil(practice.checks.length * 0.66);
        if (passed && onPass) onPass();
        await n.say(passed ? "check.pass" : "check.retry", { right });
      },
    };
  }

  function interviewChapter(practice) {
    return {
      id: "interview",
      title: "Interview round",
      async script(n, scene) {
        scene.innerHTML = `<div class="pr-scene"><p class="pr-kicker">Interview round</p><div class="pr-q gd-quiz"></div><div class="nr-marks pr-marks">${practice.warmups.map(() => "<i></i>").join("")}</div></div>`;
        await n.say("interview.intro");
        await choiceRound(n, scene, practice, { kind: "warmups", questions: practice.warmups, lead: "interview.w", speakerLabel: "Interviewer", rightLines: ["interview.right1", "interview.right2"] });
        scene.innerHTML = `<div class="pr-scene">${goalTag(practice, practice.open.goal)}${openMarkup(practice)}</div>`;
        const open = scene.querySelector(".pr-open");
        let revealed = null;
        const revealedOnce = new Promise((resolve) => { revealed = resolve; });
        const rated = wireOpen(open, practice, { onStep: (step) => { if (step === "revealed") revealed(); } });
        await n.say("interview.open");
        await n.say("interview.think");
        await n.ask(revealedOnce, { hint: "interview.hint", highlight: ".pr-reveal", label: "Your answer" });
        await n.say("interview.reveal");
        await n.say("interview.rate");
        const rating = await n.ask(rated, { highlight: ".pr-rate button", label: "Rate yourself" });
        await n.say(`interview.${rating}`);
      },
    };
  }

  // ---------- Guided beats ----------

  function goalsBeat(practice) {
    return {
      id: "goals",
      prompt: "What you'll be able to do.",
      why: "Each goal is one of the lesson's big ideas. The end of the lesson checks each one, and tells you which to revisit.",
      mount(scene, api) {
        scene.innerHTML = `<div class="pr-scene wide"><p class="pr-kicker">By the end of this lesson, you'll be able to</p>${cardsMarkup(practice)}</div>`;
        scene.querySelectorAll(".pr-card").forEach((card) => card.classList.add("pr-lit"));
        api.done("Keep these in mind. The last steps check each one.");
      },
    };
  }

  function recapBeat(practice) {
    return {
      id: "recap",
      prompt: "Recap: what you can do now.",
      mount(scene, api) {
        scene.innerHTML = `<div class="pr-scene wide"><p class="pr-kicker">What you can do now</p>${cardsMarkup(practice, { recap: true })}</div>`;
        const cards = [...scene.querySelectorAll(".pr-card")];
        (async () => {
          for (const [i, card] of cards.entries()) {
            if (!api.alive()) return;
            unlock(card);
            DSL.Sfx.play("correct", { streak: i + 1 });
            await playExample(card, practice.goals[i], (ms) => api.wait(ms));
            await api.wait(500);
          }
          api.done("Next: put each one to use.");
        })();
      },
    };
  }

  // A card-by-card multiple-choice beat that records answers per question.
  function choiceBeat(practice, { id, prompt, why, kind, questions, speaker, onPass }) {
    return {
      id,
      prompt,
      why,
      mount(scene, api) {
        let q = 0;
        let right = 0;
        function render() {
          const question = questions[q];
          scene.innerHTML = `<div class="gd-quiz pr-scene">
            ${goalTag(practice, question.goal)}<span class="gd-q-count">${q + 1} / ${questions.length}</span>
            <p class="gd-q">${speaker ? `<span class="pr-who">${speaker}</span>` : ""}${question.prompt}</p>
            <div class="gd-answers">${question.options.map((option, i) => `<button type="button" class="gd-answer" data-i="${i}">${option}</button>`).join("")}</div>
          </div>`;
          retrigger(scene.querySelector(".gd-quiz"), "gd-card-in");
          scene.querySelectorAll(".gd-answer").forEach((button) => button.addEventListener("click", async () => {
            const correct = Number(button.dataset.i) === question.answer;
            DSL.Sfx.play(correct ? "correct" : "wrong");
            record(practice.lessonId, kind, question.id, correct);
            scene.querySelectorAll(".gd-answer").forEach((b) => { b.disabled = true; if (Number(b.dataset.i) === question.answer) b.classList.add("correct"); });
            if (correct) { right += 1; burst(button, { count: 12 }); api.say(`✓ ${question.why}`, "ok"); } else { button.classList.add("wrong"); api.say(`✗ ${question.why}`, "warn"); }
            await api.wait(correct ? 1800 : 3200);
            q += 1;
            if (q < questions.length) { render(); api.say(""); return; }
            const passed = right >= Math.ceil(questions.length * 0.66);
            if (passed && onPass) onPass();
            scene.innerHTML = `<div class="gd-quiz gd-quiz-done"><b>${right} / ${questions.length}</b><span>${passed ? "Passed" : "Worth another look"}</span></div>`;
            api.done(`<b>${right} / ${questions.length}</b> right.`);
          }));
        }
        render();
      },
    };
  }

  function checkBeat(practice, { onPass } = {}) {
    return choiceBeat(practice, { id: "check", prompt: "Check your understanding.", why: "These ask you to use an idea, not name it. Each is tied to a goal; a miss tells you what to revisit.", kind: "checks", questions: practice.checks, onPass });
  }

  function warmupBeat(practice) {
    return choiceBeat(practice, { id: "warmups", prompt: "Interview round: warm-ups.", why: "Real interview questions. The next one is open: you answer in your own words.", kind: "warmups", questions: practice.warmups, speaker: "Interviewer" });
  }

  function openBeat(practice) {
    return {
      id: "open",
      prompt: "Interview round: your answer.",
      why: "Say your answer out loud as if in an interview, or jot notes. Then compare with what an interviewer listens for. Partly or missed puts the question in your flashcards.",
      mount(scene, api) {
        scene.innerHTML = `<div class="pr-scene">${goalTag(practice, practice.open.goal)}${openMarkup(practice)}</div>`;
        wireOpen(scene.querySelector(".pr-open"), practice).then((rating) => api.done({ got: "Nice: an answer that lands.", partly: "Good start. It's in your flashcards now.", missed: "That's what practice is for. It's in your flashcards." }[rating]));
      },
    };
  }

  // The wrap-up list: each goal with ✓ or "revisit".
  function goalsSummary(practice) {
    return `<div class="pr-summary"><p class="pr-kicker">Your goals</p>${goalsMarkup(practice, { withStatus: true })}</div>`;
  }

  // ---------- Explore ----------

  function exploreMarkup(practice) {
    return `<section class="lab pr-explore" id="lab-quiz">
      <div class="lab-top"><div><span class="lab-kicker">Practice</span><h2>Recap, check, and an interview round</h2><p class="lab-copy">What you should now be able to do, questions that make you use it, and questions as an interviewer would ask them.</p></div><div class="lab-side">${DSL.LabKit.stamp()}</div></div>
      <h3 class="pr-h">Recap</h3>
      ${cardsMarkup(practice, { recap: true })}
      <h3 class="pr-h">Check your understanding</h3>
      <div class="pr-checks">${DSL.Quiz.render(practice.checks, "Understanding")}</div>
      <h3 class="pr-h">Interview round</h3>
      <div class="pr-warmups">${DSL.Quiz.render(practice.warmups, "Warm-ups")}</div>
      <div class="pr-open-host">${openMarkup(practice)}</div>
    </section>`;
  }

  function mountExplore(root, practice, { onPass } = {}) {
    root.querySelectorAll(".pr-card").forEach((card, i) => { card.classList.add("pr-lit", "pr-unlocked"); playExample(card, practice.goals[i], () => Promise.resolve()); });
    const recordAll = (kind, list) => (idx, correct) => record(practice.lessonId, kind, list[idx].id, correct);
    const checks = root.querySelector(".pr-checks");
    const warmups = root.querySelector(".pr-warmups");
    let passedChecks = false;
    let passedWarmups = false;
    const maybePass = () => { if (passedChecks && passedWarmups && onPass) onPass(); };
    DSL.Quiz.mount(checks, practice.checks, { noun: "question", passScore: Math.ceil(practice.checks.length * 0.66), onAnswer: recordAll("checks", practice.checks), onComplete: ({ passed }) => { passedChecks = passed; maybePass(); } });
    DSL.Quiz.mount(warmups, practice.warmups, { noun: "question", passScore: practice.warmups.length, onAnswer: recordAll("warmups", practice.warmups), onComplete: ({ passed }) => { passedWarmups = passed; maybePass(); } });
    wireOpen(root.querySelector(".pr-open"), practice);
  }

  DSL.Practice = Object.freeze({ status, registerCards, goalsMarkup, cardsMarkup, goalsSummary, goalsChapter, recapChapter, checkChapter, interviewChapter, goalsBeat, recapBeat, checkBeat, warmupBeat, openBeat, exploreMarkup, mountExplore });
})(window.DataSystemsLab);
