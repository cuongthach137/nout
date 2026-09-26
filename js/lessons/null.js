(function registerNullLesson(DSL) {
  "use strict";

  // NULL traps: three-valued logic, IS NULL and IS DISTINCT FROM, NOT IN with a NULL in the list,
  // NULL in expressions, COALESCE, and NULLs in aggregates. Explore mode is the full reference;
  // Narrated (null-narrated.js) is the focused version and Guided (null-guided.js) sits in between.

  const { wonder, labSide } = DSL.LabKit;
  const code = (sql) => `<code>${DSL.Sql.highlight(sql)}</code>`;
  const progress = DSL.LabKit.createProgress({
    lessonId: "null",
    labs: [{ id: "unknown", name: `${DSL.labLabel("null", "A")} Unknown` }, { id: "notin", name: `${DSL.labLabel("null", "B")} NOT IN` }, { id: "defaults", name: `${DSL.labLabel("null", "C")} Defaults` }, { id: "quiz", name: "Quiz" }],
  });

  const SPEND = "WITH spend AS (\n  SELECT c.id, c.name, SUM(i.quantity * p.price) AS total\n  FROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\n  LEFT JOIN order_items i ON i.order_id = o.id\n  LEFT JOIN products p ON p.id = i.product_id\n  GROUP BY c.id\n)\n";

  const CHALLENGES = {
    unknown: [
      { id: "no-city", prompt: "Customers with <b>no city</b> on file: return their <b>name</b>.", starter: "SELECT name\nFROM customers\nWHERE city = NULL;", solution: "SELECT name FROM customers WHERE city IS NULL", hint: "Run the starter: nothing. <code>= NULL</code> is never true. Use <code>IS NULL</code>." },
      { id: "not-lisbon", prompt: "Every customer who <b>isn't in Lisbon</b>, including anyone whose city is unknown: return their <b>name</b>.", starter: "SELECT name\nFROM customers\nWHERE city <> 'Lisbon';", solution: "SELECT name FROM customers WHERE city <> 'Lisbon' OR city IS NULL", hint: "The starter drops Raj. Add <code>OR city IS NULL</code> (or, in SQLite, <code>city IS NOT 'Lisbon'</code>; in PostgreSQL, <code>city IS DISTINCT FROM 'Lisbon'</code>)." },
      { id: "has-phone", prompt: "Customers the bakery <b>can</b> text: return the <b>name</b> of everyone with a phone.", starter: "SELECT name\nFROM customers\nWHERE ", solution: "SELECT name FROM customers WHERE phone IS NOT NULL", hint: "<code>phone IS NOT NULL</code>. (<code>phone &lt;&gt; ''</code> wouldn't help: NULL isn't an empty string.)" },
      { id: "label", prompt: "Every customer's <b>name</b> and their city, showing <b>unknown</b> where the city is missing.", starter: "SELECT name,\n       \nFROM customers;", solution: "SELECT name, COALESCE(city, 'unknown') FROM customers", hint: "<code>COALESCE(city, 'unknown')</code>, or <code>CASE WHEN city IS NULL THEN 'unknown' ELSE city END</code>." },
    ],
    notin: [
      { id: "never", prompt: "Customers who <b>never ordered</b>: return their <b>name</b>. The starter returns nothing; fix it.", starter: "SELECT name\nFROM customers\nWHERE id NOT IN (SELECT customer_id FROM orders);", solution: "SELECT name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)", hint: "The walk-in orders put a NULL in the list. Use <code>NOT EXISTS</code>, or add <code>WHERE customer_id IS NOT NULL</code> inside the subquery." },
      { id: "not-maya", prompt: "Orders <b>not</b> placed by Maya (customer 1). Walk-in orders count too: return the order <b>id</b>.", starter: "SELECT id\nFROM orders\nWHERE customer_id <> 1;", solution: "SELECT id FROM orders WHERE customer_id <> 1 OR customer_id IS NULL", hint: "The starter drops orders #5 and #14: their customer is unknown. Add <code>OR customer_id IS NULL</code>." },
      { id: "unsold", prompt: "Products nobody has ordered: return their <b>name</b>, using <b>NOT EXISTS</b>.", starter: "SELECT p.name\nFROM products p\nWHERE NOT EXISTS (\n  \n);", solution: "SELECT p.name FROM products p WHERE NOT EXISTS (SELECT 1 FROM order_items i WHERE i.product_id = p.id)", hint: "<code>SELECT 1 FROM order_items i WHERE i.product_id = p.id</code>. (NOT IN would work here, because product_id is NOT NULL, but NOT EXISTS is safe either way.)" },
    ],
    defaults: [
      { id: "phones", prompt: "Every customer's <b>name</b> and phone, with <b>no phone</b> where it's missing.", starter: "SELECT name,\n       \nFROM customers;", solution: "SELECT name, COALESCE(phone, 'no phone') FROM customers", hint: "<code>COALESCE(phone, 'no phone')</code>" },
      { id: "spend-zero", prompt: "Each customer's <b>name</b> and total <b>spend</b>, showing <b>0</b> (not NULL) for customers who never ordered.", starter: `${SPEND}SELECT name, \nFROM spend;`, solution: `${SPEND}SELECT name, COALESCE(total, 0) FROM spend`, hint: "A LEFT JOIN with no matches sums to NULL, not 0. <code>COALESCE(total, 0)</code>." },
      { id: "avg-zero", prompt: "The <b>average spend per customer</b>, counting customers who never ordered as spending 0. One value.", starter: `${SPEND}SELECT AVG(total)\nFROM spend;`, solution: `${SPEND}SELECT AVG(COALESCE(total, 0)) FROM spend`, hint: "The starter averages only the 8 buyers (18.41). <code>AVG(COALESCE(total, 0))</code> averages all 10." },
      { id: "missing-count", prompt: "How many customers have <b>no phone</b>? One value, without a WHERE clause.", starter: "SELECT \nFROM customers;", solution: "SELECT COUNT(*) - COUNT(phone) FROM customers", hint: "<code>COUNT(*)</code> counts rows; <code>COUNT(phone)</code> skips NULLs. The difference is the missing ones." },
    ],
  };

  const QUIZ = [
    { prompt: "What does <code>WHERE city = NULL</code> return?", options: ["Rows where city is missing", "No rows", "An error"], answer: 1, why: "Comparing with NULL is unknown, never true, so no row passes. Use IS NULL." },
    { prompt: "10 customers: 3 in Lisbon, 1 with a NULL city. How many rows does <code>WHERE city &lt;&gt; 'Lisbon'</code> return?", options: ["7", "6", "10"], answer: 1, why: "The NULL city is unknown, not different, so it's dropped: 6, not 7." },
    { prompt: "<code>WHERE id NOT IN (SELECT customer_id FROM orders)</code> returns nothing, though some customers never ordered. Why?", options: ["NOT IN needs an index", "The list contains a NULL, so NOT IN is never true", "customer_id is a foreign key"], answer: 1, why: "The list contains a NULL, so NOT IN is never true. Use NOT EXISTS, or filter out the NULLs." },
    { prompt: "What does <code>COALESCE(phone, 'no phone')</code> return when phone is NULL?", options: ["NULL", "'no phone'", "An empty string"], answer: 1, why: "COALESCE returns its first argument that isn't NULL." },
  ];
  const QUIZ_MORE = [
    { prompt: "<code>SELECT DISTINCT city</code> on a table with two NULL cities returns…", options: ["Two NULL rows", "One NULL row", "No NULL rows"], answer: 1, why: "DISTINCT, GROUP BY and UNION treat NULLs as the same value: one NULL row. Only comparisons (=, <>, IN) treat NULL as unknown." },
    { prompt: "<code>SELECT SUM(price) FROM products WHERE 1 = 0</code> returns…", options: ["0", "NULL", "No rows"], answer: 1, why: "SUM over no rows is NULL (COUNT is the exception: 0). Write COALESCE(SUM(price), 0) when a report needs 0." },
  ];

  const TRUTH = [["TRUE AND UNKNOWN", "UNKNOWN"], ["FALSE AND UNKNOWN", "FALSE"], ["TRUE OR UNKNOWN", "TRUE"], ["FALSE OR UNKNOWN", "UNKNOWN"], ["NOT UNKNOWN", "UNKNOWN"]];
  const TRAPS = [
    ["x = NULL", "never true", "x IS NULL"],
    ["x <> 'a'", "drops NULL rows", "x <> 'a' OR x IS NULL / x IS DISTINCT FROM 'a'"],
    ["x NOT IN (… NULL …)", "returns nothing", "NOT EXISTS, or filter NULLs from the list"],
    ["'a' || x, x + 1", "NULL if x is NULL", "COALESCE(x, …)"],
    ["AVG(x), SUM(x)", "skip NULLs; SUM of nothing is NULL", "COALESCE(x, 0) when missing means 0"],
    ["COUNT(x)", "counts non-NULL x only", "COUNT(*) to count rows"],
    ["ORDER BY x", "NULLs first (SQLite, MySQL) or last (PostgreSQL)", "NULLS FIRST / NULLS LAST"],
  ];

  function labSection(id, letter, kicker, title, copy, body) {
    return `<section class="lab" id="lab-${id}">
      <div class="lab-top"><div><span class="lab-kicker">${kicker}</span><h2>${title}</h2><p class="lab-copy">${copy}</p></div>${labSide(DSL.labLabel("null", letter))}</div>
      ${body}
      <div class="sel-set" data-set="${id}"></div>
    </section>`;
  }

  function renderNull() {
    const lesson = DSL.getLesson("null");
    DSL.elements.root.innerHTML = `
      <article class="lesson sel">
        ${DSL.lessonHeader(lesson, "NULL means <em>unknown</em>, and it breaks queries quietly.", "No error, just a missing customer or an empty result. These are the NULL traps interviewers test, each on the bakery's own gaps: Raj's city, three missing phones, and two orders with no customer.")}
        ${progress.markup()}

        <div class="insight"><span class="insight-mark">//</span><p>NULL isn't zero, an empty string, or "no". It's <b>unknown</b>. Ask of every comparison: what happens when this side is unknown?</p></div>

        ${labSection("unknown", "A", "Unknown", "Three-valued logic", "Every test is TRUE, FALSE or UNKNOWN. Anything compared with NULL, even NULL, is UNKNOWN. WHERE, HAVING and ON keep only TRUE.", `
          <div class="sel-ops"><table class="sel-table"><thead><tr><th>Expression</th><th>Result</th></tr></thead><tbody>${TRUTH.map(([expr, result]) => `<tr><td><code>${expr}</code></td><td><b>${result}</b></td></tr>`).join("")}</tbody></table></div>
          ${wonder("Why does NOT make it worse?", "NOT UNKNOWN is still UNKNOWN. So <code>WHERE NOT (city = 'Lisbon')</code> drops Raj just like <code>city &lt;&gt; 'Lisbon'</code> does. Flipping a condition doesn't bring back the NULL rows; only an explicit <code>IS NULL</code> does.")}`)}

        ${labSection("notin", "B", "NOT IN", "One NULL in the list, and NOT IN returns nothing.", "<code>x NOT IN (1, 2, NULL)</code> means <code>x &lt;&gt; 1 AND x &lt;&gt; 2 AND x &lt;&gt; NULL</code>. The last part is UNKNOWN for every x, so no row is ever TRUE.", `
          <div class="sel-notes">
            <div><h3>Why IN is fine</h3><p><code>x IN (1, 2, NULL)</code> is <code>x = 1 OR x = 2 OR x = NULL</code>. For x = 1 that's TRUE OR … = TRUE. IN still finds the matches; only NOT IN collapses.</p></div>
            <div><h3>The fixes</h3><p>${code("NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)")} has no NULL problem. Or keep NOT IN and filter the list: ${code("WHERE customer_id IS NOT NULL")}. Or a LEFT JOIN with IS NULL.</p></div>
            <div><h3>Not-equal drops NULLs too</h3><p>"Orders not by Maya" with ${code("customer_id <> 1")} silently drops the walk-ins. If they should count, say so: ${code("OR customer_id IS NULL")}.</p></div>
          </div>`)}

        ${labSection("defaults", "C", "Defaults", "NULL in expressions and aggregates", "Arithmetic and text built from a NULL are NULL. Aggregates skip NULLs, so an average can quietly leave people out. COALESCE supplies a default when you mean one.", `
          ${wonder("Is NULL or 0 right for a customer who never ordered?", "It depends on the question. \"Average spend of buyers\" should skip them: 18.41. \"Average spend per customer\" should count them as 0: 14.72. Neither query is wrong; the NULL just forces you to decide, and in an interview, saying which you chose is the point.")}
          ${wonder("NULLIF, the other direction", "<code>NULLIF(a, b)</code> returns NULL when a = b. The classic use: <code>total / NULLIF(count, 0)</code> gives NULL instead of a divide-by-zero error.")}`)}

        <section class="lab sel-cheat">
          <div class="lab-top"><div><span class="lab-kicker">Cheat sheet</span><h2>Seven NULL traps, and their fixes</h2><p class="lab-copy">Run through this list before you trust a query on columns that can be NULL.</p></div></div>
          <div class="sel-ops"><table class="sel-table"><thead><tr><th>You wrote</th><th>With NULLs it…</th><th>Instead</th></tr></thead><tbody>${TRAPS.map(([wrote, does, instead]) => `<tr><td><code>${wrote.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></td><td>${does}</td><td><code>${instead.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></td></tr>`).join("")}</tbody></table></div>
        </section>

        <section class="lab" id="lab-quiz">
          <div class="lab-top"><div><span class="lab-kicker">Check yourself</span><h2>Six calls about NULL</h2><p class="lab-copy">The questions that catch people out.</p></div><div class="lab-side"><button class="button" type="button" data-quiz-reset>Reset answers</button>${DSL.LabKit.stamp()}</div></div>
          <div id="null-quiz">${DSL.Quiz.render([...QUIZ, ...QUIZ_MORE], "NULL review")}</div>
        </section>

        <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> for every nullable column in a query, ask "what happens to the unknown rows here?" That one question catches most NULL bugs.</p></div>
        ${DSL.lessonFooter("null")}
      </article>`;

    progress.mount();
    Object.entries(CHALLENGES).forEach(([labId, list]) => {
      DSL.Sql.challenges(DSL.elements.root.querySelector(`[data-set="${labId}"]`), list, {
        storageKey: `null-${labId}`,
        onAllDone: () => progress.complete(labId),
      });
    });
    DSL.Quiz.mount(document.getElementById("null-quiz"), [...QUIZ, ...QUIZ_MORE], {
      noun: "call",
      passScore: 5,
      successTitle: "NULL review passed",
      successCopy: "You can spot where unknown values go missing, and fix it.",
      onComplete: ({ passed }) => { if (passed) progress.complete("quiz"); },
    });
  }

  DSL.NullModel = Object.freeze({ QUIZ, CHALLENGES, progress });
  DSL.registerRenderer("null", renderNull);
})(window.DataSystemsLab);
