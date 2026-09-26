(function registerWindowGuided(DSL) {
  "use strict";

  // Guided mode for window functions. Query boards run real queries; window columns are revealed
  // row by row (or partition by partition) so the learner sees each row keep its place while the
  // window value appears beside it. Scenes are shared with Narrated mode (DSL.WindowScenes).

  const { board, predictBeat, challengeBeat, teach, slice } = DSL.SqlScenes;
  const hl = (sql) => DSL.Sql.highlight(sql);

  const UNITS = "WITH units AS (\n  SELECT p.name, SUM(i.quantity) AS units\n  FROM order_items i\n  JOIN products p ON p.id = i.product_id\n  GROUP BY p.name\n)\n";
  const DAILY = "WITH daily AS (\n  SELECT o.ordered_at AS day,\n         SUM(i.quantity * p.price) AS revenue\n  FROM orders o\n  JOIN order_items i ON i.order_id = o.id\n  JOIN products p ON p.id = i.product_id\n  GROUP BY o.ordered_at\n)\n";
  const RN = "ROW_NUMBER() OVER (\n         PARTITION BY category\n         ORDER BY price DESC)";
  const Q = {
    products: "SELECT name, category, price\nFROM products\nORDER BY category;",
    grouped: "SELECT category, AVG(price)\nFROM products\nGROUP BY category;",
    window: "SELECT name, category, price,\n       AVG(price) OVER (PARTITION BY category) AS cat_avg\nFROM products\nORDER BY category;",
    units: `${UNITS}SELECT name, units FROM units\nORDER BY units DESC;`,
    ranks: `${UNITS}SELECT name, units,\n  ROW_NUMBER() OVER (ORDER BY units DESC) AS row_number,\n  RANK()       OVER (ORDER BY units DESC) AS rank,\n  DENSE_RANK() OVER (ORDER BY units DESC) AS dense_rank\nFROM units\nORDER BY units DESC, name;`,
    numbered: `SELECT name, category, price,\n       ${RN} AS rn\nFROM products\nORDER BY category, rn;`,
    bad: `SELECT name, category, price\nFROM products\nWHERE ${RN} = 1;`,
    top: `WITH ranked AS (\n  SELECT name, category, price,\n         ${RN} AS rn\n  FROM products\n)\nSELECT name, category, price\nFROM ranked\nWHERE rn = 1;`,
    daily: `${DAILY}SELECT day, revenue FROM daily\nORDER BY day;`,
    running: `${DAILY}SELECT day, revenue,\n       SUM(revenue) OVER (ORDER BY day) AS running\nFROM daily\nORDER BY day;`,
    maya: "SELECT id, ordered_at\nFROM orders\nWHERE customer_id = 1\nORDER BY ordered_at;",
    lag: "SELECT id, ordered_at,\n       LAG(ordered_at) OVER (ORDER BY ordered_at) AS previous\nFROM orders\nWHERE customer_id = 1\nORDER BY ordered_at;",
    gap: "SELECT id, ordered_at,\n       LAG(ordered_at) OVER (ORDER BY ordered_at) AS previous,\n       julianday(ordered_at)\n         - julianday(LAG(ordered_at) OVER (ORDER BY ordered_at)) AS gap_days\nFROM orders\nWHERE customer_id = 1\nORDER BY ordered_at;",
  };

  // Tint rows by partition (the value in column `col`), so each window reads as a band.
  function bands(col) {
    const seen = new Map();
    return (row) => {
      if (!seen.has(row[col])) seen.set(row[col], seen.size);
      return `wn-p${seen.get(row[col]) % 3}`;
    };
  }

  // Hide the given columns, then reveal their cells top to bottom.
  async function reveal(view, names, a, step = 140) {
    const cells = names.flatMap((name) => view.cells(name).filter((cell) => cell.getAttribute("role") === "cell"));
    cells.forEach((cell) => cell.classList.add("wn-hidden"));
    for (const name of names) {
      for (const cell of view.cells(name).filter((c) => c.getAttribute("role") === "cell")) {
        cell.classList.remove("wn-hidden");
        cell.classList.add("sq-new");
        await a.wait(step);
      }
    }
  }

  function hide(view, names) {
    names.forEach((name) => view.cells(name).forEach((cell) => { if (cell.getAttribute("role") === "cell") cell.classList.add("wn-hidden"); }));
  }

  // ---------- Storyboards ----------

  function overStory() {
    return {
      build: (stage) => board(stage, { label: "products" }),
      frames: [
        {
          caption: "The eight products, with their categories.",
          async enter(b, a) { b.code(Q.products); await a.after(b.show(Q.products, { label: "products", mark: bands(1) })); },
        },
        {
          caption: "<b>GROUP BY category</b> gives three rows, one per category. The products themselves are gone.",
          async enter(b, a) { await a.after(b.code(Q.grouped, { type: true })); await a.after(b.show(Q.grouped, { label: "result set", mark: bands(0) })); },
        },
        {
          caption: "<b>AVG(price) OVER (PARTITION BY category)</b> keeps all eight rows, and writes each category's average beside every product in it.",
          async enter(b, a) {
            await a.after(b.code(Q.window, { type: true }));
            await a.after(b.show(Q.window, { label: "result set: every row kept", mark: bands(1) }));
            await reveal(b, ["cat_avg"], a, 170);
          },
        },
      ],
    };
  }

  function rankStory() {
    return {
      build: (stage) => board(stage, { label: "units sold" }),
      frames: [
        {
          caption: "Products by units sold. <b>Carrot cake</b> and <b>cinnamon roll</b> are tied at 4.",
          async enter(b, a) { b.code(Q.units); await a.after(b.show(Q.units, { label: "units sold", mark: (row) => (row[1] === 4 ? "sq-dup" : "") })); },
        },
        {
          caption: "<b>ROW_NUMBER</b> numbers the rows 1, 2, 3… The tie gets two different numbers, in no promised order.",
          async enter(b, a) {
            b.code(Q.ranks);
            await a.after(b.show(Q.ranks, { label: "result set", mark: (row) => (row[1] === 4 ? "sq-dup" : "") }));
            hide(b, ["rank", "dense_rank"]);
            await reveal(b, ["row_number"], a);
          },
        },
        {
          caption: "<b>RANK</b> gives the tie the same number, 5 and 5, then skips to 7.",
          async enter(b, a) {
            b.code(Q.ranks);
            await a.after(b.show(Q.ranks, { label: "result set", mark: (row) => (row[1] === 4 ? "sq-dup" : "") }));
            hide(b, ["dense_rank"]);
            await reveal(b, ["rank"], a);
          },
        },
        {
          caption: "<b>DENSE_RANK</b> shares the tie too, but doesn't skip: lemon tart is 6. Interviewers ask this one a lot.",
          async enter(b, a) {
            b.code(Q.ranks);
            await a.after(b.show(Q.ranks, { label: "result set", mark: (row) => (row[1] === 4 ? "sq-dup" : row[0] === "Lemon tart" ? "sq-hot" : "") }));
            await reveal(b, ["dense_rank"], a);
          },
        },
      ],
    };
  }

  function topStory() {
    return {
      build: (stage) => board(stage, { label: "result set" }),
      frames: [
        {
          caption: "The most expensive product in each category. <b>ROW_NUMBER</b>, partitioned by category and ordered by price descending: each category counts from 1 again.",
          async enter(b, a) {
            b.code(Q.numbered);
            const band = bands(1);
            await a.after(b.show(Q.numbered, { mark: (row) => { const tint = band(row); return row[3] === 1 ? "sq-hot" : tint; } }));
            await reveal(b, ["rn"], a);
          },
        },
        {
          caption: "Now keep row number 1. But <b>WHERE</b> can't see it: window functions are computed after WHERE. SQLite says it plainly.",
          async enter(b, a) { await a.after(b.code(Q.bad, { type: true })); await a.after(b.show(Q.bad)); },
        },
        {
          caption: "So number the rows in a CTE, and filter in the outer query. That's <b>top N per group</b>.",
          async enter(b, a) { await a.after(b.code(Q.top, { type: true })); await a.after(b.show(Q.top.replace(/;$/, "\nORDER BY category;"), { mark: () => "sq-pass" })); },
        },
      ],
    };
  }

  function runStory() {
    return {
      build: (stage) => board(stage, { label: "daily revenue" }),
      frames: [
        {
          caption: "The bakery's revenue, day by day.",
          async enter(b, a) { b.code(Q.daily); await a.after(b.show(Q.daily, { label: "daily revenue" })); },
        },
        {
          caption: "<b>SUM(revenue) OVER (ORDER BY day)</b>: each row adds itself to everything before it. That's a <b>running total</b>; by the 25th it reaches 161.25.",
          async enter(b, a) { await a.after(b.code(Q.running, { type: true })); await a.after(b.show(Q.running)); await reveal(b, ["running"], a, 110); },
        },
      ],
    };
  }

  function lagStory() {
    return {
      build: (stage) => board(stage, { label: "Maya's orders" }),
      frames: [
        {
          caption: "Maya's four orders.",
          async enter(b, a) { b.code(Q.maya); await a.after(b.show(Q.maya, { label: "Maya's orders" })); },
        },
        {
          caption: "<b>LAG(ordered_at)</b> puts the previous order's date beside each one. The first has none, so it's NULL.",
          async enter(b, a) { await a.after(b.code(Q.lag, { type: true })); await a.after(b.show(Q.lag, { label: "Maya's orders" })); await reveal(b, ["previous"], a, 260); },
        },
        {
          caption: "Subtract, and you get the gaps: 3 days, 7, then 13. Maya's slowing down. <b>LAG</b> and <b>LEAD</b> read the row before or after.",
          async enter(b, a) { b.code(Q.gap); await a.after(b.show(Q.gap, { label: "Maya's orders" })); await reveal(b, ["gap_days"], a, 260); },
        },
      ],
    };
  }

  // ---------- Beats ----------

  const densePredict = () => predictBeat({
    id: "dense",
    prompt: "What does DENSE_RANK give lemon tart?",
    why: "Two products tie at 5th place, and lemon tart comes right after them.",
    question: `<pre class="sq-code">${hl("DENSE_RANK() OVER (ORDER BY units DESC)")}</pre><p class="wn-q">Units: 10, 8, 6, 5, <b>4, 4</b>, 3 (lemon tart)</p>`,
    options: [["5", "5"], ["6", "6"], ["7", "7"]],
    answer: "6",
    explain: { right: "Six: DENSE_RANK doesn't skip after a tie.", wrong: "It's 6. RANK would say 7; DENSE_RANK doesn't skip." },
  });

  const avgChallenge = () => challengeBeat({
    id: "avg",
    prompt: "Your turn: category averages, every row kept.",
    why: "No GROUP BY here: the window function adds a column and keeps all eight products.",
    task: "Each product's <b>name</b>, <b>category</b> and <b>price</b>, with its <b>category's average price</b> beside it.",
    starter: "SELECT name, category, price,\n       \nFROM products;",
    solution: "SELECT name, category, price, AVG(price) OVER (PARTITION BY category) FROM products",
  });

  const top2Challenge = () => challengeBeat({
    id: "top2",
    prompt: "Your turn: top two per category.",
    why: "The same numbering as before, then keep numbers 1 and 2 in the outer query.",
    task: "The <b>two most expensive</b> products in each category: return <b>name</b>, <b>category</b>, <b>price</b>.",
    starter: "WITH ranked AS (\n  SELECT name, category, price,\n         \n  FROM products\n)\nSELECT name, category, price\nFROM ranked\nWHERE ",
    solution: "WITH ranked AS (SELECT name, category, price, ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn FROM products) SELECT name, category, price FROM ranked WHERE rn <= 2",
  });

  const gapChallenge = () => challengeBeat({
    id: "gap",
    prompt: "Your turn: the previous order.",
    why: "WHERE keeps only Maya's orders first; then LAG reads along them in date order.",
    task: "For each of <b>Maya's</b> orders (customer 1): the order's <b>id</b>, its <b>ordered_at</b>, and the date of her <b>previous</b> order.",
    starter: "SELECT id, ordered_at,\n       \nFROM orders\nWHERE customer_id = 1;",
    solution: "SELECT id, ordered_at, LAG(ordered_at) OVER (ORDER BY ordered_at) FROM orders WHERE customer_id = 1",
  });

  function makeBeats() {
    const M = DSL.WindowModel;
    return [
      teach("teach-over", "Keep every row.", overStory(), "Window functions run at SELECT time, after WHERE, GROUP BY and HAVING. That's why they can't be filtered in WHERE."),
      avgChallenge(),
      teach("teach-rank", "Numbers with ties.", slice(rankStory(), 0, 3)),
      densePredict(),
      teach("teach-dense", "RANK vs DENSE_RANK.", slice(rankStory(), 3, 4), "For \"top 3\" with ties, RANK may return more than 3 rows; ROW_NUMBER returns exactly 3 but picks among the ties arbitrarily. Ask which the business wants."),
      teach("teach-top", "Top N per group.", topStory(), "Add a tiebreaker to the window's ORDER BY (like , id) so ROW_NUMBER is deterministic."),
      top2Challenge(),
      teach("teach-run", "Running totals.", runStory(), "With ORDER BY and no frame, rows tied on the ORDER BY value share a running total. ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW makes it strictly row by row."),
      teach("teach-lag", "Look back a row.", lagStory()),
      gapChallenge(),
      DSL.Guided.quizBeat({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Guided.finishBeat({
        lessonId: "window",
        badges: [["🪟", "OVER", "every row kept"], ["🥇", "Rank", "ties, and top N"], ["📈", "Along the rows", "totals and LAG"]],
      }),
    ];
  }

  DSL.WindowScenes = Object.freeze({ Q, overStory, rankStory, topStory, runStory, lagStory, avgChallenge, top2Challenge, gapChallenge, beats: makeBeats });

  DSL.registerGuided("window", () => DSL.Guided.run({
    lessonId: "window",
    title: `${DSL.lessonNumber("window")} · Window functions`,
    beats: makeBeats(),
  }));
})(window.DataSystemsLab);
