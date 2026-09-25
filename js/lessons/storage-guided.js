(function registerStorageGuided(DSL) {
  "use strict";

  // Guided mode for lesson 02: ten one-screen beats built on the lesson's model and visuals.

  const { retrigger, burst, floater, countTo, fly } = DSL.LabKit;

  const HOT_MIX = [0, 1, 0, 2, 0, 3, 0, 1, 0, 2, 0, 3].map((page, i) => page * 4 + 1 + (i % 4));

  function setCount(el, value, format) {
    el.dataset.value = String(value);
    el.textContent = format(value);
  }

  function shelfMarkup(M) {
    return Array.from({ length: M.PAGE_COUNT }, (_, page) => `<div class="st-shelf-page" data-page="${page}"><b>P${page + 1}</b><div class="st-rows">${M.idsOn(page).map((id) => `<button type="button" class="st-row" data-id="${id}" aria-label="Customer ${id}">${M.pad(id)}</button>`).join("")}</div></div>`).join("");
  }

  const card = (M, page, extra = "") => `<div class="bp-card ${extra}" data-page="${page}"><b>P${page + 1}</b><small>${M.range(page)}</small></div>`;
  const diskMarkup = (M, cached = new Set()) => Array.from({ length: M.PAGE_COUNT }, (_, page) => card(M, page, cached.has(page) ? "cached" : "")).join("");

  function victimOf(slots, capacity, policy) {
    if (slots.filter(Boolean).length < capacity) return -1;
    const key = policy === "lru" ? "used" : "loaded";
    return slots.reduce((best, slot, i) => (slot[key] < slots[best][key] ? i : best), 0);
  }

  function slotsMarkup(M, slots, capacity, policy, { incoming = -1, tag = true } = {}) {
    const next = tag && incoming < 0 ? victimOf(slots, capacity, policy) : -1;
    return Array.from({ length: capacity }, (_, i) => {
      if (i === incoming) return `<div class="bp-slot incoming" data-slot="${i}"><span>incoming…</span></div>`;
      const slot = slots[i];
      if (!slot) return `<div class="bp-slot" data-slot="${i}"><span>empty</span></div>`;
      return `<div class="bp-slot" data-slot="${i}">${card(M, slot.page, i === next ? "next-out" : "")}${i === next ? `<em class="bp-next">next out</em>` : ""}</div>`;
    }).join("");
  }

  function ring(extra = "") {
    return `<svg class="gd-ring ${extra}" viewBox="0 0 36 36" aria-hidden="true"><circle class="bg" cx="18" cy="18" r="15.9"></circle><circle class="fg" cx="18" cy="18" r="15.9" pathLength="100"></circle></svg>`;
  }

  // Beats 1–2 share one scene: the disk shelf, the page in memory, and three counters.
  function anatomyScene(M, scene) {
    scene.innerHTML = `<div class="gd-anat">
      <div class="st-shelf gd-shelf">${shelfMarkup(M)}</div>
      <div class="st-page empty gd-page"><p>memory</p></div>
      <div class="gd-counters">
        <div><b data-c="asked">0 B</b><span>you asked for</span></div>
        <div><b data-c="read">0 B</b><span>read from disk</span></div>
        <div><b data-c="amp">—</b><span>amplification</span></div>
      </div>
    </div>`;
    return { shelf: scene.querySelector(".gd-shelf"), page: scene.querySelector(".gd-page"), c: (k) => scene.querySelector(`[data-c="${k}"]`) };
  }

  function paintAnatomy(M, ui, st, { animate = true, renderPage = true } = {}) {
    const put = animate ? (el, v, format) => countTo(el, v, { format }) : setCount;
    put(ui.c("asked"), st.asked, M.bytes);
    put(ui.c("read"), st.read, M.bytes);
    if (st.asked) put(ui.c("amp"), st.read / st.asked, (n) => `×${Math.round(n)}`);
    const wanted = new Set(st.wanted);
    ui.shelf.querySelectorAll(".st-row").forEach((row) => row.classList.toggle("fetched", wanted.has(Number(row.dataset.id))));
    ui.shelf.querySelectorAll(".st-shelf-page").forEach((page) => page.classList.toggle("open", Number(page.dataset.page) === st.open));
    if (renderPage && st.open !== null) {
      ui.page.className = "st-page gd-page";
      ui.page.innerHTML = M.pageMarkup(st.open, wanted);
    }
  }

  // Move elements to new places in the DOM, animating each from where it was (FLIP).
  function flipMove(elements, mutate, { duration = 700, stagger = 16 } = {}) {
    const before = new Map(elements.map((el) => [el, el.getBoundingClientRect()]));
    mutate();
    if (DSL.LabKit.reducedMotion()) return Promise.resolve();
    return Promise.all(elements.map((el, i) => {
      const from = before.get(el);
      const to = el.getBoundingClientRect();
      return el.animate([{ transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` }, { transform: "none" }], { duration, delay: i * stagger, easing: "cubic-bezier(.65,0,.35,1)", fill: "backwards" }).finished;
    })).catch(() => {});
  }

  // Teaching beats: show the idea first, one caption per tap.
  function teachPage(M) {
    return {
      id: "teach-page",
      prompt: "What is a page?",
      mount(scene, api) {
        DSL.Guided.storyboard(scene, api, {
          build(stage) {
            stage.innerHTML = `<div class="gt-page">
              <div class="gt-disk"><span class="gt-label">disk</span><div class="gt-rows"></div><div class="gt-pages"></div></div>
              <div class="gt-mem"><span class="gt-label">memory</span><div class="gt-mem-slot"></div></div>
            </div>`;
            return { rows: stage.querySelector(".gt-rows"), pages: stage.querySelector(".gt-pages"), mem: stage.querySelector(".gt-mem"), slot: stage.querySelector(".gt-mem-slot") };
          },
          frames: [
            {
              caption: "A table of 32 customers. Each one is a <b>row</b>.",
              async enter(ctx, a) {
                ctx.rows.innerHTML = Array.from({ length: 32 }, (_, i) => `<span class="gt-chip" data-id="${i + 1}" style="--i:${i}">${M.pad(i + 1)}</span>`).join("");
                await a.wait(700);
              },
            },
            {
              caption: "On disk, rows are packed into <b>pages</b>.",
              async enter(ctx, a) {
                ctx.pages.innerHTML = Array.from({ length: M.PAGE_COUNT }, (_, p) => `<div class="gt-pg" data-page="${p}"><b>P${p + 1}</b></div>`).join("");
                const chips = [...ctx.rows.children];
                await a.after(flipMove(chips, () => {
                  chips.forEach((chip) => ctx.pages.querySelector(`[data-page="${M.pageOf(Number(chip.dataset.id))}"]`).appendChild(chip));
                  ctx.rows.remove();
                }));
              },
            },
            {
              caption: "Every page is the same size: <b>8 KB</b>.",
              async enter(ctx, a) {
                ctx.pages.querySelectorAll(".gt-pg").forEach((page, i) => {
                  page.insertAdjacentHTML("beforeend", `<span class="gt-kb" style="--i:${i}">8 KB</span>`);
                });
                await a.wait(600);
              },
            },
            {
              caption: "A real page holds ~100 rows. We draw 4 so you can see them.",
              async enter(ctx, a) {
                const page = ctx.pages.querySelector('[data-page="2"]');
                page.classList.add("zoom");
                page.insertAdjacentHTML("beforeend", `<span class="gt-more">+ ~96 more rows</span>`);
                await a.wait(600);
              },
            },
            {
              caption: "To read <b>one</b> row, the engine copies its <b>whole page</b> into memory.",
              async enter(ctx, a) {
                const page = ctx.pages.querySelector('[data-page="2"]');
                page.classList.remove("zoom");
                page.querySelector(".gt-more").remove();
                ctx.mem.classList.add("show");
                await a.wait(350);
                await a.after(DSL.LabKit.fly(page, ctx.slot, { duration: 800, lift: 70 }));
                ctx.slot.innerHTML = page.outerHTML;
                const copy = ctx.slot.querySelector(".gt-pg");
                copy.querySelector('[data-id="11"]').classList.add("want");
                retrigger(copy, "bp-land");
                floater(copy, "#11 wanted · 4 rows came", "warn");
              },
            },
          ],
        });
      },
    };
  }

  function teachCache(M) {
    return {
      id: "teach-cache",
      prompt: "Memory is a cache.",
      mount(scene, api) {
        DSL.Guided.storyboard(scene, api, {
          build(stage) {
            stage.innerHTML = `<div class="gt-cache">
              <div class="gt-side gt-diskside"><span class="gt-label">disk · big · slow</span><div class="bp-shelf">${diskMarkup(M)}</div><span class="gt-speed">🐢 8 ms per page</span></div>
              <div class="gt-side gt-ramside"><span class="gt-label ram">RAM · small · fast</span><div class="bp-slots">${slotsMarkup(M, [], 2, "lru", { tag: false })}</div><span class="gt-speed">⚡ 0.1 ms per page</span></div>
            </div>`;
            return { disk: stage.querySelector(".gt-diskside"), ram: stage.querySelector(".gt-ramside"), shelf: stage.querySelector(".bp-shelf"), slots: stage.querySelector(".bp-slots") };
          },
          frames: [
            { caption: "Disk holds every page, but each read is <b>slow</b>.", async enter(ctx, a) { ctx.disk.classList.add("show"); await a.wait(450); } },
            { caption: "RAM is <b>fast</b>, but holds only a few pages. This one: 2.", async enter(ctx, a) { ctx.ram.classList.add("show"); await a.wait(450); } },
            {
              caption: "Page not in RAM? A <b>miss</b>: wait for the disk.",
              async enter(ctx, a) {
                const source = ctx.shelf.querySelector('[data-page="2"]');
                retrigger(source, "bp-reading");
                ctx.slots.innerHTML = slotsMarkup(M, [], 2, "lru", { incoming: 0 });
                await a.after(fly(source, ctx.slots.querySelector('[data-slot="0"]'), { duration: 950, lift: 80, className: "bp-flying" }));
                ctx.slots.innerHTML = slotsMarkup(M, [{ page: 2 }], 2, "lru", { tag: false });
                ctx.shelf.innerHTML = diskMarkup(M, new Set([2]));
                const landed = ctx.slots.querySelector(".bp-card");
                retrigger(landed, "bp-land");
                floater(landed, "+8 ms", "bad");
              },
            },
            {
              caption: "Already in RAM? A <b>hit</b>: almost free.",
              async enter(ctx, a) {
                const hit = ctx.slots.querySelector(".bp-card");
                retrigger(hit, "bp-hit");
                burst(hit, { count: 14 });
                floater(hit, "+0.1 ms", "");
                await a.wait(500);
              },
            },
            {
              caption: "RAM fills up. To load another page, one must <b>leave</b>.",
              async enter(ctx, a) {
                ctx.slots.innerHTML = slotsMarkup(M, [{ page: 2 }], 2, "lru", { incoming: 1 });
                await a.after(fly(ctx.shelf.querySelector('[data-page="4"]'), ctx.slots.querySelector('[data-slot="1"]'), { duration: 600, lift: 60, className: "bp-flying" }));
                ctx.slots.innerHTML = slotsMarkup(M, [{ page: 2 }, { page: 4 }], 2, "lru", { tag: false });
                ctx.shelf.innerHTML = diskMarkup(M, new Set([2, 4]));
                await a.wait(450);
                const next = ctx.shelf.querySelector('[data-page="6"]');
                floater(next, "P7 needed", "warn");
                ctx.slots.querySelector('[data-slot="0"] .bp-card').classList.add("bp-evicting");
                await a.wait(360);
                ctx.slots.innerHTML = slotsMarkup(M, [null, { page: 4 }], 2, "lru", { incoming: 0 });
                await a.after(fly(next, ctx.slots.querySelector('[data-slot="0"]'), { duration: 600, lift: 60, className: "bp-flying" }));
                ctx.slots.innerHTML = slotsMarkup(M, [{ page: 6 }, { page: 4 }], 2, "lru", { tag: false });
                ctx.shelf.innerHTML = diskMarkup(M, new Set([6, 4]));
                retrigger(ctx.slots.querySelector('[data-slot="0"] .bp-card'), "bp-land");
              },
            },
          ],
        });
      },
    };
  }

  function teachEvict(M) {
    const tag = (slot, text, tone) => {
      slot.querySelectorAll(".gt-tag").forEach((t) => t.remove());
      if (text) slot.insertAdjacentHTML("beforeend", `<em class="gt-tag ${tone}">${text}</em>`);
    };
    return {
      id: "teach-evict",
      prompt: "Who gets evicted?",
      mount(scene, api) {
        DSL.Guided.storyboard(scene, api, {
          build(stage) {
            stage.innerHTML = `<div class="gt-evict">
              <div class="bp-ram gd-ram"><span class="gd-ram-label">RAM · full</span><div class="bp-slots">
                <div class="bp-slot gt-slot" data-p="0">${card(M, 0)}<span class="gt-meta"></span></div>
                <div class="bp-slot gt-slot" data-p="4">${card(M, 4)}<span class="gt-meta"></span></div>
              </div></div>
              <ol class="gt-timeline"></ol>
            </div>`;
            const slot = (p) => stage.querySelector(`.gt-slot[data-p="${p}"]`);
            const log = (text) => stage.querySelector(".gt-timeline").insertAdjacentHTML("beforeend", `<li>${text}</li>`);
            return { slot, log };
          },
          frames: [
            {
              caption: "RAM holds P1 and P5. P1 arrived <b>first</b>.",
              async enter(ctx, a) {
                ctx.log("① P1 arrives");
                ctx.slot(0).querySelector(".gt-meta").textContent = "arrived 1st";
                await a.wait(350);
                ctx.log("② P5 arrives");
                ctx.slot(4).querySelector(".gt-meta").textContent = "arrived 2nd";
                await a.wait(350);
              },
            },
            {
              caption: "Then P1 is <b>used again</b>.",
              async enter(ctx, a) {
                ctx.log("③ P1 used");
                const used = ctx.slot(0).querySelector(".bp-card");
                retrigger(used, "bp-hit");
                burst(used, { count: 10 });
                ctx.slot(0).querySelector(".gt-meta").innerHTML = "arrived 1st · <b>used just now</b>";
                await a.wait(500);
              },
            },
            {
              caption: "Rule 1 · <b>FIFO</b>: first in, first out. It evicts P1, even though P1 is busy.",
              async enter(ctx, a) {
                tag(ctx.slot(0), "FIFO evicts", "out");
                retrigger(ctx.slot(0).querySelector(".bp-card"), "gd-wrong");
                await a.wait(500);
              },
            },
            {
              caption: "Rule 2 · <b>LRU</b>: least recently used. It evicts P5.",
              async enter(ctx, a) {
                tag(ctx.slot(0), "stays", "stay");
                tag(ctx.slot(4), "LRU evicts", "out");
                retrigger(ctx.slot(4).querySelector(".bp-card"), "gd-wrong");
                await a.wait(500);
              },
            },
            {
              caption: "Busy pages should stay, so real databases use <b>LRU-like</b> rules.",
              async enter(ctx, a) {
                ctx.slot(4).querySelector(".bp-card").classList.add("bp-evicting");
                burst(ctx.slot(0).querySelector(".bp-card"), { count: 14 });
                await a.wait(500);
              },
            },
          ],
        });
      },
    };
  }

  function teachLocality(M) {
    const pages = M.DRILL_STEPS.heap.filter((key) => key.startsWith("heap"));
    return {
      id: "teach-locality",
      prompt: "Where do rows live?",
      mount(scene, api) {
        DSL.Guided.storyboard(scene, api, {
          build(stage) {
            stage.innerHTML = `<div class="gt-local"><div class="gt-orders"></div>${M.laneMarkup("gtlane", "The orders table on disk")}</div>`;
            return { orders: stage.querySelector(".gt-orders"), strips: stage.querySelector("#gtlane-strips") };
          },
          frames: [
            {
              caption: "GET /orders shows Maya’s <b>12</b> latest orders.",
              async enter(ctx, a) {
                ctx.orders.innerHTML = Array.from({ length: 12 }, (_, i) => `<span class="gt-order" style="--i:${i}">order ${i + 1}</span>`).join("");
                await a.wait(700);
              },
            },
            {
              caption: "They were written over two years, so they’re <b>scattered</b> across the table’s pages.",
              async enter(ctx, a) {
                const chips = [...ctx.orders.children];
                await a.after(Promise.all(chips.map((chip, i) => a.wait(i * 70).then(() => {
                  const cell = ctx.strips.querySelector(`[data-key="${pages[i % pages.length]}"]`);
                  return fly(chip, cell, { duration: 650, lift: 50 }).then(() => {
                    chip.style.visibility = "hidden";
                    cell.classList.add("gt-has");
                    retrigger(cell, "st-pop");
                  });
                }))));
              },
            },
            {
              caption: "An <b>index</b> says where each order is. Following it costs one jump per page.",
              async enter(ctx, a) {
                const start = ctx.strips.querySelector('[data-key="index-3"]');
                start.classList.add("gt-idx");
                let previous = M.point(ctx.strips, start);
                for (const key of pages) {
                  const cell = ctx.strips.querySelector(`[data-key="${key}"]`);
                  const to = M.point(ctx.strips, cell);
                  M.arc(ctx.strips, previous, to, "heap");
                  cell.classList.add("miss");
                  previous = to;
                  await a.wait(150);
                }
              },
            },
            {
              caption: "A <b>covering index</b> stores the orders themselves, sorted: a few <b>neighbouring</b> pages.",
              async enter(ctx, a) {
                ctx.strips.querySelector(".st-arcs").innerHTML = "";
                ctx.strips.classList.add("skip-heap");
                let previous = null;
                for (const key of M.DRILL_STEPS.covering) {
                  const cell = ctx.strips.querySelector(`[data-key="${key}"]`);
                  cell.classList.remove("gt-idx");
                  cell.classList.add("good");
                  retrigger(cell, "st-pop");
                  const to = M.point(ctx.strips, cell);
                  if (previous) M.arc(ctx.strips, previous, to, "covering");
                  previous = to;
                  await a.wait(220);
                }
              },
            },
          ],
        });
      },
    };
  }

  function makeBeats() {
    const M = DSL.StorageModel;

    return [
      teachPage(M),
      {
        id: "page",
        prompt: "Your turn: tap any customer.",
        why: "Disks and the operating system move data in fixed-size blocks. Databases organise everything in 8 KB pages, so one row always costs one whole page.",
        mount(scene, api) {
          const st = api.state;
          Object.assign(st, { open: null, wanted: [], asked: 0, read: 0 });
          const ui = anatomyScene(M, scene);
          let busy = false;
          ui.shelf.addEventListener("click", async (event) => {
            const button = event.target.closest(".st-row");
            if (!button || busy || st.open !== null) return;
            busy = true;
            const id = Number(button.dataset.id);
            const page = M.pageOf(id);
            const shelfPage = ui.shelf.querySelector(`[data-page="${page}"]`);
            retrigger(shelfPage, "st-lift");
            await api.after(fly(shelfPage, ui.page, { duration: 650, lift: 60, className: "st-flying" }));
            Object.assign(st, { open: page, wanted: [id], asked: M.customer(id).bytes, read: M.PAGE_BYTES });
            paintAnatomy(M, ui, st);
            retrigger(ui.page, "st-arrive");
            floater(ui.c("read"), "+8,192 B", "warn");
            ui.shelf.classList.add("locked");
            api.done(`You wanted <b>${st.asked} B</b>. You got <b>8,192 B</b>.`, "warn");
          });
        },
      },
      {
        id: "neighbour",
        continues: true,
        prompt: "Now tap one of its neighbours.",
        why: "The page is already in memory, so every other row on it is free to read. That’s why keeping related rows together matters.",
        mount(scene, api) {
          const st = api.state;
          if (st.open === null || st.open === undefined) Object.assign(st, { open: 2, wanted: [11], asked: M.customer(11).bytes, read: M.PAGE_BYTES });
          const ui = anatomyScene(M, scene);
          paintAnatomy(M, ui, st, { animate: false });
          const hint = () => ui.shelf.querySelectorAll(".st-row").forEach((row) => {
            const id = Number(row.dataset.id);
            const live = M.pageOf(id) === st.open && !st.wanted.includes(id);
            row.classList.toggle("gd-hint", live);
            row.disabled = !live;
          });
          hint();
          ui.shelf.addEventListener("click", (event) => {
            const button = event.target.closest(".st-row");
            if (!button || button.disabled) return;
            const id = Number(button.dataset.id);
            st.wanted.push(id);
            st.asked += M.customer(id).bytes;
            paintAnatomy(M, ui, st, { renderPage: false });
            const tuple = ui.page.querySelector(`.st-tuple[data-id="${id}"]`);
            tuple.classList.replace("along", "want");
            ui.page.querySelector(`.st-pointers [data-id="${id}"]`).classList.add("want");
            retrigger(tuple, "ping");
            burst(tuple, { count: 14 });
            floater(ui.c("read"), "+0 B", "");
            hint();
            api.done(`Free ride: <b>+0 B</b> read. Amplification drops.`);
            api.lab("anatomy");
          });
        },
      },
      teachCache(M),
      {
        id: "hit",
        prompt: "Your turn: fetch customer #11.",
        why: "In this simplified model a disk read costs 8 ms and a buffer hit 0.1 ms. Real numbers vary, but the gap is always huge.",
        mount(scene, api) {
          scene.innerHTML = `<div class="gd-cache">
            <div class="bp-shelf gd-disk">${diskMarkup(M)}</div>
            <div class="gd-cache-mid">
              <div class="bp-ram gd-ram"><span class="gd-ram-label">RAM</span><div class="bp-slots">${slotsMarkup(M, [], 2, "lru")}</div></div>
              <div class="gd-watch">${ring()}<b>0.0 ms</b></div>
            </div>
            <button type="button" class="button primary gd-big">Fetch #11</button>
          </div>`;
          const button = scene.querySelector(".gd-big");
          const slots = scene.querySelector(".bp-slots");
          const disk = scene.querySelector(".gd-disk");
          const fg = scene.querySelector(".gd-ring .fg");
          const watch = scene.querySelector(".gd-watch b");
          let step = 0;
          let busy = false;

          function fill(percent, seconds) {
            fg.style.transition = "none";
            fg.style.strokeDashoffset = "100";
            void fg.getBoundingClientRect();
            fg.style.transition = `stroke-dashoffset ${seconds}s linear`;
            fg.style.strokeDashoffset = String(100 - percent);
          }

          button.addEventListener("click", async () => {
            if (busy) return;
            busy = true;
            button.disabled = true;
            if (step === 0) {
              const source = disk.querySelector('[data-page="2"]');
              retrigger(source, "bp-reading");
              watch.classList.add("slow");
              fill(100, 0.9);
              setCount(watch, 0, M.ms);
              countTo(watch, 8, { duration: 900, format: M.ms });
              slots.innerHTML = slotsMarkup(M, [], 2, "lru", { incoming: 0 });
              await api.after(fly(source, slots.querySelector('[data-slot="0"]'), { duration: 900, lift: 80, className: "bp-flying" }));
              slots.innerHTML = slotsMarkup(M, [{ page: 2, loaded: 1, used: 1 }], 2, "lru");
              disk.innerHTML = diskMarkup(M, new Set([2]));
              const landed = slots.querySelector(".bp-card");
              retrigger(landed, "bp-land");
              burst(landed, { count: 7, spread: 34, colors: ["var(--line-strong)", "var(--muted)", "var(--coral)"] });
              floater(landed, "+8 ms", "bad");
              api.say("Miss: <b>8 ms</b> waiting on disk.", "warn");
              api.prompt("Again: fetch #11.");
              button.textContent = "Fetch #11 again";
              step = 1;
            } else {
              watch.classList.remove("slow");
              fill(1.25, 0.15);
              setCount(watch, 0, M.ms);
              countTo(watch, 0.1, { duration: 150, format: M.ms });
              const hitCard = slots.querySelector(".bp-card");
              retrigger(hitCard, "bp-hit");
              burst(hitCard, { count: 16 });
              floater(hitCard, "+0.1 ms", "");
              retrigger(watch, "gd-zap");
              api.done("Hit: <b>0.1 ms</b>. That’s 80× faster.");
            }
            button.disabled = false;
            busy = false;
          });
        },
      },
      {
        id: "bet",
        prompt: "Already in RAM? Place your bet.",
        why: "Look at the page ranges in RAM. If the customer’s number falls inside one, it’s a hit. RAM holds 2 pages; when it’s full, the least recently used page leaves.",
        mount(scene, api) {
          const SEQ = [12, 2, 11, 3, 20, 10];
          let slots = [{ page: 2, loaded: 0, used: 0 }];
          let clock = 1;
          let i = 0;
          let score = 0;
          let streak = 0;
          let busy = false;
          scene.innerHTML = `<div class="gd-bet">
            <div class="bp-shelf gd-disk">${diskMarkup(M)}</div>
            <div class="gd-bet-mid">
              <div class="bp-ram gd-ram"><span class="gd-ram-label">RAM</span><div class="bp-slots"></div></div>
              <div class="gd-ask"><span>next lookup · <em>1 / ${SEQ.length}</em></span><b>${M.pad(SEQ[0])}</b></div>
            </div>
            <div class="gd-bets"><button type="button" class="button gd-big gd-bet-hit" data-bet="hit">⚡ Hit</button><button type="button" class="button gd-big gd-bet-miss" data-bet="miss">🐢 Miss</button></div>
            <div class="gd-score" aria-live="polite">0 / 0</div>
          </div>`;
          const slotsEl = scene.querySelector(".bp-slots");
          const disk = scene.querySelector(".gd-disk");
          const ask = scene.querySelector(".gd-ask b");
          const counter = scene.querySelector(".gd-ask em");
          const scoreEl = scene.querySelector(".gd-score");
          const buttons = scene.querySelectorAll("[data-bet]");

          function paint() {
            slotsEl.innerHTML = slotsMarkup(M, slots, 2, "lru");
            disk.innerHTML = diskMarkup(M, new Set(slots.map((slot) => slot.page)));
          }

          async function bet(guess, button) {
            if (busy || i >= SEQ.length) return;
            busy = true;
            buttons.forEach((b) => { b.disabled = true; });
            const id = SEQ[i];
            const page = M.pageOf(id);
            clock += 1;
            const index = slots.findIndex((slot) => slot.page === page);
            const outcome = index >= 0 ? "hit" : "miss";
            const right = guess === outcome;
            score += right ? 1 : 0;
            streak = right ? streak + 1 : 0;
            retrigger(button, right ? "gd-right" : "gd-wrong");
            floater(button, right ? (streak > 2 ? `🔥 ${streak} in a row` : "✓ called it") : "✗ nope", right ? "" : "bad");
            if (outcome === "hit") {
              slots[index].used = clock;
              paint();
              const hitCard = slotsEl.querySelector(`[data-slot="${index}"] .bp-card`);
              retrigger(hitCard, "bp-hit");
              burst(hitCard, { count: 10 });
              api.say(`${M.pad(id)} lives on P${page + 1}, already in RAM: <b>hit</b>.`, "ok");
              await api.wait(650);
            } else {
              let target = slots.length;
              const next = victimOf(slots, 2, "lru");
              if (next >= 0) {
                target = next;
                slotsEl.querySelector(`[data-slot="${next}"] .bp-card`).classList.add("bp-evicting");
                await api.wait(340);
              }
              slotsEl.innerHTML = slotsMarkup(M, slots, 2, "lru", { incoming: target });
              await api.after(fly(disk.querySelector(`[data-page="${page}"]`), slotsEl.querySelector(`[data-slot="${target}"]`), { duration: 600, lift: 70, className: "bp-flying" }));
              slots[target] = { page, loaded: clock, used: clock };
              paint();
              const landed = slotsEl.querySelector(`[data-slot="${target}"] .bp-card`);
              retrigger(landed, "bp-land");
              floater(landed, "+8 ms", "bad");
              api.say(`${M.pad(id)} lives on P${page + 1}, not in RAM: <b>miss</b>.`, "warn");
              await api.wait(350);
            }
            i += 1;
            scoreEl.textContent = `${score} / ${i}${streak > 1 ? ` · 🔥${streak}` : ""}`;
            retrigger(scoreEl, "ping");
            if (i < SEQ.length) {
              ask.textContent = M.pad(SEQ[i]);
              counter.textContent = `${i + 1} / ${SEQ.length}`;
              retrigger(ask, "gd-pop");
              buttons.forEach((b) => { b.disabled = false; });
              busy = false;
              return;
            }
            ask.textContent = "🎉";
            counter.textContent = "done";
            burst(scoreEl, { count: 14 });
            api.done(`<b>${score} / ${SEQ.length}</b> right.${score >= 5 ? " Sharp!" : " The page ranges are the clue."}`);
          }

          buttons.forEach((button) => button.addEventListener("click", () => bet(button.dataset.bet, button)));
          paint();
        },
      },
      teachEvict(M),
      {
        id: "evict",
        prompt: "Which page would LRU evict? Tap it.",
        why: "LRU evicts the page used longest ago. P4 arrived first, but it was just used, so it stays. FIFO would have thrown P4 out.",
        mount(scene, api) {
          scene.innerHTML = `<div class="gd-evict">
            <div class="gd-incoming"><span>#26 needs</span>${card(M, 6, "gd-new")}</div>
            <div class="bp-ram gd-ram"><span class="gd-ram-label">RAM · full</span><div class="bp-slots">
              <button type="button" class="bp-slot gd-pick" data-page="7">${card(M, 7)}<span class="gd-meta"><i>arrived 2nd</i><i>unused since</i></span></button>
              <button type="button" class="bp-slot gd-pick" data-page="3">${card(M, 3)}<span class="gd-meta"><i>arrived 1st</i><i class="hot">used just now</i></span></button>
            </div></div>
            <div class="gd-verdict" hidden><span data-rule="lru">LRU evicts <b>P8</b></span><span data-rule="fifo">FIFO would evict <b>P4</b></span></div>
          </div>`;
          let chosen = false;
          scene.querySelectorAll(".gd-pick").forEach((pick) => pick.addEventListener("click", async () => {
            if (chosen) return;
            chosen = true;
            const right = pick.dataset.page === "7";
            const victim = scene.querySelector('.gd-pick[data-page="7"]');
            scene.querySelectorAll(".gd-pick").forEach((other) => { other.disabled = true; });
            retrigger(pick, right ? "gd-right" : "gd-wrong");
            floater(pick, right ? "✓ that’s LRU" : "✗ that’s FIFO’s pick", right ? "" : "bad");
            await api.wait(right ? 350 : 900);
            victim.querySelector(".bp-card").classList.add("bp-evicting");
            victim.querySelector(".gd-meta").remove();
            await api.wait(340);
            const incoming = scene.querySelector(".gd-new");
            await api.after(fly(incoming, victim, { duration: 620, lift: 60, className: "bp-flying" }));
            incoming.parentElement.style.visibility = "hidden";
            victim.innerHTML = card(M, 6);
            retrigger(victim.querySelector(".bp-card"), "bp-land");
            const verdict = scene.querySelector(".gd-verdict");
            verdict.hidden = false;
            verdict.querySelector('[data-rule="lru"]').classList.add("match");
            retrigger(verdict, "gd-pop");
            if (right) burst(verdict.querySelector(".match"), { count: 12 });
            api.done(right ? "Right: P8 was used longest ago. <b>LRU</b> keeps busy P4." : "LRU evicts <b>P8</b>: used longest ago. P4 was just used, so it stays.", right ? "ok" : "warn");
          }));
        },
      },
      {
        id: "race",
        prompt: "Which rule keeps the hot page? Race them.",
        why: "P1 (🔥) is needed every other lookup. LRU refreshes it on every use, so it never becomes the one to leave. FIFO throws it out just for being old.",
        mount(scene, api) {
          const simulate = (policy) => {
            const slots = [];
            let clock = 0;
            let reads = 0;
            return HOT_MIX.map((id) => {
              clock += 1;
              const page = M.pageOf(id);
              const index = slots.findIndex((slot) => slot.page === page);
              if (index >= 0) {
                slots[index].used = clock;
                return { slots: slots.map((slot) => ({ ...slot })), touched: index, kind: "hit", reads };
              }
              reads += 1;
              const next = victimOf(slots, 2, policy);
              const target = next >= 0 ? next : slots.length;
              slots[target] = { page, loaded: clock, used: clock };
              return { slots: slots.map((slot) => ({ ...slot })), touched: target, kind: "miss", reads };
            });
          };
          const runs = { fifo: simulate("fifo"), lru: simulate("lru") };
          scene.innerHTML = `<div class="gd-race">
            <div class="gd-racers">${["fifo", "lru"].map((policy) => `<div class="gd-racer" data-policy="${policy}">
              <div class="gd-racer-head"><b>${policy === "fifo" ? "FIFO" : "LRU"}</b><span><strong data-reads>0</strong> disk reads</span></div>
              <div class="bp-ram gd-ram"><div class="bp-slots">${slotsMarkup(M, [], 2, policy)}</div></div>
              <div class="gd-track">${HOT_MIX.map((id, i) => `<i data-i="${i}" title="${M.pad(id)}"></i>`).join("")}</div>
            </div>`).join("")}</div>
            <button type="button" class="button primary gd-big">Go!</button>
          </div>`;
          const go = scene.querySelector(".gd-big");
          const markHot = (el) => el.querySelectorAll('.bp-card[data-page="0"]').forEach((c) => c.classList.add("gd-hot"));
          go.addEventListener("click", async () => {
            go.disabled = true;
            scene.querySelectorAll(".gd-racer").forEach((racer) => {
              racer.classList.remove("gd-win", "gd-lose");
              racer.querySelectorAll(".gd-track i").forEach((dot) => { dot.className = ""; });
              racer.querySelector("[data-reads]").textContent = "0";
              racer.querySelector(".bp-slots").innerHTML = slotsMarkup(M, [], 2, racer.dataset.policy);
            });
            for (let i = 0; i < HOT_MIX.length; i += 1) {
              scene.querySelectorAll(".gd-racer").forEach((racer) => {
                const step = runs[racer.dataset.policy][i];
                const slotsEl = racer.querySelector(".bp-slots");
                slotsEl.innerHTML = slotsMarkup(M, step.slots, 2, racer.dataset.policy);
                markHot(slotsEl);
                const touched = slotsEl.querySelector(`[data-slot="${step.touched}"] .bp-card`);
                retrigger(touched, step.kind === "hit" ? "bp-hit" : "bp-land");
                racer.querySelector(`.gd-track [data-i="${i}"]`).className = step.kind;
                const reads = racer.querySelector("[data-reads]");
                if (reads.textContent !== String(step.reads)) {
                  reads.textContent = String(step.reads);
                  retrigger(reads, "gd-pop");
                }
              });
              await api.wait(430);
            }
            const lru = scene.querySelector('[data-policy="lru"]');
            lru.classList.add("gd-win");
            scene.querySelector('[data-policy="fifo"]').classList.add("gd-lose");
            burst(lru.querySelector(".gd-racer-head"), { count: 18, spread: 70 });
            go.disabled = false;
            go.textContent = "Race again";
            api.done(`LRU <b>${runs.lru.at(-1).reads}</b> reads · FIFO <b>${runs.fifo.at(-1).reads}</b>. LRU keeps the hot page.`);
            api.lab("buffer");
          });
        },
      },
      teachLocality(M),
      {
        id: "head",
        prompt: "Your turn: be the read head. Tap the glowing page.",
        why: "GET /orders needs 12 rows. Following an index on customer_id, each row pointer lands on a different heap page. A covering index keeps them together, in order.",
        mount(scene, api) {
          const PHASES = [
            { name: "heap", title: "Index on customer_id → heap rows", tone: "miss" },
            { name: "covering", title: "Covering index (customer_id, created_at)", tone: "good" },
          ];
          scene.innerHTML = `<div class="gd-head">${M.laneMarkup("gdlane", PHASES[0].title)}
            <div class="gd-bars" hidden>
              <div><span>scattered</span><i class="bad" style="--w:100%"></i><b>80.0 ms</b></div>
              <div><span>covering</span><i class="good" style="--w:30%"></i><b>24.0 ms</b></div>
            </div></div>`;
          const lane = scene.querySelector(".lane");
          const strips = scene.querySelector("#gdlane-strips");
          const head = strips.querySelector(".st-head");
          const msEl = scene.querySelector("#gdlane-ms");
          const pagesEl = scene.querySelector("#gdlane-pages");
          let phase = 0;
          let step = 0;
          let total = 0;
          let previous = null;
          let busy = false;

          function target() {
            strips.querySelectorAll(".gd-target").forEach((cell) => {
              cell.classList.remove("gd-target");
              cell.removeAttribute("tabindex");
              cell.removeAttribute("role");
            });
            const key = M.DRILL_STEPS[PHASES[phase].name][step];
            const cell = strips.querySelector(`[data-key="${key}"]`);
            cell.classList.add("gd-target");
            cell.setAttribute("role", "button");
            cell.setAttribute("tabindex", "0");
            cell.setAttribute("aria-label", `Read page ${cell.textContent}`);
            return cell;
          }

          function resetPhase() {
            strips.querySelectorAll(".st-cell").forEach((cell) => { cell.className = "st-cell"; });
            strips.querySelector(".st-arcs").innerHTML = "";
            head.classList.remove("on");
            strips.classList.toggle("skip-heap", phase === 1);
            lane.querySelector(".lane-head strong").textContent = PHASES[phase].title;
            setCount(msEl, 0, M.ms);
            pagesEl.textContent = "0";
            step = 0;
            total = 0;
            previous = null;
            target();
          }

          async function read(cell) {
            if (busy) return;
            if (!cell.classList.contains("gd-target")) {
              retrigger(cell, "gd-nope");
              return;
            }
            busy = true;
            const { name, tone } = PHASES[phase];
            const to = M.point(strips, cell);
            head.style.transform = `translate(${to.x - 7}px, ${to.y - 15}px)`;
            head.classList.add("on");
            if (previous) M.arc(strips, previous, to, name);
            cell.classList.remove("gd-target");
            cell.classList.add(tone);
            retrigger(cell, "st-pop");
            total += M.MISS_MS;
            countTo(msEl, total, { format: M.ms, duration: 250 });
            pagesEl.textContent = String(step + 1);
            floater(cell, "+8 ms", tone === "miss" ? "bad" : "");
            previous = to;
            step += 1;
            if (step < M.DRILL_STEPS[name].length) {
              target();
              busy = false;
              return;
            }
            if (phase === 0) {
              api.say(`<b>10</b> jumps, <b>80 ms</b>. Now the other path.`, "warn");
              await api.wait(900);
              phase = 1;
              resetPhase();
              api.prompt("Now with the covering index.");
              busy = false;
              return;
            }
            head.classList.remove("on");
            const bars = scene.querySelector(".gd-bars");
            bars.hidden = false;
            retrigger(bars, "gd-pop");
            burst(bars.querySelector(".good"), { count: 14 });
            api.done("Same 12 rows: <b>10</b> scattered pages vs <b>3</b> neighbours.");
            api.lab("drill");
          }

          strips.addEventListener("click", (event) => {
            const cell = event.target.closest(".st-cell");
            if (cell) read(cell);
          });
          strips.addEventListener("keydown", (event) => {
            const cell = event.target.closest(".gd-target");
            if (cell && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              event.stopPropagation();
              read(cell);
            }
          });
          resetPhase();
        },
      },
      {
        id: "cache",
        prompt: "A restart empties RAM. Flip the cache.",
        why: "When every page is already in RAM, even the scattered path is fast. That’s why this bug hides in staging and appears after a restart, a failover, or once data outgrows memory.",
        mount(scene, api) {
          const VALUES = { cold: { heap: 80, covering: 24 }, warm: { heap: 1, covering: 0.3 } };
          scene.innerHTML = `<div class="gd-flip">
            <button type="button" class="gd-switch" role="switch" aria-checked="false" aria-label="Warm cache"><span>❄ Cold</span><i></i><span>🔥 Warm</span></button>
            <div class="gd-bars">
              <div><span>scattered</span><i class="bad" data-bar="heap"></i><b data-v="heap">80.0 ms</b></div>
              <div><span>covering</span><i class="good" data-bar="covering"></i><b data-v="covering">24.0 ms</b></div>
            </div>
          </div>`;
          const toggle = scene.querySelector(".gd-switch");
          let warm = false;
          function paint(animate) {
            const values = VALUES[warm ? "warm" : "cold"];
            ["heap", "covering"].forEach((name) => {
              scene.querySelector(`[data-bar="${name}"]`).style.setProperty("--w", `${Math.max(1.5, (values[name] / 80) * 100)}%`);
              const out = scene.querySelector(`[data-v="${name}"]`);
              if (animate) countTo(out, values[name], { format: M.ms, duration: 500 });
              else setCount(out, values[name], M.ms);
            });
          }
          toggle.addEventListener("click", () => {
            warm = !warm;
            toggle.setAttribute("aria-checked", String(warm));
            paint(true);
            if (warm) api.done("Warm RAM hides the jumps. <b>Staging lies.</b>");
            else api.say("Cold again, like after a restart: the jumps are back.", "warn");
          });
          paint(false);
        },
      },
      {
        id: "quiz",
        prompt: "Four quick calls.",
        mount(scene, api) {
          const questions = M.QUIZ;
          let q = 0;
          let right = 0;
          function render() {
            const question = questions[q];
            scene.innerHTML = `<div class="gd-quiz">
              <span class="gd-q-count">${q + 1} / ${questions.length}</span>
              <p class="gd-q">${question.prompt}</p>
              <div class="gd-answers">${question.options.map((option, i) => `<button type="button" class="gd-answer" data-i="${i}">${option}</button>`).join("")}</div>
            </div>`;
            retrigger(scene.querySelector(".gd-quiz"), "gd-card-in");
            scene.querySelectorAll(".gd-answer").forEach((button) => button.addEventListener("click", async () => {
              const pick = Number(button.dataset.i);
              const correct = pick === question.answer;
              scene.querySelectorAll(".gd-answer").forEach((b) => {
                b.disabled = true;
                if (Number(b.dataset.i) === question.answer) b.classList.add("correct");
              });
              if (correct) {
                right += 1;
                burst(button, { count: 12 });
                api.say("✓ Right.", "ok");
              } else {
                button.classList.add("wrong");
                api.say(`✗ ${question.why}`, "warn");
              }
              await api.wait(correct ? 1000 : 2600);
              q += 1;
              if (q < questions.length) {
                render();
                api.say("");
                return;
              }
              scene.innerHTML = `<div class="gd-quiz gd-quiz-done"><b>${right} / ${questions.length}</b><span>${right >= 3 ? "Passed" : "Replay the beats and try again"}</span></div>`;
              retrigger(scene.querySelector(".gd-quiz"), "gd-card-in");
              if (right >= 3) {
                burst(scene.querySelector(".gd-quiz b"), { count: 20, spread: 80 });
                api.lab("quiz");
              }
              api.done(`<b>${right} / ${questions.length}</b> right.`);
            }));
          }
          render();
        },
      },
      {
        id: "finish",
        prompt: "Lesson done. 🎉",
        mount(scene, api) {
          const completed = DSL.state.completed.has("pages");
          scene.innerHTML = `<div class="gd-finish">
            <div class="gd-badges">
              <div style="--i:0"><span>📄</span><b>Whole pages</b><small>one row costs 8 KB</small></div>
              <div style="--i:1"><span>⚡</span><b>Hits are cheap</b><small>RAM is 80× faster</small></div>
              <div style="--i:2"><span>🎯</span><b>Neighbours win</b><small>locality beats luck</small></div>
            </div>
            <div class="gd-finish-actions">
              <button type="button" class="button primary complete-button ${completed ? "done" : ""}" data-complete="pages">${completed ? "✓ Completed" : "Mark complete"}</button>
              <a class="button" href="#/index-layout">Next lesson →</a>
              <button type="button" class="button ghost" data-mode="explore">Open Explore mode</button>
              <button type="button" class="button ghost gd-replay">↺ Replay</button>
            </div>
          </div>`;
          DSL.setTimer(() => burst(scene.querySelector(".gd-badges"), { count: 26, spread: 140 }), 350);
          scene.querySelector(".gd-replay").addEventListener("click", () => api.restart());
          api.done();
        },
      },
    ];
  }

  DSL.registerGuided("pages", () => DSL.Guided.run({
    lessonId: "pages",
    title: "02 · Pages, not rows",
    beats: makeBeats(),
    onLab: (id) => DSL.StorageModel.progress.complete(id),
  }));
})(window.DataSystemsLab);
