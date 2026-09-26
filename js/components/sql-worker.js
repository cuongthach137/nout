/* SQL worker for js/components/sql.js. One message per query: { id, schema, sql } →
   { id, columns, rows, ms } for the last statement that returns columns, or { id, error }.
   Each query gets a fresh in-memory database, built from `schema`. Asking each statement for its
   column names (rather than using sql.js's exec) keeps the columns of a query that matches no rows. */
importScripts("../../vendor/sql.js/sql-wasm.js");

const ready = initSqlJs({ locateFile: (file) => `../../vendor/sql.js/${file}` });

self.onmessage = async ({ data }) => {
  const { id, schema, sql } = data;
  let db = null;
  try {
    const SQL = await ready;
    db = new SQL.Database();
    if (schema) db.exec(schema);
    const started = performance.now();
    let last = null;
    for (const statement of db.iterateStatements(sql)) {
      const columns = statement.getColumnNames();
      const rows = [];
      while (statement.step()) rows.push(statement.get());
      if (columns.length) last = { columns, rows };
    }
    self.postMessage({ id, columns: last ? last.columns : [], rows: last ? last.rows : [], ms: performance.now() - started });
  } catch (error) {
    self.postMessage({ id, error: error && error.message ? error.message : String(error) });
  } finally {
    if (db) db.close();
  }
};
