(function registerSql(DSL) {
  "use strict";

  // In-browser SQL: SQLite (sql.js, vendored under vendor/sql.js) running in a Web Worker
  // (js/components/sql-worker.js), a checker that compares a learner's result with the expected
  // rows, and a lab widget (schema, editor, result, verdict) that all three modes mount.
  //
  // Every query runs against a fresh copy of its dataset, so nothing a learner runs (an UPDATE, a
  // DROP) carries over. The worker is started on first use; a query that runs too long (a
  // recursive CTE with no stop, say) is cut off by terminating the worker.

  const WORKER_URL = "js/components/sql-worker.js";
  const TIMEOUT_MS = 3000;
  const SHOW_ROWS = 100;

  // ---------- Datasets ----------

  // Maya's bakery, the running story of the SQL lessons. It has deliberate edge cases: customers
  // with no orders (Lena, Theo), a NULL city (Raj) and NULL phones, walk-in orders with no
  // customer, a product nobody has ordered (Rye loaf), and orders that aren't paid.
  const BAKERY = `
CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  phone TEXT,
  joined TEXT NOT NULL
);
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER REFERENCES customers (id),
  ordered_at TEXT NOT NULL,
  status TEXT NOT NULL
);
CREATE TABLE order_items (
  order_id INTEGER NOT NULL REFERENCES orders (id),
  product_id INTEGER NOT NULL REFERENCES products (id),
  quantity INTEGER NOT NULL,
  PRIMARY KEY (order_id, product_id)
);
INSERT INTO customers VALUES
  (1, 'Maya', 'Lisbon', '555-0101', '2024-01-15'),
  (2, 'Omar', 'Osaka', NULL, '2024-02-03'),
  (3, 'Ana', 'Lisbon', '555-0103', '2024-02-20'),
  (4, 'Lena', 'Oslo', '555-0104', '2024-03-11'),
  (5, 'Raj', NULL, '555-0105', '2024-03-28'),
  (6, 'Kofi', 'Accra', NULL, '2024-04-09'),
  (7, 'Yuki', 'Osaka', '555-0107', '2024-05-02'),
  (8, 'Ines', 'Lisbon', NULL, '2024-05-19'),
  (9, 'Theo', 'Lyon', '555-0109', '2024-06-07'),
  (10, 'Priya', 'Pune', '555-0110', '2024-06-30');
INSERT INTO products VALUES
  (1, 'Croissant', 'pastry', 3.20),
  (2, 'Pain au chocolat', 'pastry', 3.60),
  (3, 'Sourdough loaf', 'bread', 6.50),
  (4, 'Baguette', 'bread', 2.80),
  (5, 'Cinnamon roll', 'pastry', 4.10),
  (6, 'Carrot cake slice', 'cake', 4.75),
  (7, 'Rye loaf', 'bread', 5.90),
  (8, 'Lemon tart', 'cake', 5.25);
INSERT INTO orders VALUES
  (1, 1, '2024-09-02', 'paid'),
  (2, 2, '2024-09-02', 'paid'),
  (3, 1, '2024-09-05', 'paid'),
  (4, 3, '2024-09-06', 'paid'),
  (5, NULL, '2024-09-06', 'paid'),
  (6, 5, '2024-09-09', 'refunded'),
  (7, 6, '2024-09-10', 'paid'),
  (8, 1, '2024-09-12', 'pending'),
  (9, 7, '2024-09-13', 'paid'),
  (10, 3, '2024-09-15', 'paid'),
  (11, 8, '2024-09-16', 'paid'),
  (12, 2, '2024-09-18', 'pending'),
  (13, 10, '2024-09-20', 'paid'),
  (14, NULL, '2024-09-21', 'paid'),
  (15, 7, '2024-09-22', 'paid'),
  (16, 1, '2024-09-25', 'paid');
INSERT INTO order_items VALUES
  (1, 1, 2), (1, 3, 1),
  (2, 2, 3),
  (3, 1, 1), (3, 5, 2),
  (4, 6, 1),
  (5, 4, 2),
  (6, 8, 1),
  (7, 3, 1), (7, 4, 1),
  (8, 2, 4),
  (9, 5, 1), (9, 6, 1),
  (10, 1, 6),
  (11, 8, 2),
  (12, 3, 2),
  (13, 2, 1), (13, 1, 1),
  (14, 4, 3),
  (15, 6, 2),
  (16, 5, 1), (16, 3, 1);
`;

  const datasets = { bakery: BAKERY };
  const schemaOf = (dataset) => datasets[dataset] || dataset;

  // ---------- Worker ----------

  let worker = null;
  let nextId = 0;
  const pending = new Map();

  function startWorker() {
    worker = new Worker(WORKER_URL);
    worker.onmessage = ({ data }) => {
      const entry = pending.get(data.id);
      if (!entry) return;
      pending.delete(data.id);
      if (data.error) entry.reject(new Error(data.error));
      else entry.resolve(data);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      failAll(new Error("The SQL engine couldn't start. Reload the page and try again."));
    };
  }

  function failAll(error) {
    pending.forEach((entry) => entry.reject(error));
    pending.clear();
    if (worker) worker.terminate();
    worker = null;
  }

  function send(message) {
    if (!worker) startWorker();
    const id = (nextId += 1);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...message, id });
    });
  }

  // Queries run one at a time, so a fresh database is never swapped out under a running one.
  let queue = Promise.resolve();

  // Run `sql` against a fresh copy of `dataset` (a name from datasets, or schema SQL).
  // Resolves { columns, rows, ms } for the last statement that returned rows, or { error }.
  function run(dataset, sql) {
    const job = queue.then(() => execute(schemaOf(dataset), sql));
    queue = job.catch(() => {});
    return job;
  }

  async function execute(schema, sql) {
    if (!sql || !sql.trim()) return { error: "Write a query first." };
    let timer = null;
    const timeout = new Promise((resolve) => {
      timer = window.setTimeout(() => {
        failAll(new Error("timeout"));
        resolve({ error: `The query ran for more than ${TIMEOUT_MS / 1000} seconds, so it was stopped. A recursive query with no stopping condition, or a join with no ON?`, timedOut: true });
      }, TIMEOUT_MS);
    });
    const work = send({ schema, sql })
      .then(({ columns, rows, ms }) => ({ columns, rows, ms }))
      .catch((error) => (error.message === "timeout" ? { error: "" } : { error: friendly(error.message), raw: error.message }));
    const result = await Promise.race([work, timeout]);
    window.clearTimeout(timer);
    return result;
  }

  // SQLite's messages, reworded for someone learning SQL. The original stays in `raw`.
  function friendly(message) {
    const rules = [
      [/no such column: (.+)/, (m) => `There's no column called ${m[1]}. Check the spelling, and which table it belongs to.`],
      [/no such table: (.+)/, (m) => `There's no table called ${m[1]}. The tables are listed above the editor.`],
      [/ambiguous column name: (.+)/, (m) => `More than one table has a column called ${m[1]}. Say which one you mean, like orders.${m[1].split(".").pop()}.`],
      [/near "(.+)": syntax error/, (m) => `SQLite couldn't read the query near “${m[1]}”. Check for a missing comma, keyword or bracket just before it.`],
      [/incomplete input/, () => "The query ends too early. Is a bracket or a quote left open?"],
      [/misuse of aggregate/, () => "An aggregate like COUNT or SUM is used where it can't be. Filter groups with HAVING, not WHERE."],
      [/must appear in the GROUP BY|not an aggregate/, () => "Every selected column must be in the GROUP BY, or inside an aggregate like COUNT or SUM."],
      [/SELECTs to the left and right of (\w+) do not have the same number of result columns/, (m) => `Both sides of ${m[1]} must return the same number of columns.`],
    ];
    for (const [pattern, reword] of rules) {
      const match = message.match(pattern);
      if (match) return reword(match);
    }
    return message;
  }

  // ---------- Checker ----------

  // Values as the checker sees them: numbers are rounded so 0.1 + 0.2 matches 0.3, and 2 matches 2.0.
  const norm = (value) => (typeof value === "number" ? Math.round(value * 1e6) / 1e6 : value);
  const rowKey = (row) => JSON.stringify(row.map(norm));

  // Compare an actual result with the expected one. Column names are ignored (aliases vary); column
  // order and count matter. Row order matters only when `ordered` is set.
  // → { ok, reason, missing: [rows], extra: [rows] }
  function compare(actual, expected, { ordered = false } = {}) {
    if (actual.error) return { ok: false, reason: "error", missing: [], extra: [] };
    if (actual.columns.length !== expected.columns.length) {
      return { ok: false, reason: "columns", missing: [], extra: [], message: `Your result has ${plural(actual.columns.length, "column")}; the answer has ${expected.columns.length}.` };
    }
    const counts = new Map();
    expected.rows.forEach((row) => counts.set(rowKey(row), (counts.get(rowKey(row)) || 0) + 1));
    const extra = [];
    actual.rows.forEach((row) => {
      const key = rowKey(row);
      if (counts.get(key)) counts.set(key, counts.get(key) - 1);
      else extra.push(row);
    });
    const missing = [];
    const left = new Map(counts);
    expected.rows.forEach((row) => {
      const key = rowKey(row);
      if (left.get(key)) {
        missing.push(row);
        left.set(key, left.get(key) - 1);
      }
    });
    if (missing.length || extra.length) {
      const parts = [];
      if (missing.length) parts.push(`${plural(missing.length, "row")} missing`);
      if (extra.length) parts.push(`${plural(extra.length, "row")} that shouldn't be there`);
      const duplicates = extra.length && extra.every((row) => expected.rows.some((e) => rowKey(e) === rowKey(row)));
      return { ok: false, reason: missing.length && extra.length ? "rows" : missing.length ? "missing" : duplicates ? "duplicates" : "extra", missing, extra, message: `Close: ${parts.join(" and ")}.${duplicates ? " Some rows appear more than once." : ""}` };
    }
    if (ordered && actual.rows.some((row, i) => rowKey(row) !== rowKey(expected.rows[i]))) {
      return { ok: false, reason: "order", missing: [], extra: [], message: "Right rows, wrong order. Check the ORDER BY." };
    }
    return { ok: true, reason: "ok", missing: [], extra: [], message: "That's the answer." };
  }

  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  // ---------- Rendering ----------

  const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function cell(value) {
    if (value === null) return `<td class="sql-null">NULL</td>`;
    if (typeof value === "number") return `<td class="sql-num">${Number.isInteger(value) ? value : Number(value.toFixed(4))}</td>`;
    return `<td>${escapeHtml(value)}</td>`;
  }

  // A result as a table. mark: rows to tint, as a Set of row keys → class name.
  function tableMarkup(result, { mark = new Map(), limit = SHOW_ROWS } = {}) {
    if (!result.columns.length) return `<p class="sql-empty">The query ran, but returned no table.</p>`;
    const shown = result.rows.slice(0, limit);
    const counts = new Map(mark);
    return `<div class="sql-table-wrap"><table class="sql-table">
      <thead><tr>${result.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join("")}</tr></thead>
      <tbody>${shown.map((row) => {
        const key = rowKey(row);
        const tone = counts.get(key);
        if (tone) counts.delete(key);
        return `<tr${tone ? ` class="${tone}"` : ""}>${row.map(cell).join("")}</tr>`;
      }).join("") || `<tr><td class="sql-none" colspan="${result.columns.length}">No rows</td></tr>`}</tbody>
    </table></div>
    <p class="sql-count">${plural(result.rows.length, "row")}${result.rows.length > limit ? `, first ${limit} shown` : ""}</p>`;
  }

  // Tables and columns of a dataset, for the schema panel.
  const schemaCache = new Map();
  function describe(dataset) {
    if (!schemaCache.has(dataset)) {
      schemaCache.set(dataset, run(dataset, "SELECT m.name, p.name, p.type, p.pk FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type = 'table' ORDER BY m.rowid, p.cid").then((result) => {
        if (result.error) throw new Error(result.error);
        const tables = [];
        result.rows.forEach(([table, column, type, pk]) => {
          let entry = tables[tables.length - 1];
          if (!entry || entry.name !== table) tables.push((entry = { name: table, columns: [] }));
          entry.columns.push({ name: column, type: type.toLowerCase(), pk: pk > 0 });
        });
        return tables;
      }));
    }
    return schemaCache.get(dataset);
  }

  function schemaMarkup(tables) {
    return tables.map((table) => `<div class="sql-schema-table"><b>${table.name}</b><span>${table.columns.map((column) => `<code class="${column.pk ? "pk" : ""}" title="${column.type}">${column.name}</code>`).join("")}</span></div>`).join("");
  }

  // ---------- Lab ----------

  // A SQL exercise: schema, editor, result, verdict.
  // options = { dataset, starter, solution?, ordered?, showGoal?, placeholder?, onResult?(result, verdict), storageKey? }
  // Without a solution it's a free sandbox. Returns { passed: Promise, run(), setSql(sql), element }.
  function lab(container, options) {
    const { dataset = "bakery", starter = "", solution = null, ordered = false, showGoal = Boolean(solution), placeholder = "SELECT …", onResult, storageKey } = options;
    const saved = storageKey ? DSL.store.get(storageKey, null) : null;
    container.innerHTML = `<div class="sql-lab">
      <div class="sql-schema" aria-label="Tables"><span class="sql-loading">Loading tables…</span></div>
      ${showGoal ? `<details class="sql-goal"><summary>Expected result</summary><div class="sql-goal-body"></div></details>` : ""}
      <div class="sql-editor">
        <textarea class="sql-input" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="SQL query" placeholder="${escapeHtml(placeholder)}" rows="5"></textarea>
        <div class="sql-actions">
          <button type="button" class="button primary sql-run">Run <kbd>${/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"} ↵</kbd></button>
          <button type="button" class="button ghost sql-reset">Reset</button>
          <span class="sql-verdict" aria-live="polite"></span>
        </div>
      </div>
      <div class="sql-out" aria-live="polite"></div>
    </div>`;
    const root = container.firstElementChild;
    const input = root.querySelector(".sql-input");
    const out = root.querySelector(".sql-out");
    const verdictEl = root.querySelector(".sql-verdict");
    const runButton = root.querySelector(".sql-run");
    input.value = typeof saved === "string" ? saved : starter;
    fit();

    let finish;
    const passed = new Promise((resolve) => { finish = resolve; });
    const expected = solution ? run(dataset, solution) : Promise.resolve(null);

    describe(dataset).then((tables) => { root.querySelector(".sql-schema").innerHTML = schemaMarkup(tables); })
      .catch((error) => { root.querySelector(".sql-schema").innerHTML = `<span class="sql-error-text">${escapeHtml(error.message)}</span>`; });
    if (showGoal) expected.then((result) => { if (result && !result.error) root.querySelector(".sql-goal-body").innerHTML = tableMarkup(result); });

    function fit() {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight + 2, 320)}px`;
    }

    function setVerdict(text, tone) {
      verdictEl.textContent = text;
      verdictEl.className = `sql-verdict ${tone || ""}`;
    }

    async function go() {
      const sql = input.value;
      if (storageKey) DSL.store.set(storageKey, sql);
      runButton.disabled = true;
      setVerdict("Running…");
      const [result, goal] = await Promise.all([run(dataset, sql), expected]);
      runButton.disabled = false;
      if (!root.isConnected) return;
      if (result.error) {
        out.innerHTML = `<div class="sql-error"><b>Error</b><p>${escapeHtml(result.error)}</p>${result.raw && result.raw !== result.error ? `<small>SQLite: ${escapeHtml(result.raw)}</small>` : ""}</div>`;
        setVerdict("");
        if (onResult) onResult(result, { ok: false, reason: result.timedOut ? "timeout" : "error" });
        return;
      }
      if (!goal) {
        out.innerHTML = tableMarkup(result);
        setVerdict(`${result.ms.toFixed(1)} ms`);
        if (onResult) onResult(result, null);
        return;
      }
      const verdict = compare(result, goal, { ordered });
      const mark = new Map(verdict.extra.map((row) => [rowKey(row), "sql-extra"]));
      out.innerHTML = tableMarkup(result, { mark })
        + (verdict.missing.length ? `<div class="sql-missing"><b>Missing from your result</b>${tableMarkup({ columns: goal.columns, rows: verdict.missing })}</div>` : "");
      setVerdict(verdict.ok ? `✓ ${verdict.message}` : verdict.message, verdict.ok ? "ok" : "warn");
      root.classList.toggle("is-passed", verdict.ok);
      if (verdict.ok) {
        DSL.LabKit.retrigger(verdictEl, "gd-pop");
        DSL.LabKit.burst(verdictEl, { count: 14 });
        finish(result);
      }
      if (onResult) onResult(result, verdict);
    }

    runButton.addEventListener("click", go);
    root.querySelector(".sql-reset").addEventListener("click", () => {
      input.value = starter;
      if (storageKey) DSL.store.set(storageKey, starter);
      out.innerHTML = "";
      setVerdict("");
      fit();
      input.focus();
    });
    input.addEventListener("input", fit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        go();
      } else if (event.key === "Tab" && !event.shiftKey) {
        event.preventDefault();
        input.setRangeText("  ", input.selectionStart, input.selectionEnd, "end");
      }
    });

    return {
      element: root,
      passed,
      run: go,
      setSql(sql) { input.value = sql; fit(); },
    };
  }

  // ---------- Code display ----------

  const KEYWORDS = /\b(SELECT|DISTINCT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|LIKE|BETWEEN|AS|ORDER|GROUP|BY|HAVING|ASC|DESC|LIMIT|OFFSET|JOIN|LEFT|RIGHT|FULL|INNER|OUTER|ON|WITH|UNION|ALL|CASE|WHEN|THEN|ELSE|END|COUNT|SUM|AVG|MIN|MAX|OVER|PARTITION|ROW_NUMBER|RANK|DENSE_RANK|LAG|LEAD|FIRST_VALUE|LAST_VALUE|ROWS|RANGE|PRECEDING|FOLLOWING|CURRENT|ROW|UNBOUNDED|RECURSIVE|EXISTS|CROSS)\b/g;

  // SQL as highlighted HTML (keywords, strings, numbers). Not a parser: good enough for display.
  function highlight(sql) {
    return String(sql).split(/('(?:[^']|'')*')/).map((part, i) => {
      if (i % 2) return `<span class="sq-str">${escapeHtml(part)}</span>`;
      return escapeHtml(part)
        .replace(KEYWORDS, `<b class="sq-kw">$1</b>`)
        .replace(/(^|[^\w.])(\d+(?:\.\d+)?)(?!\w)/g, `$1<span class="sq-num">$2</span>`);
    }).join("");
  }

  // ---------- Challenge sets ----------

  // A numbered set of SQL exercises sharing one lab area (Explore pages).
  // challenges = [{ id, prompt, starter, solution, ordered?, hint? }]
  // options = { dataset, storageKey, onPass(id), onAllDone() }
  function challenges(container, list, { dataset = "bakery", storageKey, onPass, onAllDone } = {}) {
    const passed = new Set(storageKey ? DSL.store.get(storageKey, []) : []);
    let current = Math.max(0, list.findIndex((challenge) => !passed.has(challenge.id)));
    container.innerHTML = `<div class="sql-set">
      <div class="sql-set-tabs" role="tablist">${list.map((challenge, i) => `<button type="button" role="tab" data-i="${i}">${i + 1}</button>`).join("")}</div>
      <p class="sql-set-prompt"></p>
      <details class="sql-hint" hidden><summary>Hint</summary><p></p></details>
      <div class="sql-set-lab"></div>
    </div>`;
    const root = container.firstElementChild;

    function paintTabs() {
      root.querySelectorAll(".sql-set-tabs button").forEach((tab, i) => {
        tab.setAttribute("aria-selected", String(i === current));
        tab.classList.toggle("done", passed.has(list[i].id));
        tab.textContent = passed.has(list[i].id) ? "✓" : String(i + 1);
      });
    }

    function show(i) {
      current = i;
      const challenge = list[i];
      root.querySelector(".sql-set-prompt").innerHTML = challenge.prompt;
      const hint = root.querySelector(".sql-hint");
      hint.hidden = !challenge.hint;
      hint.open = false;
      hint.querySelector("p").innerHTML = challenge.hint || "";
      paintTabs();
      const exercise = lab(root.querySelector(".sql-set-lab"), { dataset, starter: challenge.starter, solution: challenge.solution, ordered: challenge.ordered });
      exercise.passed.then(() => {
        if (passed.has(challenge.id)) return;
        passed.add(challenge.id);
        if (storageKey) DSL.store.set(storageKey, [...passed]);
        paintTabs();
        if (onPass) onPass(challenge.id);
        if (list.every((c) => passed.has(c.id)) && onAllDone) onAllDone();
      });
    }

    root.querySelector(".sql-set-tabs").addEventListener("click", (event) => {
      const tab = event.target.closest("[data-i]");
      if (tab) show(Number(tab.dataset.i));
    });
    show(current);
    return { show };
  }

  DSL.Sql = Object.freeze({ datasets, run, compare, friendly, tableMarkup, describe, lab, highlight, challenges });
})(window.DataSystemsLab);
