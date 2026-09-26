(function registerJoinsLesson(DSL) {
  "use strict";

  // Join types: what each join keeps, what it drops, and when it multiplies rows. Explore mode is
  // the full reference: three labs of graded exercises, notes, a cheat sheet, and a quiz.
  // Narrated (joins-narrated.js) is the focused version; Guided (joins-guided.js) sits in between.

  const { wonder, labSide } = DSL.LabKit;
  const code = (sql) => `<code>${DSL.Sql.highlight(sql)}</code>`;
  const progress = DSL.LabKit.createProgress({
    lessonId: "joins",
    labs: [{ id: "match", name: `${DSL.labLabel("joins", "A")} Match` }, { id: "keep", name: `${DSL.labLabel("joins", "B")} Keep a side` }, { id: "multiply", name: `${DSL.labLabel("joins", "C")} Multiply` }, { id: "quiz", name: "Quiz" }],
  });

  const CHALLENGES = {
    match: [
      { id: "names", prompt: "Every order with its customer: return the order's <b>id</b> and the customer's <b>name</b>. Walk-in orders can be left out.", starter: "SELECT o.id, c.name\nFROM orders o\nJOIN ", solution: "SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id", hint: "<code>JOIN customers c ON c.id = o.customer_id</code>" },
      { id: "items", prompt: "Every order line with the product's name: return <b>order_id</b>, the product <b>name</b>, and <b>quantity</b>.", starter: "SELECT i.order_id, p.name, i.quantity\nFROM order_items i\n", solution: "SELECT i.order_id, p.name, i.quantity FROM order_items i JOIN products p ON p.id = i.product_id", hint: "Join <code>products p</code> on <code>p.id = i.product_id</code>." },
      { id: "maya-lines", prompt: "Everything Maya has bought: for each of her order lines, return the order <b>id</b>, the product <b>name</b> and the <b>quantity</b>.", starter: "SELECT o.id, p.name, i.quantity\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\n", solution: "SELECT o.id, p.name, i.quantity FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id WHERE c.name = 'Maya'", hint: "Chain the joins: customers → orders → order_items → products, then filter on <code>c.name = 'Maya'</code>." },
    ],
    keep: [
      { id: "never", prompt: "Customers who have never ordered: return their <b>name</b>.", starter: "SELECT c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE ", solution: "SELECT c.name FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL", hint: "After the left join, a customer with no orders has NULL in every order column. Test <code>o.id IS NULL</code>." },
      { id: "unsold", prompt: "Products nobody has ordered yet: return their <b>name</b>.", starter: "SELECT p.name\nFROM products p\n", solution: "SELECT p.name FROM products p LEFT JOIN order_items i ON i.product_id = p.id WHERE i.order_id IS NULL", hint: "The same anti-join, from <code>products</code> to <code>order_items</code>." },
      { id: "walkins", prompt: "Every order's <b>id</b> with the customer's <b>name</b>, keeping walk-in orders (their name is NULL).", starter: "SELECT o.id, c.name\nFROM ", solution: "SELECT o.id, c.name FROM orders o LEFT JOIN customers c ON c.id = o.customer_id", hint: "Start <code>FROM orders</code>, then <code>LEFT JOIN customers</code>. The table you start from is the one kept whole." },
      { id: "paid", prompt: "Every customer with the <b>id</b> of each <b>paid</b> order. Customers with no paid order still appear once, with a NULL id. Return <b>name</b> and the order <b>id</b>.", starter: "SELECT c.name, o.id\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\n", solution: "SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid'", hint: "A filter on the right-hand table in WHERE throws away the NULL rows. Put <code>o.status = 'paid'</code> in the ON clause." },
      { id: "reconcile", prompt: "Reconcile the two lists: return <b>name</b> and order <b>id</b> for every customer with no order and every order with no customer, in one query.", starter: "SELECT c.name, o.id\nFROM customers c\nFULL OUTER JOIN ", solution: "SELECT c.name, o.id FROM customers c FULL OUTER JOIN orders o ON o.customer_id = c.id WHERE c.id IS NULL OR o.id IS NULL", hint: "A full outer join keeps both sides; keep the rows where either side is NULL." },
    ],
    multiply: [
      { id: "pairs", prompt: "Which customers bought which products? Return each <b>customer name</b> and <b>product name</b> pair <b>once</b>.", starter: "SELECT c.name, p.name\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nJOIN order_items i ON i.order_id = o.id\nJOIN products p ON p.id = i.product_id;", solution: "SELECT DISTINCT c.name, p.name FROM customers c JOIN orders o ON o.customer_id = c.id JOIN order_items i ON i.order_id = o.id JOIN products p ON p.id = i.product_id", hint: "Run the starter: some pairs repeat, once per order that contains them. That's fan-out. <code>SELECT DISTINCT</code> keeps each pair once." },
      { id: "neighbours", prompt: "Customers who live in the same city: return each pair of <b>names</b> once, the lower id first.", starter: "SELECT a.name, b.name\nFROM customers a\nJOIN customers b ON ", solution: "SELECT a.name, b.name FROM customers a JOIN customers b ON a.city = b.city AND a.id < b.id", hint: "A self-join: the same table twice, with two aliases. <code>a.id &lt; b.id</code> drops self-pairs and mirror pairs." },
      { id: "tasting", prompt: "A tasting menu pairs every <b>cake</b> with every <b>bread</b>. Return the cake's <b>name</b> and the bread's <b>name</b>.", starter: "SELECT cake.name, bread.name\nFROM products cake\nCROSS JOIN products bread\n", solution: "SELECT a.name, b.name FROM products a CROSS JOIN products b WHERE a.category = 'cake' AND b.category = 'bread'", hint: "<code>CROSS JOIN</code> pairs every row with every row; filter each side's category in WHERE." },
    ],
  };

  const QUIZ = [
    { prompt: "customers has 10 rows, orders has 16, and 2 orders have no customer. How many rows does an inner join on the customer ID return?", options: ["10", "14", "16"], answer: 1, why: "Each order with a customer matches exactly one row, so 14. The walk-ins, and customers who never ordered, are dropped." },
    { prompt: "Which query finds customers who have never ordered?", options: ["customers c JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL", "customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL", "customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NOT NULL"], answer: 1, why: "A left join keeps every customer. Those with no order have NULL on the order side, so test for that." },
    { prompt: "<code>LEFT JOIN orders o ON … WHERE o.status = 'paid'</code>. What happens to customers with no paid orders?", options: ["They show up with NULLs", "They disappear: the WHERE undoes the left join", "The query fails"], answer: 1, why: "WHERE runs after the join, and NULL isn't 'paid', so those rows fail. Put the condition in ON." },
    { prompt: "A report's revenue doubled right after someone added a join. What's the likely cause?", options: ["The new join repeats each order once per matching row", "The left join added NULL rows", "The table's statistics are stale"], answer: 0, why: "The new join matches several rows per order, so each order is repeated, and added up, more than once." },
  ];
  const QUIZ_MORE = [
    { prompt: "<code>SELECT * FROM a, b</code> with no condition. <code>a</code> has 3 rows, <code>b</code> has 4. How many rows?", options: ["4", "7", "12"], answer: 2, why: "No condition means a cross join: every row of a with every row of b, 3 × 4." },
    { prompt: "Two rows both have NULL in the join column. Does an inner join match them?", options: ["Yes, NULL equals NULL", "No: NULL = NULL isn't true", "Only in a left join"], answer: 1, why: "Comparing NULL with anything, even NULL, is unknown, never true. That's why walk-in orders never match a customer." },
  ];

  const TYPES = [
    ["JOIN (INNER)", "only matched pairs", "rows with no partner, on both sides"],
    ["LEFT JOIN", "every left row; right side or NULLs", "right rows with no partner"],
    ["RIGHT JOIN", "every right row; left side or NULLs", "left rows with no partner"],
    ["FULL OUTER JOIN", "every row from both sides", "nothing"],
    ["CROSS JOIN", "every pair: rows × rows", "nothing (and adds a lot)"],
  ];

  function labSection(id, letter, kicker, title, copy, body) {
    return `<section class="lab" id="lab-${id}">
      <div class="lab-top"><div><span class="lab-kicker">${kicker}</span><h2>${title}</h2><p class="lab-copy">${copy}</p></div>${labSide(DSL.labLabel("joins", letter))}</div>
      ${body}
      <div class="sel-set" data-set="${id}"></div>
    </section>`;
  }

  function renderJoins() {
    const lesson = DSL.getLesson("joins");
    DSL.elements.root.innerHTML = `
      <article class="lesson sel">
        ${DSL.lessonHeader(lesson, "Join types: what each one <em>keeps</em>, and what it drops.", "Orders point at customers by ID. A join follows those pointers. Every join type keeps some rows, drops others, and sometimes repeats them; interviews check that you know which.")}
        ${progress.markup()}

        <div class="insight"><span class="insight-mark">//</span><p>The bakery data has the edge cases on purpose: <b>Lena</b> and <b>Theo</b> never ordered, orders <b>#5</b> and <b>#14</b> are walk-ins with no customer, and <b>Rye loaf</b> has never sold.</p></div>

        ${labSection("match", "A", "Match rows", "An inner join keeps matched pairs, and only those.", "The <b>join condition</b> after ON says which rows belong together. Anything without a partner, on either side, is dropped without a word.", `
          <div class="sel-notes">
            <div><h3>ON, USING, NATURAL</h3><p>${code("ON c.id = o.customer_id")} works for any column names. ${code("USING (customer_id)")} is shorthand when both columns share a name. Avoid <code>NATURAL JOIN</code>: it joins on every same-named column, so adding a column can silently change the result.</p></div>
            <div><h3>Aliases</h3><p>${code("FROM orders o JOIN customers c")}: short table aliases keep conditions readable, and they're required when a table appears twice (a self-join).</p></div>
            <div><h3>NULL keys never match</h3><p>A walk-in order has <code>customer_id</code> NULL. <code>NULL = anything</code> is never true, so an inner join drops it, even against another NULL.</p></div>
          </div>`)}

        ${labSection("keep", "B", "Keep a side", "Outer joins keep one side whole.", "A <b>left join</b> keeps every row of the table you start from; where the other side has no match, its columns are NULL. A <b>right join</b> is the mirror, and a <b>full outer join</b> keeps both.", `
          ${wonder("Why does a WHERE on the right table break a left join?", "WHERE runs after the join. Rows the left join padded with NULLs have NULL in every right-hand column, and <code>NULL = 'paid'</code> isn't true, so they're thrown away: the result is an inner join. Put conditions on the right-hand table in <b>ON</b>, where they only decide what matches.")}
          ${wonder("LEFT JOIN … IS NULL, NOT EXISTS, or NOT IN?", "All three can find rows with no match: an <b>anti-join</b>. <code>NOT EXISTS</code> states the intent most clearly, and planners run it as an anti-join. <code>NOT IN</code> has a trap: if the subquery returns a single NULL, it matches nothing. The NULL traps lesson shows why.")}`)}

        ${labSection("multiply", "C", "Multiply", "Joins can add rows as well as drop them.", "Join a row to several matches and it's repeated once per match: <b>fan-out</b>. With no condition at all, every row pairs with every row: a <b>cross join</b>.", `
          <div class="sel-notes">
            <div><h3>Fan-out and totals</h3><p>Orders joined to items repeat each order once per item. Sum an order-level column after that and orders with several items count several times. Aggregate each table first, or check the row count per key before trusting a total.</p></div>
            <div><h3>Self-joins</h3><p>The same table twice with two aliases, for comparing rows with each other: customers in the same city, employees and their managers.</p></div>
            <div><h3>How the engine joins</h3><p>Which rows a join returns is fixed by its type. <em>How</em> it finds them (nested loop, hash or merge join) is the planner's choice: ${DSL.lessonRef("join-algorithms")}.</p></div>
          </div>`)}

        <section class="lab sel-cheat">
          <div class="lab-top"><div><span class="lab-kicker">Cheat sheet</span><h2>What each join keeps and drops</h2><p class="lab-copy">Say it this way in an interview: which rows survive, which are padded with NULLs, and which disappear.</p></div></div>
          <div class="sel-ops"><table class="sel-table"><thead><tr><th>Join</th><th>Keeps</th><th>Drops</th></tr></thead><tbody>${TYPES.map(([join, keeps, drops]) => `<tr><td><code>${join}</code></td><td>${keeps}</td><td>${drops}</td></tr>`).join("")}</tbody></table></div>
        </section>

        <section class="lab" id="lab-quiz">
          <div class="lab-top"><div><span class="lab-kicker">Check yourself</span><h2>Six calls about joins</h2><p class="lab-copy">Row counts, missing rows, and doubled totals: the join questions interviews actually ask.</p></div><div class="lab-side"><button class="button" type="button" data-quiz-reset>Reset answers</button>${DSL.LabKit.stamp()}</div></div>
          <div id="joins-quiz">${DSL.Quiz.render([...QUIZ, ...QUIZ_MORE], "Joins review")}</div>
        </section>

        <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> before trusting a joined result, ask two questions. Which rows can this join drop? How many rows per key can it create?</p></div>
        ${DSL.lessonFooter("joins")}
      </article>`;

    progress.mount();
    Object.entries(CHALLENGES).forEach(([labId, list]) => {
      DSL.Sql.challenges(DSL.elements.root.querySelector(`[data-set="${labId}"]`), list, {
        storageKey: `joins-${labId}`,
        onAllDone: () => progress.complete(labId),
      });
    });
    DSL.Quiz.mount(document.getElementById("joins-quiz"), [...QUIZ, ...QUIZ_MORE], {
      noun: "call",
      passScore: 5,
      successTitle: "Joins review passed",
      successCopy: "You can say what a join keeps, drops, and repeats.",
      onComplete: ({ passed }) => { if (passed) progress.complete("quiz"); },
    });
  }

  DSL.JoinsModel = Object.freeze({ QUIZ, CHALLENGES, progress });
  DSL.registerRenderer("joins", renderJoins);
})(window.DataSystemsLab);
