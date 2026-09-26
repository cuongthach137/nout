(function registerSubLesson(DSL) {
  "use strict";

  // Subqueries and CTEs: scalar subqueries, lists with IN, correlated subqueries, EXISTS, derived
  // tables, WITH, and a first recursive CTE. Explore mode is the full reference; Narrated
  // (sub-narrated.js) is the focused version and Guided (sub-guided.js) sits in between.

  const { wonder, labSide } = DSL.LabKit;
  const code = (sql) => `<code>${DSL.Sql.highlight(sql)}</code>`;
  const progress = DSL.LabKit.createProgress({
    lessonId: "sub",
    labs: [{ id: "nested", name: `${DSL.labLabel("sub", "A")} Nest` }, { id: "correlated", name: `${DSL.labLabel("sub", "B")} Per row` }, { id: "ctes", name: `${DSL.labLabel("sub", "C")} Name the steps` }, { id: "quiz", name: "Quiz" }],
  });

  const ORDER_TOTALS = "WITH totals AS (\n  SELECT o.id, o.customer_id, SUM(i.quantity * p.price) AS total\n  FROM orders o\n  JOIN order_items i ON i.order_id = o.id\n  JOIN products p ON p.id = i.product_id\n  GROUP BY o.id\n)\n";

  const CHALLENGES = {
    nested: [
      { id: "above", prompt: "Products that cost more than the <b>average price</b>: return <b>name</b> and <b>price</b>.", starter: "SELECT name, price\nFROM products\nWHERE price > ", solution: "SELECT name, price FROM products WHERE price > (SELECT AVG(price) FROM products)", hint: "A scalar subquery: <code>(SELECT AVG(price) FROM products)</code>." },
      { id: "after-lena", prompt: "Customers who joined <b>after Lena</b>: return their <b>name</b>.", starter: "SELECT name\nFROM customers\nWHERE ", solution: "SELECT name FROM customers WHERE joined > (SELECT joined FROM customers WHERE name = 'Lena')", hint: "<code>joined &gt; (SELECT joined FROM customers WHERE name = 'Lena')</code>" },
      { id: "cake", prompt: "Customers who have bought a <b>cake</b>: return their <b>name</b>, once each.", starter: "SELECT name\nFROM customers\nWHERE id IN (\n  \n)", solution: "SELECT name FROM customers WHERE id IN (SELECT o.customer_id FROM orders o JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id WHERE p.category = 'cake')", hint: "The inner query returns customer IDs on cake orders. <code>IN</code> doesn't care about duplicates in that list, so no DISTINCT is needed." },
      { id: "latest", prompt: "The most recent order(s): return <b>id</b> and <b>ordered_at</b> for every order on the latest date.", starter: "SELECT id, ordered_at\nFROM orders\nWHERE ", solution: "SELECT id, ordered_at FROM orders WHERE ordered_at = (SELECT MAX(ordered_at) FROM orders)", hint: "<code>ordered_at = (SELECT MAX(ordered_at) FROM orders)</code> also returns ties, which <code>ORDER BY … LIMIT 1</code> would hide." },
    ],
    correlated: [
      { id: "category", prompt: "Products that cost more than the average of <b>their own category</b>: return <b>name</b> and <b>category</b>.", starter: "SELECT p.name, p.category\nFROM products p\nWHERE p.price > (\n  SELECT AVG(x.price)\n  FROM products x\n  WHERE \n)", solution: "SELECT p.name, p.category FROM products p WHERE p.price > (SELECT AVG(x.price) FROM products x WHERE x.category = p.category)", hint: "Correlate on the category: <code>x.category = p.category</code>. Two aliases for the same table keep them apart." },
      { id: "pending", prompt: "Customers with at least one <b>pending</b> order: return their <b>name</b>.", starter: "SELECT c.name\nFROM customers c\nWHERE EXISTS (\n  \n)", solution: "SELECT c.name FROM customers c WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'pending')", hint: "<code>SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'pending'</code>" },
      { id: "no-paid", prompt: "Customers with <b>no paid orders</b> at all (including customers with no orders): return their <b>name</b>.", starter: "SELECT c.name\nFROM customers c\nWHERE ", solution: "SELECT c.name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id AND o.status = 'paid')", hint: "<code>NOT EXISTS</code> with the same kind of subquery, testing <code>status = 'paid'</code>." },
      { id: "last-order", prompt: "Every customer with the date of their <b>latest order</b> (NULL if none): return <b>name</b> and the date, using a subquery in SELECT.", starter: "SELECT c.name,\n       (  ) AS last_order\nFROM customers c;", solution: "SELECT c.name, (SELECT MAX(o.ordered_at) FROM orders o WHERE o.customer_id = c.id) FROM customers c", hint: "A correlated scalar subquery in SELECT: <code>(SELECT MAX(o.ordered_at) FROM orders o WHERE o.customer_id = c.id)</code>. A LEFT JOIN with GROUP BY gives the same result." },
    ],
    ctes: [
      { id: "above-avg", prompt: "Customers with <b>more orders than the average customer</b>: return <b>name</b> and their order count.", starter: "WITH counts AS (\n  SELECT customer_id, COUNT(*) AS n\n  FROM orders\n  WHERE customer_id IS NOT NULL\n  GROUP BY customer_id\n)\nSELECT ", solution: "WITH counts AS (SELECT customer_id, COUNT(*) AS n FROM orders WHERE customer_id IS NOT NULL GROUP BY customer_id) SELECT c.name, counts.n FROM counts JOIN customers c ON c.id = counts.customer_id WHERE counts.n > (SELECT AVG(n) FROM counts)", hint: "Join <code>counts</code> to <code>customers</code>, then <code>WHERE n &gt; (SELECT AVG(n) FROM counts)</code>. A CTE can be read twice." },
      { id: "big-orders", prompt: "Orders worth more than the <b>average order</b>: return the order <b>id</b> and its <b>total</b>.", starter: `${ORDER_TOTALS}SELECT `, solution: `${ORDER_TOTALS}SELECT id, total FROM totals WHERE total > (SELECT AVG(total) FROM totals)`, hint: "The CTE already has each order's total. Compare with <code>(SELECT AVG(total) FROM totals)</code>." },
      { id: "biggest", prompt: "Each customer's <b>biggest order</b>: return the customer's <b>name</b> and the largest order total.", starter: `${ORDER_TOTALS}SELECT `, solution: `${ORDER_TOTALS}SELECT c.name, MAX(t.total) FROM totals t JOIN customers c ON c.id = t.customer_id GROUP BY c.name`, hint: "Totals are per order, so they're safe to aggregate again: <code>MAX(t.total)</code> grouped by customer. This is \"aggregate first, then join\": no fan-out." },
      { id: "quiet-days", prompt: "Days from <b>2024-09-02</b> to <b>2024-09-25</b> with <b>no orders</b>: return each <b>day</b>.", starter: "WITH RECURSIVE days(day) AS (\n  SELECT '2024-09-02'\n  UNION ALL\n  SELECT date(day, '+1 day') FROM days WHERE day < '2024-09-25'\n)\nSELECT day\nFROM days\n", solution: "WITH RECURSIVE days(day) AS (SELECT '2024-09-02' UNION ALL SELECT date(day, '+1 day') FROM days WHERE day < '2024-09-25') SELECT day FROM days WHERE day NOT IN (SELECT ordered_at FROM orders)", hint: "The CTE generates every day. Keep the ones with no order: <code>WHERE day NOT IN (SELECT ordered_at FROM orders)</code>, or a LEFT JOIN with IS NULL. (PostgreSQL would use <code>generate_series</code> or interval arithmetic instead of <code>date(…, '+1 day')</code>.)" },
    ],
  };

  const QUIZ = [
    { prompt: "<code>WHERE price &gt; (SELECT AVG(price) FROM products)</code>. What must the subquery return?", options: ["Exactly one value", "Any number of rows", "One row per product"], answer: 0, why: "It's compared with one price, so it must be one value: one row, one column." },
    { prompt: "What makes a subquery correlated?", options: ["It's in the FROM clause", "It uses a column of the outer query", "It uses EXISTS"], answer: 1, why: "It uses a column from the outer query, so its result depends on the outer row." },
    { prompt: "Why do people write <code>EXISTS (SELECT 1 …)</code>?", options: ["1 is faster to read than *", "EXISTS ignores what's selected; it only asks whether a row exists", "It makes the subquery return the number 1"], answer: 1, why: "EXISTS only asks whether a row exists. What the subquery selects is ignored, so 1 is a convention." },
    { prompt: "Why use a CTE instead of nesting subqueries?", options: ["It's always faster", "It names each step, so the query reads top to bottom and can reuse a step", "It saves the result permanently"], answer: 1, why: "It names each step, so the query reads top to bottom, and a step can be used more than once." },
  ];
  const QUIZ_MORE = [
    { prompt: "In PostgreSQL, a scalar subquery that returns two rows…", options: ["uses the first row", "raises an error", "returns NULL"], answer: 1, why: "\"More than one row returned by a subquery used as an expression.\" SQLite silently uses the first row, which hides bugs." },
    { prompt: "What does a recursive CTE need so it doesn't run forever?", options: ["An ORDER BY", "A step whose WHERE eventually returns no new rows", "A LIMIT inside the anchor"], answer: 1, why: "It stops when the recursive step adds no rows, so the step needs a condition that eventually fails, like day < '2024-09-25'." },
  ];

  const KINDS = [
    ["Scalar", "one value", "WHERE price > (SELECT AVG(price) FROM products)"],
    ["List", "one column, many rows", "WHERE id IN (SELECT customer_id FROM orders)"],
    ["Correlated", "re-run per outer row", "WHERE price > (SELECT AVG(x.price) FROM products x WHERE x.category = p.category)"],
    ["EXISTS", "is there any row?", "WHERE EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)"],
    ["Derived table", "a table in FROM", "FROM (SELECT customer_id, COUNT(*) AS n FROM orders GROUP BY customer_id) AS counts"],
    ["CTE", "a named step", "WITH counts AS (…) SELECT … FROM counts"],
  ];

  function labSection(id, letter, kicker, title, copy, body) {
    return `<section class="lab" id="lab-${id}">
      <div class="lab-top"><div><span class="lab-kicker">${kicker}</span><h2>${title}</h2><p class="lab-copy">${copy}</p></div>${labSide(DSL.labLabel("sub", letter))}</div>
      ${body}
      <div class="sel-set" data-set="${id}"></div>
    </section>`;
  }

  function renderSub() {
    const lesson = DSL.getLesson("sub");
    DSL.elements.root.innerHTML = `
      <article class="lesson sel">
        ${DSL.lessonHeader(lesson, "Questions inside questions: <em>subqueries</em> and CTEs.", "Above average, never ordered, biggest per customer: many interview questions need one answer before another. Nest the first question, or name it with WITH.")}
        ${progress.markup()}

        <div class="insight"><span class="insight-mark">//</span><p>A subquery can stand in for a <b>value</b>, a <b>list</b>, or a <b>table</b>, depending on where you put it. Match its shape to its place: one value after <code>=</code>, a list after <code>IN</code>, a table after <code>FROM</code>.</p></div>

        ${labSection("nested", "A", "Nest", "A query where a value or a list goes.", "The inner query runs, and the outer query uses its result. A <b>scalar subquery</b> must return one value; a subquery after <b>IN</b> returns a list.", `
          <div class="sel-notes">
            <div><h3>Exactly one value</h3><p>A scalar subquery that returns two rows is an error in PostgreSQL. SQLite quietly uses the first row. If it returns no rows, the value is NULL, and comparing with NULL keeps nothing.</p></div>
            <div><h3>IN and duplicates</h3><p>${code("WHERE id IN (SELECT customer_id FROM orders)")} doesn't repeat customers who ordered twice: IN only asks "is it in the list?". A join would repeat them.</p></div>
            <div><h3>Ties, not LIMIT 1</h3><p>${code("WHERE ordered_at = (SELECT MAX(ordered_at) FROM orders)")} returns every order on the latest day. <code>ORDER BY … LIMIT 1</code> would silently pick one.</p></div>
          </div>`)}

        ${labSection("correlated", "B", "Per row", "Correlated subqueries and EXISTS.", "A <b>correlated</b> subquery uses a column of the outer row, so it's evaluated per row. <b>EXISTS</b> asks whether the subquery returns any row at all.", `
          ${wonder("Are correlated subqueries slow?", "Written naively, they run once per outer row. In practice planners often rewrite them as joins, semi-joins (EXISTS) or anti-joins (NOT EXISTS), so they can be as fast as the join you'd write by hand. Check the plan rather than guessing; the planner lesson shows how.")}
          ${wonder("NOT EXISTS or NOT IN?", "They look interchangeable, but <code>NOT IN</code> breaks if the list contains a NULL: nothing is ever \"not in\" a list with an unknown in it. <code>NOT EXISTS</code> has no such trap. The NULL traps lesson shows it happening.")}`)}

        ${labSection("ctes", "C", "Name the steps", "WITH: a query in named steps.", "A <b>CTE</b> names a subquery up front; later steps, and the final SELECT, read it like a table. A subquery in FROM, a <b>derived table</b>, does the same inline.", `
          <div class="sel-notes">
            <div><h3>Aggregate, then join</h3><p>The fan-out fix from the GROUP BY lesson: compute order totals in a CTE (one row per order), then join or aggregate again. No row is counted twice.</p></div>
            <div><h3>Reuse</h3><p>A CTE can be read more than once, like <code>counts</code> in the average-orders challenge. PostgreSQL 12+ inlines a CTE used once and computes one used more than once a single time; <code>MATERIALIZED</code> / <code>NOT MATERIALIZED</code> override that.</p></div>
            <div><h3>Recursive</h3><p>${code("WITH RECURSIVE")}: an anchor row, <code>UNION ALL</code>, and a step that reads the CTE itself. It stops when a step adds no rows. Used for date series, org charts and graph paths.</p></div>
          </div>`)}

        <section class="lab sel-cheat">
          <div class="lab-top"><div><span class="lab-kicker">Cheat sheet</span><h2>Six shapes of a nested query</h2><p class="lab-copy">Say which one you're using, and what it returns, before you write it.</p></div></div>
          <div class="sel-ops"><table class="sel-table"><thead><tr><th>Kind</th><th>Returns</th><th>Example</th></tr></thead><tbody>${KINDS.map(([kind, returns, example]) => `<tr><td><code>${kind}</code></td><td>${returns}</td><td>${code(example)}</td></tr>`).join("")}</tbody></table></div>
        </section>

        <section class="lab" id="lab-quiz">
          <div class="lab-top"><div><span class="lab-kicker">Check yourself</span><h2>Six calls about nested queries</h2><p class="lab-copy">Shapes, correlation, EXISTS, and CTEs.</p></div><div class="lab-side"><button class="button" type="button" data-quiz-reset>Reset answers</button>${DSL.LabKit.stamp()}</div></div>
          <div id="sub-quiz">${DSL.Quiz.render([...QUIZ, ...QUIZ_MORE], "Subqueries review")}</div>
        </section>

        <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> break a hard question into named steps. Each step should have a grain you can say out loud: one row per order, one row per customer.</p></div>
        ${DSL.lessonFooter("sub")}
      </article>`;

    progress.mount();
    Object.entries(CHALLENGES).forEach(([labId, list]) => {
      DSL.Sql.challenges(DSL.elements.root.querySelector(`[data-set="${labId}"]`), list, {
        storageKey: `sub-${labId}`,
        onAllDone: () => progress.complete(labId),
      });
    });
    DSL.Quiz.mount(document.getElementById("sub-quiz"), [...QUIZ, ...QUIZ_MORE], {
      noun: "call",
      passScore: 5,
      successTitle: "Subqueries review passed",
      successCopy: "You can nest a question, correlate it, and name the steps.",
      onComplete: ({ passed }) => { if (passed) progress.complete("quiz"); },
    });
  }

  DSL.SubModel = Object.freeze({ QUIZ, CHALLENGES, progress });
  DSL.registerRenderer("sub", renderSub);
})(window.DataSystemsLab);
