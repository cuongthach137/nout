(function registerSpecializedIndexesLesson(DSL) {
  "use strict";

  const FAMILIES = {
    postgres: {
      text: { family: "GIN", structure: "inverted", sql: "CREATE INDEX docs_search_idx ON docs\nUSING GIN (to_tsvector('english', body));", pages: 12, candidates: 84, size: "1.8 GiB", writes: "high", note: "GIN maps extracted lexemes to posting lists; it is purpose-built for containment and full-text membership." },
      geo: { family: "GiST", structure: "spatial", sql: "CREATE INDEX places_location_idx ON places\nUSING GiST (location);", pages: 9, candidates: 31, size: "780 MiB", writes: "medium", note: "GiST supplies a generalized tree and operator classes for overlap and nearest-neighbor searches." },
      tags: { family: "GIN", structure: "inverted", sql: "CREATE INDEX events_tags_idx ON events\nUSING GIN (tags);", pages: 7, candidates: 142, size: "2.4 GiB", writes: "high", note: "Each array or JSON component can become a searchable inverted key with a posting list." },
      time: { family: "BRIN", structure: "ranges", sql: "CREATE INDEX events_created_brin ON events\nUSING BRIN (created_at) WITH (pages_per_range=128);", pages: 128, candidates: 12000, size: "18 MiB", writes: "low", note: "BRIN stores summaries per physical block range. It is tiny and lossy, and succeeds when time correlates with row placement." },
      prefix: { family: "SP-GiST", structure: "radix", sql: "CREATE INDEX routes_prefix_idx ON routes\nUSING SPGIST (network inet_ops);", pages: 10, candidates: 64, size: "640 MiB", writes: "medium", note: "SP-GiST supports partitioned search structures such as radix trees and quadtrees for suitable operator classes." },
    },
    mysql: {
      text: { family: "FULLTEXT", structure: "inverted", sql: "CREATE FULLTEXT INDEX docs_body_ft\nON docs (body);", pages: 15, candidates: 92, size: "2.1 GiB", writes: "high", note: "InnoDB FULLTEXT tokenizes text and maintains a dedicated full-text structure; use MATCH ... AGAINST rather than LIKE '%term%'." },
      geo: { family: "SPATIAL", structure: "spatial", sql: "CREATE SPATIAL INDEX places_location_sp\nON places (location);", pages: 11, candidates: 38, size: "840 MiB", writes: "medium", note: "InnoDB SPATIAL indexes support geometry predicates; indexed spatial columns must satisfy engine restrictions such as NOT NULL." },
      tags: { family: "multi-valued", structure: "inverted", sql: "CREATE INDEX events_tags_mv ON events\n((CAST(tags->'$[*]' AS CHAR(32) ARRAY)));", pages: 13, candidates: 142, size: "2.7 GiB", writes: "high", note: "A multi-valued index can emit several secondary records for one JSON array row; it cannot serve range or index-only scans." },
      time: { family: "B-tree", structure: "ranges", sql: "CREATE INDEX events_created_idx\nON events (created_at);", pages: 14, candidates: 8600, size: "1.5 GiB", writes: "medium", note: "InnoDB has no BRIN equivalent. A B-tree is larger but provides exact ordered keys and range traversal." },
      prefix: { family: "B-tree prefix", structure: "radix", sql: "CREATE INDEX routes_prefix_idx\nON routes (network(16));", pages: 18, candidates: 210, size: "920 MiB", writes: "medium", note: "A string prefix index can reduce key width, but it is not an SP-GiST radix tree and must recheck collisions beyond the stored prefix." },
    },
    sqlite: {
      text: { family: "FTS5", structure: "inverted", sql: "CREATE VIRTUAL TABLE docs_fts\nUSING fts5(title, body, content='docs');", pages: 16, candidates: 88, size: "2.0 GiB", writes: "high", note: "FTS5 is a virtual-table module with term-to-doclist storage, tokenizers, ranking, and its own synchronization choices." },
      geo: { family: "R*Tree", structure: "spatial", sql: "CREATE VIRTUAL TABLE places_rtree\nUSING rtree(id, minX, maxX, minY, maxY);", pages: 12, candidates: 36, size: "810 MiB", writes: "medium", note: "The R*Tree virtual table indexes bounding rectangles; the application joins candidate ids back to domain rows." },
      tags: { family: "side table + B-tree", structure: "inverted", sql: "CREATE TABLE event_tags(event_id, tag,\n  PRIMARY KEY(tag, event_id)) WITHOUT ROWID;", pages: 19, candidates: 142, size: "2.2 GiB", writes: "high", note: "SQLite core has no JSON multi-valued index. A normalized membership table makes the inverted relationship explicit and constrainable." },
      time: { family: "B-tree", structure: "ranges", sql: "CREATE INDEX events_created_idx\nON events (created_at);", pages: 17, candidates: 8600, size: "1.4 GiB", writes: "medium", note: "SQLite has no BRIN family. An ordinary B-tree provides exact ordered range access." },
      prefix: { family: "B-tree / FTS5 prefix", structure: "radix", sql: "CREATE VIRTUAL TABLE routes_fts\nUSING fts5(prefix, prefix='2 4 8');", pages: 20, candidates: 190, size: "1.0 GiB", writes: "high", note: "FTS5 prefix indexes can accelerate token-prefix search; a normal B-tree remains appropriate for lexicographic ranges." },
    },
  };

  const QUESTIONS = [
    { prompt: "A 4 TB append-mostly PostgreSQL event table is ordered by created_at. Which tiny lossy family should you benchmark first?", options: ["BRIN", "GIN", "Hash"], answer: 0, why: "BRIN summarizes physical block ranges and benefits from correlation between the time key and row placement." },
    { prompt: "A MySQL JSON array contains many tags per event. Which native index can emit multiple records for one row?", options: ["FULLTEXT", "Multi-valued index", "Primary key"], answer: 1, why: "InnoDB multi-valued indexes index array elements and may create multiple secondary entries per clustered record." },
    { prompt: "Which SQLite feature is a virtual table for document search rather than a normal CREATE INDEX family?", options: ["FTS5", "BRIN", "GiST"], answer: 0, why: "FTS5 is an SQLite virtual-table module with its own token and doclist structures." },
  ];

  function renderSpecializedIndexes() {
    const lesson = DSL.getLesson("specialized-indexes");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Choose an index by the <em>question it can answer.</em>", "B-trees compare ordered scalar keys. Text tokens, spatial overlap, array membership, network prefixes, and physically correlated ranges need structures whose pruning rule matches those semantics.", "Advanced")}
      <div class="engine-levels standalone-levels"><span>1 · query semantics</span><span>2 · internal structure</span><span>3 · evidence</span><span>4 · family choice</span></div>

      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">Levels 1–2 · Lab 27</span><h2>Match a workload to an index family</h2><p class="lab-copy">The counters are deliberately modeled for comparison, not claimed measurements. Switch engines to see when the same workload maps to a different built-in family, extension, virtual table, or schema pattern.</p></div><span class="lab-badge">semantics → candidates</span></div>
        <div class="controls"><div class="control"><label for="family-engine">Engine</label><select id="family-engine"><option value="postgres">PostgreSQL 18</option><option value="mysql">MySQL 8.4 · InnoDB</option><option value="sqlite">SQLite 3.x</option></select></div><div class="control grow"><label for="family-workload">Query shape</label><select id="family-workload"><option value="text">Document contains ranked terms</option><option value="geo">Geometry overlaps / nearest places</option><option value="tags">Array or JSON contains a tag</option><option value="time">Recent range on correlated huge table</option><option value="prefix">Network or token prefix search</option></select></div></div>
        <div class="family-recommendation"><div><span>Recommended mechanism</span><strong id="family-name">—</strong><p id="family-note">—</p></div><div class="family-visual" id="family-visual" aria-live="polite"></div></div>
        <div class="metric-grid compact"><div class="metric"><span>Modeled pages visited</span><strong id="family-pages">—</strong><small>candidate discovery</small></div><div class="metric"><span>Candidate rows</span><strong id="family-candidates">—</strong><small>recheck may remain</small></div><div class="metric"><span>Illustrative index size</span><strong id="family-size">—</strong><small>10m-row scenario</small></div></div>
        <pre class="query-box"><code id="family-sql"></code></pre>
        <div class="diagnosis" id="family-diagnosis"><span class="diagnosis-label">Trade-off</span><p>—</p></div>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Level 3 · Production evidence</span><strong id="family-incident-title">LIKE '%term%' scans 10m rows</strong><span class="severity">wrong structure</span></div>
        <div class="family-evidence"><div class="family-query-shape" id="family-query-shape"></div><pre class="evidence"><code id="family-evidence-code"></code></pre></div>
        <div class="engine-doc-links"><a href="https://www.postgresql.org/docs/18/indexes-types.html" target="_blank" rel="noreferrer">PostgreSQL 18 index types ↗</a><a href="https://dev.mysql.com/doc/refman/8.4/en/create-index.html" target="_blank" rel="noreferrer">MySQL 8.4 index families ↗</a><a href="https://www.sqlite.org/fts5.html" target="_blank" rel="noreferrer">SQLite FTS5 ↗</a><a href="https://www.sqlite.org/rtree.html" target="_blank" rel="noreferrer">SQLite R*Tree ↗</a></div>
      </section>

      <section class="lab"><div class="lab-top"><div><span class="lab-kicker">Level 4 · Prediction check</span><h2>Pick from semantics, not familiarity</h2><p class="lab-copy">A specialized structure earns its cost when its pruning rule matches a valuable query shape.</p></div><button class="button" type="button" data-quiz-reset>Reset</button></div><div id="family-quiz">${DSL.Quiz.render(QUESTIONS, "Specialized family check")}</div></section>
      <div class="insight"><span class="insight-mark">!</span><p><strong>Every specialized index shifts work.</strong> Inverted indexes fan one row into many tokens, spatial trees maintain bounding regions, and BRIN accepts false-positive page ranges. Measure writes and rechecks as seriously as lookup speed.</p></div>
      ${DSL.lessonFooter("specialized-indexes")}
    </article>`;
    setupFamilyLab();
    DSL.Quiz.mount(document.getElementById("family-quiz"), QUESTIONS, { noun: "decision", successTitle: "Query shapes matched" });
  }

  function familyVisual(structure) {
    if (structure === "spatial") return `<div class="spatial-map"><i></i><i></i><i class="match"></i><i></i><span>query box</span></div>`;
    if (structure === "ranges") return `<div class="range-summaries">${["01–08", "09–16", "17–24", "25–31"].map((range, index) => `<span class="${index === 3 ? "match" : ""}"><small>pages</small>${range}<i>${index === 3 ? "overlap" : "skip"}</i></span>`).join("")}</div>`;
    if (structure === "radix") return `<div class="radix-tree"><span>/</span><div><i>10</i><i class="match">192</i><i>fd</i></div><div><i class="match">168</i><i>0</i><i>ff</i></div></div>`;
    return `<div class="posting-lists"><span><b>database</b><i>→ 3, 8, 21, 55</i></span><span class="match"><b>index</b><i>→ 8, 21, 34</i></span><span><b>page</b><i>→ 2, 8, 13</i></span></div>`;
  }

  function setupFamilyLab() {
    function update() {
      const engine = document.getElementById("family-engine").value;
      const workload = document.getElementById("family-workload").value;
      const family = FAMILIES[engine][workload];
      document.getElementById("family-name").textContent = family.family;
      document.getElementById("family-note").textContent = family.note;
      document.getElementById("family-visual").innerHTML = familyVisual(family.structure);
      document.getElementById("family-pages").textContent = family.pages.toLocaleString();
      document.getElementById("family-candidates").textContent = family.candidates.toLocaleString();
      document.getElementById("family-size").textContent = family.size;
      document.getElementById("family-sql").textContent = family.sql;
      const diagnosis = document.getElementById("family-diagnosis");
      diagnosis.className = `diagnosis ${family.writes === "high" ? "warning" : "resolved"}`;
      diagnosis.innerHTML = `<span class="diagnosis-label">${family.writes} write cost</span><p>${family.note} The shown ${family.pages} page visits and ${family.size} size are modeled—benchmark with your values, operators, and update rate.</p>`;
      const titles = { text: "Leading-wildcard text search scans 10m rows", geo: "Distance filter computes every geometry", tags: "JSON membership parses every event", time: "A tiny time slice reads the whole history", prefix: "Prefix routing walks every route" };
      const shapes = { text: "term → posting list → document ids", geo: "query rectangle → bounding tree → candidate ids", tags: "component value → member postings → rows", time: "time interval → summarized page ranges → recheck", prefix: "prefix components → partitioned search path → matches" };
      document.getElementById("family-incident-title").textContent = titles[workload];
      document.getElementById("family-query-shape").innerHTML = `<small>pruning rule</small><strong>${shapes[workload]}</strong><span>${family.family} · ${engineLabel(engine)}</span>`;
      document.getElementById("family-evidence-code").textContent = `before: 10,000,000 rows examined\nafter:  ${family.candidates.toLocaleString()} candidates · ${family.pages} modeled pages\nrecheck: ${workload === "time" || workload === "geo" ? "required for lossy candidates" : "operator-dependent"}`;
    }

    ["family-engine", "family-workload"].forEach((id) => document.getElementById(id).addEventListener("change", update));
    update();
  }

  function engineLabel(engine) {
    return engine === "postgres" ? "PostgreSQL 18" : engine === "mysql" ? "MySQL 8.4" : "SQLite 3.x";
  }

  DSL.registerRenderer("specialized-indexes", renderSpecializedIndexes);
})(window.DataSystemsLab);
