(function registerWindowLesson(DSL) {
  "use strict";

  // Window functions: OVER and PARTITION BY, ranking with ties, top N per group, running totals,
  // LAG/LEAD, and frames. Explore mode is the full reference; Narrated (window-narrated.js) is the
  // focused version and Guided (window-guided.js) sits in between.

  const { wonder, labSide } = DSL.LabKit;
  const code = (sql) => `<code>${DSL.Sql.highlight(sql)}</code>`;
  const progress = DSL.LabKit.createProgress({
    lessonId: "window",
    labs: [{ id: "keep", name: `${DSL.labLabel("window", "A")} Keep rows` }, { id: "rank", name: `${DSL.labLabel("window", "B")} Rank` }, { id: "along", name: `${DSL.labLabel("window", "C")} Along the rows` }, { id: "quiz", name: "Quiz" }],
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

  const QUIZ = [
    { prompt: "<code>GROUP BY category</code> returns 3 rows. How many does <code>AVG(price) OVER (PARTITION BY category)</code> return, on 8 products?", options: ["3", "8", "1"], answer: 1, why: "A window function keeps every row. Eight products in, eight rows out." },
    { prompt: "Scores 90, 80, 80, 70. What does <code>DENSE_RANK</code> give the 70?", options: ["3", "4", "2"], answer: 0, why: "The 80s share rank 2, and DENSE_RANK doesn't skip, so 70 is 3. RANK would say 4." },
    { prompt: "Why can't you write <code>WHERE ROW_NUMBER() OVER (…) = 1</code>?", options: ["ROW_NUMBER needs a GROUP BY", "Window functions are computed after WHERE, so filter in an outer query", "WHERE can't compare numbers"], answer: 1, why: "Window functions are computed after WHERE. Number the rows in a CTE or subquery, then filter outside." },
    { prompt: "What does <code>LAG(ordered_at)</code> return on a customer's first order?", options: ["NULL", "The same date", "An error"], answer: 0, why: "There's no previous row, so it's NULL, unless you give LAG a default: LAG(x, 1, default)." },
  ];
  const QUIZ_MORE = [
    { prompt: "\"Top 3 products by units\", with a tie for third. Which function might return 4 rows when you keep numbers ≤ 3?", options: ["ROW_NUMBER", "RANK", "Neither"], answer: 1, why: "RANK gives both tied rows 3, so you get 4 rows. ROW_NUMBER returns exactly 3, but picks one of the tied rows arbitrarily. Say which one the business wants." },
    { prompt: "<code>SUM(x) OVER (ORDER BY day)</code> when two rows share the same day…", options: ["Each row gets its own running total", "Both rows show the total through the end of that day", "It's an error"], answer: 1, why: "With ORDER BY and no frame, the default frame is RANGE … CURRENT ROW, which includes rows tied with the current one. Use ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW for a strict row-by-row total." },
  ];

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

        <section class="lab" id="lab-quiz">
          <div class="lab-top"><div><span class="lab-kicker">Check yourself</span><h2>Six calls about window functions</h2><p class="lab-copy">Rows kept, ties, filtering, and frames.</p></div><div class="lab-side"><button class="button" type="button" data-quiz-reset>Reset answers</button>${DSL.LabKit.stamp()}</div></div>
          <div id="window-quiz">${DSL.Quiz.render([...QUIZ, ...QUIZ_MORE], "Window functions review")}</div>
        </section>

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
    DSL.Quiz.mount(document.getElementById("window-quiz"), [...QUIZ, ...QUIZ_MORE], {
      noun: "call",
      passScore: 5,
      successTitle: "Window functions review passed",
      successCopy: "You can rank, compare with a group, and read along the rows.",
      onComplete: ({ passed }) => { if (passed) progress.complete("quiz"); },
    });
  }

  DSL.WindowModel = Object.freeze({ QUIZ, CHALLENGES, progress });
  DSL.registerRenderer("window", renderWindow);
})(window.DataSystemsLab);
