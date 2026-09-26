(function registerGroupLesson(DSL) {
  "use strict";

  // GROUP BY and HAVING: aggregates, groups and their grain, bare columns, WHERE vs HAVING, and
  // counting correctly after a join. Explore mode is the full reference; Narrated
  // (group-narrated.js) is the focused version and Guided (group-guided.js) sits in between.

  const { wonder, labSide } = DSL.LabKit;
  const code = (sql) => `<code>${DSL.Sql.highlight(sql)}</code>`;
  const progress = DSL.LabKit.createProgress({
    lessonId: "group",
    labs: [{ id: "aggregate", name: `${DSL.labLabel("group", "A")} Aggregate` }, { id: "groups", name: `${DSL.labLabel("group", "B")} Group` }, { id: "having", name: `${DSL.labLabel("group", "C")} Filter groups` }, { id: "quiz", name: "Quiz" }],
  });

  const CHALLENGES = {
    aggregate: [
      { id: "orders", prompt: "How many <b>orders</b> are there, and how many <b>different customers</b> placed them? Return both counts in one row.", starter: "SELECT COUNT(*), \nFROM orders;", solution: "SELECT COUNT(*), COUNT(DISTINCT customer_id) FROM orders", hint: "<code>COUNT(DISTINCT customer_id)</code> counts each customer once. Walk-ins (NULL) aren't counted." },
      { id: "prices", prompt: "The cheapest price, the dearest price, and the average price of the products (unrounded).", starter: "SELECT \nFROM products;", solution: "SELECT MIN(price), MAX(price), AVG(price) FROM products", hint: "<code>MIN(price), MAX(price), AVG(price)</code>, in that order." },
      { id: "phones", prompt: "How many customers are there, and how many of them gave a phone number? One row, two counts.", starter: "SELECT \nFROM customers;", solution: "SELECT COUNT(*), COUNT(phone) FROM customers", hint: "<code>COUNT(*)</code> counts rows; <code>COUNT(phone)</code> skips NULLs." },
    ],
    groups: [
      { id: "cities", prompt: "How many customers live in each <b>city</b>? Return the city and the count.", starter: "SELECT city, COUNT(*)\nFROM customers\n", solution: "SELECT city, COUNT(*) FROM customers GROUP BY city", hint: "<code>GROUP BY city</code>. NULL cities form one group of their own." },
      { id: "units", prompt: "Units sold per product: return the product <b>name</b> and the total <b>quantity</b>.", starter: "SELECT p.name, SUM(i.quantity)\nFROM order_items i\nJOIN products p ON p.id = i.product_id\n", solution: "SELECT p.name, SUM(i.quantity) FROM order_items i JOIN products p ON p.id = i.product_id GROUP BY p.name", hint: "Group by the product's name." },
      { id: "category", prompt: "Revenue per <b>category</b>: quantity × price, summed. Return the category and its revenue.", starter: "SELECT p.category, \nFROM order_items i\nJOIN products p ON p.id = i.product_id\n", solution: "SELECT p.category, SUM(i.quantity * p.price) FROM order_items i JOIN products p ON p.id = i.product_id GROUP BY p.category", hint: "<code>SUM(i.quantity * p.price)</code>, grouped by <code>p.category</code>." },
      { id: "latest", prompt: "Each customer's most recent order: return <b>customer_id</b> and the latest <b>ordered_at</b>.", starter: "SELECT customer_id, ordered_at\nFROM orders\nGROUP BY customer_id;", solution: "SELECT customer_id, MAX(ordered_at) FROM orders GROUP BY customer_id", hint: "The starter runs in SQLite, but <code>ordered_at</code> is a bare column: which of Maya's four dates did it pick? Wrap it: <code>MAX(ordered_at)</code>." },
    ],
    having: [
      { id: "regulars", prompt: "Regulars: customers with at least two orders. Return the customer's <b>name</b> and their order count.", starter: "SELECT c.name, COUNT(*)\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nGROUP BY c.name\n", solution: "SELECT c.name, COUNT(*) FROM orders o JOIN customers c ON c.id = o.customer_id GROUP BY c.name HAVING COUNT(*) >= 2", hint: "<code>HAVING COUNT(*) &gt;= 2</code> filters the groups." },
      { id: "paid-regulars", prompt: "Same, but count only <b>paid</b> orders: customers with at least two paid orders.", starter: "SELECT c.name, COUNT(*)\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\n", solution: "SELECT c.name, COUNT(*) FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.status = 'paid' GROUP BY c.name HAVING COUNT(*) >= 2", hint: "<code>WHERE o.status = 'paid'</code> drops rows before grouping; <code>HAVING</code> filters the groups after." },
      { id: "best", prompt: "Best sellers: products with at least <b>5 units</b> sold. Return the <b>name</b> and the total.", starter: "SELECT p.name, SUM(i.quantity)\nFROM order_items i\nJOIN products p ON p.id = i.product_id\n", solution: "SELECT p.name, SUM(i.quantity) FROM order_items i JOIN products p ON p.id = i.product_id GROUP BY p.name HAVING SUM(i.quantity) >= 5", hint: "<code>GROUP BY p.name HAVING SUM(i.quantity) &gt;= 5</code>" },
      { id: "busy", prompt: "Busy days: dates with more than one order. Return <b>ordered_at</b> and the count.", starter: "SELECT ordered_at, COUNT(*)\nFROM orders\n", solution: "SELECT ordered_at, COUNT(*) FROM orders GROUP BY ordered_at HAVING COUNT(*) > 1", hint: "Group by the date, keep groups with <code>COUNT(*) &gt; 1</code>." },
      { id: "orders-and-lines", prompt: "For each customer <b>name</b>: the number of <b>orders</b>, and the number of order <b>lines</b> (items), after joining both tables.", starter: "SELECT c.name, COUNT(*), COUNT(*)\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nJOIN order_items i ON i.order_id = o.id\nGROUP BY c.name;", solution: "SELECT c.name, COUNT(DISTINCT o.id), COUNT(*) FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items i ON i.order_id = o.id GROUP BY c.name", hint: "After the join there's one row per item, so <code>COUNT(*)</code> counts lines. Orders need <code>COUNT(DISTINCT o.id)</code>." },
    ],
  };

  const QUIZ = [
    { prompt: "A table has 10 rows, and 3 of them have a NULL phone. What do <code>COUNT(*)</code> and <code>COUNT(phone)</code> return?", options: ["10 and 10", "10 and 7", "7 and 10"], answer: 1, why: "COUNT(*) counts rows. COUNT of a column skips NULLs." },
    { prompt: "You need customers with more than 5 orders. Where does the condition go?", options: ["WHERE COUNT(*) > 5", "HAVING COUNT(*) > 5", "ORDER BY COUNT(*) > 5"], answer: 1, why: "The count only exists after grouping, so it's a HAVING condition. WHERE runs before any group exists." },
    { prompt: "<code>SELECT customer_id, ordered_at, COUNT(*) FROM orders GROUP BY customer_id</code>. What does PostgreSQL do?", options: ["Uses the first date in each group", "Rejects the query", "Returns one row per order"], answer: 1, why: "ordered_at is a bare column: neither grouped nor aggregated. PostgreSQL rejects it. Wrap it, like MAX(ordered_at)." },
    { prompt: "Orders per customer looks too high after joining <code>order_items</code>. The fix?", options: ["COUNT(DISTINCT o.id)", "Add an ORDER BY", "Switch to a LEFT JOIN"], answer: 0, why: "The join repeats each order once per item. Count distinct order IDs, or count before joining." },
  ];
  const QUIZ_MORE = [
    { prompt: "What's <code>AVG(x)</code> over the values 2, 4 and NULL?", options: ["2", "3", "NULL"], answer: 1, why: "Aggregates skip NULLs, so it's (2 + 4) / 2. If NULL should count as 0, say so: AVG(COALESCE(x, 0))." },
    { prompt: "<code>SELECT COUNT(*) FROM orders WHERE 1 = 0</code> returns…", options: ["No rows", "One row: 0", "One row: NULL"], answer: 1, why: "An aggregate with no GROUP BY always returns exactly one row. Add GROUP BY, and no input rows means no groups, so no rows." },
  ];

  const ORDER = [["FROM / JOIN", "build the rows"], ["WHERE", "drop rows"], ["GROUP BY", "form groups"], ["HAVING", "drop groups"], ["SELECT", "compute columns, aggregates"], ["DISTINCT", "drop repeated rows"], ["ORDER BY", "sort"], ["LIMIT", "cut"]];

  function labSection(id, letter, kicker, title, copy, body) {
    return `<section class="lab" id="lab-${id}">
      <div class="lab-top"><div><span class="lab-kicker">${kicker}</span><h2>${title}</h2><p class="lab-copy">${copy}</p></div>${labSide(DSL.labLabel("group", letter))}</div>
      ${body}
      <div class="sel-set" data-set="${id}"></div>
    </section>`;
  }

  function renderGroup() {
    const lesson = DSL.getLesson("group");
    DSL.elements.root.innerHTML = `
      <article class="lesson sel">
        ${DSL.lessonHeader(lesson, "From rows to numbers: <em>GROUP BY</em> and HAVING.", "How many, how much, and who: every reporting question in an interview is an aggregate over groups. Know what one row of your result stands for, and filter at the right moment.")}
        ${progress.markup()}

        <div class="insight"><span class="insight-mark">//</span><p>An aggregate turns many rows into one value. <b>GROUP BY</b> decides how many rows you get back: one per group. That's the result's <b>grain</b>, and most reporting bugs are a grain nobody checked.</p></div>

        ${labSection("aggregate", "A", "Aggregate", "COUNT, SUM, AVG, MIN, MAX", "With no GROUP BY, an aggregate collapses the whole table into one row.", `
          <div class="sel-notes">
            <div><h3>COUNT(*) vs COUNT(column)</h3><p>${code("COUNT(*)")} counts rows. ${code("COUNT(phone)")} counts rows where <code>phone</code> isn't NULL. ${code("COUNT(DISTINCT city)")} counts different non-NULL values.</p></div>
            <div><h3>Aggregates skip NULLs</h3><p>SUM, AVG, MIN and MAX ignore NULLs. <code>AVG</code> divides by the non-NULL count, which is not always what you mean. On an empty input, COUNT returns 0 and the others return NULL.</p></div>
            <div><h3>Always one row</h3><p>An aggregate query with no GROUP BY returns exactly one row, even when no rows match. With GROUP BY, no rows means no groups, so nothing comes back.</p></div>
          </div>`)}

        ${labSection("groups", "B", "Group", "GROUP BY sets the grain.", "Rows that share the grouped values form a group; each group becomes one row. Every selected column must be grouped or aggregated.", `
          ${wonder("Why does SQLite accept a bare column?", "SQLite (and MySQL with <code>ONLY_FULL_GROUP_BY</code> off) returns the value from some row of the group, with no promise which. PostgreSQL and standard SQL reject it. In an interview, name the rule: every selected column is grouped or aggregated. The exception: columns that depend on a grouped primary key, which PostgreSQL does allow.")}
          ${wonder("Where do NULLs go?", "All NULLs in a grouped column form <b>one</b> group. That's how Raj's missing city and the walk-in orders' missing customer show up as a single NULL row, unlike in a join, where NULL never matches.")}`)}

        ${labSection("having", "C", "Filter groups", "WHERE filters rows. HAVING filters groups.", "WHERE runs before grouping, on single rows, so it can't see a count. HAVING runs after, on whole groups. Put each condition as early as it can go: WHERE also makes the grouping cheaper.", `
          <div class="sel-notes">
            <div><h3>Count after a join</h3><p>Joining orders to their items repeats each order per item. ${code("COUNT(*)")} then counts lines, not orders: use ${code("COUNT(DISTINCT o.id)")}, or aggregate each table before joining.</p></div>
            <div><h3>Sums after a join</h3><p>Summing an order-level value after a one-to-many join multiplies it. Sum at the grain where the value lives: item amounts per item, then roll up.</p></div>
            <div><h3>Aliases in HAVING</h3><p>Standard SQL evaluates HAVING before SELECT, so repeat the aggregate: ${code("HAVING COUNT(*) >= 2")}. SQLite and MySQL also accept an alias there; PostgreSQL doesn't.</p></div>
          </div>`)}

        <section class="lab sel-cheat">
          <div class="lab-top"><div><span class="lab-kicker">Cheat sheet</span><h2>The full logical order</h2><p class="lab-copy">Extends the order from the SELECT lesson with GROUP BY and HAVING. Each clause only sees what the ones before it produced.</p></div></div>
          <ol class="sel-order">${ORDER.map(([clause, what], i) => `<li style="--i:${i}"><b>${clause}</b><span>${what}</span></li>`).join("")}</ol>
        </section>

        <section class="lab" id="lab-quiz">
          <div class="lab-top"><div><span class="lab-kicker">Check yourself</span><h2>Six calls about aggregates</h2><p class="lab-copy">Counting, grouping, and filtering at the right moment.</p></div><div class="lab-side"><button class="button" type="button" data-quiz-reset>Reset answers</button>${DSL.LabKit.stamp()}</div></div>
          <div id="group-quiz">${DSL.Quiz.render([...QUIZ, ...QUIZ_MORE], "GROUP BY review")}</div>
        </section>

        <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> before any aggregate, say the grain out loud: "one row per ___". Then check that every join and filter keeps it.</p></div>
        ${DSL.lessonFooter("group")}
      </article>`;

    progress.mount();
    Object.entries(CHALLENGES).forEach(([labId, list]) => {
      DSL.Sql.challenges(DSL.elements.root.querySelector(`[data-set="${labId}"]`), list, {
        storageKey: `group-${labId}`,
        onAllDone: () => progress.complete(labId),
      });
    });
    DSL.Quiz.mount(document.getElementById("group-quiz"), [...QUIZ, ...QUIZ_MORE], {
      noun: "call",
      passScore: 5,
      successTitle: "GROUP BY review passed",
      successCopy: "You can count, group, and filter groups, and say what each row means.",
      onComplete: ({ passed }) => { if (passed) progress.complete("quiz"); },
    });
  }

  DSL.GroupModel = Object.freeze({ QUIZ, CHALLENGES, progress });
  DSL.registerRenderer("group", renderGroup);
})(window.DataSystemsLab);
