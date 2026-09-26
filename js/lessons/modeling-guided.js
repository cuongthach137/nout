(function registerModelingGuided(DSL) {
  "use strict";

  // Guided mode for lesson 01: explain each idea first, then let the learner do it.

  const { retrigger, burst, floater, countTo, fly } = DSL.LabKit;
  const PHONE_NEWER = "555-0177";

  function notebook(M, rows, { trash = false } = {}) {
    const body = rows.map((o, i) => `<tr data-id="${o.id}" style="--i:${i}"><td class="mono">${o.id}</td><td>${o.customer}</td><td class="mono" data-phone>${o.phone}</td><td>${M.dish(o.item)}</td>${trash ? `<td><button type="button" class="gm-trash" data-id="${o.id}" aria-label="Cancel order ${o.id}" ${o.id === "#104" ? "" : "disabled"}>🗑</button></td>` : ""}</tr>`).join("");
    return `<div class="model-board paper gm-notebook"><small>Order notebook</small><table class="model-table"><thead><tr><th>Order</th><th>Customer</th><th>Phone</th><th>Item</th>${trash ? "<th></th>" : ""}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  // Beats report moments worth reacting to; Narrated mode listens, Guided mode ignores them.
  function emit(api, name, data = {}) {
    if (api.event) api.event(name, data);
  }

  const roster = (names) => `<div class="gm-roster"><span>People the bakery knows</span>${names.map((name) => `<b data-name="${name}">${name}</b>`).join("")}</div>`;

  // The notebook at each reshaping step, with keyed values so they can slide between lists.
  function shapeMarkup(M, step) {
    const f = M.flip;
    if (step === 0) {
      const rows = M.ORDERS.map((o) => `<tr><td class="mono">${f(`id-${o.id}`, o.id)}</td><td class="k-person">${f(`name-${o.id}`, o.customer)}</td><td class="mono k-person">${f(`phone-${o.id}`, o.phone)}</td><td class="k-item">${f(`item-${o.id}`, M.dish(o.item))}</td><td class="mono k-item">${f(`price-${o.id}`, o.price)}</td></tr>`).join("");
      return M.boardMarkup("Order notebook", ["Order", "Customer", "Phone", "Item", "Price"], rows, "orders");
    }
    const from = (field, test) => M.ORDERS.filter(test).map((o) => `${field}-${o.id}`);
    const customers = M.CUSTOMERS.map((c) => `<tr><td class="mono">${f(`cid-${c.id}`, c.id, { cls: "key-chip" })}</td><td class="k-person">${f(`cname-${c.id}`, c.name, { from: from("name", (o) => o.customer === c.name) })}</td><td class="mono k-person">${f(`cphone-${c.id}`, c.phone, { from: from("phone", (o) => o.customer === c.name) })}</td></tr>`).join("");
    const ref = (o) => `<td class="mono">${f(`ref-${o.id}`, `→ ${M.CUST_ID[o.customer]}`, { cls: "ref-chip" })}</td>`;
    const customersBoard = M.boardMarkup("Customers", ["ID", "Name", "Phone"], customers, "customers");
    if (step === 1) {
      const rows = M.ORDERS.map((o) => `<tr><td class="mono">${f(`id-${o.id}`, o.id)}</td>${ref(o)}<td class="k-item">${f(`item-${o.id}`, M.dish(o.item))}</td><td class="mono k-item">${f(`price-${o.id}`, o.price)}</td></tr>`).join("");
      return `${customersBoard}${M.boardMarkup("Orders", ["Order", "Customer", "Item", "Price"], rows, "orders")}`;
    }
    const items = M.ITEMS.map((item) => `<tr><td class="mono">${f(`iid-${item.id}`, item.id, { cls: "key-chip" })}</td><td class="k-item">${f(`iname-${item.id}`, M.dish(item.name), { from: from("item", (o) => o.item === item.name) })}</td><td class="mono k-item">${f(`iprice-${item.id}`, item.price, { from: from("price", (o) => o.item === item.name) })}</td></tr>`).join("");
    const rows = M.ORDERS.map((o) => `<tr><td class="mono">${f(`id-${o.id}`, o.id)}</td>${ref(o)}<td class="mono">${f(`iref-${o.id}`, `→ ${M.ITEM_ID[o.item]}`, { cls: "ref-chip" })}</td></tr>`).join("");
    return `<div class="split-boards">${customersBoard}${M.boardMarkup("Items", ["ID", "Item", "Price"], items, "items")}</div>${M.boardMarkup("Orders", ["Order", "Customer", "Item"], rows, "orders")}`;
  }

  // Split lists for the join steps: rows are addressable, pointer chips are addressable.
  function joinMarkup(M, { clickable = false } = {}) {
    const attrs = (key) => (clickable ? ` data-pick="${key}" role="button" tabindex="0"` : ` data-pick="${key}"`);
    const orders = M.ORDERS.map((o) => `<tr${attrs(o.id)}><td class="mono">${o.id}</td><td class="mono"><span class="ref-chip" data-ref="${o.id}-c">→ ${M.CUST_ID[o.customer]}</span></td><td class="mono"><span class="ref-chip" data-ref="${o.id}-i">→ ${M.ITEM_ID[o.item]}</span></td></tr>`).join("");
    const customers = M.CUSTOMERS.map((c) => `<tr${attrs(c.id)}><td class="mono"><span class="key-chip">${c.id}</span></td><td>${c.name}</td><td class="mono">${c.id === "C1" ? M.PHONE_NEW : c.phone}</td></tr>`).join("");
    const items = M.ITEMS.map((item) => `<tr${attrs(item.id)}><td class="mono"><span class="key-chip">${item.id}</span></td><td>${M.dish(item.name)}</td><td class="mono">${item.price}</td></tr>`).join("");
    const slots = [["id", "order"], ["name", "name"], ["phone", "phone"], ["item", "item"], ["price", "price"]];
    return `<div class="gm-join ${clickable ? "clickable" : ""}">
      <div class="gm-join-stage">
        <div class="gm-join-left">${M.boardMarkup("Orders", ["Order", "Customer", "Item"], orders, "orders")}</div>
        <div class="gm-join-right">${M.boardMarkup("Customers", ["ID", "Name", "Phone"], customers)}${M.boardMarkup("Items", ["ID", "Item", "Price"], items)}</div>
        <svg class="join-arrows" aria-hidden="true"><defs><marker id="gm-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"></path></marker></defs></svg>
      </div>
      <div class="assembled">${slots.map(([key, label]) => `<span class="slot" data-slot="${key}">${label}</span>`).join("")}</div>
    </div>`;
  }

  function joinTools(root) {
    const stage = root.querySelector(".gm-join-stage");
    const svg = stage.querySelector(".join-arrows");
    return {
      root,
      row: (key) => stage.querySelector(`[data-pick="${key}"]`),
      chip: (ref) => stage.querySelector(`[data-ref="${ref}"]`),
      fill(key, text) {
        const slot = root.querySelector(`.slot[data-slot="${key}"]`);
        slot.textContent = text;
        slot.className = "slot filled";
        retrigger(slot, "ping");
      },
      arrow(fromEl, toEl) {
        svg.style.width = `${stage.scrollWidth}px`;
        svg.style.height = `${stage.scrollHeight}px`;
        const base = stage.getBoundingClientRect();
        const a = fromEl.getBoundingClientRect();
        const b = toEl.getBoundingClientRect();
        const x1 = a.right - base.left + 4;
        const y1 = a.top + a.height / 2 - base.top;
        const x2 = b.left - base.left - 6;
        const y2 = b.top + b.height / 2 - base.top;
        const bend = Math.max(40, (x2 - x1) * 0.5);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`);
        svg.appendChild(path);
        if (DSL.LabKit.reducedMotion()) {
          path.setAttribute("marker-end", "url(#gm-head)");
          return;
        }
        const length = path.getTotalLength();
        path.style.strokeDasharray = String(length);
        path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: 420, easing: "ease-out" }).onfinish = () => {
          path.style.strokeDasharray = "";
          path.setAttribute("marker-end", "url(#gm-head)");
        };
      },
    };
  }

  // A month of customer changes, coloured by what each response does with them.
  function monthTools(M, root) {
    const timeline = root.querySelector(".timeline");
    timeline.innerHTML = Array.from({ length: M.DRILL_DAYS }, (_, i) => {
      const event = M.DRILL_EVENTS.find((e) => e.day === i + 1);
      return `<span class="tl-day" data-day="${i + 1}">${event ? `<i class="tl-event" title="Day ${event.day}: ${event.fact}"></i>` : ""}</span>`;
    }).join("");
    const wrongOn = (r, d) => (r === "repair" ? 0 : M.DRILL_EVENTS.filter((e) => (r === "refresh" ? e.day === d : e.day <= d)).reduce((sum, e) => sum + e.rows, 0));
    const toneOn = (r, d) => (!wrongOn(r, d) ? "ok" : r === "refresh" ? "lag" : "bad");
    return {
      async play(api, response, onDay) {
        timeline.querySelectorAll(".tl-day").forEach((cell) => { cell.className = "tl-day"; });
        for (let d = 1; d <= M.DRILL_DAYS; d += 1) {
          timeline.querySelector(`[data-day="${d}"]`).className = `tl-day ${toneOn(response, d)}`;
          if (onDay) onDay(d, wrongOn(response, d));
          await api.wait(55);
        }
        return wrongOn(response, M.DRILL_DAYS);
      },
    };
  }

  const monthMarkup = `<div class="gm-month"><div class="timeline"></div><div class="timeline-legend"><span class="ok">correct</span><span class="lag">stale until tonight</span><span class="bad">wrong, nobody fixes it</span><span class="ev">a customer changed</span></div></div>`;

  // Explainers, shared by Guided and Narrated mode: { build(stage) → ctx, frames: [{ caption, enter }] }.
  function copiesStory(M) {
    return {
      build(stage) {
        stage.innerHTML = `<div class="gm-t1">${notebook(M, M.ORDERS)}${roster(["Maya", "Omar", "Ana"])}</div>`;
        const cell = (id) => stage.querySelector(`tr[data-id="${id}"] [data-phone]`);
        return { stage, cell, row: (id) => stage.querySelector(`tr[data-id="${id}"]`), person: (name) => stage.querySelector(`.gm-roster [data-name="${name}"]`) };
      },
      frames: [
        { caption: "A bakery keeps <b>one notebook</b> of orders.", async enter(ctx, a) { retrigger(ctx.stage.querySelector(".gm-t1"), "gm-rows-in"); await a.wait(700); } },
        {
          caption: "Maya ordered twice, so her phone is written <b>twice</b>.",
          async enter(ctx, a) {
            ["#101", "#103"].forEach((id) => {
              ctx.cell(id).classList.add("gm-copy");
              floater(ctx.cell(id), "copy", "warn");
            });
            await a.wait(600);
          },
        },
        {
          caption: "Maya gets a new number. Someone updates <b>one</b> row…",
          async enter(ctx, a) {
            const cell = ctx.cell("#101");
            cell.classList.remove("gm-copy");
            cell.textContent = M.PHONE_NEW;
            cell.classList.add("gm-fresh");
            retrigger(ctx.row("#101"), "hot");
            await a.wait(600);
          },
        },
        {
          caption: "…and now the notebook <b>disagrees with itself</b>.",
          async enter(ctx, a) {
            const cell = ctx.cell("#103");
            cell.classList.remove("gm-copy");
            cell.classList.add("stale-cell");
            retrigger(ctx.row("#103"), "hot-bad");
            floater(cell, "≠ 555-0199", "bad");
            await a.wait(600);
          },
        },
        {
          caption: "Cancel Ana’s only order, and her phone number <b>vanishes</b> with it.",
          async enter(ctx, a) {
            ctx.row("#104").classList.add("gone");
            const ana = ctx.person("Ana");
            floater(ana, "gone", "bad");
            ana.classList.add("gm-leave");
            await a.wait(700);
          },
        },
      ],
    };
  }

  function listsStory(M) {
    return {
      build(stage) {
        stage.innerHTML = `<div class="gm-shape">
          <div class="gm-legend"><span class="k-person">people</span><span class="k-item">cakes</span><span class="k-order">orders</span></div>
          <div class="gm-split">${shapeMarkup(M, 0)}</div>
        </div>`;
        return { shape: stage.querySelector(".gm-shape"), split: stage.querySelector(".gm-split") };
      },
      frames: [
        { caption: "This notebook mixes <b>three kinds</b> of facts.", async enter(ctx, a) { await a.wait(300); } },
        { caption: "Facts about <b>people</b>, about <b>cakes</b>, and about <b>orders</b>.", async enter(ctx, a) { ctx.shape.classList.add("gm-kinds"); await a.wait(500); } },
        {
          caption: "People get their own list. Orders keep a pointer instead: <b>→ C1</b>.",
          async enter(ctx, a) {
            const before = M.captureFlip(ctx.split);
            ctx.split.innerHTML = shapeMarkup(M, 1);
            M.playFlip(ctx.split, before);
            await a.wait(1300);
          },
        },
        {
          caption: "Cakes get their own list too. Orders become <b>pure pointers</b>.",
          async enter(ctx, a) {
            const before = M.captureFlip(ctx.split);
            ctx.split.innerHTML = shapeMarkup(M, 2);
            M.playFlip(ctx.split, before);
            await a.wait(1300);
          },
        },
        {
          caption: "Every fact now lives in <b>one place</b>. IDs, called <b>keys</b>, link the lists.",
          async enter(ctx, a) {
            [...ctx.split.querySelectorAll(".key-chip, .ref-chip")].forEach((chip, i) => DSL.setTimer(() => retrigger(chip, "ping"), i * 60));
            await a.wait(900);
          },
        },
      ],
    };
  }

  function joinStory(M) {
    return {
      build(stage) {
        stage.innerHTML = joinMarkup(M);
        return joinTools(stage);
      },
      frames: [
        {
          caption: "The screen needs order #103 as <b>one line</b>.",
          async enter(t, a) {
            t.row("#103").classList.add("lit");
            t.fill("id", "#103");
            await a.wait(400);
          },
        },
        {
          caption: "Its pointer <b>→ C1</b> leads to the Customers list.",
          async enter(t, a) {
            t.arrow(t.chip("#103-c"), t.row("C1").querySelector(".key-chip"));
            await a.wait(450);
            t.row("C1").classList.add("lit");
            t.fill("name", "Maya");
            t.fill("phone", M.PHONE_NEW);
          },
        },
        {
          caption: "Its pointer <b>→ I3</b> leads to the Items list.",
          async enter(t, a) {
            t.arrow(t.chip("#103-i"), t.row("I3").querySelector(".key-chip"));
            await a.wait(450);
            t.row("I3").classList.add("lit");
            t.fill("item", M.dish("Sourdough"));
            t.fill("price", "$9");
          },
        },
        {
          caption: "Stitching lists back together is a <b>join</b>: a few lookups, always-current data.",
          async enter(t, a) {
            burst(t.root.querySelector(".assembled"), { count: 18, spread: 90 });
            await a.wait(400);
          },
        },
      ],
    };
  }

  function ownerStory(M) {
    return {
      build(stage) {
        stage.innerHTML = `<div class="gm-report">
          <div class="gm-pipeline">
            <div class="gm-lists">${["Customers", "Orders", "Items", "Stores", "Staff", "Payments"].map((name, i) => `<span style="--i:${i}">${name}</span>`).join("")}</div>
            <span class="gm-pipe">→</span>
            <div class="gm-out"><small>Nightly revenue report</small><b class="gm-clock">—</b></div>
          </div>
          ${monthMarkup}
          <div class="gm-wrong">wrong facts in the report: <b>0</b></div>
        </div>`;
        return {
          lists: stage.querySelector(".gm-lists"),
          clock: stage.querySelector(".gm-clock"),
          wrong: stage.querySelector(".gm-wrong b"),
          month: monthTools(M, stage),
        };
      },
      frames: [
        {
          caption: "A nightly report joins <b>6 lists</b>. It takes <b>40 minutes</b>.",
          async enter(ctx, a) {
            retrigger(ctx.lists, "gm-in");
            ctx.clock.className = "gm-clock slow";
            countTo(ctx.clock, 40, { duration: 900, format: (n) => `${Math.round(n)} min` });
            await a.wait(900);
          },
        },
        {
          caption: "Shortcut: copy everything into <b>one wide table</b>. Fast!",
          async enter(ctx, a) {
            ctx.lists.classList.add("merged");
            ctx.clock.className = "gm-clock fast";
            countTo(ctx.clock, 3, { duration: 600, format: (n) => `${Math.round(n)} min` });
            await a.wait(700);
          },
        },
        {
          caption: "But customers keep changing, and nobody owns the copy. It <b>drifts</b>.",
          async enter(ctx, a) {
            await ctx.month.play(a, "wide", (d, wrong) => { ctx.wrong.textContent = String(wrong); });
            retrigger(ctx.wrong, "ping");
          },
        },
        {
          caption: "Give the copy an <b>owner</b>, a nightly refresh, and drift lasts a day at most.",
          async enter(ctx, a) {
            await ctx.month.play(a, "refresh", (d, wrong) => { ctx.wrong.textContent = wrong ? `${wrong} until tonight` : "0"; });
          },
        },
        {
          caption: "Or skip the copy: make the joins fast with <b>indexes</b>.",
          async enter(ctx, a) {
            ctx.lists.classList.remove("merged");
            ctx.clock.className = "gm-clock fast";
            countTo(ctx.clock, 4, { duration: 600, format: (n) => `${Math.round(n)} min` });
            await ctx.month.play(a, "repair", () => { ctx.wrong.textContent = "0"; });
          },
        },
      ],
    };
  }

  function makeBeats() {
    const M = DSL.ModelingModel;

    return [
      {
        id: "teach-copies",
        prompt: "What goes wrong with copies?",
        mount(scene, api) {
          DSL.Guided.storyboard(scene, api, copiesStory(M));
        },
      },
      {
        id: "hunt",
        prompt: "Your turn: fix every copy of Maya’s phone.",
        why: "Nothing in a notebook tells you how many copies exist or where. Every edit becomes a search, and a missed copy is silent.",
        mount(scene, api) {
          const SECONDS = 10;
          let rows = [];
          let phase = "idle";
          let deadline = 0;
          let run = 0;
          scene.innerHTML = `<div class="gm-hunt">
            <div class="gm-hunt-top"><div class="hunt-timer"><i></i></div><span class="gm-hunt-clock">10.0 s</span></div>
            <div class="gm-tickets"></div>
            <button type="button" class="button primary gd-big gm-start">Start · 10 seconds</button>
          </div>`;
          const tickets = scene.querySelector(".gm-tickets");
          const bar = scene.querySelector(".hunt-timer i");
          const timer = scene.querySelector(".hunt-timer");
          const clock = scene.querySelector(".gm-hunt-clock");
          const start = scene.querySelector(".gm-start");
          const stale = () => rows.filter((r) => r.customer === "Maya" && r.phone === M.PHONE_OLD);

          function deal() {
            rows = M.buildNotebook(24);
            tickets.innerHTML = rows.map((r, i) => `<button type="button" class="gm-ticket" data-id="${r.id}" style="--i:${i}" disabled><small>${r.id}</small><b>${r.customer}</b><span>${r.phone}</span></button>`).join("");
            bar.style.width = "100%";
            timer.classList.remove("low");
            clock.textContent = `${SECONDS}.0 s`;
          }

          function end(found) {
            phase = "over";
            tickets.querySelectorAll(".gm-ticket").forEach((t) => { t.disabled = true; });
            const total = rows.filter((r) => r.customer === "Maya").length;
            if (found) {
              burst(tickets, { count: 22, spread: 120 });
              api.done(`All <b>${total}</b> copies fixed. This time. Nothing told you how many there were.`);
            } else {
              stale().forEach((r) => {
                const ticket = tickets.querySelector(`[data-id="${r.id}"]`);
                ticket.classList.add("stale");
                retrigger(ticket, "gd-wrong");
              });
              api.done(`Missed <b>${stale().length} of ${total}</b>. Maya now has two phone numbers, and nobody would notice.`, "warn");
            }
            emit(api, "hunt", { found, missed: stale().length, total });
            api.lab("copies");
            start.textContent = "Try again";
            start.style.visibility = "visible";
          }

          async function tick(id) {
            while (id === run && phase === "hunt") {
              const left = (deadline - Date.now()) / 1000;
              bar.style.width = `${Math.max(0, left / SECONDS) * 100}%`;
              timer.classList.toggle("low", left < 3);
              clock.textContent = `${Math.max(0, left).toFixed(1)} s`;
              if (left <= 0) {
                end(false);
                return;
              }
              await api.wait(100);
            }
          }

          start.addEventListener("click", () => {
            if (phase === "hunt") return;
            deal();
            run += 1;
            phase = "hunt";
            deadline = Date.now() + SECONDS * 1000;
            start.style.visibility = "hidden";
            tickets.querySelectorAll(".gm-ticket").forEach((t) => { t.disabled = false; });
            api.say(`Tap every <b>${M.PHONE_OLD}</b> on Maya’s tickets.`);
            tick(run);
          });

          tickets.addEventListener("click", (event) => {
            const ticket = event.target.closest(".gm-ticket");
            if (!ticket || phase !== "hunt") return;
            const row = rows.find((r) => r.id === ticket.dataset.id);
            if (row.customer !== "Maya") {
              retrigger(ticket, "gd-wrong");
              emit(api, "wrong-ticket", { name: row.customer });
              api.say(`That’s ${row.customer}. Only Maya’s copies need the change.`, "warn");
              return;
            }
            if (row.phone !== M.PHONE_OLD) return;
            row.phone = M.PHONE_NEW;
            ticket.querySelector("span").textContent = M.PHONE_NEW;
            ticket.classList.add("fixed");
            retrigger(ticket, "gd-right");
            burst(ticket, { count: 8, spread: 30 });
            if (!stale().length) end(true);
            else api.say("Fixed one. Are there more? The notebook won’t say.");
          });

          deal();
        },
      },
      {
        id: "cancel",
        prompt: "Your turn: cancel Ana’s order #104.",
        why: "Ana’s phone was a fact about Ana, stored on her order. With nowhere else to live, it disappears with the order: a deletion anomaly.",
        mount(scene, api) {
          scene.innerHTML = `<div class="gm-t1">${notebook(M, M.ORDERS, { trash: true })}${roster(["Maya", "Omar", "Ana"])}</div>`;
          const trash = scene.querySelector('.gm-trash[data-id="#104"]');
          trash.classList.add("gm-pulse");
          trash.addEventListener("click", async () => {
            trash.disabled = true;
            trash.classList.remove("gm-pulse");
            scene.querySelector('tr[data-id="#104"]').classList.add("gone");
            await api.wait(350);
            const ana = scene.querySelector('.gm-roster [data-name="Ana"]');
            floater(ana, "Ana’s phone: gone", "bad");
            ana.classList.add("gm-leave");
            emit(api, "cancelled");
            api.done("Ana vanished too. Her phone only lived on that order.", "warn");
          });
        },
      },
      {
        id: "teach-lists",
        prompt: "One list per kind of thing.",
        mount(scene, api) {
          DSL.Guided.storyboard(scene, api, listsStory(M));
        },
      },
      {
        id: "sort",
        prompt: "Your turn: where does each fact belong?",
        why: "Ask what each fact describes. A phone describes a person, a price describes a cake, and the order number and time describe the order.",
        mount(scene, api) {
          const FACTS = [
            ["#105", "orders", "The order number identifies the order."],
            ["Lena", "people", "A name describes a person."],
            ["555-0404", "people", "A phone number belongs to a person."],
            [M.dish("Rye loaf"), "items", "A cake’s name describes the cake."],
            ["$8", "items", "The price is a fact about the cake."],
            ["Mon 9:14", "orders", "When it was ordered is about the order."],
          ];
          const BINS = [["people", "👤 Customers"], ["items", "🧁 Items"], ["orders", "🧾 Orders"]];
          scene.innerHTML = `<div class="gm-sort">
            <div class="model-board paper gm-messy"><small>A new notebook row</small><div class="gm-facts">${FACTS.map(([text], i) => `<span class="gm-fact" data-i="${i}">${text}</span>`).join("")}</div></div>
            <div class="gm-bins">${BINS.map(([key, label]) => `<button type="button" class="gm-bin k-${key === "people" ? "person" : key === "items" ? "item" : "order"}" data-bin="${key}"><b>${label}</b><span class="gm-bin-items"></span></button>`).join("")}</div>
          </div>`;
          let i = 0;
          let busy = false;
          const current = () => scene.querySelector(`.gm-fact[data-i="${i}"]`);
          const point = () => {
            current().classList.add("current");
            api.say(`Where does <b>${FACTS[i][0]}</b> go?`);
          };
          scene.querySelectorAll(".gm-bin").forEach((bin) => bin.addEventListener("click", async () => {
            if (busy || i >= FACTS.length) return;
            const [text, home, hint] = FACTS[i];
            if (bin.dataset.bin !== home) {
              retrigger(bin, "gd-wrong");
              emit(api, "sort-wrong", { fact: text, home });
              api.say(`Not quite. ${hint}`, "warn");
              return;
            }
            busy = true;
            const fact = current();
            const target = bin.querySelector(".gm-bin-items");
            await api.after(fly(fact, target, { duration: 520, lift: 50 }));
            fact.classList.remove("current");
            fact.classList.add("placed");
            target.insertAdjacentHTML("beforeend", `<i>${text}</i>`);
            retrigger(bin, "gd-right");
            i += 1;
            busy = false;
            if (i < FACTS.length) {
              point();
              return;
            }
            burst(scene.querySelector(".gm-bins"), { count: 20, spread: 110 });
            api.done("Every fact on the list of the thing it describes. That’s <b>normalization</b>.");
          }));
          point();
        },
      },
      {
        id: "one-edit",
        prompt: "Your turn: Maya has a new number. Edit it once.",
        why: "Orders don’t copy Maya’s phone any more; they point at C1. Change C1 and every order that points there sees it. Deleting an order only deletes the order.",
        mount(scene, api) {
          const customers = M.CUSTOMERS.map((c) => `<tr data-c="${c.id}"><td class="mono"><span class="key-chip">${c.id}</span></td><td>${c.name}</td><td class="mono">${c.id === "C1" ? `<button type="button" class="gm-edit">${M.PHONE_NEW}</button>` : c.phone}</td></tr>`).join("");
          const orders = M.ORDERS.map((o) => `<tr data-id="${o.id}"><td class="mono">${o.id}</td><td class="mono"><span class="ref-chip" data-ref="${M.CUST_ID[o.customer]}">→ ${M.CUST_ID[o.customer]}</span></td><td class="mono"><span class="ref-chip">→ ${M.ITEM_ID[o.item]}</span></td><td>${o.id === "#104" ? `<button type="button" class="gm-trash" aria-label="Cancel order #104" disabled>🗑</button>` : ""}</td></tr>`).join("");
          scene.innerHTML = `<div class="gm-live">${M.boardMarkup("Customers", ["ID", "Name", "Phone"], customers)}${M.boardMarkup("Orders", ["Order", "Customer", "Item", ""], orders, "orders")}</div>`;
          const edit = scene.querySelector(".gm-edit");
          const trash = scene.querySelector(".gm-trash");
          edit.classList.add("gm-pulse");
          edit.addEventListener("click", async () => {
            edit.disabled = true;
            edit.classList.remove("gm-pulse");
            edit.textContent = PHONE_NEWER;
            retrigger(scene.querySelector('tr[data-c="C1"]'), "hot");
            burst(edit, { count: 10 });
            const pointers = [...scene.querySelectorAll('[data-ref="C1"]')];
            pointers.forEach((chip, n) => DSL.setTimer(() => { retrigger(chip, "ping"); floater(chip, PHONE_NEWER, ""); }, 350 + n * 220));
            emit(api, "edited");
            api.say("<b>1 edit</b>, and both of Maya’s orders see it.", "ok");
            await api.wait(1500);
            api.prompt("Now cancel order #104.");
            trash.disabled = false;
            trash.classList.add("gm-pulse");
          });
          trash.addEventListener("click", async () => {
            trash.disabled = true;
            trash.classList.remove("gm-pulse");
            scene.querySelector('tr[data-id="#104"]').classList.add("gone");
            await api.wait(400);
            const ana = scene.querySelector('tr[data-c="C3"]');
            ana.classList.add("lit");
            floater(ana, "Ana is still here", "");
            emit(api, "cancelled");
            api.done("Ana stays on the Customers list. Deleting an order no longer erases a person.");
            api.lab("split");
          });
        },
      },
      {
        id: "teach-join",
        prompt: "Reading it back: joins.",
        mount(scene, api) {
          DSL.Guided.storyboard(scene, api, joinStory(M));
        },
      },
      {
        id: "assemble",
        prompt: "Your turn: open order #102.",
        why: "Each pointer is one lookup on another list. Three lookups rebuild the full row, and every value is the current one.",
        mount(scene, api) {
          scene.innerHTML = joinMarkup(M, { clickable: true });
          const t = joinTools(scene);
          const STEPS = [
            { key: "#102", prompt: "Follow → C2: tap that customer.", fill: () => t.fill("id", "#102") },
            { key: "C2", from: "#102-c", prompt: "Follow → I2: tap that cake.", fill: () => { t.fill("name", "Omar"); t.fill("phone", "555-0202"); } },
            { key: "I2", from: "#102-i", fill: () => { t.fill("item", M.dish("Carrot cake")); t.fill("price", "$22"); } },
          ];
          let step = 0;
          let busy = false;
          async function pick(row) {
            if (busy || step >= STEPS.length) return;
            const expected = STEPS[step];
            if (row.dataset.pick !== expected.key) {
              retrigger(row, "gd-wrong");
              emit(api, "wrong-row", { step });
              api.say(step === 0 ? "Find the order numbered #102." : `Look for <b>${expected.key}</b>, the ID the pointer names.`, "warn");
              return;
            }
            busy = true;
            if (expected.from) {
              t.arrow(t.chip(expected.from), row.querySelector(".key-chip"));
              await api.wait(420);
            }
            row.classList.add("lit");
            expected.fill();
            emit(api, "lookup", { n: step + 1 });
            api.say(`Lookup ${step + 1} of 3.`);
            step += 1;
            busy = false;
            if (step < STEPS.length) {
              api.prompt(expected.prompt);
              return;
            }
            burst(scene.querySelector(".assembled"), { count: 18, spread: 90 });
            api.done("<b>3 lookups</b> rebuilt the order. That’s a join, by hand.");
            api.lab("join");
          }
          scene.addEventListener("click", (event) => {
            const row = event.target.closest("[data-pick]");
            if (row) pick(row);
          });
          scene.addEventListener("keydown", (event) => {
            const row = event.target.closest("[data-pick]");
            if (row && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              event.stopPropagation();
              pick(row);
            }
          });
        },
      },
      {
        id: "teach-owner",
        prompt: "Copies, on purpose.",
        mount(scene, api) {
          DSL.Guided.storyboard(scene, api, ownerStory(M));
        },
      },
      {
        id: "fix-report",
        prompt: "Your turn: pick a fix, then watch the month.",
        why: "Fast joins keep one copy of every fact. A refreshed copy is fine when its owner keeps staleness bounded. A copy nobody owns drifts forever.",
        mount(scene, api) {
          scene.innerHTML = `<div class="gm-fix">
            <div class="response-cards" role="radiogroup" aria-label="Fix">${Object.entries(M.RESPONSES).map(([key, r]) => `<button type="button" class="response-card ${key}" role="radio" aria-checked="false" data-response="${key}"><span class="rc-tag">${r.tag}</span><strong>${r.title}</strong><small>${r.sub}</small></button>`).join("")}</div>
            <div class="gm-fix-stats"><span>report <b data-s="time">—</b></span><span>wrong facts <b data-s="wrong">—</b></span><span>owner <b data-s="owner">—</b></span></div>
            ${monthMarkup}
          </div>`;
          const month = monthTools(M, scene);
          const stat = (key) => scene.querySelector(`[data-s="${key}"]`);
          const tried = new Set();
          let busy = false;
          const VERDICT = {
            repair: "0 wrong facts all month. One copy of every fact, and fast joins.",
            refresh: "Stale for a day at most, then its owner fixes it. A trade you chose.",
            wide: "13 wrong facts and climbing. Nobody owns the copy.",
          };
          scene.querySelectorAll(".response-card").forEach((cardEl) => cardEl.addEventListener("click", async () => {
            if (busy) return;
            busy = true;
            const key = cardEl.dataset.response;
            scene.querySelectorAll(".response-card").forEach((other) => other.setAttribute("aria-checked", String(other === cardEl)));
            const r = M.RESPONSES[key];
            stat("time").textContent = r.time;
            stat("owner").textContent = r.owner;
            stat("owner").className = key === "wide" ? "bad" : "";
            await month.play(api, key, (d, wrong) => {
              stat("wrong").textContent = String(wrong);
              stat("wrong").className = wrong && key === "wide" ? "bad" : "";
            });
            tried.add(key);
            emit(api, "month", { key, tried: tried.size });
            busy = false;
            if (tried.size >= 2) {
              api.done(VERDICT[key], key === "wide" ? "warn" : "ok");
              api.lab("drill");
            } else {
              api.say(`${VERDICT[key]} Now try another fix.`, key === "wide" ? "warn" : "ok");
              api.prompt("Try another fix.");
            }
          }));
        },
      },
      DSL.Guided.quizBeat({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Guided.finishBeat({
        lessonId: "modeling",
        next: "pages",
        badges: [["🧾", "One fact, one place", "an edit stays one edit"], ["🔗", "Pointers, not copies", "keys link the lists"], ["🧷", "Copies need an owner", "or they drift"]],
      }),
    ];
  }

  DSL.ModelingScenes = Object.freeze({ copiesStory, listsStory, joinStory, ownerStory, beats: makeBeats });

  DSL.registerGuided("modeling", () => DSL.Guided.run({
    lessonId: "modeling",
    title: `${DSL.lessonNumber("modeling")} · One fact, one place`,
    beats: makeBeats(),
    onLab: (id) => DSL.ModelingModel.progress.complete(id),
  }));
})(window.DataSystemsLab);
