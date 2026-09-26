(function registerWelcomeNarrated(DSL) {
  "use strict";

  // Narrated course map: what the course is, the bakery story, how lessons work, and the path.
  // Lines live in narration/welcome.json. Never name lesson numbers aloud; the path is built from
  // the lesson list, so it follows any reorder.

  const { retrigger, burst } = DSL.LabKit;

  const LEVELS = [
    ["📓", "Level 1", "The notebook", "Shape data so it stays correct"],
    ["🖥️", "Level 2", "One server", "How a database stores, finds and protects data"],
    ["🏪", "Level 3", "A chain", "Scale out without losing data"],
    ["⚙️", "Level 4", "Engine depth", "Electives on specific engines"],
  ];

  // The course as it stands: consecutive lessons that share a module form one stop.
  function stops() {
    const groups = [];
    DSL.lessons.filter((lesson) => lesson.id !== "welcome").forEach((lesson) => {
      let group = groups[groups.length - 1];
      if (!group || group.name !== lesson.module) groups.push((group = { name: lesson.module, lessons: [] }));
      group.lessons.push(lesson);
    });
    return groups;
  }

  // Draw the eye to a control outside the stage (the transport or the mode switch).
  function attention(selector, on) {
    document.querySelectorAll(selector).forEach((el) => el.classList.toggle("gw-attn", on));
  }

  function makeChapters() {
    return [
      {
        id: "welcome",
        title: "Welcome",
        async script(n, scene) {
          scene.innerHTML = `<div class="gw-hero">
            <div class="gw-logo" aria-hidden="true">🧁</div>
            <h2>Databases, from the inside</h2>
            <div class="gw-icons" aria-hidden="true">${[["📄", "pages"], ["🌳", "indexes"], ["🔒", "transactions"], ["🌍", "replication"]].map(([icon, label], i) => `<span style="--i:${i}">${icon}<small>${label}</small></span>`).join("")}</div>
          </div>`;
          const hero = scene.firstElementChild;
          retrigger(hero, "gw-in");
          await n.say("welcome.1");
          hero.classList.add("icons-in");
          await n.say("welcome.2");
          await n.say("welcome.ask");
          const goal = await n.choose([["interview", "A backend interview"], ["design", "A system design interview"], ["curious", "Just curious"]], { label: "Your goal" });
          await n.say(`welcome.${goal}`);
          await n.say("welcome.3");
        },
      },
      {
        id: "story",
        title: "The bakery",
        async script(n, scene) {
          scene.innerHTML = `<div class="gw-story">
            <div class="gw-sign"><span aria-hidden="true">🧁</span>Maya's bakery</div>
            <div class="gw-levels">${LEVELS.map(([icon, level, name, what], i) => `<div class="gw-level" data-i="${i}"><span class="gw-level-icon" aria-hidden="true">${icon}</span><small>${level}</small><b>${name}</b><p>${what}</p></div>`).join("")}</div>
          </div>`;
          const sign = scene.querySelector(".gw-sign");
          const levels = [...scene.querySelectorAll(".gw-level")];
          const reveal = (i) => {
            levels.forEach((level, j) => level.classList.toggle("current", j === i));
            levels[i].classList.add("on");
            retrigger(levels[i], "gd-pop");
          };
          await Promise.all([n.say("story.1"), n.show(() => { sign.classList.add("on"); retrigger(sign, "gd-pop"); })]);
          for (let i = 0; i < LEVELS.length; i += 1) {
            await Promise.all([n.say(`story.${i + 2}`), n.show(() => reveal(i))]);
          }
          levels.forEach((level) => level.classList.remove("current"));
          await n.say("story.6");
        },
      },
      {
        id: "how",
        title: "How lessons work",
        async script(n, scene) {
          scene.innerHTML = `<div class="gw-rhythm">${[["🎧", "I explain", "the pictures move with me"], ["👆", "Your turn", "the film stops for you"], ["🎙️", "Interviewer", "checks what stuck"]].map(([icon, name, what], i) => `<div class="gw-step" data-i="${i}"><span aria-hidden="true">${icon}</span><b>${name}</b><small>${what}</small></div>`).join('<i class="gw-arrow" aria-hidden="true">→</i>')}</div>`;
          const steps = [...scene.querySelectorAll(".gw-step")];
          const light = (i) => steps.forEach((step, j) => { step.classList.toggle("on", j === i); if (j === i) retrigger(step, "gd-pop"); });

          light(0);
          await n.say("how.1");
          light(1);
          await n.say("how.2");
          light(2);
          await n.say("how.3");
          await n.say("how.interviewer");
          await n.say("how.4");
          steps.forEach((step) => step.classList.remove("on"));

          await n.say("how.speed-ask");
          attention(".nr-speed", true);
          await n.ask((finish) => document.querySelector(".nr-speed").addEventListener("click", () => finish(), { once: true }), { hint: "how.speed-hint" });
          attention(".nr-speed", false);
          await n.say("how.speed-ok");
          attention(".nr .mode-switch", true);
          await n.say("how.5");
          attention(".nr .mode-switch", false);
        },
      },
      {
        id: "path",
        title: "Your path",
        async script(n, scene) {
          const groups = stops();
          const first = groups[0].lessons[0];
          const range = (group) => (group.lessons.length > 1 ? `${group.lessons[0].number}–${group.lessons[group.lessons.length - 1].number}` : group.lessons[0].number);
          scene.innerHTML = `<div class="gw-path">${groups.map((group, i) => {
            const done = group.lessons.filter((lesson) => DSL.state.completed.has(lesson.id)).length;
            return `<button type="button" class="gw-stop${i === 0 ? " first" : ""}" style="--i:${i}" ${i === 0 ? "" : "disabled"}><b>${range(group)}</b><span>${group.name}</span><small>${done} / ${group.lessons.length} done</small></button>`;
          }).join("")}</div>`;
          const path = scene.firstElementChild;
          retrigger(path, "gw-in");

          await n.say("path.1");
          await n.say("path.2");
          await n.say("path.3");
          await n.say("path.ask");
          const stop = scene.querySelector(".gw-stop.first");
          await n.ask((finish) => stop.addEventListener("click", () => finish(), { once: true }), { hint: "path.hint", highlight: ".gw-stop.first" });
          burst(stop, { count: 18, spread: 80 });

          scene.innerHTML = `<div class="gw-go">
            <span class="gw-logo" aria-hidden="true">📓</span>
            <small>First up · ${first.number}</small>
            <h2>${first.title}</h2>
            <div class="gw-go-actions">
              <a class="button primary gd-big" href="#/${first.id}">Start the first lesson →</a>
              <a class="button ghost" href="#/welcome?view=explore">Browse the course map</a>
            </div>
          </div>`;
          retrigger(scene.firstElementChild, "gw-in");
          await n.say("path.go");
        },
      },
    ];
  }

  DSL.registerNarrated("welcome", () => DSL.Narrator.run({
    lessonId: "welcome",
    title: `${DSL.lessonNumber("welcome")} · Course map`,
    chapters: makeChapters(),
  }), { complete: true });
})(window.DataSystemsLab);
