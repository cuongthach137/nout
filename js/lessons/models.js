(function registerModelsLesson(DSL) {
  "use strict";

  // Relational, document and graph models, all on SQLite: order_docs holds the orders as JSON
  // documents, referrals holds a who-brought-whom graph. Explore is the full reference; Narrated
  // (models-narrated.js) is the focused version and Guided (models-guided.js) sits in between.

  const { wonder, labSide } = DSL.LabKit;
  const code = (sql) => `<code>${DSL.Sql.highlight(sql)}</code>`;
  const progress = DSL.LabKit.createProgress({
    lessonId: "models",
    labs: [{ id: "docs", name: `${DSL.labLabel("models", "A")} Documents` }, { id: "shape", name: `${DSL.labLabel("models", "B")} Schema on read` }, { id: "graph", name: `${DSL.labLabel("models", "C")} Graphs` }, { id: "quiz", name: "Quiz" }],
  });
  const D = "bakeryModels";
  const NET = "WITH RECURSIVE net(id) AS (\n  SELECT referred_id FROM referrals WHERE referrer_id = 1\n  UNION ALL\n  ";

  const CHALLENGES = {
    docs: [
      { id: "names", dataset: D, prompt: "From <b>order_docs</b>, return each order's <b>id</b> and the customer's <b>name</b> (NULL for walk-ins).", starter: "SELECT id, \nFROM order_docs;", solution: "SELECT id, json_extract(doc, '$.customer.name') FROM order_docs", hint: "<code>json_extract(doc, '$.customer.name')</code>: a path into the document." },
      { id: "maya-docs", dataset: D, prompt: "How many documents contain a copy of Maya's details? One value.", starter: "SELECT COUNT(*)\nFROM order_docs\nWHERE ", solution: "SELECT COUNT(*) FROM order_docs WHERE json_extract(doc, '$.customer.id') = 1", hint: "Match on <code>json_extract(doc, '$.customer.id') = 1</code> (or her name)." },
      { id: "new-phone", dataset: D, prompt: "Maya's new number is <b>555-9999</b>. Update <b>every</b> document that holds her details, then return the <b>id</b> and phone of each of her documents.", starter: "UPDATE order_docs\nSET doc = json_set(doc, '$.customer.phone', '555-9999')\nWHERE ;\n\nSELECT id, json_extract(doc, '$.customer.phone')\nFROM order_docs\nWHERE json_extract(doc, '$.customer.id') = 1;", solution: "UPDATE order_docs SET doc = json_set(doc, '$.customer.phone', '555-9999') WHERE json_extract(doc, '$.customer.id') = 1; SELECT id, json_extract(doc, '$.customer.phone') FROM order_docs WHERE json_extract(doc, '$.customer.id') = 1", hint: "The same condition in the UPDATE's WHERE. One fact, four copies: in the tables it was one UPDATE of one row." },
      { id: "croissant", dataset: D, prompt: "Orders whose items include a <b>Croissant</b>: return the order <b>id</b>.", starter: "SELECT d.id\nFROM order_docs d\nWHERE EXISTS (\n  SELECT 1 FROM json_each(d.doc, '$.items')\n  WHERE \n);", solution: "SELECT d.id FROM order_docs d WHERE EXISTS (SELECT 1 FROM json_each(d.doc, '$.items') WHERE json_extract(value, '$.product') = 'Croissant')", hint: "<code>json_each</code> turns the items array into rows; each row's <code>value</code> is one item: <code>json_extract(value, '$.product') = 'Croissant'</code>." },
    ],
    shape: [
      { id: "notes", dataset: D, prompt: "Some documents carry a <b>note</b> no schema declared. Return the <b>id</b> and note of every order that has one.", starter: "SELECT id, json_extract(doc, '$.note')\nFROM order_docs\n", solution: "SELECT id, json_extract(doc, '$.note') FROM order_docs WHERE json_extract(doc, '$.note') IS NOT NULL", hint: "A missing field reads as NULL: <code>WHERE json_extract(doc, '$.note') IS NOT NULL</code>." },
      { id: "item-count", dataset: D, prompt: "How many items does each order document hold? Return <b>id</b> and the count.", starter: "SELECT id, \nFROM order_docs;", solution: "SELECT id, json_array_length(doc, '$.items') FROM order_docs", hint: "<code>json_array_length(doc, '$.items')</code>" },
      { id: "doc-revenue", dataset: D, prompt: "Total revenue across <b>all documents</b> (price × quantity of every item). One value.", starter: "SELECT SUM(\n  \n)\nFROM order_docs, json_each(order_docs.doc, '$.items');", solution: "SELECT SUM(json_extract(value, '$.price') * json_extract(value, '$.quantity')) FROM order_docs, json_each(order_docs.doc, '$.items')", hint: "Each <code>value</code> is an item: <code>json_extract(value, '$.price') * json_extract(value, '$.quantity')</code>. It should match the tables: 161.25." },
    ],
    graph: [
      { id: "direct", dataset: D, prompt: "Who did <b>Maya</b> (customer 1) refer directly? Return their <b>name</b>.", starter: "SELECT c.name\nFROM referrals r\nJOIN customers c ON ", solution: "SELECT c.name FROM referrals r JOIN customers c ON c.id = r.referred_id WHERE r.referrer_id = 1", hint: "One hop: <code>JOIN customers c ON c.id = r.referred_id WHERE r.referrer_id = 1</code>." },
      { id: "network", dataset: D, prompt: "Everyone Maya brought in, <b>at any depth</b>: return their <b>name</b>.", starter: `${NET}\n)\nSELECT c.name\nFROM net\nJOIN customers c ON c.id = net.id;`, solution: `${NET}SELECT r.referred_id FROM referrals r JOIN net ON r.referrer_id = net.id\n) SELECT c.name FROM net JOIN customers c ON c.id = net.id`, hint: "The recursive step: <code>SELECT r.referred_id FROM referrals r JOIN net ON r.referrer_id = net.id</code>." },
      { id: "upstream", dataset: D, prompt: "Walk the other way: who led to <b>Priya</b> (customer 10)? Return every referrer up the chain, by <b>name</b>.", starter: "WITH RECURSIVE up(id) AS (\n  SELECT referrer_id FROM referrals WHERE referred_id = 10\n  UNION ALL\n  \n)\nSELECT c.name\nFROM up\nJOIN customers c ON c.id = up.id;", solution: "WITH RECURSIVE up(id) AS (SELECT referrer_id FROM referrals WHERE referred_id = 10 UNION ALL SELECT r.referrer_id FROM referrals r JOIN up ON r.referred_id = up.id) SELECT c.name FROM up JOIN customers c ON c.id = up.id", hint: "Follow edges backwards: <code>SELECT r.referrer_id FROM referrals r JOIN up ON r.referred_id = up.id</code>." },
      { id: "depth", dataset: D, prompt: "Maya's network with how many hops away each person is: return <b>name</b> and <b>depth</b>.", starter: "WITH RECURSIVE net(id, depth) AS (\n  SELECT referred_id, 1 FROM referrals WHERE referrer_id = 1\n  UNION ALL\n  \n)\nSELECT c.name, net.depth\nFROM net\nJOIN customers c ON c.id = net.id;", solution: "WITH RECURSIVE net(id, depth) AS (SELECT referred_id, 1 FROM referrals WHERE referrer_id = 1 UNION ALL SELECT r.referred_id, net.depth + 1 FROM referrals r JOIN net ON r.referrer_id = net.id) SELECT c.name, net.depth FROM net JOIN customers c ON c.id = net.id", hint: "Carry a counter: <code>SELECT r.referred_id, net.depth + 1 …</code>." },
    ],
  };

  const QUIZ = [
    { prompt: "Why is a document store fast at showing a whole order?", options: ["It uses better indexes", "Everything the page needs is embedded in one document: one read, no joins", "JSON is faster to parse than rows"], answer: 1, why: "Everything is embedded in one document, so it's one read with no joins. That's data locality." },
    { prompt: "A customer's details are embedded in each of her orders. What goes wrong when she moves?", options: ["Nothing: documents update themselves", "Every copy must be updated, and a missed one disagrees", "The old orders are deleted"], answer: 1, why: "Every copy must be updated. Miss one and the documents disagree: the update anomaly again." },
    { prompt: "What does schema on read mean?", options: ["The database has no schema at all", "Writes accept any shape; the reading code copes with each variant", "The schema is checked each time a row is read"], answer: 1, why: "Writes accept any shape; readers interpret it. Tables check on write instead." },
    { prompt: "Which question most needs a graph model?", options: ["Total revenue per month", "Show one order with its items", "Who's connected to Maya within three hops"], answer: 2, why: "Following links to an unknown depth is a traversal: the graph model's strength." },
  ];
  const QUIZ_MORE = [
    { prompt: "PostgreSQL's <code>jsonb</code> columns mean…", options: ["PostgreSQL became a document database", "Documents can live inside a relational database, with indexes and queries on their fields", "JSON is converted to tables on insert"], answer: 1, why: "The models converge: relational databases store and index documents, and document databases add joins. Choose by access pattern, not by product." },
    { prompt: "SQL can traverse a graph with a recursive CTE. Why use a graph database?", options: ["SQL can't follow edges", "Graph databases store edges for fast hops and have query languages built for paths (like Cypher)", "Graph databases don't need indexes"], answer: 1, why: "Deep or variable-length traversals, path finding and pattern matching are what graph engines and languages like Cypher are built for." },
  ];

  const COMPARE = [
    ["Relational", "each fact once; joins on read", "many-to-many data, reports, constraints", "joins on every read; schema changes are migrations"],
    ["Document", "one tree per record, embedded", "whole-record reads: an order, a profile", "copies to keep in sync; weak joins; readers handle old shapes"],
    ["Graph", "nodes and edges", "links to any depth: friends, routes, fraud rings", "aggregates and bulk reports are awkward"],
  ];

  function labSection(id, letter, kicker, title, copy, body) {
    return `<section class="lab" id="lab-${id}">
      <div class="lab-top"><div><span class="lab-kicker">${kicker}</span><h2>${title}</h2><p class="lab-copy">${copy}</p></div>${labSide(DSL.labLabel("models", letter))}</div>
      ${body}
      <div class="sel-set" data-set="${id}"></div>
    </section>`;
  }

  function renderModels() {
    const lesson = DSL.getLesson("models");
    DSL.elements.root.innerHTML = `
      <article class="lesson sel">
        ${DSL.lessonHeader(lesson, "Tables, documents, and <em>graphs</em>.", "The same bakery in three shapes. Each makes some questions easy and others painful. \"When would you use a document store?\" is a staple of system design interviews.")}
        ${progress.markup()}

        <div class="insight"><span class="insight-mark">//</span><p>These labs add two tables to the bakery: <code>order_docs</code>, the orders as JSON documents (customer and items embedded), and <code>referrals</code>, who brought whom. SQLite's JSON functions and recursive CTEs let one engine play all three models.</p></div>

        ${labSection("docs", "A", "Documents", "Embed what's read together.", "A document holds a record and everything nested under it. One read shows a whole order. The cost is the copies: Maya's details now live in four places.", `
          <div class="sel-notes">
            <div><h3>Reading into JSON</h3><p>${code("json_extract(doc, '$.customer.name')")} follows a path. ${code("json_each(doc, '$.items')")} turns an array into rows. PostgreSQL writes ${code("doc -> 'customer' ->> 'name'")}.</p></div>
            <div><h3>Embed or reference?</h3><p>Embed what's owned and read with its parent (an order's items). Reference what's shared and changes on its own (the customer). Most document designs mix both.</p></div>
            <div><h3>Many-to-one hurts</h3><p>Documents are trees. Data that many records point at (customers, products) either gets copied, and drifts, or referenced, and needs joins the database is weak at.</p></div>
          </div>`)}

        ${labSection("shape", "B", "Schema on read", "Any shape goes in; readers cope.", "Tables check structure on write. Documents accept anything and push the checking to every reader, which suits fields that vary, and costs you every old shape forever.", `
          ${wonder("Is \"schemaless\" really schemaless?", "No: the schema moves into the code that reads the data. If orders written last year lack a field, every reader must handle both shapes, or you migrate the documents. \"Schema on read\" is the honest name.")}`)}

        ${labSection("graph", "C", "Graphs", "Nodes, edges, and traversals.", "When anything can connect to anything, and questions follow links to an unknown depth, store the links as first-class <b>edges</b>. In SQL that's an edges table and a recursive CTE.", `
          <div class="sel-notes">
            <div><h3>Edges as a table</h3><p>${code("referrals (referrer_id, referred_id)")} is a junction table between customers and customers: a many-to-many relationship of a table with itself.</p></div>
            <div><h3>Cycles</h3><p>Real graphs loop (A knows B knows A). A recursive CTE would then run forever: track visited nodes, cap the depth, or use <code>UNION</code> instead of <code>UNION ALL</code>.</p></div>
            <div><h3>Graph databases</h3><p>Neo4j's Cypher: <code>MATCH (m {name:'Maya'})-[:REFERRED*]-&gt;(p) RETURN p</code>. Same traversal, one line, and storage built for hops.</p></div>
          </div>`)}

        <section class="lab sel-cheat">
          <div class="lab-top"><div><span class="lab-kicker">Cheat sheet</span><h2>Choosing a model</h2><p class="lab-copy">Choose by how the data is read and how it changes. Most systems are relational at the core, with documents and graphs where they fit.</p></div></div>
          <div class="sel-ops"><table class="sel-table"><thead><tr><th>Model</th><th>Shape</th><th>Great for</th><th>Costs</th></tr></thead><tbody>${COMPARE.map(([model, shape, good, cost]) => `<tr><td><code>${model}</code></td><td>${shape}</td><td>${good}</td><td>${cost}</td></tr>`).join("")}</tbody></table></div>
        </section>

        <section class="lab" id="lab-quiz">
          <div class="lab-top"><div><span class="lab-kicker">Check yourself</span><h2>Six calls about data models</h2><p class="lab-copy">The trade-offs system design interviews probe.</p></div><div class="lab-side"><button class="button" type="button" data-quiz-reset>Reset answers</button>${DSL.LabKit.stamp()}</div></div>
          <div id="models-quiz">${DSL.Quiz.render([...QUIZ, ...QUIZ_MORE], "Data models review")}</div>
        </section>

        <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> ask what's read together, what's shared, and how deep the links go. Those three answers pick the model.</p></div>
        ${DSL.lessonFooter("models")}
      </article>`;

    progress.mount();
    Object.entries(CHALLENGES).forEach(([labId, list]) => {
      DSL.Sql.challenges(DSL.elements.root.querySelector(`[data-set="${labId}"]`), list, {
        storageKey: `models-${labId}`,
        onAllDone: () => progress.complete(labId),
      });
    });
    DSL.Quiz.mount(document.getElementById("models-quiz"), [...QUIZ, ...QUIZ_MORE], {
      noun: "call",
      passScore: 5,
      successTitle: "Data models review passed",
      successCopy: "You can say which model fits which question, and what it costs.",
      onComplete: ({ passed }) => { if (passed) progress.complete("quiz"); },
    });
  }

  DSL.ModelsModel = Object.freeze({ QUIZ, CHALLENGES, progress });
  DSL.registerRenderer("models", renderModels);
})(window.DataSystemsLab);
