(function registerModelsLesson(DSL) {
  "use strict";

  // Relational, document and graph models, all on SQLite: order_docs holds the orders as JSON
  // documents, referrals holds a who-brought-whom graph. Explore is the full reference; Narrated
  // (models-narrated.js) is the focused version and Guided (models-guided.js) sits in between.

  const { wonder, labSide } = DSL.LabKit;
  const code = (sql) => `<code>${DSL.Sql.highlight(sql)}</code>`;
  const progress = DSL.LabKit.createProgress({
    lessonId: "models",
    labs: [{ id: "docs", name: `${DSL.labLabel("models", "A")} Documents` }, { id: "shape", name: `${DSL.labLabel("models", "B")} Schema on read` }, { id: "graph", name: `${DSL.labLabel("models", "C")} Graphs` }, { id: "quiz", name: "Practice" }],
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

  // Goals, and the practice that checks them (js/components/practice.js). Every mode states the
  // goals at the start and ends with the recap, the checks and the interview round.
  const PRACTICE = {
    lessonId: "models",
    goals: [
      {
        id: "document", icon: "📄", title: "Store what's read together", snippet: "json_extract(doc, '$.customer.name')",
        text: "Model an order as a document, explain embedding and data locality, and name the cost of copied data.",
        recap: "A <b>document</b> embeds the customer and the items, so showing an order is one read with no joins: <b>data locality</b>. The cost: Maya's phone is copied into every order.",
        example: {
          dataset: "bakeryModels",
          sql: "SELECT id, json_extract(doc, '$.customer.phone') AS phone FROM order_docs WHERE json_extract(doc, '$.customer.id') = 1 ORDER BY id",
          mark: () => "hot",
          note: "Her phone lives in four documents: change it four times.",
        },
      },
      {
        id: "schema", icon: "📐", title: "Choose when to check", snippet: "\"note\": \"Leave at the door\"",
        text: "Contrast schema on write with schema on read, and say who pays for each.",
        recap: "Tables check the shape as each row is written: <b>schema on write</b>. Documents take any shape, and every reader copes: <b>schema on read</b>. Only order 8 has a note.",
        example: {
          dataset: "bakeryModels",
          sql: "SELECT id, json_extract(doc, '$.note') AS note FROM order_docs WHERE id BETWEEN 6 AND 9 ORDER BY id",
          mark: (row) => (row[1] !== null ? "hot" : ""),
          note: "Every reader must handle a field that may not be there.",
        },
      },
      {
        id: "graph", icon: "🕸️", title: "Follow the links", snippet: "WITH RECURSIVE net AS (…)",
        text: "Model connections as a graph, and traverse it to any depth with a recursive CTE.",
        recap: "In a <b>graph</b>, people are nodes and referrals are edges. A <b>traversal</b> follows them hop by hop: Maya's network is five people, three hops deep.",
        example: {
          dataset: "bakeryModels",
          sql: "WITH RECURSIVE net(id) AS (\n  SELECT referred_id FROM referrals WHERE referrer_id = 1\n  UNION\n  SELECT r.referred_id FROM referrals r\n  JOIN net ON r.referrer_id = net.id\n)\nSELECT group_concat(c.name, ', ') AS network\nFROM net JOIN customers c ON c.id = net.id",
          note: "Ana and Omar, then Ines and Yuki, then Priya.",
        },
      },
    ],
    checks: [
      { id: "old-price", goal: "document", prompt: "Each order document embeds the price of every item. The bakery raises the croissant's price. What should happen to the old order documents?", options: ["Update every one with the new price", "Leave them: the embedded price is what the customer paid at the time", "Delete them and rebuild from the products table"], answer: 1, why: "Not every copy is a bug. An order should freeze the price it was sold at. Embed facts that should freeze; point at facts that must stay current, like a phone number." },
      { id: "phone-list", goal: "schema", prompt: "A new app version stores <code>customer.phone</code> as a list of numbers; older documents hold a single string. With schema on read, who deals with the difference?", options: ["The database rejects the new documents", "Every piece of code that reads phones must handle both shapes", "The old documents are converted automatically"], answer: 1, why: "Schema on read moves the check from the write to every reader. Nothing converts old documents unless you run a migration yourself." },
      { id: "hops", goal: "graph", prompt: "Why does a plain JOIN struggle to find everyone Maya brought in, at any depth?", options: ["A JOIN can't use the same table twice", "Each JOIN follows exactly one hop, and the number of hops isn't known in advance", "Referrals need a foreign key first"], answer: 1, why: "Two hops is two joins; three hops, three. A recursive CTE, or a graph query, repeats the hop until no new people appear." },
    ],
    warmups: [
      { id: "when-docs", goal: "document", prompt: "When would you choose a document database over a relational one?", options: ["When data is read as one self-contained tree, like an order or a profile, and rarely joined to much else", "Whenever the data is large", "When the data has many-to-many relationships"], answer: 0, why: "Documents win on locality for tree-shaped reads. Many-to-many data and reports that cut across records suit tables better." },
      { id: "write-read", goal: "schema", prompt: "What's the difference between schema on write and schema on read?", options: ["On write, the database checks the structure as data is stored; on read, any shape goes in and the reader interprets it", "Schema on read makes writes faster, and that's all", "They're the query languages of SQL and NoSQL"], answer: 0, why: "It's about where the structure is enforced: by the database on every write, or by the code on every read." },
    ],
    open: {
      id: "pick-a-model",
      goal: "graph",
      prompt: "The bakery wants customer reviews and a \"customers also bought\" feature. Would you use tables, documents or a graph? Walk me through the trade-offs.",
      points: [
        "Choose by how the data is read and connected, not by product.",
        "Documents suit data read as one tree, like an order (locality), but copied data must be updated everywhere.",
        "Reviews link customers to products (many-to-many) and feed reports: tables fit, with foreign keys and constraints.",
        "\"Also bought\" follows links between products through orders. A graph fits deep or variable-depth traversals; one or two hops are fine as SQL joins.",
        "Schema on write enforces rules; schema on read is flexible, but every reader copes with old shapes.",
        "The lines blur: PostgreSQL has JSON columns and recursive CTEs, so one database can often do all three.",
      ],
      answer: "I'd decide by access pattern. Reviews connect customers and products, which is many-to-many, and the bakery will want reports on them, so a reviews table with foreign keys to both fits best, and the database can enforce the rules. \"Customers also bought\" is a question about connections: from a product, through its orders, to other products. At one or two hops that's just a couple of joins in SQL; if it grew into deeper recommendations across customers, a graph model would fit more naturally. Documents would make sense if we showed an order or a product page as one self-contained tree, for locality, at the cost of updating copied data. And the lines blur: PostgreSQL stores JSON and runs recursive queries, so I'd likely start in one relational database.",
    },
  };
  DSL.Practice.registerCards(PRACTICE);

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
        <div class="pr-intro"><p class="pr-kicker">By the end, you'll be able to</p>${DSL.Practice.cardsMarkup(PRACTICE, { compact: true })}</div>
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

        ${DSL.Practice.exploreMarkup(PRACTICE)}

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
    DSL.Practice.mountExplore(document.getElementById("lab-quiz"), PRACTICE, { onPass: () => progress.complete("quiz") });
  }

  DSL.ModelsModel = Object.freeze({ PRACTICE, CHALLENGES, progress });
  DSL.registerRenderer("models", renderModels);
})(window.DataSystemsLab);
