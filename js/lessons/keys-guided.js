(function registerKeysGuided(DSL) {
  "use strict";

  // Guided mode for relationships and keys. Scenes run real statements, including ones the
  // database refuses, so the learner sees each constraint do its job. Shared with Narrated mode
  // (DSL.KeysScenes).

  const { retrigger } = DSL.LabKit;
  const { board, predictBeat, challengeBeat, teach, slice } = DSL.SqlScenes;
  const hl = (sql) => DSL.Sql.highlight(sql);
  const P = () => DSL.KeysModel.PROBE;

  const Q = {
    customers: "SELECT id, name, phone\nFROM customers;",
    dupId: "INSERT INTO customers (id, name, joined)\nVALUES (1, 'Another Maya', '2024-10-01');",
    unique: "CREATE UNIQUE INDEX customers_phone\n  ON customers (phone);\nINSERT INTO customers (id, name, phone, joined)\nVALUES (11, 'Copycat', '555-0101', '2024-10-01');",
    uniqueNulls: "CREATE UNIQUE INDEX customers_phone\n  ON customers (phone);\nINSERT INTO customers (id, name, phone, joined)\nVALUES (11, 'Zoe', NULL, '2024-10-01');\nSELECT name, phone FROM customers\nWHERE phone IS NULL;",
    orders: "SELECT id, customer_id\nFROM orders;",
    badOrder: "INSERT INTO orders\nVALUES (17, 99, '2024-09-26', 'paid');",
    walkIn: "INSERT INTO orders\nVALUES (17, NULL, '2024-09-26', 'paid');\nSELECT id, customer_id FROM orders\nWHERE customer_id IS NULL;",
    deleteMaya: "DELETE FROM customers\nWHERE name = 'Maya';",
    cascadeSetup: "CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT);\nCREATE TABLE orders (\n  id INTEGER PRIMARY KEY,\n  customer_id INTEGER REFERENCES customers (id)\n    ON DELETE CASCADE\n);\nINSERT INTO customers VALUES (1, 'Maya'), (2, 'Omar');\nINSERT INTO orders VALUES (1, 1), (3, 1), (2, 2);\n",
  };

  // The customers table with its primary key column picked out.
  function keyCells(b) { b.cells("id").forEach((cell) => cell.classList.add("sq-pick")); }

  function note(b, html, tone = "") {
    b.stage.querySelectorAll(".nl-chip").forEach((el) => el.remove());
    b.grid.insertAdjacentHTML("afterend", `<div class="nl-chip ${tone}">${html}</div>`);
  }

  // ---------- Storyboards ----------

  function pkStory() {
    return {
      build: (stage) => board(stage, { label: "customers", dataset: "bakeryStrict" }),
      frames: [
        {
          caption: "Every customer has an <b>id</b>: the table's <b>primary key</b>. Unique, and never empty.",
          async enter(b, a) { b.code(Q.customers); await a.after(b.show("SELECT id, name, phone FROM customers ORDER BY id", { label: "customers" })); keyCells(b); },
        },
        {
          caption: "Add a second customer with id 1, and the database refuses.",
          async enter(b, a) { await a.after(b.code(Q.dupId, { type: true })); await a.after(b.show(Q.dupId)); },
        },
        {
          caption: "Why not use the phone as the key? Three customers don't have one, and phones change. So the key is a meaningless number that never needs to: a <b>surrogate key</b>.",
          async enter(b, a) { b.code(Q.customers); await a.after(b.show("SELECT id, name, phone FROM customers ORDER BY id", { label: "customers", mark: (row) => (row[2] === null ? "sq-dup" : "") })); keyCells(b); },
        },
      ],
    };
  }

  function uniqueStory() {
    return {
      build: (stage) => board(stage, { label: "result", dataset: "bakeryStrict" }),
      frames: [
        {
          caption: "Phones shouldn't be shared, though. A <b>UNIQUE constraint</b>, here a unique index, forbids duplicates in a column that isn't the key.",
          async enter(b, a) { await a.after(b.code(Q.unique, { type: true })); await a.after(b.show(Q.unique)); },
        },
        {
          caption: "But empty phones are fine: NULLs aren't equal to each other, so they never clash. Unknown isn't equal to unknown, as in the NULL lesson.",
          async enter(b, a) { await a.after(b.code(Q.uniqueNulls, { type: true })); await a.after(b.show(Q.uniqueNulls, { label: "customers with no phone", mark: (row) => (row[0] === "Zoe" ? "sq-hot" : "sq-dup") })); },
        },
      ],
    };
  }

  function fkStory() {
    return {
      build: (stage) => board(stage, { label: "orders", dataset: "bakeryStrict" }),
      frames: [
        {
          caption: "Each order's <b>customer_id</b> should match a real customer.",
          async enter(b, a) { b.code(Q.orders); await a.after(b.show("SELECT id, customer_id FROM orders ORDER BY id", { label: "orders" })); b.cells("customer_id").forEach((cell) => cell.classList.add("sq-pick")); },
        },
        {
          caption: "A <b>foreign key</b> makes it a rule. An order for customer 99, who doesn't exist, is refused.",
          async enter(b, a) { await a.after(b.code(Q.badOrder, { type: true })); await a.after(b.show(Q.badOrder)); },
        },
        {
          caption: "An empty pointer is allowed, though: NULL points at nothing on purpose. That's how the walk-in orders exist.",
          async enter(b, a) { await a.after(b.code(Q.walkIn, { type: true })); await a.after(b.show(Q.walkIn, { label: "orders with no customer", mark: (row) => (row[0] === 17 ? "sq-hot" : "sq-dup") })); },
        },
      ],
    };
  }

  function deleteStory() {
    return {
      build: (stage) => board(stage, { label: "result", dataset: "bakeryStrict" }),
      frames: [
        {
          caption: "Delete Maya, who has orders. By default, the database <b>refuses</b>: her orders would point at nothing.",
          async enter(b, a) { await a.after(b.code(Q.deleteMaya, { type: true })); await a.after(b.show(Q.deleteMaya)); },
        },
        {
          caption: "<b>ON DELETE</b> chooses what happens instead. On a small copy, with <b>CASCADE</b>: Maya has two orders, Omar one.",
          async enter(b, a) {
            const view = board(b.stage, { label: "orders", dataset: "strict" });
            view.code(`${Q.cascadeSetup}SELECT * FROM orders;`);
            await a.after(view.show(`${Q.cascadeSetup}SELECT * FROM orders ORDER BY id;`, { label: "orders, before", mark: (row) => (row[1] === 1 ? "sq-dup" : "") }));
          },
        },
        {
          caption: "Delete Maya, and her orders go with her; Omar's stays. <b>SET NULL</b> would keep them with no customer. Cascade only when child rows mean nothing on their own.",
          async enter(b, a) {
            const view = board(b.stage, { label: "orders", dataset: "strict" });
            view.code("DELETE FROM customers WHERE name = 'Maya';\nSELECT * FROM orders;");
            await a.after(view.show(`${Q.cascadeSetup}DELETE FROM customers WHERE name = 'Maya';\nSELECT * FROM orders ORDER BY id;`, { label: "orders, after", mark: () => "sq-pass" }));
          },
        },
      ],
    };
  }

  const SHAPES = [
    ["customers", "1", "∞", "orders", "orders.customer_id → customers"],
    ["customers", "1", "1", "loyalty_cards", "customer_id UNIQUE → customers"],
    ["orders", "∞", "∞", "products", "order_items (order_id, product_id)"],
  ];

  function cardStory() {
    return {
      build(stage) {
        stage.innerHTML = `<div class="ky-card"><div class="ky-shapes"></div><div class="ky-out"></div></div>`;
        return { shapes: stage.querySelector(".ky-shapes"), out: stage.querySelector(".ky-out"), stage };
      },
      frames: [
        {
          caption: "<b>Cardinality</b>: how many rows can relate on each side. One customer, many orders: the foreign key goes on the <b>many</b> side.",
          async enter(ctx, a) { ctx.shapes.innerHTML = shapeRow(SHAPES[0], 0); ctx.out.innerHTML = ""; await a.wait(500); },
        },
        {
          caption: "One-to-one, like one loyalty card per customer: the same foreign key, made <b>UNIQUE</b>.",
          async enter(ctx, a) { ctx.shapes.innerHTML = SHAPES.slice(0, 2).map(shapeRow).join(""); await a.wait(500); },
        },
        {
          caption: "Many-to-many: an order holds many products, a product is in many orders. Neither side can hold one pointer, so a <b>junction table</b> sits in between, one row per pair.",
          async enter(ctx, a) { ctx.shapes.innerHTML = SHAPES.map(shapeRow).join(""); ctx.shapes.lastElementChild.classList.add("ky-hot"); await a.wait(500); },
        },
        {
          caption: "<b>order_items</b> is that table. Its key is both columns together, a <b>composite key</b>: each order and product pair appears once.",
          async enter(ctx, a) {
            ctx.shapes.innerHTML = "";
            const view = board(ctx.out, { label: "order_items" });
            view.code("PRIMARY KEY (order_id, product_id)");
            await a.after(view.show("SELECT order_id, product_id, quantity FROM order_items ORDER BY order_id, product_id LIMIT 8", { label: "order_items (first 8)" }));
            ["order_id", "product_id"].forEach((name) => view.cells(name).forEach((cell) => cell.classList.add("sq-pick")));
          },
        },
      ],
    };
  }

  function shapeRow([left, a, b, right, how], i) {
    return `<div class="ky-shape" style="--i:${i}"><span class="ky-table">${left}</span><span class="ky-link"><i>${a}</i><em></em><i>${b}</i></span><span class="ky-table">${right}</span><small>${hl(how)}</small></div>`;
  }

  // ---------- Beats ----------

  const uniquePredict = () => predictBeat({
    id: "unique-nulls",
    prompt: "Will a UNIQUE phone allow three empty phones?",
    why: "Three customers have no phone: their phone is NULL.",
    question: `<pre class="sq-code">${hl("CREATE UNIQUE INDEX customers_phone\n  ON customers (phone);")}</pre>`,
    options: [["yes", "Yes"], ["no", "No"]],
    answer: "yes",
    explain: { right: "Yes: NULLs aren't equal, so they never clash.", wrong: "It does allow them: NULLs aren't equal to each other." },
  });

  const deletePredict = () => predictBeat({
    id: "delete-maya",
    prompt: "Delete Maya, who has orders. What happens by default?",
    why: "orders.customer_id is a foreign key to customers, with no ON DELETE clause.",
    question: `<pre class="sq-code">${hl(Q.deleteMaya)}</pre>`,
    options: [["error", "It's refused"], ["cascade", "Her orders are deleted too"], ["dangle", "Her orders keep pointing at her"]],
    answer: "error",
    explain: { right: "Refused. Her orders would point at nothing.", wrong: "By default it's refused: her orders would point at nothing." },
  });

  const phoneChallenge = () => challengeBeat({
    id: "phone",
    prompt: "Your turn: no shared phones.",
    why: "SQLite can't add a constraint to an existing table with ALTER TABLE; a unique index enforces the same rule.",
    task: "Make it impossible for two customers to share a <b>phone</b> number. A check then tries a copy of Maya's number, and a customer with no phone.",
    starter: "",
    solution: "CREATE UNIQUE INDEX customers_phone ON customers (phone)",
    probe: P().phone,
  });

  const addressChallenge = () => challengeBeat({
    id: "addr",
    prompt: "Your turn: addresses that belong to someone.",
    why: "REFERENCES customers (id) makes customer_id a foreign key. NOT NULL makes the address require one.",
    task: "Create <b>addresses</b> (<b>id</b>, <b>customer_id</b>, <b>street</b>) where every address must belong to a real customer.",
    starter: "CREATE TABLE addresses (\n  id INTEGER PRIMARY KEY,\n  customer_id INTEGER NOT NULL,\n  street TEXT NOT NULL\n);",
    solution: "CREATE TABLE addresses (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers (id), street TEXT NOT NULL)",
    dataset: "bakeryStrict",
    probe: P().addresses,
  });

  const favChallenge = () => challengeBeat({
    id: "fav",
    prompt: "Your turn: a junction table.",
    why: "Two foreign keys make it a junction; the composite primary key stops the same favourite being saved twice.",
    task: "Customers can favourite many products. Create <b>favourites</b> (<b>customer_id</b>, <b>product_id</b>) with two foreign keys and a primary key made of both.",
    starter: "CREATE TABLE favourites (\n  customer_id INTEGER,\n  product_id INTEGER\n);",
    solution: "CREATE TABLE favourites (customer_id INTEGER REFERENCES customers (id), product_id INTEGER REFERENCES products (id), PRIMARY KEY (customer_id, product_id))",
    dataset: "bakeryStrict",
    probe: P().favourites,
  });

  function makeBeats() {
    const M = DSL.KeysModel;
    return [
      teach("teach-pk", "A key that identifies.", pkStory(), "A primary key is also where other tables point, so its value gets copied into every foreign key. That's why it should never change."),
      teach("teach-unique", "Unique, but not the key.", slice(uniqueStory(), 0, 1)),
      uniquePredict(),
      teach("teach-unique-nulls", "NULLs don't clash.", slice(uniqueStory(), 1, 2), "PostgreSQL 15+ can forbid repeated NULLs with UNIQUE NULLS NOT DISTINCT. SQL Server allows only one NULL by default."),
      phoneChallenge(),
      teach("teach-fk", "Pointers that must point.", fkStory(), "SQLite only enforces foreign keys after PRAGMA foreign_keys = ON; PostgreSQL and MySQL (InnoDB) always do."),
      deletePredict(),
      teach("teach-delete", "What a delete does.", slice(deleteStory(), 1, 3), "RESTRICT and NO ACTION both refuse; they differ only in when the check runs inside a transaction."),
      addressChallenge(),
      teach("teach-card", "One, many, and many-to-many.", cardStory()),
      favChallenge(),
      DSL.Guided.quizBeat({ questions: M.QUIZ, passScore: 3, onPass: () => M.progress.complete("quiz") }),
      DSL.Guided.finishBeat({
        lessonId: "keys",
        badges: [["🔑", "Keys", "unique, never empty"], ["🔗", "Foreign keys", "no pointer to nothing"], ["🧩", "Junctions", "many-to-many, by pairs"]],
      }),
    ];
  }

  DSL.KeysScenes = Object.freeze({ Q, pkStory, uniqueStory, fkStory, deleteStory, cardStory, phoneChallenge, addressChallenge, favChallenge, beats: makeBeats });

  DSL.registerGuided("keys", () => DSL.Guided.run({
    lessonId: "keys",
    title: `${DSL.lessonNumber("keys")} · Relationships and keys`,
    beats: makeBeats(),
  }));
})(window.DataSystemsLab);
