(function registerIndexQuizLesson(DSL) {
  "use strict";

  const QUESTIONS = [
    { prompt: "A query returns 15% of a table from many scattered heap pages. Which path often groups row locations before reading the heap?", options: ["Index Only Scan", "Bitmap Heap Scan", "Hash join"], answer: 1, why: "A bitmap scan collects matching tuple locations, then visits heap pages in physical order." },
    { prompt: "A stable table has INDEX ON orders(customer_id) INCLUDE (total). The query selects only customer_id and total. What becomes possible?", options: ["Index Only Scan", "Sequential scan only", "No visibility checks ever"], answer: 0, why: "The index covers the query; all-visible heap pages can avoid heap fetches, though recent changes may still require them." },
    { prompt: "With separate indexes on status and region, how can PostgreSQL execute status = 'paid' OR region = 'EU'?", options: ["Leftmost-prefix scan", "BitmapOr", "Cluster the heap"], answer: 1, why: "The engine can scan both indexes and OR their in-memory bitmaps before visiting the heap." },
    { prompt: "You must add an index to a heavily written production table without blocking normal writes. What is the PostgreSQL starting point?", options: ["VACUUM FULL", "CREATE INDEX CONCURRENTLY", "Disable autovacuum"], answer: 1, why: "The concurrent form allows normal writes, with extra scans, coordination, runtime, and failure caveats." },
    { prompt: "Why can random UUIDv4 primary keys reduce B-tree insert throughput?", options: ["They cannot be compared", "They widen the hot leaf working set and can trigger scattered splits", "They force bitmap scans"], answer: 1, why: "Random positions touch many leaf pages and split full pages throughout the tree." },
    { prompt: "A Bloom-filter probe encounters one required bit set to zero. What can the system conclude?", options: ["Definitely absent", "Definitely present", "False positive"], answer: 0, why: "A zero proves the key was not added; only an all-one result is probabilistic." },
  ];

  function renderIndexQuiz() {
    const lesson = DSL.getLesson("index-quiz");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Make the call before the <em>planner does</em>.", "Use the evidence in each production scenario to choose an access path or operational response. Every answer explains the physical reason behind the decision.", "Challenge")}
      <div id="index-quiz">${DSL.Quiz.render(QUESTIONS, "Index design challenge")}
        ${DSL.lessonFooter("index-quiz", { extra: `<button class="button" type="button" data-quiz-reset>Reset answers</button>` })}
      </div>
    </article>`;
    DSL.Quiz.mount(document.getElementById("index-quiz"), QUESTIONS, {
      passScore: 5,
      successTitle: "Design review passed",
      successCopy: "You can connect query shape to physical work.",
    });
  }

  DSL.registerRenderer("index-quiz", renderIndexQuiz);
})(window.DataSystemsLab);
