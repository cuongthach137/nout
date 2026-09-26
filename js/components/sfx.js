(function registerSfx(DSL) {
  "use strict";

  // Sound effects, synthesized with the Web Audio API (no files to load). Ported from the hanyu
  // course. Short notes: "correct" rises with the learner's streak, "wrong" slides down, "tick"
  // marks a small event (a pick, a star, something landing), "combo" a finished lab, "complete" a
  // finished lesson. The learner can switch them off (saved as "sfx"); they're separate from the
  // narrator's voice mute.

  let audioContext = null;

  function soundOn() {
    return DSL.store.get("sfx", true) !== false;
  }

  function setSound(on) {
    DSL.store.set("sfx", Boolean(on));
  }

  function context() {
    if (audioContext) return audioContext;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    audioContext = new Ctx();
    return audioContext;
  }

  // One note with a quick attack and exponential release; `harmonic` adds soft overtones.
  function note(ctx, { freq, start = 0, duration = 0.18, type = "sine", gain = 0.07, slideTo, harmonic = 0 }) {
    const at = ctx.currentTime + start;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, at);
    amp.gain.exponentialRampToValueAtTime(gain, at + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    amp.connect(ctx.destination);
    const voices = harmonic ? [[freq, 1], [freq * 2, harmonic], [freq * 3.01, harmonic * 0.4]] : [[freq, 1]];
    voices.forEach(([hz, level]) => {
      const osc = ctx.createOscillator();
      const mix = ctx.createGain();
      mix.gain.value = level;
      osc.type = type;
      osc.frequency.setValueAtTime(hz, at);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo * (hz / freq), at + duration);
      osc.connect(mix);
      mix.connect(amp);
      osc.start(at);
      osc.stop(at + duration + 0.05);
    });
  }

  // Correct answers climb a pentatonic scale as the streak grows, so a run of right answers sounds like one.
  const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const hz = (semitones, base = 659.25) => base * Math.pow(2, semitones / 12);
  let streak = 0;

  // play(name, { streak }): "correct" | "wrong" | "tick" | "combo" | "complete".
  // Without an explicit streak, correct/wrong keep a running one across the page.
  function play(name, options = {}) {
    if (name === "correct") streak = options.streak ?? streak + 1;
    if (name === "wrong") streak = 0;
    if (!soundOn()) return;
    const ctx = context();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    const lift = PENTATONIC[Math.min(PENTATONIC.length - 2, Math.max(0, streak - 1))];
    if (name === "correct") {
      note(ctx, { freq: hz(lift), duration: 0.16, harmonic: 0.25 });
      note(ctx, { freq: hz(lift + 7), start: 0.07, duration: 0.32, harmonic: 0.3 });
    } else if (name === "wrong") {
      note(ctx, { freq: 196, duration: 0.2, type: "triangle", gain: 0.06, slideTo: 150 });
    } else if (name === "tick") {
      note(ctx, { freq: 1568, duration: 0.05, gain: 0.035 });
    } else if (name === "combo") {
      [0, 4, 7, 12].forEach((step, i) => note(ctx, { freq: hz(lift + step), start: i * 0.06, duration: 0.22, harmonic: 0.3, gain: 0.055 }));
    } else if (name === "complete") {
      [0, 4, 7, 12, 16, 19, 24].forEach((step, i) => note(ctx, { freq: hz(step, 523.25), start: i * 0.085, duration: 0.6, harmonic: 0.35, gain: 0.05 }));
    }
  }

  // A new screen starts a new streak.
  function reset() { streak = 0; }

  DSL.Sfx = Object.freeze({ play, soundOn, setSound, reset });
})(window.DataSystemsLab);
