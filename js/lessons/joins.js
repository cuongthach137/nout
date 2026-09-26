(function registerJoinsLesson(DSL) {
  "use strict";

  // Join types: what each join keeps, what it drops, and when it multiplies rows. Explore mode is
  // the full reference: three labs of graded exercises, notes, a cheat sheet, and the practice ending.
  // Narrated (joins-narrated.js) is the focused version; Guided (joins-guided.js) sits in between.

  const { wonder, labSide } = DSL.LabKit;
  const code = (sql) => `<code>${DSL.Sql.highlight(sql)}</code>`;
  const progress = DSL.LabKit.createProgress({
    lessonId: "joins",
    labs: [{ id: "match", name: `${DSL.labLabel("joins", "A")} Match` }, { id: "keep", name: `${DSL.labLabel("joins", "B")} Keep a side` }, { id: "multiply", name: `${DSL.labLabel("joins", "C")} Multiply` }, { id: "quiz", name: "Practice" }],
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

  // Goals, and the practice that checks them (js/components/practice.js). Every mode states the
  // goals at the start and ends with the recap, the checks and the interview round.
  const PRACTICE = {
    lessonId: "joins",
    goals: [
      {
        id: "match", icon: "🔗", title: "Match rows", snippet: "JOIN customers c ON c.id = o.customer_id",
        text: "Join tables on a key, and predict which rows an inner join drops.",
        recap: "The join condition after ON says which rows belong together. An <b>inner join</b> keeps only matched pairs: 16 orders in, 14 rows out, because the walk-ins have no customer.",
        example: {
          before: "SELECT id, customer_id FROM orders ORDER BY id",
          sql: "SELECT o.id, c.name FROM orders o JOIN customers c ON c.id = o.customer_id ORDER BY o.id",
          show: 5,
          mark: (row, phase) => (phase === "before" && row[1] === null ? "bad" : ""),
          note: "Walk-in #5 has no partner, so it's gone.",
        },
      },
      {
        id: "keep", icon: "🫱", title: "Keep a side", snippet: "LEFT JOIN orders o\n  ON … AND o.status = 'paid'",
        text: "Keep every row with LEFT JOIN, find rows with no match, and put right-side filters in ON.",
        recap: "A <b>left join</b> keeps every row of the first table, with NULLs where nothing matched: test for them to find who never ordered. Filter the right table in ON, or WHERE drops Lena.",
        example: {
          before: "SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.status = 'paid' ORDER BY c.name, o.id",
          sql: "SELECT c.name, o.id FROM customers c LEFT JOIN orders o ON o.customer_id = c.id AND o.status = 'paid' ORDER BY c.name, o.id",
          show: 5,
          mark: (row, phase) => (phase === "after" && row[1] === null ? "good" : ""),
          note: "Moved into ON, the test keeps Lena, with a NULL order.",
        },
      },
      {
        id: "multiply", icon: "✖️", title: "Count before you trust", snippet: "16 orders → 22 rows",
        text: "Predict how many rows a join makes, and spot fan-out and cross joins before they inflate a total.",
        recap: "Join orders to their items and each order repeats once per item: 16 orders become 22 rows. That's <b>fan-out</b>. With no condition at all, it's a <b>cross join</b>: 10 × 16 rows.",
        example: {
          before: "SELECT id, ordered_at FROM orders ORDER BY id",
          sql: "SELECT o.id, o.ordered_at, i.product_id FROM orders o JOIN order_items i ON i.order_id = o.id ORDER BY o.id, i.product_id",
          show: 5,
          mark: (row, phase) => (phase === "after" && (row[0] === 1 || row[0] === 3) ? "hot" : ""),
          note: "Orders #1 and #3 appear twice: once per item.",
        },
      },
    ],
    checks: [
      { id: "items-products", goal: "match", prompt: "<code>order_items</code> has 22 rows, <code>products</code> has 8, and Rye loaf has never sold. An inner join on <code>product_id</code> returns how many rows?", options: ["8", "22", "176"], answer: 1, why: "Each item points at exactly one product, so all 22 match. Rye loaf has no items, so it drops out without costing a row." },
      { id: "unsold-bug", goal: "keep", prompt: "\"Every product, with its order lines, including unsold ones\": <code>products p LEFT JOIN order_items i ON i.product_id = p.id WHERE i.quantity &gt; 0</code>. What's wrong?", options: ["Nothing: it's correct", "Rye loaf disappears: WHERE throws away its NULL-padded row", "It fails: you can't compare NULL"], answer: 1, why: "WHERE runs after the join, and a NULL quantity isn't greater than 0, so the left join turns back into an inner join. Put the test in ON." },
      { id: "maya-rows", goal: "multiply", prompt: "Maya has 4 orders, with 2, 2, 1 and 2 items. <code>customers JOIN orders JOIN order_items</code>: how many rows for Maya?", options: ["1", "4", "7"], answer: 2, why: "Every join repeats the rows before it once per match: 1 customer becomes 4 orders, and those become 2 + 2 + 1 + 2 = 7 rows." },
    ],
    warmups: [
      { id: "never-ordered", goal: "keep", prompt: "How would you find customers who have never placed an order?", options: ["<code>customers c JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL</code>", "<code>customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id IS NULL</code>", "<code>customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE o.id = NULL</code>"], answer: 1, why: "A left join keeps every customer; those with no order have NULL on the order side. <code>= NULL</code> is never true, and an inner join has no NULL rows to find. <code>NOT EXISTS</code> works too." },
      { id: "doubled", goal: "multiply", prompt: "A report's revenue doubled right after someone added a join. What's the likely cause?", options: ["The new join repeats each order once per matching row", "The left join added NULL rows", "The table's statistics are stale"], answer: 0, why: "A one-to-many join repeats each order per match, so its amount is added up more than once. Aggregate before joining, or count rows per key." },
    ],
    open: {
      id: "join-types",
      goal: "match",
      prompt: "Using customers and orders, explain what INNER, LEFT and FULL OUTER JOIN each return, and one mistake people make with joins.",
      points: [
        "<b>INNER</b>: only matched pairs. Customers with no orders and orders with no customer are both dropped.",
        "<b>LEFT</b>: every customer; the order columns are NULL where nothing matched.",
        "<b>FULL OUTER</b>: both sides whole, NULLs on whichever side has no partner. (RIGHT is LEFT mirrored.)",
        "NULL keys never match: <code>NULL = NULL</code> isn't true.",
        "A mistake: filtering the right table in WHERE turns a LEFT JOIN into an inner join; put it in ON.",
        "Another: a one-to-many join repeats rows (fan-out), so totals come out too big.",
      ],
      answer: "An inner join returns only customer–order pairs that match on the key, so customers who never ordered and orders with no customer both disappear. A left join from customers keeps every customer, with NULL order columns where there's no match; a full outer join keeps both sides, padding whichever is missing. A classic mistake is a left join followed by WHERE o.status = 'paid': the NULL-padded rows fail the test, so it silently becomes an inner join, and the fix is to move the condition into ON. Another is summing after a one-to-many join, where each order repeats once per item.",
    },
  };
  DSL.Practice.registerCards(PRACTICE);

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
        <div class="pr-intro"><p class="pr-kicker">By the end, you'll be able to</p>${DSL.Practice.cardsMarkup(PRACTICE, { compact: true })}</div>
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

        ${DSL.Practice.exploreMarkup(PRACTICE)}

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
    DSL.Practice.mountExplore(document.getElementById("lab-quiz"), PRACTICE, { onPass: () => progress.complete("quiz") });
  }

  DSL.JoinsModel = Object.freeze({ PRACTICE, CHALLENGES, progress });
  DSL.registerRenderer("joins", renderJoins);
})(window.DataSystemsLab);
