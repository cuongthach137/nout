(function registerJoinsGuided(DSL) {
  "use strict";

  // Guided mode for the joins lesson. The join board shows customers and orders side by side and
  // draws a line for each match, so the learner sees which rows pair up and which are left over.
  // Scenes are shared with Narrated mode (DSL.JoinsScenes).

  const { retrigger, reducedMotion } = DSL.LabKit;
  const { board, predictBeat, challengeBeat, teach, slice } = DSL.SqlScenes;
  const hl = (sql) => DSL.Sql.highlight(sql);
  const run = (sql) => DSL.Sql.run("bakery", sql);

  const Q = {
    inner: "SELECT o.id, c.name\nFROM orders o\nJOIN customers c\n  ON c.id = o.customer_id;",
    left: "SELECT c.name, o.id\nFROM customers c\nLEFT JOIN orders o\n  ON o.customer_id = c.id;",
    trap: "SELECT c.name, o.id\nFROM customers c\nLEFT JOIN orders o\n  ON o.customer_id = c.id\nWHERE o.status = 'paid';",
    fixed: "SELECT c.name, o.id\nFROM customers c\nLEFT JOIN orders o\n  ON o.customer_id = c.id\n AND o.status = 'paid';",
    right: "SELECT c.name, o.id\nFROM orders o\nRIGHT JOIN customers c\n  ON c.id = o.customer_id;",
    full: "SELECT c.name, o.id\nFROM customers c\nFULL OUTER JOIN orders o\n  ON o.customer_id = c.id;",
    fanout: "SELECT o.id, o.customer_id, i.product_id\nFROM orders o\nJOIN order_items i\n  ON i.order_id = o.id;",
    cross: "SELECT c.name, o.id\nFROM customers c, orders o;",
  };
  // Stable row order for the scenes (engines don't promise one).
  const sorted = (sql, by) => sql.replace(/;$/, `\nORDER BY ${by};`);

  // ---------- Join board: customers | links | orders, above a result ----------

  function joinBoard(stage) {
    stage.innerHTML = `<div class="jn-board">
      <pre class="sq-code" hidden></pre>
      <div class="jn-inputs">
        <div class="jn-side" data-side="left"><span class="sq-label">customers</span><div class="jn-list"></div></div>
        <svg class="jn-links" aria-hidden="true"></svg>
        <div class="jn-side" data-side="right"><span class="sq-label">orders</span><div class="jn-list"></div></div>
      </div>
      <div class="jn-out" hidden></div>
    </div>`;
    const root = stage.firstElementChild;
    const codeEl = root.querySelector(".sq-code");
    const inputs = root.querySelector(".jn-inputs");
    const svg = root.querySelector(".jn-links");
    const left = root.querySelector('[data-side="left"] .jn-list');
    const right = root.querySelector('[data-side="right"] .jn-list');
    const out = root.querySelector(".jn-out");
    let loaded = null;

    async function load() {
      if (loaded) return loaded;
      const [customers, orders] = await Promise.all([run("SELECT id, name FROM customers ORDER BY id"), run("SELECT id, customer_id FROM orders ORDER BY id")]);
      left.innerHTML = customers.rows.map(([id, name], i) => `<div class="jn-item" data-key="${id}" style="--i:${i}"><b>${id}</b>${name}</div>`).join("");
      right.innerHTML = orders.rows.map(([id, fk], i) => `<div class="jn-item" data-id="${id}" data-fk="${fk === null ? "" : fk}" style="--i:${i}"><b>#${id}</b>→ ${fk === null ? `<i class="sq-null">NULL</i>` : fk}</div>`).join("");
      loaded = { customers, orders };
      return loaded;
    }

    function code(sql, { groupOn = false } = {}) {
      codeEl.hidden = !sql;
      let html = hl(sql);
      if (groupOn) html = html.replace(/(<b class="sq-kw">ON<\/b>[^\n;]*)/, `<span class="sq-group">$1</span>`);
      codeEl.innerHTML = html;
      retrigger(codeEl, "sq-code-in");
    }

    // One line per order that has a customer, drawn one after another.
    async function link(a, { animate = true } = {}) {
      showInputs();
      const box = svg.getBoundingClientRect();
      const paths = [...right.querySelectorAll(".jn-item")].filter((item) => item.dataset.fk).map((item) => {
        const target = left.querySelector(`[data-key="${item.dataset.fk}"]`);
        const from = target.getBoundingClientRect();
        const to = item.getBoundingClientRect();
        const y1 = from.top + from.height / 2 - box.top;
        const y2 = to.top + to.height / 2 - box.top;
        target.classList.add("jn-matched");
        item.classList.add("jn-matched");
        return `<path d="M0 ${y1} C ${box.width / 2} ${y1}, ${box.width / 2} ${y2}, ${box.width} ${y2}" pathLength="1"/>`;
      });
      svg.innerHTML = paths.join("");
      if (!animate || reducedMotion()) return;
      [...svg.children].forEach((path, i) => { path.style.animationDelay = `${i * 70}ms`; path.classList.add("jn-draw"); });
      await a.wait(paths.length * 70 + 450);
    }

    function orphans(sides = ["left", "right"]) {
      if (sides.includes("left")) left.querySelectorAll(".jn-item:not(.jn-matched)").forEach((item) => item.classList.add("jn-orphan"));
      if (sides.includes("right")) right.querySelectorAll(".jn-item:not(.jn-matched)").forEach((item) => item.classList.add("jn-orphan"));
    }

    function keep(side) {
      (side === "left" ? left : right).querySelectorAll(".jn-item:not(.jn-matched)").forEach((item) => item.classList.add("jn-kept"));
    }

    function showInputs() {
      inputs.hidden = false;
      out.hidden = true;
    }

    // Replace the inputs with a result grid (a query board without its own code box).
    async function result(sql, options = {}) {
      inputs.hidden = true;
      out.hidden = false;
      const view = board(out, { label: options.label || "result set" });
      const res = await view.show(sql, options);
      if (options.count) out.insertAdjacentHTML("afterbegin", `<span class="jn-count">${res.rows.length} rows</span>`);
      return { view, res };
    }

    return { root, load, code, link, orphans, keep, result, showInputs, left, right };
  }

  const nameIsNull = (col) => (row) => (row[col] === null ? "sq-hot" : "");

  // ---------- Storyboards (each frame sets up its own state) ----------

  function innerStory() {
    return {
      build: (stage) => joinBoard(stage),
      frames: [
        {
          caption: "Customers on the left, orders on the right. Each order carries a <b>customer_id</b>: a key pointing at one customer.",
          async enter(b, a) { await a.after(b.load()); b.code(""); await a.wait(400); },
        },
        {
          caption: "<b>JOIN … ON c.id = o.customer_id</b> matches each order to the customer it points at.",
          async enter(b, a) { await a.after(b.load()); b.code(Q.inner); await b.link(a); },
        },
        {
          caption: "The part after <b>ON</b> is the <b>join condition</b>: the test that decides which rows belong together.",
          async enter(b, a) { await a.after(b.load()); b.code(Q.inner, { groupOn: true }); await b.link(a, { animate: false }); await a.wait(400); },
        },
        {
          caption: "Some rows have no partner: <b>Lena</b> and <b>Theo</b> never ordered, and walk-in orders <b>#5</b> and <b>#14</b> have no customer.",
          async enter(b, a) { await a.after(b.load()); b.code(Q.inner); await b.link(a, { animate: false }); b.orphans(); await a.wait(500); },
        },
        {
          caption: "An <b>inner join</b> keeps only matched pairs: 14 rows. Rows without a partner, on either side, are dropped. Plain <b>JOIN</b> means inner join.",
          async enter(b, a) { b.code(Q.inner); await a.after(b.result(sorted(Q.inner, "o.id"), { count: true })); },
        },
      ],
    };
  }

  function leftStory() {
    return {
      build: (stage) => joinBoard(stage),
      frames: [
        {
          caption: "Now the bakery wants <b>every customer</b>, with their orders if they have any.",
          async enter(b, a) { await a.after(b.load()); b.code(""); await b.link(a, { animate: false }); b.orphans(["left"]); },
        },
        {
          caption: "Swap JOIN for <b>LEFT JOIN</b>. Every row of the left table, the one after FROM, stays.",
          async enter(b, a) { await a.after(b.load()); b.code(Q.left); await b.link(a, { animate: false }); b.keep("left"); b.orphans(["right"]); await a.wait(500); },
        },
        {
          caption: "Lena and Theo stay too. Where an order should be, the columns are <b>NULL</b>. That's a <b>left join</b>: all of the left table, plus its matches, or NULLs.",
          async enter(b, a) { b.code(Q.left); await a.after(b.result(sorted(Q.left, "c.id, o.id"), { count: true, mark: nameIsNull(1) })); },
        },
      ],
    };
  }

  function trapStory() {
    const missing = async (b, a, sql) => {
      const [all, got] = await a.after(Promise.all([run("SELECT name FROM customers ORDER BY id"), run(sql)]));
      const present = new Set(got.rows.map((row) => row[0]));
      const gone = all.rows.map((row) => row[0]).filter((name) => !present.has(name));
      b.root.querySelector(".jn-out").insertAdjacentHTML("beforeend", `<div class="jn-gone"><span>Gone:</span>${gone.map((name) => `<b>${name}</b>`).join("")}</div>`);
    };
    return {
      build: (stage) => joinBoard(stage),
      frames: [
        {
          caption: "Every customer with their <b>paid</b> orders; customers with none should still appear. A first try: left join, then filter in WHERE.",
          async enter(b, a) { b.code(Q.trap); b.root.querySelector(".jn-inputs").hidden = true; await a.wait(300); },
        },
        {
          caption: "Lena, Theo and Raj are gone. <b>WHERE</b> runs after the join, and a NULL status isn't <b>'paid'</b>, so their NULL rows fail. The left join became an inner join.",
          async enter(b, a) { b.code(Q.trap); await a.after(b.result(sorted(Q.trap, "c.id, o.id"), { count: true })); await missing(b, a, Q.trap); },
        },
        {
          caption: "Move the test into <b>ON</b>. It now only decides which orders match, and every customer stays. In a left join, filters on the right-hand table belong in ON.",
          async enter(b, a) { b.code(Q.fixed); await a.after(b.result(sorted(Q.fixed, "c.id, o.id"), { count: true, mark: nameIsNull(1) })); },
        },
      ],
    };
  }

  function fullStory() {
    return {
      build: (stage) => joinBoard(stage),
      frames: [
        {
          caption: "A <b>right join</b> is the mirror: it keeps every row of the right table. This is the same result as the left join, with the tables swapped. Most teams just write LEFT.",
          async enter(b, a) { b.code(Q.right); await a.after(b.result(sorted(Q.right, "c.id, o.id"), { count: true, mark: nameIsNull(1) })); },
        },
        {
          caption: "A <b>full outer join</b> keeps both sides whole: customers with no orders, and orders with no customer. 18 rows, handy for reconciling two lists.",
          async enter(b, a) {
            b.code(Q.full);
            await a.after(b.result(sorted(Q.full, "c.id IS NULL, c.id, o.id"), { count: true, mark: (row) => (row[0] === null ? "sq-bad" : row[1] === null ? "sq-hot" : "") }));
          },
        },
      ],
    };
  }

  function fanoutStory() {
    const repeated = async (a) => {
      const counts = await a.after(run("SELECT order_id FROM order_items GROUP BY order_id HAVING COUNT(*) > 1"));
      return new Set(counts.rows.map((row) => row[0]));
    };
    return {
      build: (stage) => joinBoard(stage),
      frames: [
        {
          caption: "Joins can also <b>add</b> rows. Each order has one or more items.",
          async enter(b, a) { b.code("SELECT order_id, product_id, quantity\nFROM order_items;"); await a.after(b.result("SELECT order_id, product_id, quantity FROM order_items ORDER BY order_id, product_id", { label: "order_items", count: true })); },
        },
        {
          caption: "Join orders to their items, and 16 orders become <b>22 rows</b>. Order 1 appears twice, once per item.",
          async enter(b, a) {
            const many = await repeated(a);
            b.code(Q.fanout);
            await a.after(b.result(sorted(Q.fanout, "o.id, i.product_id"), { count: true, mark: (row) => (many.has(row[0]) ? "sq-dup" : "") }));
          },
        },
        {
          caption: "That's <b>fan-out</b>. Add up anything from the orders side now, and orders with several items count several times.",
          async enter(b, a) {
            const many = await repeated(a);
            b.code(Q.fanout);
            await a.after(b.result(sorted(Q.fanout, "o.id, i.product_id"), { count: true, mark: (row) => (many.has(row[0]) ? "sq-dup" : "") }));
            b.root.querySelector(".jn-out .sq-grid").insertAdjacentHTML("beforeend", `<span class="sq-stamp">order 1 counted twice</span>`);
          },
        },
        {
          caption: "Forget the join condition, and every customer pairs with every order: 10 × 16 = <b>160 rows</b>. That's a <b>cross join</b>: occasionally useful, usually a bug.",
          async enter(b, a) { b.code(Q.cross); await a.after(b.result(Q.cross.replace(";", " ORDER BY c.id, o.id;"), { count: true })); },
        },
      ],
    };
  }

  // ---------- Beats ----------

  const innerPredict = () => predictBeat({
    id: "inner-count",
    prompt: "Sixteen orders go in. How many rows come out?",
    why: "Each order points at no more than one customer, so an inner join can't return more rows than orders here. Walk-ins have nobody to match.",
    question: `<pre class="sq-code">${hl(Q.inner)}</pre>`,
    options: [["16", "16"], ["14", "14"], ["10", "10"]],
    answer: "14",
    explain: { right: "Fourteen: the two walk-in orders have no customer to match.", wrong: "Fourteen. Orders #5 and #14 have no customer, so they're dropped." },
    async reveal(host) { await board(host).show(sorted(Q.inner, "o.id")); },
  });

  const trapPredict = () => predictBeat({
    id: "trap-predict",
    prompt: "Will Lena still be in the result?",
    why: "Lena has no orders at all, so after the left join her order columns, status included, are NULL.",
    question: `<pre class="sq-code">${hl(Q.trap)}</pre>`,
    options: [["yes", "Yes: it's a left join"], ["no", "No"]],
    answer: "no",
    explain: { right: "Right: she's gone. Next: why.", wrong: "She's gone, even though it's a left join. Next: why." },
  });

  const neverChallenge = () => challengeBeat({
    id: "never",
    prompt: "Your turn: customers who never ordered.",
    why: "After a left join, a customer with no orders has NULL in every order column. Test one that's never NULL in a real order, like o.id.",
    task: "The bakery wants to send a welcome offer to customers who've never ordered. Return their <b>name</b>.",
    starter: "SELECT c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE ",
    solution: "SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL",
  });

  const walkChallenge = () => challengeBeat({
    id: "walk",
    prompt: "Your turn: keep the walk-ins.",
    why: "The table after FROM is the one a left join keeps whole. Start from orders to keep every order.",
    task: "List every order's <b>id</b> with the customer's <b>name</b>, keeping the walk-in orders.",
    starter: "SELECT o.id, c.name\nFROM ",
    solution: "SELECT o.id, c.name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id",
  });

  function makeBeats() {
    const M = DSL.JoinsModel;
    return [
      teach("teach-inner", "Follow the pointers.", slice(innerStory(), 0, 4), "Joins don't need a foreign key to be declared: ON can compare any columns. Keys are just the usual thing to match on."),
      innerPredict(),
      teach("teach-inner-result", "Only pairs survive.", slice(innerStory(), 4, 5)),
      teach("teach-left", "Keep every customer.", leftStory(), "LEFT JOIN is short for LEFT OUTER JOIN. \"Outer\" means rows without a match are kept, padded with NULLs."),
      neverChallenge(),
      trapPredict(),
      teach("teach-trap", "WHERE after a left join.", slice(trapStory(), 1, 3), "Logical order again: FROM and its joins first, then WHERE. By the time WHERE runs, the NULL-padded rows exist, and it filters them out."),
      teach("teach-full", "Right and full joins.", fullStory()),
      teach("teach-fanout", "Joins can multiply.", fanoutStory(), "In an interview, when a total looks too big, say it out loud: a one-to-many join repeated the rows. Then aggregate before joining, or count per key."),
      walkChallenge(),
      DSL.Guided.quizBeat({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Guided.finishBeat({
        lessonId: "joins",
        badges: [["🔗", "Inner", "only matched pairs"], ["🫱", "Outer", "keep a side, pad with NULL"], ["✖️", "Multiply", "fan-out and cross joins"]],
      }),
    ];
  }

  DSL.JoinsScenes = Object.freeze({ Q, joinBoard, innerStory, leftStory, trapStory, fullStory, fanoutStory, neverChallenge, walkChallenge, beats: makeBeats });

  DSL.registerGuided("joins", () => DSL.Guided.run({
    lessonId: "joins",
    title: `${DSL.lessonNumber("joins")} · Join types`,
    beats: makeBeats(),
  }));
})(window.DataSystemsLab);
