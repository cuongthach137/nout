(function registerTupleVersionsLesson(DSL) {
  "use strict";

  function renderTupleVersions() {
    const lesson = DSL.getLesson("tuple-versions");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "An UPDATE creates a <em>new row version.</em>", "PostgreSQL keeps the old tuple long enough for existing snapshots to see it. Whether the indexes must also change determines how much physical work one logical update creates.", "Intermediate")}

      <section class="lab">
        <div class="lab-top"><div><span class="lab-kicker">${DSL.labLabel("tuple-versions")} · tuple lifecycle</span><h2>Follow one row through the heap</h2><p class="lab-copy">Replay several updates. A HOT update can keep the version chain on one heap page without adding index entries; changing an indexed value—or running out of page space—breaks that shortcut.</p></div><span class="lab-badge">logical row ≠ physical tuple</span></div>
        <div class="controls">
          <div class="control"><label for="version-column">Column being changed</label><select id="version-column"><option value="bio">profile_bio · not indexed</option><option value="email">email · indexed</option></select></div>
          <div class="control"><label for="version-space">Free space on page 42</label><select id="version-space"><option value="room">Enough room</option><option value="full">Page is full</option></select></div>
          <div class="control grow"><label for="version-count">Updates: <span id="version-count-value">3</span></label><input id="version-count" type="range" min="1" max="5" value="3"></div>
          <button class="button primary" id="replay-updates">Replay updates</button>
        </div>

        <div class="tuple-storage" aria-live="polite">
          <div class="storage-panel"><div class="storage-panel-head"><span>Heap file · physical pages</span><strong id="tuple-path-label">—</strong></div><div class="tuple-pages" id="tuple-pages"></div></div>
          <div class="tuple-link" aria-hidden="true">points to →</div>
          <div class="storage-panel"><div class="storage-panel-head"><span>B-tree leaf · separate structure</span><strong id="index-write-label">—</strong></div><div class="tuple-index" id="tuple-index"></div></div>
        </div>
        <div class="metric-grid compact">
          <div class="metric"><span>Tuple versions</span><strong id="tuple-version-metric">—</strong><small>one live, older versions remain</small></div>
          <div class="metric"><span>Index entries</span><strong id="tuple-index-metric">—</strong><small>entries currently modeled</small></div>
          <div class="metric"><span>Heap pages touched</span><strong id="tuple-page-metric">—</strong><small>physical write locality</small></div>
        </div>
        <div class="diagnosis" id="tuple-diagnosis"><span class="diagnosis-label">Ready</span><p>Replay the workload to expose its physical write path.</p></div>
      </section>

      <section class="concept-grid">
        <article class="concept-card"><span class="concept-number">01 · MVCC</span><h3>Readers keep their snapshot</h3><p>The old tuple is not immediately overwritten because a transaction that started earlier may still need to see it.</p></article>
        <article class="concept-card"><span class="concept-number">02 · HOT</span><h3>Skip index maintenance</h3><p>A heap-only tuple update is possible when indexed columns stay unchanged and the new version fits on the same page.</p></article>
        <article class="concept-card"><span class="concept-number">03 · Cleanup</span><h3>Versions become reclaimable</h3><p>After no active snapshot can see an old version, pruning and vacuum can make that space reusable.</p></article>
      </section>

      <section class="lab incident-lab">
        <div class="incident-strip"><span>Production drill</span><strong>Profile writes doubled after a “helpful” index</strong><span class="severity">write amplification</span></div>
        <div class="lab-top"><div><span class="lab-kicker">Schema choice → storage work</span><h2>The read optimization changed the write path</h2><p class="lab-copy">Model 100,000 profile updates. The figures are illustrative, but the direction is real: indexing a frequently changed column removes HOT eligibility, while leaving page room makes HOT updates more likely.</p></div><span class="lab-badge">100k updates</span></div>
        <div class="controls"><div class="control"><label for="profile-index">Index design</label><select id="profile-index"><option value="none">No index on last_seen_at</option><option value="indexed">Index last_seen_at</option></select></div><div class="control grow"><label for="profile-fillfactor">Page policy</label><select id="profile-fillfactor"><option value="100">fillfactor 100 · pack pages</option><option value="80">fillfactor 80 · reserve update room</option></select></div><button class="button primary" id="measure-write-load">Measure write load</button></div>
        <div class="metric-grid compact"><div class="metric"><span>HOT update ratio</span><strong id="hot-ratio">—</strong><small>illustrative workload</small></div><div class="metric"><span>New index entries</span><strong id="index-write-count">—</strong><small>for 100k updates</small></div><div class="metric"><span>Relative WAL volume</span><strong id="wal-pressure">—</strong><small>baseline = 1.0×</small></div></div>
        <div class="diagnosis" id="hot-diagnosis"><span class="diagnosis-label">Investigation</span><p>Change both schema and page policy, then compare the write amplification.</p></div>
      </section>

      <div class="insight"><span class="insight-mark">!</span><p><strong>An ordinary secondary index does not rearrange the heap.</strong> It adds another physical structure whose entries point into heap pages. That extra structure accelerates reads but must stay consistent with every non-HOT version.</p></div>
      ${DSL.lessonFooter("tuple-versions")}
    </article>`;
    setupTupleLab();
    setupWriteAmplificationDrill();
  }

  function buildVersionModel(column, space, updateCount) {
    const hot = column === "bio" && space === "room";
    const versions = Array.from({ length: updateCount + 1 }, (_, index) => {
      const page = hot ? 42 : index === 0 ? 42 : space === "full" ? 42 + index : 42 + Math.floor(index / 3);
      return { number: index + 1, page, slot: hot ? index + 1 : index % 3 + 1, live: index === updateCount };
    });
    const pages = [...new Set(versions.map((version) => version.page))];
    const indexEntries = hot ? [versions[0]] : versions;
    return { hot, versions, pages, indexEntries };
  }

  function setupTupleLab() {
    const column = document.getElementById("version-column");
    const space = document.getElementById("version-space");
    const count = document.getElementById("version-count");

    function renderModel() {
      const updateCount = Number(count.value);
      const model = buildVersionModel(column.value, space.value, updateCount);
      const pages = document.getElementById("tuple-pages");
      const index = document.getElementById("tuple-index");
      const grouped = model.pages.map((pageNumber) => ({
        pageNumber,
        versions: model.versions.filter((version) => version.page === pageNumber),
      }));

      pages.innerHTML = grouped.map((page) => `<div class="tuple-page"><small>heap page ${page.pageNumber}</small><div>${page.versions.map((version) => `<span class="tuple-version ${version.live ? "live" : "dead"}"><b>v${version.number}</b><i>(${version.page},${version.slot})</i><em>${version.live ? "visible" : "old"}</em></span>`).join('<span class="version-arrow">→</span>')}</div></div>`).join("");
      index.innerHTML = model.indexEntries.map((version, indexPosition) => `<span class="tuple-index-entry ${version.live || model.hot ? "current" : "stale"}"><b>${column.value === "email" ? `email_v${version.number}` : "user_id=42"}</b><i>→ (${version.page},${version.slot})</i>${model.hot && indexPosition === 0 ? "<em>follows HOT chain</em>" : ""}</span>`).join("");

      document.getElementById("tuple-path-label").textContent = model.hot ? "HOT chain · same page" : "regular update path";
      document.getElementById("index-write-label").textContent = model.hot ? "leaf unchanged" : `${updateCount} new entries`;
      document.getElementById("tuple-version-metric").textContent = model.versions.length;
      document.getElementById("tuple-index-metric").textContent = model.indexEntries.length;
      document.getElementById("tuple-page-metric").textContent = model.pages.length;

      const diagnosis = document.getElementById("tuple-diagnosis");
      diagnosis.className = `diagnosis ${model.hot ? "resolved" : "warning"}`;
      diagnosis.innerHTML = model.hot
        ? `<span class="diagnosis-label">HOT path</span><p>The indexed key did not change and page 42 had room. The B-tree keeps one pointer to the root tuple; PostgreSQL follows the same-page version chain to v${model.versions.length}.</p>`
        : `<span class="diagnosis-label">Write amplification</span><p>${column.value === "email" ? "The indexed email changed, so every version needs a new index entry." : "The unindexed value changed, but the full page forced the new tuple elsewhere, so HOT was not possible."} Old entries remain until cleanup can safely remove them.</p>`;
    }

    count.addEventListener("input", () => { document.getElementById("version-count-value").textContent = count.value; });
    document.getElementById("replay-updates").addEventListener("click", renderModel);
    [column, space].forEach((control) => control.addEventListener("change", renderModel));
    renderModel();
  }

  function setupWriteAmplificationDrill() {
    document.getElementById("measure-write-load").addEventListener("click", () => {
      const indexed = document.getElementById("profile-index").value === "indexed";
      const reservedRoom = document.getElementById("profile-fillfactor").value === "80";
      const hotRatio = indexed ? 0 : reservedRoom ? 92 : 18;
      const indexWrites = indexed ? 100000 : 100000 - hotRatio * 1000;
      const wal = indexed ? 3.4 : reservedRoom ? 1.15 : 1.8;
      document.getElementById("hot-ratio").textContent = `${hotRatio}%`;
      document.getElementById("index-write-count").textContent = indexWrites.toLocaleString();
      document.getElementById("wal-pressure").textContent = `${wal.toFixed(2)}×`;
      const healthy = !indexed && reservedRoom;
      const diagnosis = document.getElementById("hot-diagnosis");
      diagnosis.className = `diagnosis ${healthy ? "resolved" : "warning"}`;
      diagnosis.innerHTML = healthy
        ? `<span class="diagnosis-label">Lower write cost</span><p>Reserved page space lets most new versions stay beside their predecessor, and the unchanged index avoids almost all entry churn. Validate the read benefit before adding an index to a high-churn column.</p>`
        : `<span class="diagnosis-label">Operational trade-off</span><p>${indexed ? "Because last_seen_at changes on every write, its index must be maintained on every update." : "The column is HOT-eligible, but tightly packed pages leave little room for same-page versions."} Measure index value against WAL, page splits, cache churn, and vacuum work.</p>`;
    });
  }

  DSL.registerRenderer("tuple-versions", renderTupleVersions);
})(window.DataSystemsLab);
