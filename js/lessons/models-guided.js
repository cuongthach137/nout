(function registerModelsGuided(DSL) {
  "use strict";

  // Guided mode for relational, document and graph models. Scenes show order 1 as joined rows and
  // as a JSON document, the undeclared "note" field, and the referral graph traversed hop by hop.
  // Shared with Narrated mode (DSL.ModelsScenes).

  const { retrigger } = DSL.LabKit;
  const { board, predictBeat, challengeBeat, teach, slice } = DSL.SqlScenes;
  const hl = (sql) => DSL.Sql.highlight(sql);
  const D = "bakeryModels";
  const run = (sql) => DSL.Sql.run(D, sql);

  const Q = {
    joined: "SELECT o.id, o.ordered_at, c.name, c.phone,\n       p.name AS product, i.quantity\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nJOIN order_items i ON i.order_id = o.id\nJOIN products p ON p.id = i.product_id\nWHERE o.id = 1;",
    doc: "SELECT doc FROM order_docs WHERE id = 1;",
    mayaDocs: "SELECT id, json_extract(doc, '$.customer.phone') AS phone\nFROM order_docs\nWHERE json_extract(doc, '$.customer.id') = 1;",
    note: "INSERT INTO orders (id, customer_id, ordered_at, status, note)\nVALUES (17, 1, '2024-09-26', 'paid', 'Leave at the door');",
    notes: "SELECT id, json_extract(doc, '$.note') AS note\nFROM order_docs\nWHERE id BETWEEN 6 AND 10;",
    network: "WITH RECURSIVE net(id, depth) AS (\n  SELECT referred_id, 1 FROM referrals WHERE referrer_id = 1\n  UNION ALL\n  SELECT r.referred_id, net.depth + 1\n  FROM referrals r JOIN net ON r.referrer_id = net.id\n)\nSELECT c.name, net.depth\nFROM net JOIN customers c ON c.id = net.id\nORDER BY net.depth, c.name;",
  };

  // ---------- A JSON document, pretty-printed with the embedded parts marked ----------

  function jsonHtml(value, indent = 0, key = "") {
    const pad = "  ".repeat(indent);
    const esc = (text) => String(text).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
    if (Array.isArray(value)) {
      return `[\n${value.map((item) => `${pad}  ${jsonHtml(item, indent + 1)}`).join(",\n")}\n${pad}]`;
    }
    if (value && typeof value === "object") {
      const body = Object.entries(value).map(([k, v]) => {
        const inner = jsonHtml(v, indent + 1, k);
        const line = `${pad}  <span class="md-key">"${esc(k)}"</span>: ${inner}`;
        return ["customer", "items", "note"].includes(k) && indent === 0 ? `<span class="md-part" data-part="${k}">${line}</span>` : line;
      }).join(",\n");
      return `{\n${body}\n${pad}}`;
    }
    if (value === null) return `<span class="md-null">null</span>`;
    if (typeof value === "string") return `<span class="sq-str">"${esc(value)}"</span>`;
    return `<span class="sq-num">${value}</span>`;
  }

  function docBoard(stage) {
    stage.innerHTML = `<div class="md-board"><pre class="md-doc"></pre><div class="md-side"></div></div>`;
    const root = stage.firstElementChild;
    return {
      root,
      doc: root.querySelector(".md-doc"),
      side: root.querySelector(".md-side"),
      async show(id) {
        const res = await run(`SELECT doc FROM order_docs WHERE id = ${id}`);
        this.doc.innerHTML = jsonHtml(JSON.parse(res.rows[0][0]));
        retrigger(this.doc, "sq-code-in");
      },
      mark(parts) { root.querySelectorAll(".md-part").forEach((el) => el.classList.toggle("on", parts.includes(el.dataset.part))); },
    };
  }

  // ---------- Storyboards ----------

  function relStory() {
    return {
      build: (stage) => board(stage, { label: "order 1, joined", dataset: D }),
      frames: [
        {
          caption: "The relational shape: to show order 1, join four tables. The order, its customer, its items, and their products.",
          async enter(b, a) { await a.after(b.code(Q.joined, { type: true })); await a.after(b.show(Q.joined, { label: "order 1, joined" })); },
        },
        {
          caption: "Each fact lives once; joins stitch them back together on every read. Notice Maya's name and phone repeat per row: that's the join's output, not the storage.",
          async enter(b, a) { b.code(Q.joined); await a.after(b.show(Q.joined, { label: "order 1, joined" })); ["name", "phone"].forEach((c) => b.cells(c).forEach((cell) => cell.classList.add("sq-pick"))); },
        },
      ],
    };
  }

  function docStory() {
    return {
      build: (stage) => docBoard(stage),
      frames: [
        {
          caption: "The same order as a <b>document</b>: the customer and the items are nested right inside it.",
          async enter(d, a) { await a.after(d.show(1)); d.side.innerHTML = ""; },
        },
        {
          caption: "Putting related data inside the document is <b>embedding</b>: the heart of the <b>document model</b>.",
          async enter(d, a) { await a.after(d.show(1)); d.mark(["customer", "items"]); },
        },
        {
          caption: "Showing the order is one read, with no joins. Data read together is stored together: <b>data locality</b>.",
          async enter(d, a) { await a.after(d.show(1)); d.mark(["customer", "items"]); d.side.innerHTML = `<div class="md-stat"><b>1</b><span>read</span></div><div class="md-stat"><b>0</b><span>joins</span></div>`; },
        },
        {
          caption: "But Maya's details are copied into <b>every</b> one of her orders: four documents to change when her phone does. The update anomaly from the notebook, back again.",
          async enter(d, a) {
            await a.after(d.show(1));
            d.mark(["customer"]);
            const view = board(d.side, { label: "Maya's copies", dataset: D });
            await a.after(view.show(Q.mayaDocs, { label: "documents holding Maya's phone", mark: () => "sq-dup" }));
          },
        },
      ],
    };
  }

  function schemaStory() {
    return {
      build: (stage) => docBoard(stage),
      frames: [
        {
          caption: "Order 8 has a <b>note</b> that no other order has. Nobody declared that field.",
          async enter(d, a) { await a.after(d.show(8)); d.mark(["note"]); d.side.innerHTML = ""; },
        },
        {
          caption: "A table would refuse it: structure is checked as each row is written. That's <b>schema on write</b>.",
          async enter(d, a) { await a.after(d.show(8)); d.mark(["note"]); const view = board(d.side, { dataset: D }); view.code(Q.note); await a.after(view.show(Q.note)); },
        },
        {
          caption: "A document accepts any shape; the code reading it copes with whatever it finds. That's <b>schema on read</b>: flexible, but every reader handles every old shape, forever.",
          async enter(d, a) { await a.after(d.show(8)); d.mark(["note"]); const view = board(d.side, { dataset: D }); view.code(Q.notes); await a.after(view.show(Q.notes, { mark: (row) => (row[1] ? "sq-hot" : "sq-dup") })); },
        },
      ],
    };
  }

  // Referral graph layout: [id, name, x%, y%].
  const NODES = [[1, "Maya", 50, 10], [3, "Ana", 30, 36], [2, "Omar", 70, 36], [8, "Ines", 30, 62], [7, "Yuki", 70, 62], [10, "Priya", 70, 88], [6, "Kofi", 8, 36], [5, "Raj", 8, 62], [4, "Lena", 92, 36], [9, "Theo", 92, 62]];
  const EDGES = [[1, 3], [1, 2], [3, 8], [2, 7], [7, 10], [6, 5], [4, 9]];
  const DEPTH = { 3: 1, 2: 1, 8: 2, 7: 2, 10: 3 };

  function graphBoard(stage) {
    const pos = Object.fromEntries(NODES.map(([id, , x, y]) => [id, [x, y]]));
    stage.innerHTML = `<div class="md-graph">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${EDGES.map(([from, to]) => `<line data-edge="${from}-${to}" x1="${pos[from][0]}" y1="${pos[from][1]}" x2="${pos[to][0]}" y2="${pos[to][1]}"/>`).join("")}</svg>
      ${NODES.map(([id, name, x, y]) => `<span class="md-node" data-id="${id}" style="left:${x}%;top:${y}%">${name}</span>`).join("")}
    </div><div class="md-graph-out"></div>`;
    return {
      root: stage.firstElementChild,
      out: stage.querySelector(".md-graph-out"),
      node: (id) => stage.querySelector(`.md-node[data-id="${id}"]`),
      edge: (from, to) => stage.querySelector(`[data-edge="${from}-${to}"]`),
      reset() { stage.querySelectorAll(".md-node, line").forEach((el) => el.classList.remove("on", "start", "hop")); this.out.innerHTML = ""; },
    };
  }

  function graphStory() {
    return {
      build: (stage) => graphBoard(stage),
      frames: [
        {
          caption: "Some customers brought friends. Maya brought Ana and Omar, and they brought others.",
          async enter(g, a) { g.reset(); g.node(1).classList.add("start"); await a.wait(400); },
        },
        {
          caption: "People are <b>nodes</b>; each referral is an <b>edge</b>. That's the <b>graph model</b>.",
          async enter(g, a) { g.reset(); g.node(1).classList.add("start"); g.root.querySelectorAll("line").forEach((line, i) => { line.style.animationDelay = `${i * 90}ms`; line.classList.add("on"); }); await a.wait(700); },
        },
        {
          caption: "Who joined because of Maya, directly or not? Follow the edges one hop at a time until they run out: a <b>traversal</b>.",
          async enter(g, a) {
            g.reset();
            g.node(1).classList.add("start");
            for (const hop of [1, 2, 3]) {
              EDGES.filter(([from, to]) => DEPTH[to] === hop && (from === 1 || DEPTH[from] === hop - 1)).forEach(([from, to]) => { g.edge(from, to).classList.add("on", "hop"); g.node(to).classList.add("hop"); retrigger(g.node(to), "gd-pop"); });
              await a.wait(650);
            }
          },
        },
        {
          caption: "Ana and Omar, then Ines and Yuki, then Priya: three hops. SQL does it with a recursive CTE; graph databases make it the main event.",
          async enter(g, a) {
            g.reset();
            g.node(1).classList.add("start");
            Object.keys(DEPTH).forEach((id) => g.node(Number(id)).classList.add("hop"));
            EDGES.filter(([, to]) => DEPTH[to]).forEach(([from, to]) => g.edge(from, to).classList.add("on", "hop"));
            const view = board(g.out, { label: "Maya's network", dataset: D });
            await a.after(view.show(Q.network, { label: "Maya's network", mark: () => "sq-pass" }));
          },
        },
      ],
    };
  }

  const PICKS = [["📄", "Documents", "read as one tree: an order, a profile", "doc"], ["🕸️", "Graphs", "links to any depth: friends, routes, fraud rings", "graph"], ["🗃️", "Tables", "everything in between: many-to-many, reports, rules", "table"]];

  function pickStory() {
    return {
      build(stage) {
        stage.innerHTML = `<div class="md-picks">${PICKS.map(([icon, name, when, key], i) => `<div class="md-pick" data-key="${key}" style="--i:${i}"><span>${icon}</span><b>${name}</b><small>${when}</small></div>`).join("")}</div>`;
        return stage.firstElementChild;
      },
      frames: [0, 1, 2].map((i) => ({
        caption: ["<b>Documents</b> when data is read as one tree, like an order or a profile, and rarely joined to much else.", "<b>Graphs</b> when everything connects to everything and questions follow links to an unknown depth.", "<b>Tables</b> for everything in between, which is most things. And the lines blur: PostgreSQL stores JSON, and document stores add joins."][i],
        async enter(root, a) { root.querySelectorAll(".md-pick").forEach((el, j) => el.classList.toggle("on", j <= i)); root.querySelectorAll(".md-pick").forEach((el, j) => el.classList.toggle("current", j === i)); await a.wait(300); },
      })),
    };
  }

  // ---------- Beats ----------

  const copiesPredict = () => predictBeat({
    id: "copies",
    prompt: "Maya changes her phone. How many documents must change?",
    why: "Each order document embeds a copy of its customer's details.",
    question: `<pre class="sq-code">${hl("-- order_docs: 16 documents, one per order\n-- each embeds a copy of its customer")}</pre>`,
    options: [["1", "1"], ["4", "4"], ["16", "16"]],
    answer: "4",
    explain: { right: "Four: one per order she's placed.", wrong: "Four: her details are copied into each of her orders." },
  });

  const graphPredict = () => predictBeat({
    id: "pick-graph",
    prompt: "Friends of friends of friends. Which model fits most naturally?",
    why: "The question follows links, to a depth that isn't fixed.",
    question: `<p class="wn-q">A social app shows friends of friends of friends.</p>`,
    options: [["relational", "Relational"], ["document", "Document"], ["graph", "Graph"]],
    answer: "graph",
    explain: { right: "Graph: following links to any depth is what it's built for.", wrong: "Graph. Tables can do it with recursive queries, and documents hold one person's list, but traversing links is a graph's job." },
  });

  const namesChallenge = () => challengeBeat({
    id: "names",
    prompt: "Your turn: read inside the documents.",
    why: "A JSON path starts at $ (the whole document) and follows keys with dots.",
    task: "From <b>order_docs</b>, return each order's <b>id</b> and the customer's <b>name</b> (NULL for walk-ins).",
    starter: "SELECT id, \nFROM order_docs;",
    solution: "SELECT id, json_extract(doc, '$.customer.name') FROM order_docs",
    dataset: D,
  });

  const netChallenge = () => challengeBeat({
    id: "net",
    prompt: "Your turn: traverse the graph.",
    why: "The anchor finds Maya's direct referrals; the recursive step follows edges from everyone found so far, until no new rows appear.",
    task: "Find everyone Maya brought in, <b>at any depth</b>. Finish the recursive step; return their <b>name</b>.",
    starter: "WITH RECURSIVE net(id) AS (\n  SELECT referred_id FROM referrals WHERE referrer_id = 1\n  UNION ALL\n  \n)\nSELECT c.name\nFROM net\nJOIN customers c ON c.id = net.id;",
    solution: "WITH RECURSIVE net(id) AS (SELECT referred_id FROM referrals WHERE referrer_id = 1 UNION ALL SELECT r.referred_id FROM referrals r JOIN net ON r.referrer_id = net.id) SELECT c.name FROM net JOIN customers c ON c.id = net.id",
    dataset: D,
  });

  function makeBeats() {
    const M = DSL.ModelsModel;
    return [
      teach("teach-rel", "Tables: join on read.", relStory()),
      teach("teach-doc", "Documents: embed what's read together.", slice(docStory(), 0, 3), "MongoDB, Couchbase and DynamoDB store documents like this; PostgreSQL's jsonb columns can too."),
      copiesPredict(),
      teach("teach-copies", "The cost of copies.", slice(docStory(), 3, 4), "The usual fix: embed what's owned (items), reference what's shared (the customer), and accept a lookup for the shared part."),
      namesChallenge(),
      teach("teach-schema", "Schema on write, or on read.", schemaStory(), "Flexible documents still have a schema: it lives in every piece of code that reads them."),
      teach("teach-graph", "Graphs: follow the links.", graphStory(), "Real graphs have cycles. A recursive CTE then needs a visited list or a depth limit, or it never stops."),
      netChallenge(),
      teach("teach-pick", "Which shape when.", pickStory()),
      graphPredict(),
      DSL.Guided.quizBeat({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Guided.finishBeat({
        lessonId: "models",
        badges: [["🗃️", "Tables", "each fact once"], ["📄", "Documents", "read together, stored together"], ["🕸️", "Graphs", "links to any depth"]],
      }),
    ];
  }

  DSL.ModelsScenes = Object.freeze({ Q, relStory, docStory, schemaStory, graphStory, pickStory, namesChallenge, netChallenge, beats: makeBeats });

  DSL.registerGuided("models", () => DSL.Guided.run({
    lessonId: "models",
    title: `${DSL.lessonNumber("models")} · Tables, documents, graphs`,
    beats: makeBeats(),
  }));
})(window.DataSystemsLab);
