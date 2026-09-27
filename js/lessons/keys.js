(function registerKeysLesson(DSL) {
  "use strict";

  // Relationships and keys: primary, surrogate and unique keys, foreign keys and ON DELETE,
  // cardinality, junction tables and composite keys. Exercises that build something are checked by
  // a probe query run afterwards. Explore is the full reference; Narrated (keys-narrated.js) is the
  // focused version and Guided (keys-guided.js) sits in between.

  const { wonder, labSide } = DSL.LabKit;
  const code = (sql) => `<code>${DSL.Sql.highlight(sql)}</code>`;
  const progress = DSL.LabKit.createProgress({
    lessonId: "keys",
    labs: [{ id: "ident", name: `${DSL.labLabel("keys", "A")} Identify` }, { id: "point", name: `${DSL.labLabel("keys", "B")} Point` }, { id: "relate", name: `${DSL.labLabel("keys", "C")} Relate` }, { id: "quiz", name: "Practice" }],
  });

  // Probes: run after the learner's SQL; the result is what's graded.
  const PROBE = {
    phone: "INSERT OR IGNORE INTO customers (id, name, phone, joined) VALUES (99, 'Copy', '555-0101', '2024-10-01');\nINSERT OR IGNORE INTO customers (id, name, phone, joined) VALUES (98, 'No phone', NULL, '2024-10-01');\nSELECT (SELECT COUNT(*) FROM customers WHERE phone = '555-0101') AS copies_of_mayas_number, (SELECT COUNT(*) FROM customers WHERE phone IS NULL) AS without_phone",
    price: "INSERT OR IGNORE INTO products_v2 (id, name, price) VALUES (1, 'Free sample', 0);\nINSERT OR IGNORE INTO products_v2 (id, name, price) VALUES (2, 'Refund', -1);\nINSERT OR IGNORE INTO products_v2 (id, name, price) VALUES (3, NULL, 2);\nINSERT OR IGNORE INTO products_v2 (id, name, price) VALUES (4, 'Scone', 2.5);\nSELECT id, name FROM products_v2",
    addresses: "SELECT \"table\", \"from\" FROM pragma_foreign_key_list('addresses')",
    reviews: "SELECT \"table\", \"from\", on_delete FROM pragma_foreign_key_list('reviews')",
    favourites: "SELECT 'foreign key' AS kind, \"table\" || '.' || \"from\" AS detail FROM pragma_foreign_key_list('favourites')\nUNION ALL SELECT 'primary key', name FROM pragma_table_info('favourites') WHERE pk > 0",
    loyalty: "SELECT (SELECT COUNT(*) FROM pragma_foreign_key_list('loyalty_cards') WHERE \"table\" = 'customers' AND \"from\" = 'customer_id') AS points_at_customers,\n  (SELECT COUNT(*) FROM pragma_index_list('loyalty_cards') il, pragma_index_info(il.name) ii WHERE il.\"unique\" = 1 AND ii.name = 'customer_id' AND (SELECT COUNT(*) FROM pragma_index_info(il.name)) = 1)\n  + (SELECT COUNT(*) FROM pragma_table_info('loyalty_cards') WHERE pk = 1 AND name = 'customer_id' AND (SELECT COUNT(*) FROM pragma_table_info('loyalty_cards') WHERE pk > 0) = 1) AS one_card_per_customer",
  };

  const CHALLENGES = {
    ident: [
      { id: "phone", prompt: "Make it impossible for two customers to share a <b>phone</b> number. (A check then tries to add a copy of Maya's number, and a customer with no phone.)", starter: "", solution: "CREATE UNIQUE INDEX customers_phone ON customers (phone)", probe: PROBE.phone, hint: "<code>CREATE UNIQUE INDEX customers_phone ON customers (phone)</code>. SQLite can't add a constraint to an existing table with ALTER TABLE; a unique index enforces the same rule." },
      { id: "price", prompt: "Create <b>products_v2</b> (<b>id</b>, <b>name</b>, <b>price</b>) where every product needs a name and a price above zero. (A check tries four rows; only the valid one should get in.)", starter: "CREATE TABLE products_v2 (\n  id INTEGER PRIMARY KEY,\n  name TEXT,\n  price REAL\n);", solution: "CREATE TABLE products_v2 (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL CHECK (price > 0))", probe: PROBE.price, hint: "<code>name TEXT NOT NULL</code> and <code>price REAL NOT NULL CHECK (price &gt; 0)</code>." },
      { id: "orphans", prompt: "Data quality: this copy of the bakery was loaded with foreign keys switched off. Find <b>orders whose customer doesn't exist</b> (ignoring walk-ins): return the order <b>id</b> and its <b>customer_id</b>.", dataset: "bakeryOrphan", starter: "SELECT o.id, o.customer_id\nFROM orders o\n", solution: "SELECT o.id, o.customer_id FROM orders o LEFT JOIN customers c ON c.id = o.customer_id WHERE o.customer_id IS NOT NULL AND c.id IS NULL", hint: "An anti-join: <code>LEFT JOIN customers c ON c.id = o.customer_id WHERE o.customer_id IS NOT NULL AND c.id IS NULL</code>. Run this before adding a foreign key to old data." },
    ],
    point: [
      { id: "addresses", prompt: "Create <b>addresses</b> (<b>id</b>, <b>customer_id</b>, <b>street</b>) where every address must belong to a real customer.", dataset: "bakeryStrict", starter: "CREATE TABLE addresses (\n  id INTEGER PRIMARY KEY,\n  customer_id INTEGER NOT NULL,\n  street TEXT NOT NULL\n);", solution: "CREATE TABLE addresses (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers (id), street TEXT NOT NULL)", probe: PROBE.addresses, hint: "<code>customer_id INTEGER NOT NULL REFERENCES customers (id)</code>" },
      { id: "reviews", prompt: "Create <b>reviews</b> (<b>id</b>, <b>product_id</b>, <b>stars</b>) whose rows are <b>deleted along with their product</b>.", dataset: "bakeryStrict", starter: "CREATE TABLE reviews (\n  id INTEGER PRIMARY KEY,\n  product_id INTEGER REFERENCES products (id),\n  stars INTEGER\n);", solution: "CREATE TABLE reviews (id INTEGER PRIMARY KEY, product_id INTEGER REFERENCES products (id) ON DELETE CASCADE, stars INTEGER)", probe: PROBE.reviews, hint: "<code>REFERENCES products (id) ON DELETE CASCADE</code>" },
      { id: "delete-lena", prompt: "Foreign keys are on. Delete a customer who can be deleted: <b>Lena</b>, who never ordered. Then return every remaining customer's <b>name</b>.", dataset: "bakeryStrict", starter: "DELETE FROM customers WHERE name = 'Maya';\nSELECT name FROM customers;", solution: "DELETE FROM customers WHERE name = 'Lena'; SELECT name FROM customers", hint: "Run the starter first: deleting Maya fails, because her orders point at her. Lena has nothing pointing at her." },
    ],
    relate: [
      { id: "favourites", prompt: "Customers can favourite many products; a product can be anyone's favourite. Create <b>favourites</b> (<b>customer_id</b>, <b>product_id</b>): two foreign keys, and a primary key made of both.", dataset: "bakeryStrict", starter: "CREATE TABLE favourites (\n  customer_id INTEGER,\n  product_id INTEGER\n);", solution: "CREATE TABLE favourites (customer_id INTEGER REFERENCES customers (id), product_id INTEGER REFERENCES products (id), PRIMARY KEY (customer_id, product_id))", probe: PROBE.favourites, hint: "Each column <code>REFERENCES</code> its table, plus <code>PRIMARY KEY (customer_id, product_id)</code>." },
      { id: "loyalty", prompt: "One-to-one: each customer can have <b>at most one</b> loyalty card. Create <b>loyalty_cards</b> (<b>id</b>, <b>customer_id</b>, <b>points</b>).", dataset: "bakeryStrict", starter: "CREATE TABLE loyalty_cards (\n  id INTEGER PRIMARY KEY,\n  customer_id INTEGER REFERENCES customers (id),\n  points INTEGER\n);", solution: "CREATE TABLE loyalty_cards (id INTEGER PRIMARY KEY, customer_id INTEGER UNIQUE REFERENCES customers (id), points INTEGER)", probe: PROBE.loyalty, hint: "A one-to-many foreign key, made <code>UNIQUE</code>, is one-to-one: <code>customer_id INTEGER UNIQUE REFERENCES customers (id)</code>." },
      { id: "popular", prompt: "Through the junction table: in how many <b>different orders</b> does each product appear? Return the product <b>name</b> and the count, including products in no order.", starter: "SELECT p.name, \nFROM products p\n", solution: "SELECT p.name, COUNT(i.order_id) FROM products p LEFT JOIN order_items i ON i.product_id = p.id GROUP BY p.id", hint: "<code>LEFT JOIN order_items</code> keeps Rye loaf; <code>COUNT(i.order_id)</code> gives it 0. The composite key means a product appears once per order, so no DISTINCT is needed." },
    ],
  };

  // Goals, and the practice that checks them (js/components/practice.js). Every mode states the
  // goals at the start and ends with the recap, the checks and the interview round.
  const PRACTICE = {
    lessonId: "keys",
    goals: [
      {
        id: "identify", icon: "🔑", title: "Identify every row", snippet: "id INTEGER PRIMARY KEY\nphone TEXT UNIQUE",
        text: "Pick a primary key, explain why a surrogate key beats a natural one, and forbid duplicates with UNIQUE.",
        recap: "A <b>primary key</b> is unique and never empty, and a meaningless <b>surrogate key</b> never has to change. <b>UNIQUE</b> guards other columns; NULLs never clash.",
        example: {
          dataset: "bakeryStrict",
          sql: "CREATE UNIQUE INDEX u ON customers (phone);\nINSERT OR IGNORE INTO customers VALUES\n  (98, 'Copy', NULL, '555-0101', '2024-10-01'),\n  (99, 'No phone', NULL, NULL, '2024-10-01');\nSELECT id, name, phone FROM customers\nWHERE id IN (1, 98, 99)",
          note: "The copy of Maya's number was refused; the empty phone went in.",
        },
      },
      {
        id: "point", icon: "🔗", title: "Keep pointers honest", snippet: "customer_id INTEGER\n  REFERENCES customers (id)\n  ON DELETE CASCADE",
        text: "Enforce references with foreign keys, and choose what ON DELETE does when a parent row goes.",
        recap: "A <b>foreign key</b> won't let a pointer dangle: by default it refuses to delete Maya while her orders point at her. CASCADE or SET NULL must be asked for.",
        example: {
          dataset: "bakeryStrict",
          before: "DELETE FROM customers WHERE id = 1",
          sql: "SELECT id, customer_id FROM orders WHERE customer_id = 1 ORDER BY id",
          note: "Refused: Maya's four orders would point at nothing.",
        },
      },
      {
        id: "shape", icon: "🧩", title: "Shape relationships", snippet: "PRIMARY KEY (order_id, product_id)",
        text: "Put the foreign key on the right side for one-to-many and one-to-one, and model many-to-many with a junction table.",
        recap: "One-to-many puts the foreign key on the many side; one-to-one makes it UNIQUE. Many-to-many needs a <b>junction table</b>, like order_items, keyed by both columns.",
        example: {
          sql: "SELECT o.id AS order_id, p.name FROM order_items i JOIN orders o ON o.id = i.order_id JOIN products p ON p.id = i.product_id WHERE o.id IN (1, 3) ORDER BY o.id, p.name",
          mark: (row) => (row[1] === "Croissant" ? "hot" : ""),
          note: "One order, many products; one product, many orders.",
        },
      },
    ],
    checks: [
      { id: "unique-inserts", goal: "identify", prompt: "<code>phone</code> has a UNIQUE constraint. Three new customers arrive with the phones 555-0101 (Maya's), NULL and NULL. Which inserts succeed?", options: ["Only the first NULL", "Both NULLs; the copy of Maya's number is refused", "All three"], answer: 1, why: "UNIQUE compares values, and NULL isn't equal to anything, not even another NULL. So both empty phones go in, and only the real duplicate clashes." },
      { id: "set-null", goal: "point", prompt: "<code>orders.customer_id REFERENCES customers (id) ON DELETE SET NULL</code>. You delete Maya. What happens to her 4 orders?", options: ["They're deleted with her", "They stay, with no customer, like the walk-in orders", "The delete is refused"], answer: 1, why: "SET NULL keeps the child rows and empties their pointer. CASCADE would delete them; with no ON DELETE clause, the delete is refused." },
      { id: "loyalty", goal: "shape", prompt: "Each customer has at most one loyalty card, and each card belongs to one customer. Where does the key go?", options: ["<code>loyalty_cards.customer_id</code> references customers, and is UNIQUE", "A junction table between customers and cards", "A list of card IDs on customers"], answer: 0, why: "One-to-one is one-to-many with the many side capped at one: the same foreign key, made UNIQUE." },
    ],
    warmups: [
      { id: "what-fk", goal: "point", prompt: "What's a foreign key, and what does it protect you from?", options: ["A column whose values must match a row in another table; it stops orphans, pointers to rows that don't exist", "An index that makes joins faster", "A second primary key for the table"], answer: 0, why: "It's a rule, not an index: PostgreSQL won't index it for you. Add an index too, or every join and parent delete scans the child table." },
      { id: "students", goal: "shape", prompt: "Students take many courses, and courses have many students. How do you model it?", options: ["A <code>course_ids</code> column on students", "A junction table with one row per student and course", "A <code>student_id</code> column on courses"], answer: 1, why: "Neither side can hold one pointer. A table in between, enrolments, holds one row per pair, with a composite key on (student_id, course_id)." },
    ],
    open: {
      id: "bakery-schema",
      goal: "shape",
      prompt: "Design the tables for the bakery's customers, orders and products. Walk me through the keys and the relationships.",
      points: [
        "customers, orders and products each get a surrogate primary key, <code>id</code>.",
        "<code>orders.customer_id</code> is a foreign key to customers: one-to-many, so it sits on the many side. Nullable for walk-ins, or NOT NULL if every order needs a customer.",
        "Orders and products are many-to-many: a junction table <code>order_items (order_id, product_id, quantity)</code>.",
        "order_items has a composite primary key, (order_id, product_id), and each column is a foreign key.",
        "Choose ON DELETE on purpose: refuse deleting customers with orders; cascade from an order to its items.",
        "Index the foreign key columns, and put UNIQUE on natural identifiers like email or phone.",
      ],
      answer: "Three entity tables, customers, orders and products, each with a surrogate integer ID as the primary key, because natural keys like emails change. An order belongs to one customer, and a customer has many orders, so orders gets a customer_id foreign key; I'd allow NULL only if walk-in orders exist. Orders and products are many-to-many, so a junction table, order_items, holds one row per order and product, with the quantity, a composite primary key on (order_id, product_id), and a foreign key on each column. For deletes, I'd leave customers restricted, so you can't orphan orders, and cascade from orders to their items. I'd also index the foreign keys for joins, and add a UNIQUE constraint on the customer's email or phone.",
    },
  };
  DSL.Practice.registerCards(PRACTICE);

  const SHAPES = [
    ["One-to-many", "customer → orders", "orders.customer_id REFERENCES customers (id)"],
    ["One-to-one", "customer → loyalty card", "loyalty_cards.customer_id UNIQUE REFERENCES customers (id)"],
    ["Many-to-many", "orders ↔ products", "order_items (order_id, product_id), PRIMARY KEY (order_id, product_id)"],
  ];

  function labSection(id, letter, kicker, title, copy, body) {
    return `<section class="lab" id="lab-${id}">
      <div class="lab-top"><div><span class="lab-kicker">${kicker}</span><h2>${title}</h2><p class="lab-copy">${copy}</p></div>${labSide(DSL.labLabel("keys", letter))}</div>
      ${body}
      <div class="sel-set" data-set="${id}"></div>
    </section>`;
  }

  function renderKeys() {
    const lesson = DSL.getLesson("keys");
    DSL.elements.root.innerHTML = `
      <article class="lesson sel">
        ${DSL.lessonHeader(lesson, "Keys the database <em>enforces</em>.", "Primary keys, unique constraints, foreign keys, and the shapes relationships take. Schema design questions in interviews are mostly about these, and about what happens when you delete something.")}
        <div class="pr-intro"><p class="pr-kicker">By the end, you'll be able to</p>${DSL.Practice.cardsMarkup(PRACTICE, { compact: true })}</div>
        ${progress.markup()}

        <div class="insight"><span class="insight-mark">//</span><p>Exercises here change the schema: create tables, add constraints, delete rows. Each run starts from a fresh copy, and a <b>check</b> query runs afterwards to test what you built. Some labs switch foreign-key enforcement on: SQLite leaves it off unless asked (<code>PRAGMA foreign_keys = ON</code>).</p></div>

        ${labSection("ident", "A", "Identify", "Primary keys, UNIQUE, NOT NULL and CHECK", "A <b>primary key</b> identifies each row: unique and never NULL. Other constraints guard the rest of the row, so bad data is refused at the door instead of cleaned up later.", `
          <div class="sel-notes">
            <div><h3>Natural or surrogate?</h3><p>A natural key (email, phone, ISBN) has meaning, and meaning changes. A <b>surrogate key</b> (1, 2, 3, or a UUID) never needs to. Keep the natural value too, with a UNIQUE constraint on it.</p></div>
            <div><h3>Integer or UUID?</h3><p>Integers are small and keep inserts at the end of the index. Random UUIDv4s scatter inserts across the B-tree; time-ordered UUIDv7s don't. ${DSL.lessonRef("btree-writes")} shows the difference.</p></div>
            <div><h3>UNIQUE and NULL</h3><p>Most engines let a UNIQUE column hold many NULLs, since unknown ≠ unknown. PostgreSQL 15+ can forbid that: <code>UNIQUE NULLS NOT DISTINCT</code>.</p></div>
          </div>`)}

        ${labSection("point", "B", "Point", "Foreign keys, and what happens on delete", "A <b>foreign key</b> must match a key in the other table, or be NULL. The database checks it on every insert and update, and when the row it points at is deleted.", `
          <div class="sel-ops"><table class="sel-table"><thead><tr><th>ON DELETE</th><th>Deleting a customer with orders…</th><th>Use when</th></tr></thead><tbody>
            <tr><td><code>NO ACTION / RESTRICT</code></td><td>is refused (the default)</td><td>child rows matter on their own: orders, payments</td></tr>
            <tr><td><code>CASCADE</code></td><td>deletes their orders too</td><td>children mean nothing without the parent: a draft's lines</td></tr>
            <tr><td><code>SET NULL</code></td><td>keeps the orders, customer_id becomes NULL</td><td>the link is optional: an assigned-to user</td></tr>
          </tbody></table></div>
          ${wonder("Do real systems use foreign keys?", "Often yes, sometimes deliberately not. They cost a lookup on every insert and complicate sharding and bulk loads, so some large systems check in application code instead. Then you need the orphan check from Lab A, run regularly. In an interview, say both: the database guarantees it, or you own the check.")}`)}

        ${labSection("relate", "C", "Relate", "Cardinality and junction tables", "One-to-many puts the foreign key on the many side. One-to-one is that key made UNIQUE. Many-to-many needs a <b>junction table</b> with one row per pair and a <b>composite key</b>.", `
          <div class="sel-ops"><table class="sel-table"><thead><tr><th>Shape</th><th>Example</th><th>How</th></tr></thead><tbody>${SHAPES.map(([shape, example, how]) => `<tr><td><code>${shape}</code></td><td>${example}</td><td>${code(how)}</td></tr>`).join("")}</tbody></table></div>
          ${wonder("Why not a comma-separated list of product IDs on each order?", "It breaks first normal form: you can't index it, join it, or enforce it with a foreign key, and \"which orders contain croissants?\" becomes string searching. A junction table is one row per pair, and every tool in SQL works on it.")}`)}

        ${DSL.Practice.exploreMarkup(PRACTICE)}

        <div class="insight"><span class="insight-mark">!</span><p><strong>Transferable idea:</strong> for each relationship, say its cardinality, where the foreign key lives, and what should happen when the thing it points at is deleted.</p></div>
        ${DSL.lessonFooter("keys")}
      </article>`;

    progress.mount();
    Object.entries(CHALLENGES).forEach(([labId, list]) => {
      DSL.Sql.challenges(DSL.elements.root.querySelector(`[data-set="${labId}"]`), list, {
        storageKey: `keys-${labId}`,
        onAllDone: () => progress.complete(labId),
      });
    });
    DSL.Practice.mountExplore(document.getElementById("lab-quiz"), PRACTICE, { onPass: () => progress.complete("quiz") });
  }

  DSL.KeysModel = Object.freeze({ PRACTICE, CHALLENGES, PROBE, progress });
  DSL.registerRenderer("keys", renderKeys);
})(window.DataSystemsLab);
