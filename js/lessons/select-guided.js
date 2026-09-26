(function registerSelectGuided(DSL) {
  "use strict";

  // Guided mode for the SELECT lesson: storyboards that run real queries, a fill-the-blank query,
  // predictions, and two written exercises. The scenes are shared with Narrated mode
  // (DSL.SelectScenes); Guided adds fuller captions and "why" notes.

  const { retrigger, burst } = DSL.LabKit;
  const { board, flip, predictBeat, challengeBeat, teach, slice } = DSL.SqlScenes;
  const hl = (sql) => DSL.Sql.highlight(sql);
  const run = (sql) => DSL.Sql.run("bakery", sql);

  // ---------- Storyboards. Every frame sets its own query, so any run of frames works alone. ----------

  const Q = {
    all: "SELECT *\nFROM customers;",
    pick: "SELECT name, city\nFROM customers;",
    products: "SELECT name, price\nFROM products;",
    rise: "SELECT name, price,\n  price * 1.1 AS new_price\nFROM products;",
    cities: "SELECT city\nFROM customers;",
    distinct: "SELECT DISTINCT city\nFROM customers;",
    lisbon: "SELECT name, phone\nFROM customers\nWHERE city = 'Lisbon';",
    trap: "SELECT id, customer_id, status\nFROM orders\nWHERE customer_id = 1\n  AND status = 'pending'\n  OR status = 'refunded';",
    fixed: "SELECT id, customer_id, status\nFROM orders\nWHERE customer_id = 1\n  AND (status = 'pending'\n    OR status = 'refunded');",
    in: "SELECT id, customer_id, status\nFROM orders\nWHERE customer_id = 1\n  AND status IN ('pending', 'refunded');",
    sorted: "SELECT name, price\nFROM products\nORDER BY price DESC;",
    top3: "SELECT name, price\nFROM products\nORDER BY price DESC\nLIMIT 3;",
  };

  function queryStory() {
    return {
      build: (stage) => board(stage, { label: "customers" }),
      frames: [
        {
          caption: "This is the <b>customers</b> table: one row per customer, one column per fact about them.",
          async enter(b, a) { b.code(""); await a.after(b.show(Q.all)); await a.wait(500); },
        },
        {
          caption: "A query asks a question: <b>SELECT</b> the columns you want, <b>FROM</b> a table.",
          async enter(b, a) { await a.after(b.show(Q.all)); await a.after(b.code(Q.pick, { type: true })); },
        },
        {
          caption: "SELECT picks columns. Every row still comes back, but only with the facts you asked for.",
          async enter(b, a) {
            if (!b.columns().includes("joined")) await a.after(b.show(Q.all));
            b.code(Q.pick);
            ["id", "phone", "joined"].forEach((name) => b.cells(name).forEach((cell) => cell.classList.add("sq-dim")));
            ["name", "city"].forEach((name) => b.cells(name).forEach((cell) => cell.classList.add("sq-pick")));
            await a.wait(700);
          },
        },
        {
          caption: "The answer is a new table: the <b>result set</b>. You said <em>what</em> you want, not how to find it. That makes SQL <b>declarative</b>.",
          async enter(b, a) {
            b.code(Q.pick);
            await a.after(b.show(Q.pick, { label: "result set", mark: () => "sq-pick" }));
            await a.wait(500);
          },
        },
      ],
    };
  }

  function shapeStory() {
    return {
      build: (stage) => board(stage, { label: "result set" }),
      frames: [
        {
          caption: "A column can be computed. The bakery plans a <b>10%</b> price rise: start from each product's price.",
          async enter(b, a) { b.code(Q.products); await a.after(b.show(Q.products)); },
        },
        {
          caption: "Multiply in the SELECT, and name the new column with <b>AS</b>. That name is an <b>alias</b>.",
          async enter(b, a) {
            await a.after(b.code(Q.rise, { type: true }));
            await a.after(b.show(Q.rise));
            b.cells("new_price").forEach((cell) => cell.classList.add("sq-new"));
          },
        },
        {
          caption: "Which cities do we deliver to? Asking for <b>city</b> repeats Lisbon three times, and Osaka twice.",
          async enter(b, a) {
            b.code(Q.cities);
            await a.after(b.show(Q.cities, { mark: (row) => (row[0] === "Lisbon" || row[0] === "Osaka" ? "sq-dup" : "") }));
          },
        },
        {
          caption: "<b>DISTINCT</b> keeps one copy of each row: seven cities. Raj never gave his, so <b>NULL</b> gets a row of its own.",
          async enter(b, a) {
            await a.after(b.code(Q.distinct, { type: true }));
            await a.after(b.show(Q.distinct, { mark: (row) => (row[0] === null ? "sq-hot" : "") }));
          },
        },
      ],
    };
  }

  function whereStory() {
    const isLisbon = (row) => row[1] === "Lisbon";
    return {
      build: (stage) => board(stage, { label: "customers" }),
      frames: [
        {
          caption: "A pastry launches in Lisbon. Only Lisbon customers should get the text.",
          async enter(b, a) {
            b.code(Q.lisbon);
            await a.after(b.show("SELECT name, city, phone FROM customers", { label: "FROM customers" }));
          },
        },
        {
          caption: "<b>WHERE</b> holds a test. The database checks it against every row, one at a time.",
          async enter(b, a) {
            if (!b.rows().length) await a.after(b.show("SELECT name, city, phone FROM customers", { label: "FROM customers" }));
            const rows = await a.after(run("SELECT name, city, phone FROM customers"));
            for (const [i, row] of b.rows().entries()) {
              row.classList.add(isLisbon(rows.rows[i]) ? "sq-pass" : "sq-fail");
              await a.wait(160);
            }
          },
        },
        {
          caption: "Rows that pass stay. The rest are dropped. Then SELECT keeps just <b>name</b> and <b>phone</b>.",
          async enter(b, a) {
            const all = await a.after(run("SELECT name, city, phone FROM customers"));
            if (!b.grid.querySelector(".sq-fail")) b.paint(all, { mark: (row) => (isLisbon(row) ? "sq-pass" : "sq-fail") });
            b.rows().filter((row) => row.classList.contains("sq-fail")).forEach((row) => row.classList.add("sq-drop"));
            await a.wait(650);
            await a.after(b.show(Q.lisbon, { label: "result set", mark: () => "sq-pass" }));
          },
        },
        {
          caption: "<code>city = 'Lisbon'</code> is a <b>predicate</b>: a test that's true or false for each row. Here are the common ones.",
          async enter(b, a) {
            b.code("");
            b.grid.innerHTML = `<div class="sq-ops">${[["=  <>", "equal, not equal"], ["<  <=  >  >=", "compare"], ["BETWEEN a AND b", "a range, ends included"], ["IN ( … )", "any value in a list"], ["LIKE '%loaf%'", "a text pattern"], ["IS NULL", "a missing value"]].map(([op, what], i) => `<div style="--i:${i}"><code>${op.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code><span>${what}</span></div>`).join("")}</div>`;
            b.label("operators");
            await a.wait(600);
          },
        },
      ],
    };
  }

  function andorStory() {
    const raj = (row) => (row[1] === 5 ? "sq-bad" : "sq-pass");
    return {
      build: (stage) => board(stage, { label: "result set" }),
      frames: [
        {
          caption: "Maya (customer 1) paid for an order that never came. Find her orders that are <b>pending</b> or <b>refunded</b>. A first try:",
          async enter(b, a) { await a.after(b.code(Q.trap, { type: true })); b.grid.innerHTML = `<p class="sq-wait">?</p>`; },
        },
        {
          caption: "Two rows, and one of them is <b>Raj's</b> (customer 5).",
          async enter(b, a) { b.code(Q.trap); await a.after(b.show(Q.trap, { mark: raj })); },
        },
        {
          caption: "<b>AND</b> binds tighter than <b>OR</b>, so SQL read it as: Maya's pending orders, <em>or</em> anybody's refunded order.",
          async enter(b, a) {
            b.code("");
            b.stage.querySelector(".sq-code").hidden = false;
            b.stage.querySelector(".sq-code").innerHTML = `${hl("SELECT id, customer_id, status\nFROM orders\nWHERE ")}<span class="sq-group">${hl("customer_id = 1\n  AND status = 'pending'")}</span>\n  <span class="sq-group other">${hl("OR status = 'refunded'")}</span>;`;
            await a.after(b.show(Q.trap, { mark: raj }));
            await a.wait(600);
          },
        },
        {
          caption: "Brackets say what you mean. Now it's only Maya's order.",
          async enter(b, a) { await a.after(b.code(Q.fixed, { type: true })); await a.after(b.show(Q.fixed, { mark: () => "sq-pass" })); },
        },
        {
          caption: "Even clearer: <b>IN</b> checks against a list. When you mix AND with OR, always add brackets.",
          async enter(b, a) { await a.after(b.code(Q.in, { type: true })); await a.after(b.show(Q.in, { mark: () => "sq-pass" })); },
        },
      ],
    };
  }

  function orderStory() {
    return {
      build: (stage) => board(stage, { label: "result set" }),
      frames: [
        {
          caption: "The menu board needs the <b>three most expensive</b> products.",
          async enter(b, a) { b.code(Q.products); await a.after(b.show(Q.products)); },
        },
        {
          caption: "Rows come back in <b>no promised order</b>. Today it looks like ID order. After updates, or with another plan, it may not.",
          async enter(b, a) {
            if (!b.rows().length) { b.code(Q.products); await a.after(b.show(Q.products)); }
            b.grid.insertAdjacentHTML("beforeend", `<span class="sq-stamp">order not guaranteed</span>`);
            await a.wait(500);
          },
        },
        {
          caption: "<b>ORDER BY</b> sorts the result. <b>DESC</b> puts the biggest first; ascending is the default.",
          async enter(b, a) {
            b.code(Q.products);
            const before = await a.after(run(Q.products));
            b.paint(before);
            await a.after(b.code(Q.sorted, { type: true }));
            const sorted = await a.after(run(Q.sorted));
            const rows = b.rows();
            const byName = new Map(rows.map((row, i) => [before.rows[i][0], row]));
            const target = sorted.rows.map((row) => byName.get(row[0]));
            await a.after(flip(rows, () => target.forEach((row) => b.grid.appendChild(row))));
          },
        },
        {
          caption: "<b>LIMIT</b> keeps the first rows and drops the rest. Sort first, then cut: <b>LIMIT 3</b> without ORDER BY means <em>any</em> three.",
          async enter(b, a) {
            if (b.grid.querySelector(".sq-stamp")) b.grid.querySelector(".sq-stamp").remove();
            b.code(Q.sorted);
            const sorted = await a.after(run(Q.sorted));
            if (b.rows()[0].textContent.indexOf(sorted.rows[0][0]) < 0) b.paint(sorted);
            await a.after(b.code(Q.top3, { type: true }));
            b.rows().forEach((row, i) => row.classList.add(i < 3 ? "sq-pass" : "sq-drop"));
            await a.wait(700);
            await a.after(b.show(Q.top3, { mark: () => "sq-pass" }));
          },
        },
      ],
    };
  }

  const WRITTEN = [["SELECT", "name, price * 1.1 AS new_price"], ["FROM", "products"], ["WHERE", "price > 4"], ["ORDER BY", "new_price DESC"], ["LIMIT", "3"]];
  const RUNS = ["FROM", "WHERE", "SELECT", "ORDER BY", "LIMIT"];

  function logicStory() {
    return {
      build(stage) {
        stage.innerHTML = `<div class="sq-logic"><ol class="sq-clauses">${WRITTEN.map(([clause, rest]) => `<li data-clause="${clause}"><i></i>${hl(clause)} <span>${hl(rest)}</span></li>`).join("")}</ol><div class="sq-logic-note"></div></div>`;
        return { list: stage.querySelector(".sq-clauses"), note: stage.querySelector(".sq-logic-note") };
      },
      frames: [
        {
          caption: "You <b>write</b> SELECT first. The database doesn't <b>run</b> it first.",
          async enter(ctx, a) { retrigger(ctx.list, "sq-grid-in"); await a.wait(600); },
        },
        {
          caption: "It starts <b>FROM</b> the table, keeps rows <b>WHERE</b> the test passes, then <b>SELECT</b>s columns, sorts, and cuts.",
          async enter(ctx, a) {
            const items = [...ctx.list.children];
            await a.after(flip(items, () => RUNS.forEach((clause) => ctx.list.appendChild(ctx.list.querySelector(`[data-clause="${clause}"]`)))));
            [...ctx.list.children].forEach((item, i) => { item.querySelector("i").textContent = String(i + 1); item.classList.add("sq-numbered"); });
          },
        },
        {
          caption: "That's the <b>logical query order</b>. It decides which names each clause can see.",
          async enter(ctx, a) {
            [...ctx.list.children].forEach((item, i) => { item.querySelector("i").textContent = String(i + 1); item.classList.add("sq-numbered"); });
            if (ctx.list.firstElementChild.dataset.clause !== "FROM") RUNS.forEach((clause) => ctx.list.appendChild(ctx.list.querySelector(`[data-clause="${clause}"]`)));
            ctx.list.classList.add("sq-glow");
            await a.wait(500);
          },
        },
        {
          caption: "An alias made in SELECT doesn't exist yet when WHERE runs, so <code>WHERE new_price &gt; 5</code> fails in PostgreSQL. ORDER BY runs later: it can use it.",
          async enter(ctx, a) {
            if (ctx.list.firstElementChild.dataset.clause !== "FROM") RUNS.forEach((clause) => ctx.list.appendChild(ctx.list.querySelector(`[data-clause="${clause}"]`)));
            ctx.note.innerHTML = `<div class="sq-verdict bad"><code>✗ ${hl("WHERE new_price > 5")}</code><small>runs before SELECT: no such column yet</small></div><div class="sq-verdict good"><code>✓ ${hl("ORDER BY new_price DESC")}</code><small>runs after SELECT: the alias exists</small></div>`;
            retrigger(ctx.note, "sq-grid-in");
            await a.wait(600);
          },
        },
      ],
    };
  }

  // ---------- Interactive beats ----------

  // Fill the blank in SELECT ___ FROM customers. Events: pick { choice, ok }.
  const PICKS = [["*", "*"], ["name", "name"], ["name, phone", "name, phone"]];
  function pickBeat() {
    return {
      id: "pick",
      prompt: "Fill the blank: the bakery wants to text every customer.",
      why: "A text needs a name to greet and a number to send to. SELECT lists exactly those columns.",
      mount(scene, api) {
        scene.innerHTML = `<div class="sq-pick-beat">
          <div class="sq-board"><pre class="sq-code">${hl("SELECT ")}<span class="sq-blank">?</span>\n${hl("FROM customers;")}</pre>
          <div class="sq-choices">${PICKS.map(([value, label], i) => `<button type="button" class="sq-chip" data-pick="${i}" style="--i:${i}">${hl(label)}</button>`).join("")}</div>
          <div class="sq-result"><span class="sq-label">result set</span><div class="sq-grid"></div></div></div>
        </div>`;
        const blank = scene.querySelector(".sq-blank");
        const b = { grid: scene.querySelector(".sq-grid") };
        const view = board(document.createElement("div"));
        let busy = false;
        scene.querySelector(".sq-choices").addEventListener("click", async (event) => {
          const chip = event.target.closest("[data-pick]");
          if (!chip || busy) return;
          busy = true;
          const [value] = PICKS[Number(chip.dataset.pick)];
          blank.innerHTML = hl(value);
          blank.classList.add("filled");
          retrigger(blank, "gd-pop");
          const result = await api.after(run(`SELECT ${value} FROM customers`));
          view.paint(result);
          b.grid.replaceWith(view.grid);
          b.grid = view.grid;
          const ok = value === "name, phone";
          scene.querySelectorAll(".sq-chip").forEach((c) => c.classList.toggle("picked", c === chip));
          busy = false;
          api.event("pick", { choice: value, ok });
          if (ok) {
            view.cells("phone").forEach((cell) => cell.classList.add("sq-pick"));
            burst(chip, { count: 12 });
            scene.querySelectorAll(".sq-chip").forEach((c) => { c.disabled = true; });
            api.done("Name and phone for all ten customers. <b>NULL</b> means the bakery never got that number.");
          } else if (value === "*") {
            api.say("<b>*</b> is every column: handy for a quick look, but it drags along data the text doesn't need.", "warn");
          } else {
            api.say("Names alone won't reach anyone. What else does a text need?", "warn");
          }
        });
      },
    };
  }

  // ---------- Beats in lesson order ----------


  const distinctPredict = () => predictBeat({
    id: "distinct",
    prompt: "Add DISTINCT. How many rows come back?",
    why: "DISTINCT compares whole rows. A missing value, NULL, is treated as one value here, so it survives as a row of its own.",
    question: `<pre class="sq-code">${hl(Q.distinct)}</pre>`,
    options: [["6", "6"], ["7", "7"], ["10", "10"]],
    answer: "7",
    explain: { right: "Seven: six cities, plus <b>NULL</b> for Raj.", wrong: "It's seven: six cities, plus <b>NULL</b> for Raj, who never gave his city." },
    async reveal(host) {
      const b = board(host);
      await b.show(Q.distinct, { mark: (row) => (row[0] === null ? "sq-hot" : "") });
    },
  });

  const trapPredict = () => predictBeat({
    id: "trap",
    prompt: "Maya's pending or refunded orders. How many rows?",
    why: "Maya is customer 1. Read the WHERE clause the way the database does before you answer.",
    question: `<pre class="sq-code">${hl(Q.trap)}</pre>`,
    options: [["1", "One: Maya's pending order"], ["2", "Two"]],
    answer: "2",
    explain: { right: "Two. You spotted the trap. Next: why.", wrong: "Two rows. That's what we meant, not what we wrote. Next: why." },
    async reveal(host) {
      const b = board(host);
      await b.show(Q.trap, { mark: (row) => (row[1] === 5 ? "sq-bad" : "sq-pass") });
    },
  });

  const filterChallenge = () => challengeBeat({
    id: "filter",
    prompt: "Your turn: the Lisbon list.",
    why: "Text values go in single quotes: city = 'Lisbon'. Without quotes, SQL looks for a column called Lisbon.",
    task: "Return the <b>name</b> and <b>phone</b> of every customer in <b>Lisbon</b>.",
    starter: "SELECT name, phone\nFROM customers\nWHERE ",
    solution: "SELECT name, phone FROM customers WHERE city = 'Lisbon'",
  });

  const recentChallenge = () => challengeBeat({
    id: "recent",
    prompt: "Your turn: newest first.",
    why: "Dates stored as YYYY-MM-DD text sort correctly as text, so ORDER BY ordered_at DESC puts the newest first.",
    task: "The three most recent orders, newest first. Return <b>id</b> and <b>ordered_at</b>.",
    starter: "",
    solution: "SELECT id, ordered_at FROM orders ORDER BY ordered_at DESC LIMIT 3",
    ordered: true,
  });

  function makeBeats() {
    const M = DSL.SelectModel;
    return [
      teach("teach-query", "A query is a question.", queryStory(), "You never tell the database how to find rows: which index to use, which order to read pages in. It plans that itself. That's what declarative means."),
      pickBeat(),
      teach("teach-shape", "Shape the answer.", slice(shapeStory(), 0, 3), "Aliases name computed columns, so the application can read them by name. Without AS, the column is called whatever the expression looks like."),
      distinctPredict(),
      teach("teach-where", "Keep only some rows.", whereStory(), "WHERE runs before SELECT: it can test columns you don't return, like city here."),
      filterChallenge(),
      teach("teach-trap", "A query that looks right.", slice(andorStory(), 0, 1)),
      trapPredict(),
      teach("teach-andor", "AND before OR.", slice(andorStory(), 2, 5), "Like × before + in arithmetic. Brackets cost nothing and remove all doubt."),
      teach("teach-order", "Sort, then cut.", orderStory(), "Row order without ORDER BY depends on how the engine happens to read the data: table order, an index, or several workers at once."),
      recentChallenge(),
      teach("teach-logic", "The order SQL runs in.", logicStory(), "Full order, for later lessons: FROM, WHERE, GROUP BY, HAVING, SELECT, DISTINCT, ORDER BY, LIMIT."),
      DSL.Guided.quizBeat({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Guided.finishBeat({
        lessonId: "select",
        badges: [["🧾", "Shape", "SELECT, AS, DISTINCT"], ["🔎", "Filter", "WHERE, with brackets"], ["🏁", "Sort, then cut", "ORDER BY, LIMIT"]],
      }),
    ];
  }

  DSL.SelectScenes = Object.freeze({ Q, board, queryStory, shapeStory, whereStory, andorStory, orderStory, logicStory, pickBeat, distinctPredict, trapPredict, filterChallenge, recentChallenge, beats: makeBeats });

  DSL.registerGuided("select", () => DSL.Guided.run({
    lessonId: "select",
    title: `${DSL.lessonNumber("select")} · SELECT, filter, sort`,
    beats: makeBeats(),
  }));
})(window.DataSystemsLab);
