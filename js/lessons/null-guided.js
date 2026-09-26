(function registerNullGuided(DSL) {
  "use strict";

  // Guided mode for NULL traps. Query boards run real queries and add a column that shows what
  // each row's test evaluates to (TRUE, FALSE or UNKNOWN), so the learner sees which rows WHERE
  // keeps. Scenes are shared with Narrated mode (DSL.NullScenes).

  const { board, predictBeat, challengeBeat, teach, slice } = DSL.SqlScenes;
  const hl = (sql) => DSL.Sql.highlight(sql);

  // SQL that labels a condition's result for each row.
  const truth = (cond) => `CASE WHEN ${cond} THEN 'TRUE' WHEN NOT (${cond}) THEN 'FALSE' ELSE 'UNKNOWN' END`;
  const tint = (col) => (row) => ({ TRUE: "sq-pass", FALSE: "sq-fail", UNKNOWN: "sq-dup" })[row[col]] || "";
  const SPEND = "WITH spend AS (\n  SELECT c.name, SUM(i.quantity * p.price) AS total\n  FROM customers c\n  LEFT JOIN orders o ON o.customer_id = c.id\n  LEFT JOIN order_items i ON i.order_id = o.id\n  LEFT JOIN products p ON p.id = i.product_id\n  GROUP BY c.id\n)\n";

  const Q = {
    eqNull: "SELECT name\nFROM customers\nWHERE city = NULL;",
    eqNullTruth: `SELECT name, city, ${truth("city = NULL")} AS test FROM customers ORDER BY id`,
    isNull: "SELECT name\nFROM customers\nWHERE city IS NULL;",
    notLisbon: "SELECT name\nFROM customers\nWHERE city <> 'Lisbon';",
    notLisbonTruth: `SELECT name, city, ${truth("city <> 'Lisbon'")} AS test FROM customers ORDER BY id`,
    notLisbonFixed: "SELECT name\nFROM customers\nWHERE city <> 'Lisbon'\n   OR city IS NULL;",
    notIn: "SELECT name\nFROM customers\nWHERE id NOT IN (\n  SELECT customer_id FROM orders\n);",
    notExists: "SELECT name\nFROM customers c\nWHERE NOT EXISTS (\n  SELECT 1 FROM orders o\n  WHERE o.customer_id = c.id\n);",
    message: "SELECT name,\n       'Call ' || name || ' on ' || phone AS message,\n       10 + NULL AS ten_plus_null\nFROM customers;",
    coalesce: "SELECT name,\n       'Call ' || name || ' on '\n         || COALESCE(phone, 'no phone') AS message\nFROM customers;",
    spend: `${SPEND}SELECT name, total FROM spend;`,
    avgs: `${SPEND}SELECT AVG(total) AS avg_buyers,\n       AVG(COALESCE(total, 0)) AS avg_all,\n       COUNT(total) AS buyers,\n       COUNT(*) AS customers\nFROM spend;`,
  };

  // A small chip under the result: "0 rows", "Missing: Raj".
  function chip(b, html, tone = "") {
    b.stage.querySelectorAll(".nl-chip").forEach((el) => el.remove());
    b.grid.insertAdjacentHTML("afterend", `<div class="nl-chip ${tone}">${html}</div>`);
  }

  // ---------- Storyboards ----------

  function unknownStory() {
    return {
      build: (stage) => board(stage, { label: "result set" }),
      frames: [
        {
          caption: "Find customers with no city. The obvious query says <b>city = NULL</b>. Nothing comes back, not even Raj.",
          async enter(b, a) { await a.after(b.code(Q.eqNull, { type: true })); await a.after(b.show(Q.eqNull)); chip(b, "0 rows", "bad"); },
        },
        {
          caption: "Is an unknown city equal to unknown? Nobody knows: the test is <b>UNKNOWN</b> for every row. SQL has three truth values, and WHERE keeps only TRUE.",
          async enter(b, a) { b.code(Q.eqNull); await a.after(b.show(Q.eqNullTruth, { label: "what WHERE sees", mark: tint(2) })); },
        },
        {
          caption: "To find missing values, ask directly: <b>city IS NULL</b>. There's Raj.",
          async enter(b, a) { await a.after(b.code(Q.isNull, { type: true })); await a.after(b.show(Q.isNull, { mark: () => "sq-pass" })); },
        },
      ],
    };
  }

  function notStory() {
    return {
      build: (stage) => board(stage, { label: "result set" }),
      frames: [
        {
          caption: "<b>city &lt;&gt; 'Lisbon'</b>, row by row: TRUE for the six elsewhere, FALSE for Lisbon, and <b>UNKNOWN</b> for Raj.",
          async enter(b, a) { b.code(Q.notLisbon); await a.after(b.show(Q.notLisbonTruth, { label: "what WHERE sees", mark: tint(2) })); },
        },
        {
          caption: "So six rows, and Raj is missing again. Is his unknown city different from Lisbon? Unknown, so WHERE drops him.",
          async enter(b, a) { b.code(Q.notLisbon); await a.after(b.show(Q.notLisbon, { mark: () => "sq-pass" })); chip(b, "Missing: <b>Raj</b>", "bad"); },
        },
        {
          caption: "Say what you mean: <b>OR city IS NULL</b>. Seven. <b>IS DISTINCT FROM</b> does the same in one comparison; SQLite spells it <b>IS NOT</b>.",
          async enter(b, a) { await a.after(b.code(Q.notLisbonFixed, { type: true })); await a.after(b.show(Q.notLisbonFixed, { mark: (row) => (row[0] === "Raj" ? "sq-hot" : "sq-pass") })); },
        },
      ],
    };
  }

  function notinStory() {
    return {
      build: (stage) => board(stage, { label: "the list: customer_id on orders" }),
      frames: [
        {
          caption: "Customers who never ordered: <b>id NOT IN</b> the customer IDs on orders. Here's that list. The walk-in orders put two <b>NULL</b>s in it.",
          async enter(b, a) { b.code(Q.notIn); await a.after(b.show("SELECT customer_id FROM orders ORDER BY id", { label: "the list: customer_id on orders", mark: (row) => (row[0] === null ? "sq-dup" : "") })); },
        },
        {
          caption: "No rows at all, even though Lena and Theo never ordered.",
          async enter(b, a) { b.code(Q.notIn); await a.after(b.show(Q.notIn, { label: "result set" })); chip(b, "0 rows", "bad"); },
        },
        {
          caption: "<b>NOT IN</b> means: not 1, and not 2, … and not NULL. That last part is UNKNOWN for everyone. Customers who ordered come out FALSE; Lena and Theo come out UNKNOWN. Nobody is TRUE.",
          async enter(b, a) {
            b.code("id <> 1 AND id <> 2 AND id <> 3 AND …\n  AND id <> NULL   -- UNKNOWN, for everyone\n-- ordered: FALSE; never ordered: UNKNOWN");
            await a.after(b.show(`SELECT name, ${truth("id NOT IN (SELECT customer_id FROM orders)")} AS "NOT IN" FROM customers ORDER BY id`, { label: "what WHERE sees", mark: tint(1) }));
          },
        },
        {
          caption: "The fix: <b>NOT EXISTS</b>, which has no such problem. Lena and Theo. (Or keep NOT IN, and filter the NULLs out of the list.)",
          async enter(b, a) { await a.after(b.code(Q.notExists, { type: true })); await a.after(b.show(Q.notExists, { mark: () => "sq-pass" })); },
        },
      ],
    };
  }

  function exprStory() {
    return {
      build: (stage) => board(stage, { label: "result set" }),
      frames: [
        {
          caption: "NULL spreads through expressions. Omar, Kofi and Ines have no phone, so their whole message is NULL. And 10 + NULL is NULL.",
          async enter(b, a) { await a.after(b.code(Q.message, { type: true })); await a.after(b.show(Q.message.replace(";", " ORDER BY id;"), { mark: (row) => (row[1] === null ? "sq-dup" : "") })); },
        },
        {
          caption: "<b>COALESCE</b> returns its first argument that isn't NULL: <b>COALESCE(phone, 'no phone')</b>.",
          async enter(b, a) { await a.after(b.code(Q.coalesce, { type: true })); await a.after(b.show(Q.coalesce.replace(";", " ORDER BY id;"), { mark: (row) => (/no phone/.test(row[1]) ? "sq-hot" : "") })); },
        },
      ],
    };
  }

  function avgStory() {
    return {
      build: (stage) => board(stage, { label: "spend per customer" }),
      frames: [
        {
          caption: "Spend per customer. Lena and Theo never ordered, so their total is <b>NULL</b>, not 0.",
          async enter(b, a) { b.code(Q.spend); await a.after(b.show(Q.spend, { label: "spend per customer", mark: (row) => (row[1] === null ? "sq-dup" : "") })); },
        },
        {
          caption: "AVG skips NULLs: <b>18.41</b>, over 8 buyers. Count them as 0 and it's <b>14.72</b>, over 10 customers. Decide what the question means, then say it in SQL.",
          async enter(b, a) { await a.after(b.code(Q.avgs, { type: true })); await a.after(b.show(Q.avgs, { mark: () => "sq-hot" })); },
        },
      ],
    };
  }

  // ---------- Beats ----------

  const notPredict = () => predictBeat({
    id: "not-lisbon",
    prompt: "Ten customers, three in Lisbon. How many rows?",
    why: "Raj's city is NULL: unknown.",
    question: `<pre class="sq-code">${hl(Q.notLisbon)}</pre>`,
    options: [["7", "7"], ["6", "6"], ["3", "3"]],
    answer: "6",
    explain: { right: "Six: Raj's unknown city isn't \"different from Lisbon\", it's unknown.", wrong: "Six. Seven is the right answer to the question, but Raj's unknown city fails the test." },
  });

  const notinPredict = () => predictBeat({
    id: "not-in",
    prompt: "Lena and Theo never ordered. How many rows?",
    why: "Look at what's in the list: the walk-in orders have no customer.",
    question: `<pre class="sq-code">${hl(Q.notIn)}</pre>`,
    options: [["2", "2"], ["0", "0"], ["10", "10"]],
    answer: "0",
    explain: { right: "Zero. You know this one.", wrong: "Zero. It should be two, but a NULL in the list breaks NOT IN." },
  });

  const awayChallenge = () => challengeBeat({
    id: "away",
    prompt: "Your turn: everyone outside Lisbon.",
    why: "<> drops rows where the column is NULL. Add them back explicitly.",
    task: "Every customer who <b>isn't in Lisbon</b>, including anyone whose city is unknown: return their <b>name</b>.",
    starter: "SELECT name\nFROM customers\nWHERE city <> 'Lisbon';",
    solution: "SELECT name FROM customers WHERE city <> 'Lisbon' OR city IS NULL",
  });

  const neverChallenge = () => challengeBeat({
    id: "never",
    prompt: "Your turn: fix the NOT IN.",
    why: "Either NOT EXISTS, or a WHERE customer_id IS NOT NULL inside the subquery.",
    task: "This query should find <b>Lena</b> and <b>Theo</b>, but returns nothing. Fix it.",
    starter: "SELECT name\nFROM customers\nWHERE id NOT IN (\n  SELECT customer_id FROM orders\n);",
    solution: "SELECT name FROM customers c WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id)",
  });

  const phoneChallenge = () => challengeBeat({
    id: "phone",
    prompt: "Your turn: a default for missing phones.",
    why: "COALESCE takes the first non-NULL argument, so it's the phone when there is one.",
    task: "Every customer's <b>name</b> and phone, showing <b>no phone</b> where it's missing.",
    starter: "SELECT name,\n       \nFROM customers;",
    solution: "SELECT name, COALESCE(phone, 'no phone') FROM customers",
  });

  function makeBeats() {
    const M = DSL.NullModel;
    return [
      teach("teach-unknown", "NULL means unknown.", unknownStory(), "IS NULL and IS NOT NULL are the only tests that return TRUE or FALSE for a NULL. Everything else (=, <>, <, IN) gives UNKNOWN."),
      notPredict(),
      teach("teach-not", "Not equal drops NULLs.", notStory(), "NOT doesn't help: NOT UNKNOWN is still UNKNOWN."),
      awayChallenge(),
      teach("teach-notin-list", "Customers who never ordered.", slice(notinStory(), 0, 1)),
      notinPredict(),
      teach("teach-notin", "The NOT IN trap.", slice(notinStory(), 1, 4), "IN is fine: x IN (1, 2, NULL) is still TRUE for x = 1. Only NOT IN collapses."),
      neverChallenge(),
      teach("teach-expr", "NULL spreads.", exprStory(), "NULLIF(a, b) goes the other way: NULL when a = b. total / NULLIF(n, 0) avoids a divide-by-zero."),
      teach("teach-avg", "NULL in averages.", avgStory(), "SUM over no rows is NULL too; only COUNT returns 0. Reports usually want COALESCE(SUM(x), 0)."),
      phoneChallenge(),
      DSL.Guided.quizBeat({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Guided.finishBeat({
        lessonId: "null",
        badges: [["❓", "Unknown", "test with IS NULL"], ["🚫", "NOT IN", "breaks on a NULL"], ["🩹", "COALESCE", "a default, on purpose"]],
      }),
    ];
  }

  DSL.NullScenes = Object.freeze({ Q, unknownStory, notStory, notinStory, exprStory, avgStory, awayChallenge, neverChallenge, phoneChallenge, beats: makeBeats });

  DSL.registerGuided("null", () => DSL.Guided.run({
    lessonId: "null",
    title: `${DSL.lessonNumber("null")} · NULL traps`,
    beats: makeBeats(),
  }));
})(window.DataSystemsLab);
