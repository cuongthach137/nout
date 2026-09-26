(function registerSelectLesson(DSL) {
  "use strict";

  // SELECT, filtering and sorting: the first SQL lesson. Explore mode is the full reference:
  // three labs of graded exercises on the bakery data, a cheat sheet, and a quiz. Narrated
  // (select-narrated.js) is the focused version; Guided (select-guided.js) sits in between.

  const { wonder, labSide } = DSL.LabKit;
  const hl = (sql) => DSL.Sql.highlight(sql);
  const code = (sql) => `<code>${hl(sql)}</code>`;
  const progress = DSL.LabKit.createProgress({
    lessonId: "select",
    labs: [{ id: "shape", name: `${DSL.labLabel("select", "A")} Shape` }, { id: "filter", name: `${DSL.labLabel("select", "B")} Filter` }, { id: "sort", name: `${DSL.labLabel("select", "C")} Sort & cut` }, { id: "quiz", name: "Quiz" }],
  });

  // Exercises, by lab. Each is graded against the rows its solution returns.
  const CHALLENGES = {
    shape: [
      { id: "phones", prompt: "The bakery wants to text every customer. Return each customer's <b>name</b> and <b>phone</b>.", starter: "SELECT \nFROM customers;", solution: "SELECT name, phone FROM customers", hint: "List the columns after SELECT, separated by a comma." },
      { id: "rise", prompt: "Prices go up 10%. Return each product's <b>name</b>, its <b>price</b>, and the new price as a column called <b>new_price</b>.", starter: "SELECT name, price\nFROM products;", solution: "SELECT name, price, price * 1.1 AS new_price FROM products", hint: "A column can be an expression: <code>price * 1.1</code>. Name it with <code>AS new_price</code>." },
      { id: "categories", prompt: "Which product <b>categories</b> does the bakery sell? Return each category once.", starter: "SELECT category\nFROM products;", solution: "SELECT DISTINCT category FROM products", hint: "<code>SELECT DISTINCT</code> keeps one copy of each row." },
    ],
    filter: [
      { id: "lisbon", prompt: "Return the <b>name</b> and <b>phone</b> of every customer in Lisbon.", starter: "SELECT name, phone\nFROM customers\nWHERE ", solution: "SELECT name, phone FROM customers WHERE city = 'Lisbon'", hint: "Text goes in single quotes: <code>city = 'Lisbon'</code>." },
      { id: "cheap", prompt: "Products under 4.00: return their <b>name</b> and <b>price</b>.", starter: "SELECT name, price\nFROM products\nWHERE ", solution: "SELECT name, price FROM products WHERE price < 4", hint: "Numbers don't take quotes: <code>price &lt; 4</code>." },
      { id: "week", prompt: "Orders placed from <b>2024-09-10</b> to <b>2024-09-15</b>, both days included: return <b>id</b> and <b>ordered_at</b>.", starter: "SELECT id, ordered_at\nFROM orders\nWHERE ", solution: "SELECT id, ordered_at FROM orders WHERE ordered_at BETWEEN '2024-09-10' AND '2024-09-15'", hint: "<code>BETWEEN a AND b</code> includes both ends. Dates stored as <code>YYYY-MM-DD</code> text sort correctly." },
      { id: "loaves", prompt: "Every product with <b>loaf</b> in its name: return the <b>name</b>.", starter: "SELECT name\nFROM products\nWHERE ", solution: "SELECT name FROM products WHERE name LIKE '%loaf%'", hint: "<code>LIKE</code> matches patterns: <code>%</code> stands for any run of characters." },
      { id: "no-phone", prompt: "Customers the bakery can't text: return the <b>name</b> of everyone with no phone.", starter: "SELECT name\nFROM customers\nWHERE ", solution: "SELECT name FROM customers WHERE phone IS NULL", hint: "<code>phone = NULL</code> is never true, not even for a missing phone. Use <code>IS NULL</code>." },
      { id: "maya", prompt: "Maya (customer 1) says an order never arrived. Return the <b>id</b> and <b>status</b> of her orders that are <b>pending</b> or <b>refunded</b>.", starter: "SELECT id, status\nFROM orders\nWHERE ", solution: "SELECT id, status FROM orders WHERE customer_id = 1 AND status IN ('pending', 'refunded')", hint: "AND binds tighter than OR. Use brackets, or <code>status IN ('pending', 'refunded')</code>." },
    ],
    sort: [
      { id: "top3", prompt: "For the menu board: the three most expensive products, priciest first. Return <b>name</b> and <b>price</b>.", starter: "SELECT name, price\nFROM products\n", solution: "SELECT name, price FROM products ORDER BY price DESC LIMIT 3", ordered: true, hint: "<code>ORDER BY price DESC</code>, then <code>LIMIT 3</code>." },
      { id: "recent", prompt: "The three most recent orders, newest first. Return <b>id</b> and <b>ordered_at</b>.", starter: "", solution: "SELECT id, ordered_at FROM orders ORDER BY ordered_at DESC LIMIT 3", ordered: true, hint: "Sort by <code>ordered_at</code>, descending, then cut." },
      { id: "two-keys", prompt: "Customers in Lisbon or Osaka, sorted by <b>city</b>, and by <b>name</b> within each city. Return <b>city</b> and <b>name</b>.", starter: "SELECT city, name\nFROM customers\n", solution: "SELECT city, name FROM customers WHERE city IN ('Lisbon', 'Osaka') ORDER BY city, name", ordered: true, hint: "<code>ORDER BY city, name</code>: the second key only breaks ties in the first." },
      { id: "page2", prompt: "The product list shows 3 per page, sorted by name. Return the <b>name</b>s on <b>page 2</b>.", starter: "SELECT name\nFROM products\nORDER BY name\n", solution: "SELECT name FROM products ORDER BY name LIMIT 3 OFFSET 3", ordered: true, hint: "<code>OFFSET 3</code> skips the first page. <code>LIMIT 3 OFFSET 3</code>." },
    ],
  };

  // Narrated and Guided ask these four; Explore adds two more.
  const QUIZ = [
    { prompt: "Which query returns each city exactly once?", options: ["SELECT city FROM customers", "SELECT DISTINCT city FROM customers", "SELECT city FROM customers LIMIT 1"], answer: 1, why: "DISTINCT collapses repeated rows. LIMIT would just cut the list short." },
    { prompt: "How does SQL read <code>WHERE a = 1 AND b = 2 OR c = 3</code>?", options: ["a = 1 AND (b = 2 OR c = 3)", "(a = 1 AND b = 2) OR c = 3", "It's a syntax error"], answer: 1, why: "AND binds tighter than OR, so it's grouped first. Add brackets to say what you mean." },
    { prompt: "A query ends in <code>LIMIT 10</code>, with no ORDER BY. Which ten rows come back?", options: ["The first ten inserted", "The ten with the smallest IDs", "Any ten: the order isn't guaranteed"], answer: 2, why: "With no ORDER BY there's no promised order. Sort first, then cut." },
    { prompt: "<code>SELECT price * 2 AS doubled FROM products WHERE doubled &gt; 10</code> fails in PostgreSQL. Why?", options: ["Aliases can't contain numbers", "WHERE runs before SELECT, so the alias doesn't exist yet", "You can't do arithmetic in SELECT"], answer: 1, why: "WHERE runs before SELECT, so the alias doesn't exist yet. Repeat the expression in WHERE instead." },
  ];
  const QUIZ_MORE = [
    { prompt: "<code>WHERE phone = NULL</code> returns…", options: ["Customers with no phone", "No rows at all", "An error"], answer: 1, why: "Comparing anything with NULL gives unknown, never true, so no row passes. Use IS NULL." },
    { prompt: "20 results per page. Which clause gets page 3?", options: ["LIMIT 20 OFFSET 40", "LIMIT 60", "LIMIT 3 OFFSET 20"], answer: 0, why: "Skip two pages (40 rows), then take 20. With a stable ORDER BY, or pages can overlap." },
  ];

  const ORDER = [["FROM", "pick the table"], ["WHERE", "keep rows that pass the test"], ["SELECT", "compute the columns, name aliases"], ["DISTINCT", "drop repeated rows"], ["ORDER BY", "sort (aliases work here)"], ["LIMIT / OFFSET", "cut to a page"]];
  const OPERATORS = [
    ["=  <>", "equal, not equal", "city = 'Lisbon'"],
    ["<  <=  >  >=", "compare numbers, dates, text", "price < 4"],
    ["BETWEEN a AND b", "inclusive range", "ordered_at BETWEEN '2024-09-10' AND '2024-09-15'"],
    ["IN (…)", "matches any value in a list", "status IN ('pending', 'refunded')"],
    ["LIKE", "pattern: % any run, _ one character", "name LIKE '%loaf%'"],
    ["IS NULL", "value is missing (= NULL never matches)", "phone IS NULL"],
    ["AND  OR  NOT", "combine tests; AND binds before OR", "a AND (b OR c)"],
  ];

  function labSection(id, kicker, title, copy, body) {
    return `<section class="lab" id="lab-${id}">
      <div class="lab-top"><div><span class="lab-kicker">${kicker}</span><h2>${title}</h2><p class="lab-copy">${copy}</p></div>${labSide(DSL.labLabel("select", { shape: "A", filter: "B", sort: "C" }[id]))}</div>
      ${body}
      <div class="sel-set" data-set="${id}"></div>
    </section>`;
  }

  function renderSelect() {
    const lesson = DSL.getLesson("select");
    DSL.elements.root.innerHTML = `
      <article class="lesson sel">
        ${DSL.lessonHeader(lesson, "Ask the tables: <em>SELECT</em>, filter, sort.", "Maya's bakery runs on four tables. Here you'll write the queries every SQL interview starts with: pick columns, keep the right rows, and return them in order.")}
        ${progress.markup()}

        <div class="insight"><span class="insight-mark">//</span><p>Every query here runs for real, on SQLite in your browser, against a fresh copy of the bakery's data. Break anything you like. Tables: <code>customers</code>, <code>products</code>, <code>orders</code>, <code>order_items</code>.</p></div>

        ${labSection("shape", "Shape the answer", "SELECT picks columns. The answer is a table.", "A query describes the result you want, not how to find it: SQL is <b>declarative</b>. The answer, the <b>result set</b>, is itself a table, so you can compute columns, rename them, and remove repeated rows.", `
          <div class="sel-notes">
            <div><h3>Columns and <code>*</code></h3><p><code>SELECT *</code> returns every column: fine for a quick look. In application code, list the columns you need. Then adding a column to the table can't change your result or slow the query down, and a covering index can answer it.</p></div>
            <div><h3>Expressions and aliases</h3><p>${code("SELECT name, price * 1.1 AS new_price")} computes a column. <code>AS</code> gives it a name, an <b>alias</b>. Aliases also shorten tables: ${code("FROM customers AS c")}.</p></div>
            <div><h3>DISTINCT</h3><p>${code("SELECT DISTINCT city")} keeps one copy of each row. It applies to the whole row: <code>SELECT DISTINCT city, name</code> removes only rows where both match. NULL counts as one value here, so a missing city shows up once.</p></div>
          </div>`)}

        ${labSection("filter", "Filter rows", "WHERE keeps the rows that pass a test.", "The database checks the <b>predicate</b> after WHERE against every row and keeps the ones where it's true. Text goes in single quotes, numbers don't.", `
          <div class="sel-ops"><table class="sel-table"><thead><tr><th>Operator</th><th>Means</th><th>Example</th></tr></thead><tbody>${OPERATORS.map(([op, means, example]) => `<tr><td><code>${op.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></td><td>${means}</td><td>${code(example)}</td></tr>`).join("")}</tbody></table></div>
          ${wonder("Why does <code>a = 1 AND b = 2 OR c = 3</code> surprise people?", "AND binds tighter than OR, the way × binds tighter than +. So it means <code>(a = 1 AND b = 2) OR c = 3</code>. Whenever you mix them, add brackets, even when the default happens to be what you meant. The next reader will thank you.")}
          ${wonder("Why doesn't <code>phone = NULL</code> find anything?", "NULL means “unknown”. Is an unknown phone equal to an unknown phone? Unknown. WHERE keeps only rows where the test is <b>true</b>, so no row passes. Use <code>IS NULL</code> and <code>IS NOT NULL</code>. The NULL traps lesson goes deeper.")}`)}

        ${labSection("sort", "Sort and cut", "ORDER BY sorts. LIMIT keeps the top.", "Without ORDER BY, rows come back in whatever order is cheapest for the engine. It often looks like insertion order, until an update, a new index, or a parallel scan changes it. Sort first, then cut with LIMIT.", `
          <div class="sel-notes">
            <div><h3>Several sort keys</h3><p>${code("ORDER BY city, name")} sorts by city, and by name only to break ties within a city. Each key takes its own direction: ${code("ORDER BY price DESC, name")}.</p></div>
            <div><h3>Where NULLs go</h3><p>Engines disagree. SQLite and MySQL sort NULL <b>first</b> in ascending order, PostgreSQL <b>last</b>. PostgreSQL and SQLite accept <code>NULLS FIRST</code> / <code>NULLS LAST</code> to say it outright.</p></div>
            <div><h3>Pages</h3><p>${code("LIMIT 20 OFFSET 40")} is page 3 of 20. The sort must be stable (add a unique key like <code>id</code> as the last sort key), or rows can repeat or vanish between pages. Deep offsets get slow: the engine still walks every skipped row.</p></div>
          </div>`)}

        <section class="lab sel-cheat">
          <div class="lab-top"><div><span class="lab-kicker">Cheat sheet</span><h2>Written order vs. the order it runs</h2><p class="lab-copy">You write <code>SELECT</code> first, but the database evaluates the clauses in a different, <b>logical</b> order. It explains which names are visible where: an alias made in SELECT works in ORDER BY, but not in WHERE.</p></div></div>
          <ol class="sel-order">${ORDER.map(([clause, what], i) => `<li style="--i:${i}"><b>${clause}</b><span>${what}</span></li>`).join("")}</ol>
          <p class="sel-footnote">SQLite, the engine in this course, lets an alias slip into WHERE. PostgreSQL and MySQL reject it, so don't rely on it in an interview.</p>
        </section>

        <section class="lab" id="lab-quiz">
          <div class="lab-top"><div><span class="lab-kicker">Check yourself</span><h2>Six calls about SELECT</h2><p class="lab-copy">The kind of questions that open a SQL interview.</p></div><div class="lab-side"><button class="button" type="button" data-quiz-reset>Reset answers</button>${DSL.LabKit.stamp()}</div></div>
          <div id="select-quiz">${DSL.Quiz.render([...QUIZ, ...QUIZ_MORE], "SELECT review")}</div>
        </section>

        <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> a query is a description of a table. Name the columns, state the test, fix the order, and let the database choose how.</p></div>
        ${DSL.lessonFooter("select")}
      </article>`;

    progress.mount();
    Object.entries(CHALLENGES).forEach(([labId, list]) => {
      DSL.Sql.challenges(DSL.elements.root.querySelector(`[data-set="${labId}"]`), list, {
        storageKey: `select-${labId}`,
        onAllDone: () => progress.complete(labId),
      });
    });
    DSL.Quiz.mount(document.getElementById("select-quiz"), [...QUIZ, ...QUIZ_MORE], {
      noun: "call",
      passScore: 5,
      successTitle: "SELECT review passed",
      successCopy: "You can shape, filter and sort a result, and explain why.",
      onComplete: ({ passed }) => { if (passed) progress.complete("quiz"); },
    });
  }

  DSL.SelectModel = Object.freeze({ QUIZ, CHALLENGES, progress });
  DSL.registerRenderer("select", renderSelect);
})(window.DataSystemsLab);
