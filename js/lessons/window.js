(function registerWindowLesson(DSL) {
  "use strict";

  // Window functions: OVER and PARTITION BY, ranking with ties, top N per group, running totals,
  // LAG/LEAD, and frames. Explore mode is the full reference; Narrated (window-narrated.js) is the
  // focused version and Guided (window-guided.js) sits in between.

  const { wonder, labSide } = DSL.LabKit;
  const code = (sql) => `<code>${DSL.Sql.highlight(sql)}</code>`;
  const progress = DSL.LabKit.createProgress({
    lessonId: "window",
    labs: [{ id: "keep", name: `${DSL.labLabel("window", "A")} Keep rows` }, { id: "rank", name: `${DSL.labLabel("window", "B")} Rank` }, { id: "along", name: `${DSL.labLabel("window", "C")} Along the rows` }, { id: "quiz", name: "Practice" }],
  });

  const UNITS = "WITH units AS (\n  SELECT p.name, SUM(i.quantity) AS units\n  FROM order_items i\n  JOIN products p ON p.id = i.product_id\n  GROUP BY p.name\n)\n";
  const DAILY = "WITH daily AS (\n  SELECT o.ordered_at AS day, SUM(i.quantity * p.price) AS revenue\n  FROM orders o\n  JOIN order_items i ON i.order_id = o.id\n  JOIN products p ON p.id = i.product_id\n  GROUP BY o.ordered_at\n)\n";

  const CHALLENGES = {
    keep: [
      { id: "cat-avg", prompt: "Every product's <b>name</b>, <b>category</b> and <b>price</b>, with its <b>category's average price</b> beside it.", starter: "SELECT name, category, price,\n       \nFROM products;", solution: "SELECT name, category, price, AVG(price) OVER (PARTITION BY category) FROM products", hint: "<code>AVG(price) OVER (PARTITION BY category)</code>. No GROUP BY: every row stays." },
      { id: "status-count", prompt: "Every order's <b>id</b> and <b>status</b>, with the <b>number of orders</b> that share its status.", starter: "SELECT id, status,\n       \nFROM orders;", solution: "SELECT id, status, COUNT(*) OVER (PARTITION BY status) FROM orders", hint: "<code>COUNT(*) OVER (PARTITION BY status)</code>" },
      { id: "share", prompt: "Each product's <b>name</b> and its <b>share</b> of its category's total price (price ÷ the category's summed price, unrounded).", starter: "SELECT name,\n       \nFROM products;", solution: "SELECT name, price / SUM(price) OVER (PARTITION BY category) FROM products", hint: "<code>price / SUM(price) OVER (PARTITION BY category)</code>. Shares within a category add up to 1." },
    ],
    rank: [
      { id: "ranks", prompt: "Units sold per product, with <b>RANK</b> and <b>DENSE_RANK</b> by units (most first). Return <b>name</b>, <b>units</b>, the rank, and the dense rank.", starter: `${UNITS}SELECT name, units,\n       \nFROM units;`, solution: `${UNITS}SELECT name, units, RANK() OVER (ORDER BY units DESC), DENSE_RANK() OVER (ORDER BY units DESC) FROM units`, hint: "<code>RANK() OVER (ORDER BY units DESC)</code> and the same with <code>DENSE_RANK()</code>. Watch the tie at 4 units." },
      { id: "top1", prompt: "The <b>most expensive</b> product in each category: return <b>name</b>, <b>category</b>, <b>price</b>.", starter: "WITH ranked AS (\n  SELECT name, category, price,\n         \n  FROM products\n)\nSELECT name, category, price\nFROM ranked\nWHERE ", solution: "WITH ranked AS (SELECT name, category, price, ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn FROM products) SELECT name, category, price FROM ranked WHERE rn = 1", hint: "<code>ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn</code>, then <code>WHERE rn = 1</code> outside." },
      { id: "top2", prompt: "The <b>two most expensive</b> products in each category: <b>name</b>, <b>category</b>, <b>price</b>.", starter: "WITH ranked AS (\n  SELECT name, category, price,\n         \n  FROM products\n)\nSELECT name, category, price\nFROM ranked\nWHERE ", solution: "WITH ranked AS (SELECT name, category, price, ROW_NUMBER() OVER (PARTITION BY category ORDER BY price DESC) AS rn FROM products) SELECT name, category, price FROM ranked WHERE rn <= 2", hint: "Same numbering, <code>WHERE rn &lt;= 2</code>." },
      { id: "latest", prompt: "Each customer's <b>latest order</b>: return <b>customer_id</b>, the order <b>id</b> and <b>ordered_at</b>. Skip walk-ins.", starter: "WITH ranked AS (\n  SELECT customer_id, id, ordered_at,\n         \n  FROM orders\n  WHERE customer_id IS NOT NULL\n)\nSELECT customer_id, id, ordered_at\nFROM ranked\nWHERE ", solution: "WITH ranked AS (SELECT customer_id, id, ordered_at, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at DESC) AS rn FROM orders WHERE customer_id IS NOT NULL) SELECT customer_id, id, ordered_at FROM ranked WHERE rn = 1", hint: "Partition by customer, newest first. Unlike MAX(ordered_at), this returns the whole row: the order's id too." },
    ],
    along: [
      { id: "running", prompt: "Revenue per <b>day</b>, with a <b>running total</b>: return the day, that day's revenue, and the total so far (unrounded).", starter: `${DAILY}SELECT day, revenue,\n       \nFROM daily;`, solution: `${DAILY}SELECT day, revenue, SUM(revenue) OVER (ORDER BY day) FROM daily`, hint: "<code>SUM(revenue) OVER (ORDER BY day)</code>" },
      { id: "moving", prompt: "A <b>3-day moving average</b> of daily revenue: return the day and the average of that day and the two before it (fewer at the start).", starter: `${DAILY}SELECT day,\n       \nFROM daily;`, solution: `${DAILY}SELECT day, AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) FROM daily`, hint: "A frame: <code>AVG(revenue) OVER (ORDER BY day ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)</code>. These are the last 3 <em>rows</em> (days with orders), not calendar days." },
      { id: "previous", prompt: "Maya's orders (customer 1): each order's <b>id</b>, <b>ordered_at</b>, and the date of her <b>previous</b> order.", starter: "SELECT id, ordered_at,\n       \nFROM orders\nWHERE customer_id = 1;", solution: "SELECT id, ordered_at, LAG(ordered_at) OVER (ORDER BY ordered_at) FROM orders WHERE customer_id = 1", hint: "<code>LAG(ordered_at) OVER (ORDER BY ordered_at)</code>. WHERE runs first, so the window only sees Maya's orders." },
      { id: "gaps", prompt: "Maya's orders with the <b>days since her previous order</b>: <b>id</b> and the gap in days (NULL for the first).", starter: "SELECT id,\n       \nFROM orders\nWHERE customer_id = 1;", solution: "SELECT id, julianday(ordered_at) - julianday(LAG(ordered_at) OVER (ORDER BY ordered_at)) FROM orders WHERE customer_id = 1", hint: "SQLite has no date subtraction: <code>julianday(ordered_at) - julianday(LAG(ordered_at) OVER (ORDER BY ordered_at))</code>. In PostgreSQL, subtracting two dates gives days directly." },
      { id: "nth", prompt: "Number each customer's orders from first to last: <b>customer_id</b>, order <b>id</b>, and its number. Skip walk-ins.", starter: "SELECT customer_id, id,\n       \nFROM orders\nWHERE customer_id IS NOT NULL;", solution: "SELECT customer_id, id, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at) FROM orders WHERE customer_id IS NOT NULL", hint: "<code>ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY ordered_at)</code>" },
    ],
  };

  // Goals, and the practice that checks them (js/components/practice.js). Every mode states the
  // goals at the start and ends with the recap, the checks and the interview round.
  const PRACTICE = {
    lessonId: "window",
    goals: [
      {
        id: "keep", icon: "🪟", title: "Keep every row", snippet: "AVG(price) OVER (PARTITION BY category)",
        text: "Put a group's number beside every row with OVER and PARTITION BY, and tell a window from a GROUP BY.",
        recap: "A <b>window function</b> computes over a group but keeps every row: 8 products in, 8 rows out, each with its category's average beside it.",
        example: {
          before: "SELECT category, AVG(price) FROM products GROUP BY category ORDER BY category",
          sql: "SELECT name, category, AVG(price) OVER (PARTITION BY category) AS avg FROM products ORDER BY category, name",
          show: 5,
          note: "All 8 products stay; GROUP BY kept 3 rows.",
        },
      },
      {
        id: "rank", icon: "🏅", title: "Rank and pick the top", snippet: "ROW_NUMBER() OVER (\n  PARTITION BY category\n  ORDER BY price DESC)",
        text: "Rank rows with ROW_NUMBER, RANK and DENSE_RANK, and return the top N per group.",
        recap: "Ties share a RANK, with a gap after; DENSE_RANK doesn't skip. For <b>top N per group</b>, number rows in a CTE and filter outside.",
        example: {
          sql: "WITH ranked AS (\n  SELECT name, category, ROW_NUMBER() OVER (\n    PARTITION BY category ORDER BY price DESC) AS rn\n  FROM products\n)\nSELECT name, category FROM ranked\nWHERE rn = 1 ORDER BY category",
          note: "The dearest product in each category.",
        },
      },
      {
        id: "line", icon: "📈", title: "Read along the line", snippet: "LAG(ordered_at) OVER (ORDER BY ordered_at)",
        text: "Build running totals and compare a row with the one before it, using ORDER BY inside the window and LAG.",
        recap: "With ORDER BY inside OVER, <b>SUM</b> becomes a running total and <b>LAG</b> reads the previous row: Maya's gaps between orders are 3, 7 and 13 days.",
        example: {
          sql: "SELECT id, ordered_at, LAG(ordered_at) OVER (ORDER BY ordered_at) AS previous FROM orders WHERE customer_id = 1 ORDER BY ordered_at",
          mark: (row) => (row[2] === null ? "hot" : ""),
          note: "Her first order has no previous one: NULL.",
        },
      },
    ],
    checks: [
      { id: "rows-out", goal: "keep", prompt: "<code>SELECT category, COUNT(*) OVER (PARTITION BY category) FROM products</code>, on 8 products in 3 categories. How many rows come back?", options: ["3", "8", "24"], answer: 1, why: "A window function never removes rows. Each of the 8 products gets its category's count beside it.",
        visual: { sql: "SELECT category, COUNT(*) OVER (PARTITION BY category) AS n\nFROM products ORDER BY category", show: 8, note: "8 rows in, 8 rows out." },
      },
      { id: "ties", goal: "rank", prompt: "Four prices, ordered from high to low: 6.50, 5.90, 5.90, 2.80. What does each function give the 2.80?", options: ["ROW_NUMBER 4, RANK 4, DENSE_RANK 3", "ROW_NUMBER 4, RANK 3, DENSE_RANK 3", "All three give 4"], answer: 0, why: "ROW_NUMBER just counts: 4. RANK gives the tie 2 and 2, then skips to 4. DENSE_RANK doesn't skip, so 3.",
        visual: {
          before: { label: "Ordered by price, high to low", columns: ["price", "ROW_NUMBER", "RANK", "DENSE_RANK"], rows: [["6.50", 1, 1, 1], ["5.90", 2, 2, 2], ["5.90", 3, 2, 2], ["2.80", "?", "?", "?"]] },
          after: { label: "Ordered by price, high to low", columns: ["price", "ROW_NUMBER", "RANK", "DENSE_RANK"], rows: [["6.50", 1, 1, 1], ["5.90", 2, 2, 2], ["5.90", 3, 2, 2], ["2.80", 4, 4, 3]] },
          mark: (row, phase) => (phase === "after" && row[0] === "2.80" ? "hot" : ""),
          note: "RANK skips 3; DENSE_RANK doesn't.",
        },
      },
      { id: "running", goal: "line", prompt: "A running total of daily revenue: <code>SUM(revenue) OVER ( ? )</code>. What goes in the brackets?", options: ["<code>PARTITION BY day</code>", "<code>ORDER BY day</code>", "<code>GROUP BY day</code>"], answer: 1, why: "ORDER BY lines the days up, so each row adds itself to everything before it. PARTITION BY day would restart every day, and GROUP BY can't go inside OVER.",
        visual: {
          before: { label: "Revenue per day", columns: ["day", "revenue", "running"], rows: [["09-02", "23.70", "?"], ["09-05", "11.40", "?"], ["09-06", "10.35", "?"], ["09-09", "5.25", "?"]] },
          after: { label: "SUM(revenue) OVER (ORDER BY day)", columns: ["day", "revenue", "running"], rows: [["09-02", "23.70", "23.70"], ["09-05", "11.40", "35.10"], ["09-06", "10.35", "45.45"], ["09-09", "5.25", "50.70"]] },
          mark: (row, phase) => (phase === "after" ? "good" : ""),
          note: "Each row adds itself to everything before it.",
        },
      },
    ],
    warmups: [
      { id: "rank-kinds", goal: "rank", prompt: "What's the difference between ROW_NUMBER, RANK and DENSE_RANK?", options: ["ROW_NUMBER always counts 1, 2, 3; RANK gives ties the same number and then skips; DENSE_RANK gives ties the same number without skipping", "They're the same except for how they treat NULLs", "RANK skips NULLs; DENSE_RANK doesn't"], answer: 0, why: "They only differ on ties: ROW_NUMBER breaks them arbitrarily, RANK leaves a gap after them, DENSE_RANK doesn't." },
      { id: "why-window", goal: "keep", prompt: "When would you use a window function instead of GROUP BY?", options: ["When I need a group's value beside each row, keeping every row", "When the table is too big for GROUP BY", "Never: GROUP BY can do everything a window can"], answer: 0, why: "GROUP BY collapses each group into one row. A window keeps the rows, so you can compare each one with its group: its rank, its share, the average." },
    ],
    open: {
      id: "top-spenders",
      goal: "rank",
      prompt: "Find the top three customers by total spend in each city. Walk me through the query, and tell me what happens with ties.",
      points: [
        "Step one: each customer's total spend: join orders, items and products, <code>SUM(quantity * price)</code>, grouped by customer and city.",
        "Step two: rank within each city: <code>ROW_NUMBER()</code> or <code>RANK() OVER (PARTITION BY city ORDER BY spend DESC)</code>.",
        "Window functions run after WHERE, so number the rows in a CTE and filter <code>rn &lt;= 3</code> outside.",
        "Ties: ROW_NUMBER returns exactly three and breaks ties arbitrarily; RANK or DENSE_RANK can return more. Ask which the business wants, or add a tiebreaker.",
        "Customers with no city (NULL) form a partition of their own.",
      ],
      answer: "First a CTE with each customer's total spend: join orders to order_items and products, sum quantity times price, grouped by customer and city. Then a second step ranks inside each city with ROW_NUMBER() OVER (PARTITION BY city ORDER BY spend DESC). I can't filter on that in the same WHERE, because window functions are computed after it, so I filter rn <= 3 in the outer query. On ties, ROW_NUMBER gives exactly three rows but picks arbitrarily between tied customers; RANK keeps everyone tied at third, so a city can return four. I'd ask which one they want, or add a tiebreaker like the customer ID. And customers without a city end up in a NULL partition.",
    },
  };
  DSL.Practice.registerCards(PRACTICE);

  const PARTS = [
    ["PARTITION BY", "which rows share a window", "PARTITION BY category"],
    ["ORDER BY", "their order inside it", "ORDER BY price DESC"],
    ["frame", "which rows around the current one", "ROWS BETWEEN 2 PRECEDING AND CURRENT ROW"],
  ];
  const FUNCS = [
    ["ROW_NUMBER()", "1, 2, 3, 4: ties broken arbitrarily"],
    ["RANK()", "1, 2, 2, 4: ties share, then skip"],
    ["DENSE_RANK()", "1, 2, 2, 3: ties share, no gap"],
    ["SUM / AVG / COUNT … OVER", "running or per-partition totals"],
    ["LAG(x) / LEAD(x)", "value from the previous / next row"],
    ["FIRST_VALUE / LAST_VALUE", "first / last in the frame (mind the default frame)"],
  ];

  function labSection(id, letter, kicker, title, copy, body) {
    return `<section class="lab" id="lab-${id}">
      <div class="lab-top"><div><span class="lab-kicker">${kicker}</span><h2>${title}</h2><p class="lab-copy">${copy}</p></div>${labSide(DSL.labLabel("window", letter))}</div>
      ${body}
      <div class="sel-set" data-set="${id}"></div>
    </section>`;
  }

  function renderWindow() {
    const lesson = DSL.getLesson("window");
    DSL.elements.root.innerHTML = `
      <article class="lesson sel">
        ${DSL.lessonHeader(lesson, "Keep every row: <em>window functions</em>.", "Rank within a group, compare a row with its group, total as you go, look at the previous row. Window functions answer the questions GROUP BY can't, and they're a staple of SQL interviews.")}
        <div class="pr-intro"><p class="pr-kicker">By the end, you'll be able to</p>${DSL.Practice.cardsMarkup(PRACTICE, { compact: true })}</div>
        ${progress.markup()}

        <div class="insight"><span class="insight-mark">//</span><p>GROUP BY collapses rows into groups. A window function keeps every row and adds a value computed over a <b>window</b> of related rows: ${code("AVG(price) OVER (PARTITION BY category)")}.</p></div>

        ${labSection("keep", "A", "Keep rows", "OVER and PARTITION BY", "An aggregate with OVER becomes a window function. PARTITION BY says which rows share a window; with an empty <code>OVER ()</code>, the window is the whole result.", `
          <div class="sel-notes">
            <div><h3>When windows run</h3><p>After FROM, WHERE, GROUP BY and HAVING, at SELECT time. So WHERE can't filter on a window function, but ORDER BY can sort by one. After a GROUP BY, a window can even aggregate aggregates: ${code("SUM(COUNT(*)) OVER ()")}.</p></div>
            <div><h3>Versus a correlated subquery</h3><p>"Each product vs its category's average" was a correlated subquery last lesson. As a window function it's one pass over the table, and the result keeps every product with its average beside it.</p></div>
            <div><h3>Engines</h3><p>PostgreSQL, MySQL 8+, SQL Server and SQLite 3.25+ all support window functions. MySQL 5.7 doesn't, which is why older answers use variables or self-joins.</p></div>
          </div>`)}

        ${labSection("rank", "B", "Rank", "ROW_NUMBER, RANK, DENSE_RANK", "Ranking functions need an ORDER BY inside OVER. They differ only in how they treat ties. Top N per group: number the rows in a CTE, then filter outside.", `
          ${wonder("Which ranking function should a top-N query use?", "Ask what should happen with ties. <code>ROW_NUMBER</code> returns exactly N rows but breaks ties arbitrarily; add a tiebreaker to its ORDER BY (like <code>, id</code>) so it's deterministic. <code>RANK</code> or <code>DENSE_RANK</code> keep every tied row, so you may get more than N. Saying this out loud is most of what the interviewer is checking.")}`)}

        ${labSection("along", "C", "Along the rows", "Running totals, moving averages, LAG and LEAD", "With ORDER BY inside OVER, a window can grow as it goes (running totals) or slide (a frame). LAG and LEAD read a neighbouring row.", `
          <div class="sel-notes">
            <div><h3>The default frame</h3><p>With ORDER BY and no frame, a window runs from the first row to the current row <em>and its ties</em> (<code>RANGE</code>). For a strict row-by-row total, write ${code("ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW")}.</p></div>
            <div><h3>Moving windows</h3><p>${code("ROWS BETWEEN 2 PRECEDING AND CURRENT ROW")} is the last three rows. If some days have no rows, that's not the last three calendar days: fill the dates first (a recursive CTE, or <code>generate_series</code> in PostgreSQL).</p></div>
            <div><h3>LAG with a default</h3><p>${code("LAG(ordered_at, 1, joined)")} reads one row back and falls back to a default instead of NULL. <code>LEAD</code> looks forward: "next order date", "time until the next event".</p></div>
          </div>`)}

        <section class="lab sel-cheat">
          <div class="lab-top"><div><span class="lab-kicker">Cheat sheet</span><h2>Anatomy of OVER, and the functions</h2><p class="lab-copy"><code>function() OVER (PARTITION BY … ORDER BY … frame)</code>. Every part is optional.</p></div></div>
          <div class="sel-ops"><table class="sel-table"><thead><tr><th>Part</th><th>Says</th><th>Example</th></tr></thead><tbody>${PARTS.map(([part, says, example]) => `<tr><td><code>${part}</code></td><td>${says}</td><td>${code(example)}</td></tr>`).join("")}</tbody></table></div>
          <div class="sel-ops" style="margin-top:14px"><table class="sel-table"><thead><tr><th>Function</th><th>Gives</th></tr></thead><tbody>${FUNCS.map(([fn, gives]) => `<tr><td><code>${fn}</code></td><td>${gives}</td></tr>`).join("")}</tbody></table></div>
        </section>

        ${DSL.Practice.exploreMarkup(PRACTICE)}

        <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> when a question says "for each … the top", "compared with its group", "so far", or "previous", reach for a window function, and decide how ties should behave before writing it.</p></div>
        ${DSL.lessonFooter("window")}
      </article>`;

    progress.mount();
    Object.entries(CHALLENGES).forEach(([labId, list]) => {
      DSL.Sql.challenges(DSL.elements.root.querySelector(`[data-set="${labId}"]`), list, {
        storageKey: `window-${labId}`,
        onAllDone: () => progress.complete(labId),
      });
    });
    DSL.Practice.mountExplore(document.getElementById("lab-quiz"), PRACTICE, { onPass: () => progress.complete("quiz") });
  }

  DSL.WindowModel = Object.freeze({ PRACTICE, CHALLENGES, progress });
  DSL.registerRenderer("window", renderWindow);
})(window.DataSystemsLab);
