(function registerQuizComponent(DSL) {
  "use strict";

  function renderQuestions(questions) {
    return questions.map((question, questionIndex) => `
      <article class="quiz-question" data-quiz-question="${questionIndex}">
        <div class="quiz-question-head">
          <span>${String(questionIndex + 1).padStart(2, "0")}</span>
          <h3>${question.prompt}</h3>
        </div>
        <div class="quiz-options">
          ${question.options.map((option, optionIndex) => `
            <button class="quiz-option" type="button" data-quiz-answer="${optionIndex}" aria-pressed="false">${option}</button>
          `).join("")}
        </div>
        <div class="quiz-feedback" aria-live="polite">Choose one answer.</div>
      </article>
    `).join("");
  }

  function render(questions, title) {
    return `
      <section class="quiz-progress">
        <div><span>${title}</span><strong data-quiz-score>0 / ${questions.length}</strong></div>
        <div class="progress-track light"><div class="progress-fill" data-quiz-progress></div></div>
      </section>
      <section class="quiz-list">${renderQuestions(questions)}</section>
      <div class="quiz-verdict" data-quiz-verdict><strong>0 answered</strong><span>Complete every scenario to see your result.</span></div>
    `;
  }

  function mount(container, questions, options = {}) {
    if (!(container instanceof Element)) throw new TypeError("Quiz.mount requires a container element");

    const answers = new Map();
    const passScore = options.passScore ?? Math.ceil(questions.length * 0.8);
    const noun = options.noun || "scenario";
    const score = container.querySelector("[data-quiz-score]");
    const progress = container.querySelector("[data-quiz-progress]");
    const verdict = container.querySelector("[data-quiz-verdict]");
    const reset = container.querySelector("[data-quiz-reset]")
      || container.closest(".lab")?.querySelector("[data-quiz-reset]");

    function updateSummary() {
      const correct = [...answers.entries()].filter(([questionIndex, answer]) => questions[questionIndex].answer === answer).length;
      const answered = answers.size;
      score.textContent = `${correct} / ${questions.length}`;
      progress.style.width = `${answered / questions.length * 100}%`;

      if (answered < questions.length) {
        const remaining = questions.length - answered;
        verdict.className = "quiz-verdict";
        verdict.innerHTML = `<strong>${answered} answered</strong><span>${remaining} ${noun}${remaining === 1 ? "" : "s"} remaining.</span>`;
        return;
      }

      const passed = correct >= passScore;
      if (options.onComplete) options.onComplete({ passed, correct });
      verdict.className = `quiz-verdict ${passed ? "passed" : "retry"}`;
      verdict.innerHTML = passed
        ? `<strong>${options.successTitle || "Review passed"}</strong><span>${correct} of ${questions.length} correct. ${options.successCopy || "You connected the symptoms to the underlying mechanism."}</span>`
        : `<strong>${options.retryTitle || "Review the trade-offs"}</strong><span>${correct} of ${questions.length} correct. ${options.retryCopy || "Use each explanation, reset, and try again."}</span>`;
    }

    container.querySelectorAll("[data-quiz-question]").forEach((card) => {
      const questionIndex = Number(card.dataset.quizQuestion);
      card.querySelectorAll("[data-quiz-answer]").forEach((button) => button.addEventListener("click", () => {
        const selected = Number(button.dataset.quizAnswer);
        answers.set(questionIndex, selected);

        card.querySelectorAll("[data-quiz-answer]").forEach((answerButton) => {
          const answerIndex = Number(answerButton.dataset.quizAnswer);
          answerButton.classList.toggle("selected", answerIndex === selected);
          answerButton.classList.toggle("correct", answerIndex === questions[questionIndex].answer);
          answerButton.classList.toggle("wrong", answerIndex === selected && answerIndex !== questions[questionIndex].answer);
          answerButton.setAttribute("aria-pressed", String(answerIndex === selected));
        });

        const isCorrect = selected === questions[questionIndex].answer;
        const feedback = card.querySelector(".quiz-feedback");
        feedback.className = `quiz-feedback ${isCorrect ? "correct" : "wrong"}`;
        feedback.textContent = `${isCorrect ? "Correct. " : "Not quite. "}${questions[questionIndex].why}`;
        updateSummary();
      }));
    });

    reset?.addEventListener("click", () => {
      answers.clear();
      container.querySelectorAll("[data-quiz-answer]").forEach((button) => {
        button.className = "quiz-option";
        button.setAttribute("aria-pressed", "false");
      });
      container.querySelectorAll(".quiz-feedback").forEach((feedback) => {
        feedback.className = "quiz-feedback";
        feedback.textContent = "Choose one answer.";
      });
      updateSummary();
    });

    updateSummary();
  }

  DSL.Quiz = Object.freeze({ render, mount });
})(window.DataSystemsLab);
