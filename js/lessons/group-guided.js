(function registerGroupGuided(DSL) {
  "use strict";

  // Guided mode for GROUP BY and HAVING. The pile board sorts row chips into one pile per group,
  // collapses each pile into its aggregate, and then shows the result. Scenes are shared with
  // Narrated mode (DSL.GroupScenes).

  const { retrigger } = DSL.LabKit;
  const { board, flip, predictBeat, challengeBeat, teach, slice } = DSL.SqlScenes;
  const hl = (sql) => DSL.Sql.highlight(sql);
  const run = (sql) => DSL.Sql.run("bakery", sql);

  const Q = {
    orders: "SELECT id, customer_id, status\nFROM orders;",
    count: "SELECT COUNT(*)\nFROM orders;",
    prices: "SELECT COUNT(*), SUM(price), AVG(price),\n       MIN(price), MAX(price)\nFROM products;",
    phones: "SELECT COUNT(*), COUNT(phone)\nFROM customers;",
    byStatus: "SELECT status, COUNT(*)\nFROM orders\nGROUP BY status;",
    bare: "SELECT customer_id, ordered_at, COUNT(*)\nFROM orders\nGROUP BY customer_id;",
    bareFixed: "SELECT customer_id,\n       MAX(ordered_at) AS latest,\n       COUNT(*)\nFROM orders\nGROUP BY customer_id;",
    perCustomer: "SELECT c.name, COUNT(*)\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nGROUP BY c.name;",
    regulars: "SELECT c.name, COUNT(*)\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nGROUP BY c.name\nHAVING COUNT(*) >= 2;",
    paidRegulars: "SELECT c.name, COUNT(*)\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nWHERE o.status = 'paid'\nGROUP BY c.name\nHAVING COUNT(*) >= 2;",
    fanout: "SELECT c.name, COUNT(*)\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nJOIN order_items i ON i.order_id = o.id\nGROUP BY c.name;",
    fanoutFixed: "SELECT c.name, COUNT(DISTINCT o.id)\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nJOIN order_items i ON i.order_id = o.id\nGROUP BY c.name;",
  };
  const sorted = (sql, by) => sql.replace(/;$/, `\nORDER BY ${by};`);
  const STATUSES = ["paid", "pending", "refunded"];

  // ---------- Pile board: order chips → one pile per status → one row per pile ----------

  function pileBoard(stage) {
    stage.innerHTML = `<div class="gp-board">
      <pre class="sq-code" hidden></pre>
      <div class="gp-field">
        <div class="gp-source"></div>
        <div class="gp-piles">${STATUSES.map((status) => `<div class="gp-pile" data-status="${status}"><span class="gp-pile-label">${status}</span><div class="gp-pile-chips"></div><b class="gp-pile-count"></b></div>`).join("")}</div>
      </div>
      <div class="gp-out" hidden></div>
    </div>`;
    const root = stage.firstElementChild;
    const codeEl = root.querySelector(".sq-code");
    const field = root.querySelector(".gp-field");
    const source = root.querySelector(".gp-source");
    const out = root.querySelector(".gp-out");
    let rows = null;

    async function load() {
      if (!rows) rows = (await run("SELECT id, status FROM orders ORDER BY id")).rows;
      if (!source.children.length && !root.querySelector(".gp-pile-chips .gp-chip")) {
        source.innerHTML = rows.map(([id, status], i) => `<span class="gp-chip" data-status="${status}" style="--i:${i}">#${id}</span>`).join("");
      }
      field.hidden = false;
      out.hidden = true;
      return rows;
    }

    function code(sql) {
      codeEl.hidden = !sql;
      codeEl.innerHTML = hl(sql);
      retrigger(codeEl, "sq-code-in");
    }

    async function sort(a) {
      await load();
      root.classList.add("gp-sorted");
      const chips = [...source.querySelectorAll(".gp-chip")];
      if (!chips.length) return;
      await a.after(flip(chips, () => chips.forEach((chip) => root.querySelector(`.gp-pile[data-status="${chip.dataset.status}"] .gp-pile-chips`).appendChild(chip)), 650));
    }

    function collapse() {
      root.classList.add("gp-sorted", "gp-collapsed");
      root.querySelectorAll(".gp-pile").forEach((pile) => {
        const count = pile.querySelectorAll(".gp-chip").length;
        const badge = pile.querySelector(".gp-pile-count");
        badge.textContent = String(count);
        retrigger(badge, "gd-pop");
      });
    }

    async function result(sql, options = {}) {
      field.hidden = true;
      out.hidden = false;
      const view = board(out, { label: options.label || "result set" });
      return view.show(sql, options);
    }

    return { root, load, code, sort, collapse, result };
  }

  // ---------- Storyboards (each frame sets up its own state) ----------

  function aggStory() {
    return {
      build: (stage) => board(stage, { label: "orders" }),
      frames: [
        {
          caption: "All sixteen orders. So far, every query returned rows like these.",
          async enter(b, a) { b.code(Q.orders); await a.after(b.show(sorted(Q.orders, "id"))); },
        },
        {
          caption: "<b>COUNT(*)</b> turns them into one row, with one number: 16.",
          async enter(b, a) {
            await a.after(b.show(sorted(Q.orders, "id")));
            await a.after(b.code(Q.count, { type: true }));
            b.rows().forEach((row) => row.classList.add("sq-drop"));
            await a.wait(500);
            await a.after(b.show(Q.count, { label: "result set", mark: () => "sq-hot" }));
          },
        },
        {
          caption: "COUNT, SUM, AVG, MIN and MAX each turn many rows into one value: they're <b>aggregate functions</b>. Here, on the products.",
          async enter(b, a) { b.code("SELECT name, price\nFROM products;"); await a.after(b.show("SELECT name, price FROM products ORDER BY id", { label: "products" })); },
        },
        {
          caption: "The prices add up to <b>36.10</b> and average <b>4.51</b>. Cheapest <b>2.80</b>, dearest <b>6.50</b>. Eight rows in, one row out.",
          async enter(b, a) { await a.after(b.code(Q.prices, { type: true })); await a.after(b.show(Q.prices, { label: "result set", mark: () => "sq-hot" })); },
        },
      ],
    };
  }

  function countStory() {
    return {
      build: (stage) => board(stage, { label: "customers" }),
      frames: [
        {
          caption: "<b>COUNT(phone)</b> skips NULLs: 7. <b>COUNT(*)</b> counts every row: 10. Interviewers love that difference.",
          async enter(b, a) {
            b.code(Q.phones);
            await a.after(b.show("SELECT name, phone FROM customers ORDER BY id", { mark: (row) => (row[1] === null ? "sq-dup" : "") }));
            const res = await a.after(run(Q.phones));
            b.grid.insertAdjacentHTML("beforebegin", `<span class="jn-count">COUNT(*) = ${res.rows[0][0]} · COUNT(phone) = ${res.rows[0][1]}</span>`);
          },
        },
      ],
    };
  }

  function groupStory() {
    return {
      build: (stage) => pileBoard(stage),
      frames: [
        {
          caption: "How many orders are paid, pending or refunded? Here are the orders, one chip each.",
          async enter(p, a) { p.code(""); await a.after(p.load()); await a.wait(400); },
        },
        {
          caption: "<b>GROUP BY status</b> sorts the rows into one pile per status.",
          async enter(p, a) { p.code(Q.byStatus); await p.sort(a); },
        },
        {
          caption: "Then each pile collapses into a single row, and <b>COUNT(*)</b> runs once per pile.",
          async enter(p, a) { p.code(Q.byStatus); await p.sort(a); p.collapse(); await a.wait(600); },
        },
        {
          caption: "Three statuses, three rows. The result's <b>grain</b> is now one row per status, not one per order. Always know the grain of your result.",
          async enter(p, a) { p.code(Q.byStatus); await a.after(p.result(sorted(Q.byStatus, "COUNT(*) DESC"), { mark: () => "sq-hot" })); },
        },
      ],
    };
  }

  function bareStory() {
    return {
      build: (stage) => board(stage, { label: "Maya's orders" }),
      frames: [
        {
          caption: "A common mistake: group orders by customer, but also select <b>ordered_at</b>. Maya has four orders, with four dates. Her group gets one row. Which date goes in it?",
          async enter(b, a) {
            b.code(Q.bare);
            await a.after(b.show("SELECT customer_id, ordered_at FROM orders WHERE customer_id = 1 ORDER BY id", { mark: () => "sq-dup" }));
          },
        },
        {
          caption: "PostgreSQL refuses to guess and rejects the query. SQLite quietly picks one. <b>ordered_at</b> here is a <b>bare column</b>.",
          async enter(b, a) {
            b.code(Q.bare);
            await a.after(b.show(sorted(Q.bare, "customer_id"), { label: "result set (SQLite)", mark: (row) => (row[0] === 1 ? "sq-bad" : "") }));
            b.grid.insertAdjacentHTML("beforeend", `<span class="sq-stamp">PostgreSQL: error</span>`);
          },
        },
        {
          caption: "The rule: every selected column is grouped, or wrapped in an aggregate. <b>MAX(ordered_at)</b> gives each customer's latest order.",
          async enter(b, a) {
            await a.after(b.code(Q.bareFixed, { type: true }));
            await a.after(b.show(sorted(Q.bareFixed, "customer_id"), { label: "result set", mark: (row) => (row[0] === 1 ? "sq-pass" : "") }));
          },
        },
      ],
    };
  }

  function havingStory() {
    return {
      build: (stage) => board(stage, { label: "result set" }),
      frames: [
        {
          caption: "The bakery wants its regulars: customers with at least two orders. First, count each customer's orders.",
          async enter(b, a) { b.code(Q.perCustomer); await a.after(b.show(sorted(Q.perCustomer, "COUNT(*) DESC, c.name"))); },
        },
        {
          caption: "WHERE can't do it: it runs before grouping, when there's no count yet. <b>HAVING</b> filters groups after they're counted.",
          async enter(b, a) {
            b.code(Q.perCustomer);
            const all = await a.after(b.show(sorted(Q.perCustomer, "COUNT(*) DESC, c.name")));
            await a.after(b.code(Q.regulars, { type: true }));
            b.rows().forEach((row, i) => row.classList.add(all.rows[i][1] >= 2 ? "sq-pass" : "sq-drop"));
            await a.wait(700);
            await a.after(b.show(sorted(Q.regulars, "COUNT(*) DESC, c.name"), { mark: () => "sq-pass" }));
          },
        },
        {
          caption: "Now count only <b>paid</b> orders. WHERE drops the unpaid rows first; then the groups are counted and filtered.",
          async enter(b, a) { await a.after(b.code(Q.paidRegulars, { type: true })); b.grid.innerHTML = `<p class="sq-wait">?</p>`; },
        },
        {
          caption: "Omar's gone: one of his two orders is still pending, so only one paid order is left in his group.",
          async enter(b, a) {
            b.code(Q.paidRegulars);
            await a.after(b.show(sorted(Q.paidRegulars, "COUNT(*) DESC, c.name"), { mark: () => "sq-pass" }));
            b.grid.insertAdjacentHTML("afterend", `<div class="jn-gone"><span>Gone:</span><b>Omar</b></div>`);
          },
        },
        {
          caption: "<b>WHERE</b> filters rows before grouping; <b>HAVING</b> filters groups after. The full order: FROM, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, LIMIT.",
          async enter(b, a) {
            b.code("");
            b.stage.querySelectorAll(".jn-gone").forEach((el) => el.remove());
            b.grid.innerHTML = `<ol class="sq-clauses sq-glow">${["FROM", "WHERE", "GROUP BY", "HAVING", "SELECT", "ORDER BY", "LIMIT"].map((clause, i) => `<li class="sq-numbered"><i>${i + 1}</i>${hl(clause)} <span>${["build the rows", "drop rows", "form groups", "drop groups", "compute columns", "sort", "cut"][i]}</span></li>`).join("")}</ol>`;
            b.label("logical order");
            await a.wait(500);
          },
        },
      ],
    };
  }

  function fanoutStory() {
    return {
      build: (stage) => board(stage, { label: "result set" }),
      frames: [
        {
          caption: "A trap you've met before. Count each customer's orders, but also join their items.",
          async enter(b, a) { await a.after(b.code(Q.fanout, { type: true })); b.grid.innerHTML = `<p class="sq-wait">?</p>`; },
        },
        {
          caption: "Maya shows <b>7</b>. She has 4 orders: the join repeated each order once per item, and COUNT(*) counts rows.",
          async enter(b, a) { b.code(Q.fanout); await a.after(b.show(sorted(Q.fanout, "COUNT(*) DESC, c.name"), { mark: (row) => (row[0] === "Maya" ? "sq-bad" : "") })); },
        },
        {
          caption: "<b>COUNT(DISTINCT o.id)</b> counts each order once: Maya's back to 4. When a joined total looks too big, check the grain.",
          async enter(b, a) {
            await a.after(b.code(Q.fanoutFixed, { type: true }));
            await a.after(b.show(sorted(Q.fanoutFixed, "COUNT(DISTINCT o.id) DESC, c.name"), { mark: (row) => (row[0] === "Maya" ? "sq-pass" : "") }));
          },
        },
      ],
    };
  }

  // ---------- Beats ----------

  const countPredict = () => predictBeat({
    id: "count-phone",
    prompt: "Ten customers. How many does COUNT(phone) return?",
    why: "Three customers never gave a phone number, so their phone is NULL.",
    question: `<pre class="sq-code">${hl("SELECT COUNT(phone)\nFROM customers;")}</pre>`,
    options: [["10", "10"], ["7", "7"], ["3", "3"]],
    answer: "7",
    explain: { right: "Seven: COUNT(column) skips NULLs.", wrong: "It's seven: COUNT(column) skips the three NULL phones." },
  });

  const omarPredict = () => predictBeat({
    id: "omar",
    prompt: "Paid orders only. Is Omar still a regular?",
    why: "Omar has two orders: #2 is paid, #12 is pending.",
    question: `<pre class="sq-code">${hl(Q.paidRegulars)}</pre>`,
    options: [["yes", "Yes"], ["no", "No"]],
    answer: "no",
    explain: { right: "Right: one of his two orders is pending.", wrong: "No: one of his two orders is still pending." },
  });

  const cityChallenge = () => challengeBeat({
    id: "city",
    prompt: "Your turn: customers per city.",
    why: "SELECT the grouped column and the aggregate; GROUP BY the same column.",
    task: "How many customers live in each <b>city</b>? Return the city and a count.",
    starter: "SELECT \nFROM customers\n",
    solution: "SELECT city, COUNT(*) FROM customers GROUP BY city",
  });

  const bestChallenge = () => challengeBeat({
    id: "best",
    prompt: "Your turn: best sellers.",
    why: "Units sold is SUM(i.quantity), not COUNT(*): one line can hold several units.",
    task: "Products that sold at least <b>5 units</b> in total: return the product's <b>name</b> and the total.",
    starter: "SELECT p.name, SUM(i.quantity)\nFROM order_items i\nJOIN products p ON p.id = i.product_id\n",
    solution: "SELECT p.name, SUM(i.quantity) FROM order_items i JOIN products p ON p.id = i.product_id GROUP BY p.name HAVING SUM(i.quantity) >= 5",
  });

  function makeBeats() {
    const M = DSL.GroupModel;
    return [
      teach("teach-agg", "Many rows, one value.", aggStory(), "With no GROUP BY, an aggregate query always returns exactly one row, even when no rows match: COUNT gives 0, the others give NULL."),
      countPredict(),
      teach("teach-count", "COUNT(*) vs COUNT(column).", countStory()),
      teach("teach-group", "One row per group.", groupStory(), "\"Grain\" is analytics slang worth using in interviews: say what one row stands for before you aggregate."),
      cityChallenge(),
      teach("teach-bare", "Grouped or aggregated.", bareStory(), "MySQL with ONLY_FULL_GROUP_BY off behaves like SQLite. PostgreSQL does allow columns that depend on a grouped primary key."),
      teach("teach-having", "Filter the groups.", slice(havingStory(), 0, 3)),
      omarPredict(),
      teach("teach-having-order", "WHERE, then HAVING.", slice(havingStory(), 3, 5), "Put a condition in WHERE whenever it doesn't need an aggregate: fewer rows to group means less work."),
      bestChallenge(),
      teach("teach-fanout", "Counting after a join.", fanoutStory(), "The other fix is to aggregate before joining: count orders per customer in a subquery, then join that."),
      DSL.Guided.quizBeat({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Guided.finishBeat({
        lessonId: "group",
        badges: [["🧮", "Aggregate", "many rows, one value"], ["🗂️", "Group", "one row per group"], ["🚦", "HAVING", "filter the groups"]],
      }),
    ];
  }

  DSL.GroupScenes = Object.freeze({ Q, pileBoard, aggStory, countStory, groupStory, bareStory, havingStory, fanoutStory, cityChallenge, bestChallenge, beats: makeBeats });

  DSL.registerGuided("group", () => DSL.Guided.run({
    lessonId: "group",
    title: `${DSL.lessonNumber("group")} · GROUP BY and HAVING`,
    beats: makeBeats(),
  }));
})(window.DataSystemsLab);
