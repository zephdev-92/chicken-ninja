import { getAudioContext } from './audioContext.js';
import { koto, shakuhachi, taiko, drone, createReverb } from './instruments.js';
import { EVENTS, LOOP_EIGHTHS, TEMPO_BPM } from './score.js';

// Looping ambient music, synthesized live from score.js (no audio file to license).
//
// Classic Web Audio look-ahead scheduler: a 25 ms timer schedules every note falling
// in the next LOOKAHEAD seconds at its exact AudioContext time, so timing never
// depends on the main thread. The player's on/off choice is remembered; playback also
// pauses while the tab is hidden. Browsers only allow audio after a user gesture, so
// start() is safe to call early — it waits for the first pointer/key event.
//
// Framework-agnostic: subscribe()/getSnapshot() let React read `enabled` through
// useSyncExternalStore (see hooks/useMusic.js).

const STORAGE_KEY = 'chicken:music';
const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const VOLUME = 0.5;
const FADE = 0.8;

export class AmbientMusic {
  constructor({ storage = globalThis.localStorage } = {}) {
    this._storage = storage;
    this._enabled = this._readPreference();
    this._listeners = new Set();
    this._timer = null;
    this._bus = null;
    this._unlocked = false;
    this._eighth = 60 / TEMPO_BPM / 2;
    this._loopLength = LOOP_EIGHTHS * this._eighth;

    this.subscribe = this.subscribe.bind(this);
    this.getSnapshot = this.getSnapshot.bind(this);
    this._onGesture = this._onGesture.bind(this);
    this._onVisibility = this._onVisibility.bind(this);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  start() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', this._onVisibility);
    if (this._unlocked) { this._play(); return; }
    for (const type of ['pointerdown', 'keydown', 'touchstart']) {
      window.addEventListener(type, this._onGesture, { once: false, passive: true });
    }
  }

  toggle() {
    this.setEnabled(!this._enabled);
  }

  setEnabled(enabled) {
    if (enabled === this._enabled) return;
    this._enabled = enabled;
    try { this._storage?.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch { /* storage unavailable */ }
    if (enabled) this._play(); else this._pause();
    this._listeners.forEach(listener => listener());
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  getSnapshot() {
    return this._enabled;
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  _readPreference() {
    try { return this._storage?.getItem(STORAGE_KEY) !== 'off'; } catch { return true; }
  }

  _onGesture() {
    this._unlocked = true;
    for (const type of ['pointerdown', 'keydown', 'touchstart']) {
      window.removeEventListener(type, this._onGesture);
    }
    this._play();
  }

  _onVisibility() {
    if (document.hidden) this._pause();
    else this._play();
  }

  _ensureBus(ctx) {
    if (this._bus) return;
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    const wet = ctx.createGain();
    wet.gain.value = 0.45;
    const reverb = createReverb(ctx);
    // Instruments → input → (dry + reverb) → master → speakers
    const input = ctx.createGain();
    input.connect(dry).connect(master);
    input.connect(reverb).connect(wet).connect(master);
    master.connect(ctx.destination);
    this._bus = { input, master };
  }

  _play() {
    if (!this._enabled || !this._unlocked || this._timer || (typeof document !== 'undefined' && document.hidden)) return;
    const ctx = getAudioContext();
    this._ensureBus(ctx);
    const now = ctx.currentTime;
    this._bus.master.gain.cancelScheduledValues(now);
    this._bus.master.gain.setValueAtTime(Math.max(0.0001, this._bus.master.gain.value), now);
    this._bus.master.gain.exponentialRampToValueAtTime(VOLUME, now + FADE);
    // Restart from the top of the loop, a beat from now.
    this._loopStart = now + 0.1;
    this._nextIndex = 0;
    this._timer = setInterval(() => this._schedule(), TICK_MS);
    this._schedule();
  }

  _pause() {
    if (!this._timer) return;
    clearInterval(this._timer);
    this._timer = null;
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const gain = this._bus.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.exponentialRampToValueAtTime(0.0001, now + FADE * 0.5);
    // Notes already scheduled ahead are silenced by the fade; a fresh bus avoids them
    // bleeding into the next play().
    const old = this._bus.master;
    this._bus = null;
    setTimeout(() => old.disconnect(), FADE * 1000);
  }

  _schedule() {
    const ctx = getAudioContext();
    const horizon = ctx.currentTime + LOOKAHEAD;
    for (;;) {
      if (this._nextIndex >= EVENTS.length) {
        this._nextIndex = 0;
        this._loopStart += this._loopLength;
      }
      const event = EVENTS[this._nextIndex];
      const time = this._loopStart + event.at * this._eighth;
      if (time > horizon) break;
      if (time >= ctx.currentTime - 0.02) this._playEvent(ctx, event, time);
      this._nextIndex++;
    }
  }

  _playEvent(ctx, event, time) {
    const out = this._bus.input;
    switch (event.type) {
      case 'koto': koto(ctx, out, time, event.note, { velocity: event.velocity }); break;
      case 'flute': shakuhachi(ctx, out, time, event.note, event.length * this._eighth, {}); break;
      case 'taiko': taiko(ctx, out, time, { velocity: event.velocity }); break;
      case 'drone': drone(ctx, out, time, event.length * this._eighth, event.notes, { velocity: event.velocity }); break;
      default: break;
    }
  }
}

export const ambientMusic = new AmbientMusic();
