(function registerSqlSandbox(DSL) {
  "use strict";

  // A free SQL scratchpad on the bakery data (#/sql). The SQL lessons use the same engine with a
  // checker; here nothing is graded. The last query is kept in this browser.

  const EXAMPLES = [
    ["Customers in Lisbon", "SELECT name, phone\nFROM customers\nWHERE city = 'Lisbon';"],
    ["Orders with names", "SELECT o.id, o.ordered_at, c.name\nFROM orders o\nJOIN customers c ON c.id = o.customer_id\nORDER BY o.ordered_at;"],
    ["Revenue per product", "SELECT p.name, SUM(i.quantity * p.price) AS revenue\nFROM order_items i\nJOIN products p ON p.id = i.product_id\nGROUP BY p.name\nORDER BY revenue DESC;"],
    ["Customers with no orders", "SELECT c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;"],
  ];

  function render() {
    DSL.elements.root.innerHTML = `<article class="lesson sql-page">
      <header class="lesson-header">
        <div class="eyebrow">Practice</div>
        <h1>SQL sandbox</h1>
        <p class="lede">Maya's bakery, as four tables. Query anything you like: every run starts from a fresh copy, so nothing you change sticks.</p>
      </header>
      <div class="sql-examples" aria-label="Example queries"><span>Try</span>${EXAMPLES.map(([label], i) => `<button type="button" class="sql-chip" data-example="${i}">${label}</button>`).join("")}</div>
      <section class="lab sql-sandbox"></section>
    </article>`;
    const lab = DSL.Sql.lab(DSL.elements.root.querySelector(".sql-sandbox"), {
      dataset: "bakery",
      starter: "SELECT *\nFROM customers;",
      storageKey: "sql-sandbox",
    });
    DSL.elements.root.querySelector(".sql-examples").addEventListener("click", (event) => {
      const chip = event.target.closest("[data-example]");
      if (!chip) return;
      lab.setSql(EXAMPLES[Number(chip.dataset.example)][1]);
      lab.run();
    });
    lab.run();
  }

  DSL.registerPage("sql", { title: "SQL sandbox", icon: "⌨", render });
})(window.DataSystemsLab);
