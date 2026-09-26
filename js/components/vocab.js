(function registerVocab(DSL) {
  "use strict";

  // Keywords: terms a narrated lesson highlights as the narrator says them. Learners star the ones
  // they want to practise; starred words become flashcards reviewed with spaced repetition.
  //
  // Terms and definitions live in each narration script ("keywords"), so they reach the page with
  // the lesson's narration bundle. Progress is saved per browser, like course progress.

  const { retrigger, burst } = DSL.LabKit;
  const KEY = "vocab";
  const DAY = 864e5;
  const MINUTE = 6e4;
  const NEW_PER_SESSION = 20;
  const RATINGS = [["again", "Again"], ["hard", "Hard"], ["good", "Good"], ["easy", "Easy"]];

  function read() {
    const saved = DSL.store.get(KEY, {});
    return saved && typeof saved === "object" ? saved : {};
  }

  let cards = read();

  function save() {
    DSL.store.set(KEY, cards);
    // Lets open views (the narrator's Keywords counter) follow along.
    window.dispatchEvent(new CustomEvent("dsl-vocab"));
  }

  const card = (id) => cards[id] || (cards[id] = {});
  // Every keyword from every loaded narration bundle: { id: { term, def, lesson } }.
  const terms = () => (DSL.Narrator ? DSL.Narrator.keywords() : {});

  function seen(id, lesson) {
    const c = card(id);
    const first = !c.seenAt;
    if (first) {
      c.seenAt = Date.now();
      c.lesson = lesson;
      save();
    }
    return first;
  }

  const isStarred = (id) => Boolean(cards[id] && cards[id].starred);
  const hasSeen = (id) => Boolean(cards[id] && cards[id].seenAt);

  function star(id, on) {
    const c = card(id);
    c.starred = on;
    if (!c.seenAt) c.seenAt = Date.now();
    save();
    DSL.Vocab.onChange();
  }

  // Simplified SM-2: intervals grow by the card's ease; "again" sends it back to the start.
  function next(c, rating, now = Date.now()) {
    const reps = c.reps || 0;
    let interval = c.interval || 0;
    let ease = c.ease || 2.5;
    if (rating === "again") return { reps: 0, interval: 0, ease: Math.max(1.3, ease - 0.2), due: now + MINUTE, lapses: (c.lapses || 0) + 1 };
    if (reps === 0) interval = { hard: 1, good: 1, easy: 3 }[rating];
    else if (reps === 1) interval = { hard: 2, good: 3, easy: 5 }[rating];
    else interval = Math.max(interval + 1, Math.round(interval * { hard: 1.2, good: ease, easy: ease * 1.3 }[rating]));
    ease = Math.max(1.3, ease + { hard: -0.15, good: 0, easy: 0.15 }[rating]);
    return { reps: reps + 1, interval, ease, due: now + interval * DAY, lapses: c.lapses || 0 };
  }

  function rate(id, rating) {
    Object.assign(card(id), next(card(id), rating), { reviewedAt: Date.now() });
    save();
  }

  function whenLabel(ms) {
    if (ms < 2 * MINUTE) return "<1m";
    if (ms < DAY) return `${Math.round(ms / 36e5)}h`;
    const days = Math.round(ms / DAY);
    return days < 30 ? `${days}d` : `${Math.round(days / 30)}mo`;
  }

  // Starred cards to study now: those due, then new ones.
  function queue(now = Date.now()) {
    const known = terms();
    const starred = Object.keys(cards).filter((id) => cards[id].starred && known[id]);
    const due = starred.filter((id) => cards[id].reps > 0 && cards[id].due <= now).sort((a, b) => cards[a].due - cards[b].due);
    const fresh = starred.filter((id) => !cards[id].reps).slice(0, NEW_PER_SESSION);
    return [...due, ...fresh];
  }

  const dueCount = () => queue().length;

  function lessonTitle(id) {
    const lesson = DSL.getLesson(id);
    return lesson ? `${lesson.number} · ${lesson.title}` : "";
  }

  // A deck of flip cards for one lesson's keywords, each with a practise-later star.
  function cardsMarkup(ids) {
    const known = terms();
    return ids.filter((id) => known[id]).map((id, i) => `<div class="vk-card" data-kw="${id}" style="--i:${i}">
      <button type="button" class="vk-flip" aria-label="Flip ${known[id].term}"><span class="vk-front">${known[id].term}</span><span class="vk-back">${known[id].def}</span></button>
      <button type="button" class="vk-star" data-star="${id}" aria-pressed="${isStarred(id)}" aria-label="Practise ${known[id].term} later">${isStarred(id) ? "★" : "☆"}</button>
    </div>`).join("");
  }

  // A compact list (term, definition, star) for the narrator's keyword panel.
  function listMarkup(ids) {
    const known = terms();
    return `<ul class="vk-list">${ids.filter((id) => known[id]).map((id) => `<li><button type="button" class="vk-star" data-star="${id}" aria-pressed="${isStarred(id)}" aria-label="Practise ${known[id].term} later">${isStarred(id) ? "★" : "☆"}</button><div><b>${known[id].term}</b><p>${known[id].def}</p></div></li>`).join("")}</ul>`;
  }

  function wireCards(root) {
    root.addEventListener("click", (event) => {
      const starButton = event.target.closest("[data-star]");
      if (starButton) {
        const id = starButton.dataset.star;
        const on = !isStarred(id);
        star(id, on);
        root.querySelectorAll(`[data-star="${id}"]`).forEach((b) => {
          b.setAttribute("aria-pressed", String(on));
          b.textContent = on ? "★" : "☆";
        });
        retrigger(starButton, "gd-pop");
        if (on) burst(starButton, { count: 8, spread: 28 });
        return;
      }
      const flip = event.target.closest(".vk-flip");
      if (flip) flip.closest(".vk-card").classList.toggle("flipped");
    });
  }

  // A narrated chapter: review this lesson's keywords and star the ones to practise.
  // Needs lines keywords.1, keywords.ask, keywords.hint, and keywords.done in the lesson script.
  function reviewChapter(lessonId) {
    return {
      id: "keywords",
      title: "Words to keep",
      async script(n, scene) {
        const ids = Object.keys(DSL.Narrator.keywords(lessonId));
        ids.forEach((id) => seen(id, lessonId));
        scene.innerHTML = `<div class="vk-review">
          <div class="vk-deck">${cardsMarkup(ids)}</div>
          <div class="vk-review-actions"><a class="button ghost" href="#/flashcards">Open flashcards</a><button type="button" class="button primary gd-big vk-done">Done</button></div>
        </div>`;
        wireCards(scene);
        await n.say("keywords.1");
        await n.say("keywords.ask");
        await n.ask((finish) => scene.querySelector(".vk-done").addEventListener("click", () => finish(), { once: true }), { hint: "keywords.hint", highlight: ".vk-card" });
        await n.say("keywords.done");
      },
    };
  }

  // The flashcards page (#/flashcards): review due cards, or browse every word.
  function renderDeck() {
    const root = DSL.elements.root;
    let tab = "review";
    let session = queue();
    let reviewed = 0;
    let flipped = false;

    function stats() {
      const known = terms();
      const ids = Object.keys(known);
      const seenIds = ids.filter((id) => cards[id] && cards[id].seenAt);
      const starred = seenIds.filter(isStarred);
      return { total: ids.length, seen: seenIds.length, starred: starred.length, due: queue().length };
    }

    function reviewMarkup() {
      const known = terms();
      if (!session.length) {
        const s = stats();
        const upcoming = Object.keys(cards).filter((id) => cards[id].starred && cards[id].reps > 0 && known[id]).map((id) => cards[id].due).sort((a, b) => a - b)[0];
        return `<div class="fc-empty">
          <span class="fc-empty-icon" aria-hidden="true">${reviewed ? "🎉" : "🗂"}</span>
          <h2>${reviewed ? `Done: ${reviewed} card${reviewed === 1 ? "" : "s"} reviewed` : s.starred ? "Nothing due right now" : "No starred words yet"}</h2>
          <p>${s.starred ? (upcoming ? `Next card is due in ${whenLabel(upcoming - Date.now())}.` : "") : "Star words during a narrated lesson, or in <b>All words</b>, to practise them here."}</p>
          <button type="button" class="button" data-tab="words">Browse all words</button>
        </div>`;
      }
      const id = session[0];
      const c = card(id);
      const term = known[id];
      return `<div class="fc-session">
        <div class="fc-progress"><span>${session.length} left</span><i><b style="width:${(reviewed / (reviewed + session.length)) * 100}%"></b></i></div>
        <div class="fc-card ${flipped ? "flipped" : ""}" tabindex="0" aria-live="polite">
          <div class="fc-face fc-front"><small>${lessonTitle(term.lesson)}</small><b>${term.term}</b><span class="fc-tip">Say the definition, then flip</span></div>
          <div class="fc-face fc-back"><small>${term.term}</small><p>${term.def}</p><a href="#/${term.lesson}">Revisit the lesson</a></div>
        </div>
        ${flipped
          ? `<div class="fc-rate">${RATINGS.map(([key, label], i) => `<button type="button" class="fc-rate-btn ${key}" data-rate="${key}"><kbd>${i + 1}</kbd><b>${label}</b><small>${whenLabel(next(c, key).due - Date.now())}</small></button>`).join("")}</div>`
          : `<button type="button" class="button primary gd-big fc-show" data-show>Show answer <kbd>Space</kbd></button>`}
      </div>`;
    }

    function wordsMarkup() {
      const known = terms();
      const byLesson = {};
      Object.entries(known).forEach(([id, term]) => { (byLesson[term.lesson] = byLesson[term.lesson] || []).push(id); });
      const order = DSL.lessons.map((lesson) => lesson.id).filter((id) => byLesson[id]);
      return `<div class="fc-words-top"><button type="button" class="button" data-star-all>Star every word you've seen</button></div>
        ${order.map((lessonId) => {
          const ids = byLesson[lessonId];
          const open = ids.filter((id) => cards[id] && cards[id].seenAt);
          const locked = ids.length - open.length;
          return `<section class="fc-group">
            <h3><a href="#/${lessonId}">${lessonTitle(lessonId)}</a><small>${open.length} / ${ids.length} words</small></h3>
            <ul>${open.map((id) => {
              const c = cards[id];
              const status = !c.starred ? "" : !c.reps ? `<em class="new">new</em>` : c.due <= Date.now() ? `<em class="due">due</em>` : `<em>in ${whenLabel(c.due - Date.now())}</em>`;
              return `<li><button type="button" class="vk-star" data-star="${id}" aria-pressed="${isStarred(id)}" aria-label="Practise ${known[id].term}">${isStarred(id) ? "★" : "☆"}</button><div><b>${known[id].term}</b><p>${known[id].def}</p></div>${status}</li>`;
            }).join("")}</ul>
            ${locked ? `<p class="fc-locked">🔒 ${locked} more word${locked === 1 ? "" : "s"} unlock as you play this lesson in Narrated mode.</p>` : ""}
          </section>`;
        }).join("") || `<p class="fc-locked">Keywords appear here as narrated lessons introduce them.</p>`}`;
    }

    function paint() {
      const s = stats();
      root.innerHTML = `<article class="lesson fc">
        <header class="lesson-header">
          <div class="eyebrow">Practice</div>
          <h1>Flashcards</h1>
          <p class="lede">The words each lesson highlights. Star the ones you want to keep, and review them a little each day; cards you know come back less often.</p>
          <div class="fc-stats"><span><b>${s.due}</b> to review now</span><span><b>${s.starred}</b> starred</span><span><b>${s.seen}</b> / ${s.total} words seen</span></div>
        </header>
        <div class="fc-tabs" role="tablist"><button type="button" role="tab" data-tab="review" aria-selected="${tab === "review"}">Review</button><button type="button" role="tab" data-tab="words" aria-selected="${tab === "words"}">All words</button></div>
        <section class="fc-panel">${tab === "review" ? reviewMarkup() : wordsMarkup()}</section>
      </article>`;
    }

    function show() {
      if (!session.length || flipped) return;
      flipped = true;
      paint();
      retrigger(root.querySelector(".fc-card"), "fc-flip");
    }

    function grade(rating) {
      if (!flipped || !session.length) return;
      const id = session.shift();
      rate(id, rating);
      if (rating === "again") session.push(id);
      else reviewed += 1;
      flipped = false;
      paint();
      DSL.Vocab.onChange();
      if (!session.length && reviewed) burst(root.querySelector(".fc-empty-icon"), { count: 22, spread: 90 });
    }

    function onClick(event) {
      const tabButton = event.target.closest("[data-tab]");
      if (tabButton) {
        tab = tabButton.dataset.tab;
        if (tab === "review") session = queue();
        flipped = false;
        paint();
        return;
      }
      if (event.target.closest("[data-show]") || event.target.closest(".fc-card:not(.flipped)")) { show(); return; }
      const rateButton = event.target.closest("[data-rate]");
      if (rateButton) { grade(rateButton.dataset.rate); return; }
      const starButton = event.target.closest("[data-star]");
      if (starButton) {
        const id = starButton.dataset.star;
        star(id, !isStarred(id));
        paint();
        return;
      }
      if (event.target.closest("[data-star-all]")) {
        Object.keys(terms()).filter((id) => cards[id] && cards[id].seenAt).forEach((id) => { card(id).starred = true; });
        save();
        DSL.Vocab.onChange();
        paint();
      }
    }

    function onKey(event) {
      const target = event.target instanceof Element ? event.target : null;
      if (tab !== "review" || (target && target.closest("input, textarea"))) return;
      if (event.key === " " && !flipped) { event.preventDefault(); show(); }
      const index = ["1", "2", "3", "4"].indexOf(event.key);
      if (index >= 0 && flipped) grade(RATINGS[index][0]);
    }

    // Listeners live only while this page is on screen; the router calls leave() on navigation.
    root.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    DSL.onLeave(() => {
      root.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    });
    paint();
  }

  DSL.Vocab = {
    seen, hasSeen, star, isStarred, rate, queue, dueCount, cardsMarkup, listMarkup, wireCards, reviewChapter, renderDeck,
    // Replaced by the app to refresh the sidebar's due count.
    onChange() {},
  };
})(window.DataSystemsLab);
