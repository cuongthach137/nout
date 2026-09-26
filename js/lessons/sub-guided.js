(function registerSubGuided(DSL) {
  "use strict";

  // Guided mode for subqueries and CTEs. The nest board shows the outer query with the inner one
  // highlighted, the inner result (a value, a list, or a table), and then the outer result.
  // Scenes are shared with Narrated mode (DSL.SubScenes).

  const { retrigger } = DSL.LabKit;
  const { board, predictBeat, challengeBeat, teach, slice } = DSL.SqlScenes;
  const hl = (sql) => DSL.Sql.highlight(sql);
  const run = (sql) => DSL.Sql.run("bakery", sql);
  const sorted = (sql, by) => sql.replace(/;?$/, `\nORDER BY ${by};`);

  const Q = {
    avg: "SELECT AVG(price) FROM products",
    above: "SELECT name, price\nFROM products\nWHERE price > (SELECT AVG(price) FROM products);",
    cakeIds: "SELECT o.customer_id\n  FROM orders o\n  JOIN order_items i ON i.order_id = o.id\n  JOIN products p ON p.id = i.product_id\n  WHERE p.category = 'cake'",
    corrInner: "SELECT AVG(x.price)\n   FROM products x\n   WHERE x.category = p.category",
    pendingInner: "SELECT 1 FROM orders o\n  WHERE o.customer_id = c.id\n    AND o.status = 'pending'",
    counts: "SELECT customer_id, COUNT(*) AS n\n  FROM orders\n  WHERE customer_id IS NOT NULL\n  GROUP BY customer_id",
  };
  Q.cake = `SELECT name\nFROM customers\nWHERE id IN (\n  ${Q.cakeIds}\n);`;
  Q.corr = `SELECT p.name, p.category, p.price\nFROM products p\nWHERE p.price > (\n   ${Q.corrInner}\n);`;
  Q.exists = `SELECT c.name\nFROM customers c\nWHERE EXISTS (\n  ${Q.pendingInner}\n);`;
  Q.nested = `SELECT c.name, counts.n\nFROM (\n  ${Q.counts}\n) AS counts\nJOIN customers c ON c.id = counts.customer_id\nWHERE counts.n > (\n  SELECT AVG(n) FROM (\n    ${Q.counts.replace(/\n {2}/g, "\n      ")}\n  )\n);`;
  Q.cte = `WITH counts AS (\n  ${Q.counts}\n)\nSELECT c.name, counts.n\nFROM counts\nJOIN customers c ON c.id = counts.customer_id\nWHERE counts.n > (SELECT AVG(n) FROM counts);`;

  // ---------- Nest board ----------

  function nestBoard(stage) {
    stage.innerHTML = `<div class="nb-board">
      <pre class="sq-code nb-code" hidden></pre>
      <div class="nb-mid" hidden><span class="nb-arrow">inner query →</span><span class="nb-value"></span></div>
      <div class="nb-out"></div>
    </div>`;
    const root = stage.firstElementChild;
    const codeEl = root.querySelector(".nb-code");
    const mid = root.querySelector(".nb-mid");
    const valueEl = root.querySelector(".nb-value");
    const out = root.querySelector(".nb-out");

    // Show `sql` with `inner` (a substring) highlighted as the subquery.
    function code(sql, inner) {
      codeEl.hidden = !sql;
      const at = inner ? sql.indexOf(inner) : -1;
      codeEl.innerHTML = at < 0 ? hl(sql) : `${hl(sql.slice(0, at))}<span class="nb-inner">${hl(inner)}</span>${hl(sql.slice(at + inner.length))}`;
      retrigger(codeEl, "sq-code-in");
    }

    function value(html) {
      mid.hidden = !html;
      valueEl.innerHTML = html || "";
      if (html) retrigger(valueEl, "gd-pop");
    }

    async function result(sql, options = {}) {
      const view = board(out, { label: options.label || "result set" });
      const res = await view.show(sql, options);
      return { view, res };
    }

    return { root, code, value, result, out };
  }

  const fmt = (n) => String(Number(n.toFixed(2)));

  // ---------- Storyboards (each frame sets up its own state) ----------

  function scalarStory() {
    return {
      build: (stage) => nestBoard(stage),
      frames: [
        {
          caption: "Which products cost more than average? Here are the eight products and their prices.",
          async enter(b, a) { b.code(""); b.value(""); await a.after(b.result("SELECT name, price FROM products ORDER BY id", { label: "products" })); },
        },
        {
          caption: "The <b>inner query</b>, in brackets, runs first. It returns one number: the average price, <b>4.51</b>.",
          async enter(b, a) {
            b.code(Q.above, Q.avg);
            const avg = (await a.after(run(Q.avg))).rows[0][0];
            b.value(`<code>AVG(price)</code> = <b>${fmt(avg)}</b>`);
            await a.after(b.result("SELECT name, price FROM products ORDER BY id", { label: "products" }));
          },
        },
        {
          caption: "The outer query compares every price with that number. Four products beat it. A query inside a query is a <b>subquery</b>; one that returns a single value is a <b>scalar subquery</b>.",
          async enter(b, a) {
            b.code(Q.above, Q.avg);
            const avg = (await a.after(run(Q.avg))).rows[0][0];
            b.value(`<code>AVG(price)</code> = <b>${fmt(avg)}</b>`);
            const { view } = await a.after(b.result("SELECT name, price FROM products ORDER BY id", { label: "products", mark: (row) => (row[1] > avg ? "sq-pass" : "sq-fail") }));
            await a.wait(700);
            view.rows().filter((row) => row.classList.contains("sq-fail")).forEach((row) => row.classList.add("sq-drop"));
            await a.wait(500);
            await a.after(b.result(sorted(Q.above, "price DESC"), { mark: () => "sq-pass" }));
          },
        },
      ],
    };
  }

  function listStory() {
    return {
      build: (stage) => nestBoard(stage),
      frames: [
        {
          caption: "A subquery can return a <b>list</b>. Which customers bought a cake? The inner query finds the customer IDs on cake orders; customer 7 shows up twice.",
          async enter(b, a) {
            b.code(Q.cake, Q.cakeIds);
            b.value("");
            await a.after(b.result(Q.cakeIds.replace(/\n\s*/g, " "), { label: "inner query: a list", mark: (row) => (row[0] === 7 ? "sq-dup" : "") }));
          },
        },
        {
          caption: "<b>IN</b> checks each customer against that list: Ana, Raj, Yuki and Ines. Duplicates in the list don't matter.",
          async enter(b, a) { b.code(Q.cake, Q.cakeIds); b.value(""); await a.after(b.result(sorted(Q.cake, "id"), { mark: () => "sq-pass" })); },
        },
      ],
    };
  }

  function corrStory() {
    const withAvg = "SELECT p.name, p.category, p.price, (SELECT AVG(x.price) FROM products x WHERE x.category = p.category) AS category_avg FROM products p ORDER BY p.id";
    return {
      build: (stage) => nestBoard(stage),
      frames: [
        {
          caption: "Harder: which products cost more than the average of <b>their own category</b>? The inner query now uses the outer row's <b>p.category</b>.",
          async enter(b, a) { b.code(Q.corr, Q.corrInner); b.value(""); await a.after(b.result("SELECT p.name, p.category, p.price FROM products p ORDER BY p.id", { label: "products" })); },
        },
        {
          caption: "So it runs again for every product: breads against the bread average, cakes against the cakes. That's a <b>correlated subquery</b>.",
          async enter(b, a) {
            b.code(Q.corr, Q.corrInner);
            const { view } = await a.after(b.result(withAvg, { label: "each row, with its category's average" }));
            const cells = view.cells("category_avg");
            cells.forEach((cell) => { cell.style.opacity = "0"; });
            for (const cell of cells) {
              if (cell.getAttribute("role") !== "cell") { cell.style.opacity = "1"; continue; }
              cell.style.opacity = "1";
              cell.classList.add("sq-new");
              await a.wait(260);
            }
          },
        },
        {
          caption: "Sourdough and rye beat the bread average, cinnamon roll beats the pastries, and lemon tart beats the cakes: <b>four</b> products.",
          async enter(b, a) {
            b.code(Q.corr, Q.corrInner);
            await a.after(b.result(withAvg, { label: "each row, with its category's average", mark: (row) => (row[2] > row[3] ? "sq-pass" : "sq-fail") }));
            await a.wait(800);
            await a.after(b.result(sorted(Q.corr, "p.id"), { mark: () => "sq-pass" }));
          },
        },
      ],
    };
  }

  function existsStory() {
    return {
      build: (stage) => nestBoard(stage),
      frames: [
        {
          caption: "Which customers have at least one pending order? <b>EXISTS</b> asks: does the subquery return any row? It stops at the first match, and ignores what's selected.",
          async enter(b, a) {
            b.code(Q.exists, Q.pendingInner);
            b.value("");
            await a.after(b.result("SELECT c.name, EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'pending') AS has_pending FROM customers c ORDER BY c.id", { label: "EXISTS, per customer (1 = true)", mark: (row) => (row[1] ? "sq-pass" : "sq-fail") }));
          },
        },
        {
          caption: "Maya and Omar. <b>NOT EXISTS</b> flips it: customers with no such row, the anti-join from the joins lesson, spelled out.",
          async enter(b, a) { b.code(Q.exists, Q.pendingInner); b.value(""); await a.after(b.result(sorted(Q.exists, "c.id"), { mark: () => "sq-pass" })); },
        },
      ],
    };
  }

  function cteStory() {
    return {
      build: (stage) => nestBoard(stage),
      frames: [
        {
          caption: "Who has more orders than the average customer? Two steps: count per customer, then compare with the average count. Nested, the same step appears twice, and it's hard to read.",
          async enter(b, a) { b.code(Q.nested, Q.counts); b.value(""); b.out.innerHTML = ""; await a.wait(400); },
        },
        {
          caption: "<b>WITH</b> names the first step, <b>counts</b>. Later steps read it like a table. That's a <b>CTE</b>: common table expression.",
          async enter(b, a) { b.code(Q.cte, Q.counts); b.value(""); await a.after(b.result(Q.counts.replace(/\n\s*/g, " ") + " ORDER BY customer_id", { label: "step 1: counts" })); },
        },
        {
          caption: "The average is <b>1.75</b>. Maya, Omar, Ana and Yuki are above it. A subquery in FROM, a <b>derived table</b>, does the same job; a CTE reads top to bottom.",
          async enter(b, a) {
            b.code(Q.cte, "WHERE counts.n > (SELECT AVG(n) FROM counts)");
            const avg = (await a.after(run(`WITH counts AS (${Q.counts}) SELECT AVG(n) FROM counts`))).rows[0][0];
            b.value(`<code>AVG(n)</code> = <b>${fmt(avg)}</b>`);
            await a.after(b.result(sorted(Q.cte, "counts.n DESC, c.name"), { mark: () => "sq-pass" }));
          },
        },
      ],
    };
  }

  // ---------- Beats ----------

  const corrPredict = () => predictBeat({
    id: "corr-count",
    prompt: "How many products beat their own category's average?",
    why: "Each category has at least one product above its own average; bread has a big spread.",
    question: `<pre class="sq-code">${hl(Q.corr)}</pre>`,
    options: [["2", "2"], ["4", "4"], ["6", "6"]],
    answer: "4",
    explain: { right: "Four: one or two from each category.", wrong: "It's four: sourdough and rye, cinnamon roll, and lemon tart." },
  });

  const laterChallenge = () => challengeBeat({
    id: "later",
    prompt: "Your turn: joined after Lena.",
    why: "The subquery returns Lena's join date, one value, so it can sit on the right of >.",
    task: "Which customers <b>joined after Lena</b>? Return their <b>name</b>.",
    starter: "SELECT name\nFROM customers\nWHERE joined > ",
    solution: "SELECT name FROM customers WHERE joined > (SELECT joined FROM customers WHERE name = 'Lena')",
  });

  const neverChallenge = () => challengeBeat({
    id: "never",
    prompt: "Your turn: no paid orders.",
    why: "NOT EXISTS is true when the subquery finds no row, which includes customers with no orders at all.",
    task: "Customers with <b>no paid orders</b> at all: return their <b>name</b>.",
    starter: "SELECT c.name\nFROM customers c\nWHERE NOT EXISTS (\n  \n);",
    solution: "SELECT c.name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'paid')",
  });

  const aboveChallenge = () => challengeBeat({
    id: "above",
    prompt: "Your turn: above-average customers.",
    why: "counts has one row per customer. Join it to customers for the name, and compare n with a scalar subquery over counts.",
    task: "Customers with <b>more orders than the average customer</b>: return <b>name</b> and the count.",
    starter: `WITH counts AS (\n  ${Q.counts}\n)\nSELECT `,
    solution: "WITH counts AS (SELECT customer_id, COUNT(*) AS n FROM orders WHERE customer_id IS NOT NULL GROUP BY customer_id) SELECT c.name, counts.n FROM counts JOIN customers c ON c.id = counts.customer_id WHERE counts.n > (SELECT AVG(n) FROM counts)",
  });

  function makeBeats() {
    const M = DSL.SubModel;
    return [
      teach("teach-scalar", "A question inside a question.", scalarStory(), "A scalar subquery must return exactly one row. PostgreSQL raises an error on two; SQLite silently uses the first, which hides bugs."),
      laterChallenge(),
      teach("teach-list", "A list, with IN.", listStory(), "IN only asks \"is it in the list?\", so duplicates don't repeat customers. A join on the same tables would."),
      teach("teach-corr", "Once per row.", slice(corrStory(), 0, 2), "Planners often turn correlated subqueries into joins, so they're not always slow. Check the plan."),
      corrPredict(),
      teach("teach-corr-result", "Beat your own category.", slice(corrStory(), 2, 3)),
      teach("teach-exists", "Is there any row?", existsStory(), "Prefer NOT EXISTS to NOT IN: NOT IN returns nothing if its list contains a NULL. The NULL traps lesson shows why."),
      neverChallenge(),
      teach("teach-cte", "Name the steps.", cteStory(), "WITH RECURSIVE goes further: a step that reads its own output, for date ranges, org charts and paths. There's one to try in Explore."),
      aboveChallenge(),
      DSL.Guided.quizBeat({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Guided.finishBeat({
        lessonId: "sub",
        badges: [["🪆", "Nest", "a value or a list"], ["🔁", "Per row", "correlated, EXISTS"], ["🏷️", "Name it", "WITH, step by step"]],
      }),
    ];
  }

  DSL.SubScenes = Object.freeze({ Q, nestBoard, scalarStory, listStory, corrStory, existsStory, cteStory, laterChallenge, neverChallenge, aboveChallenge, beats: makeBeats });

  DSL.registerGuided("sub", () => DSL.Guided.run({
    lessonId: "sub",
    title: `${DSL.lessonNumber("sub")} · Subqueries and CTEs`,
    beats: makeBeats(),
  }));
})(window.DataSystemsLab);
