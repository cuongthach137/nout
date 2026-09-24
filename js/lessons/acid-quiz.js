(function registerAcidQuizLesson(DSL) {
  "use strict";

  const QUESTIONS = [
    {
      prompt: "A transfer debits Alice, then the credit statement fails. What protects the business operation from a partial result?",
      options: ["A covering index", "One transaction around both updates", "A replica read"],
      answer: 1,
      why: "Atomicity applies to the transaction boundary. Both balance changes must commit or roll back as one unit.",
    },
    {
      prompt: "Transaction A runs two SELECTs at PostgreSQL Read Committed. Transaction B commits between them. Can A's second SELECT see B's change?",
      options: ["Yes", "No, one transaction always has one snapshot", "Only if B used async commit"],
      answer: 0,
      why: "Read Committed creates a new snapshot for each statement, so successive SELECTs can observe different committed states.",
    },
    {
      prompt: "Which phenomenon does PostgreSQL prevent even when READ UNCOMMITTED is requested?",
      options: ["Dirty reads", "All write skew", "Every lost update"],
      answer: 0,
      why: "PostgreSQL maps Read Uncommitted to Read Committed, so one transaction cannot read another transaction's uncommitted versions.",
    },
    {
      prompt: "Two Repeatable Read transactions each see two doctors on call and update different rows so both leave. Why can the invariant still break?",
      options: ["The snapshots changed", "Stable snapshots do not prevent every serialization anomaly", "WAL was not flushed"],
      answer: 1,
      why: "This is write skew: each snapshot is stable, but the combined result is inconsistent with every possible one-at-a-time order.",
    },
    {
      prompt: "PostgreSQL aborts a Serializable transaction with SQLSTATE 40001. What should application retry logic rerun?",
      options: ["Only COMMIT", "Only the last UPDATE", "The complete transaction and its decision logic"],
      answer: 2,
      why: "A retry receives a new snapshot, so all reads and application decisions that chose the writes must run again.",
    },
    {
      prompt: "An order_items row must never reference a missing product. Which database mechanism directly expresses that invariant?",
      options: ["FOREIGN KEY", "Bloom filter", "READ COMMITTED"],
      answer: 0,
      why: "A foreign key rejects referencing values that do not exist in the referenced unique or primary key.",
    },
    {
      prompt: "The server acknowledges a synchronous commit after WAL is durable but before the dirty heap page is flushed. A crash follows. What restores the change?",
      options: ["The client resends it", "WAL REDO during recovery", "A sequential scan"],
      answer: 1,
      why: "Write-ahead logging makes the redo record durable first; recovery can reapply it to a stale data page.",
    },
    {
      prompt: "With asynchronous commit, the server returns success before WAL reaches durable storage. What can a sudden OS crash cause?",
      options: ["Loss of a recently acknowledged transaction", "A dirty read", "Automatic duplicate constraints"],
      answer: 0,
      why: "Async commit trades acknowledgement durability for latency. Recovery remains self-consistent, but recent acknowledged commits may be absent.",
    },
  ];

  function renderAcidQuiz() {
    const lesson = DSL.getLesson("acid-quiz");
    const completed = DSL.state.completed.has("acid-quiz");
    DSL.elements.root.innerHTML = `<article class="lesson">
      ${DSL.lessonHeader(lesson, "Diagnose the failure from the <em>observable evidence</em>.", "Each scenario asks for a mechanism, guarantee, or recovery behavior—not an ACID acronym definition. Use the explanation to repair any weak spots in your mental model.", "Challenge")}
      <div id="acid-quiz">
        ${DSL.Quiz.render(QUESTIONS, "ACID incident review")}
        <div class="lesson-footer"><a class="button ghost" href="#/durability">← Commit, WAL & recovery</a><div class="footer-actions"><button class="button" type="button" data-quiz-reset>Reset answers</button><button class="button complete-button ${completed ? "done" : ""}" data-complete="acid-quiz">${completed ? "✓ Completed" : "Mark complete"}</button><a class="button primary" href="#/replication">Next: Replication & lag →</a></div></div>
      </div>
    </article>`;
    DSL.Quiz.mount(document.getElementById("acid-quiz"), QUESTIONS, {
      passScore: 7,
      successTitle: "Incident review passed",
      successCopy: "You can distinguish transaction, isolation, constraint, and durability failures.",
      retryTitle: "Revisit the execution timelines",
    });
  }

  DSL.registerRenderer("acid-quiz", renderAcidQuiz);
})(window.DataSystemsLab);
