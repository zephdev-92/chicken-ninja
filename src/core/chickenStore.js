// Pure JS state machine — no React dependency.
// Subscribes to gameEvents; React uses useSyncExternalStore / addEventListener('change').
import { gameEvents } from './gameEvents.js';

// How long a finished round (busted/cashed) sits on screen before the game
// quietly returns to the idle bet screen on its own, so a player who walks
// away doesn't leave the table stuck showing a stale result forever.
const AUTO_IDLE_MS = 6000;

const IDLE_PATCH = {
  status: 'idle', step: 0, multiplier: 1, lanesRemaining: 0,
  activeBet: 0, lastOutcome: null, cashoutMultiplier: null,
  message: 'Choisissez une difficulté et misez.',
};

class ChickenStore extends EventTarget {
  constructor() {
    super();
    this._idleTimer = null;
    this._state = {
      // States: idle | active | busted | cashed
      status:         'idle',
      difficulty:     null,
      lanes:          0,
      step:           0,
      multiplier:     1,
      lanesRemaining: 0,
      activeBet:      0,
      lastOutcome:    null,   // 'safe' | 'star' | null — drives the last renderer animation
      cashoutMultiplier: null,
      message:        'Choisissez une difficulté et misez.',
      history:        [],
      cashoutFeed:    [],
      provablyFair: {
        serverSeedHash: '',
        clientSeed:     'default',
        nonce:          0,
        serverSeed:     null,
      },
    };
  }

  getState() { return this._state; }

  setState(patch) {
    this._state = { ...this._state, ...patch };
    this.dispatchEvent(new CustomEvent('change', { detail: this._state }));
    this._scheduleAutoIdle();
  }

  // Arms (or disarms) the return-to-idle timer to match the current status —
  // called after every state change so a fresh busted/cashed result always
  // gets its own full countdown, and starting a new round or already being
  // idle cancels it outright.
  _scheduleAutoIdle() {
    if (this._idleTimer) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    if (this._state.status !== 'busted' && this._state.status !== 'cashed') return;
    this._idleTimer = setTimeout(() => {
      this._idleTimer = null;
      if (this._state.status === 'busted' || this._state.status === 'cashed') {
        this.setState(IDLE_PATCH);
      }
    }, AUTO_IDLE_MS);
  }

  addCashoutFeed(entry) {
    const cashoutFeed = [entry, ...this._state.cashoutFeed].slice(0, 20);
    this.setState({ cashoutFeed });
  }

  addHistory(entry) {
    const history = [entry, ...this._state.history].slice(0, 10);
    this.setState({ history });
  }
}

export const chickenStore = new ChickenStore();

// ── Wire gameEvents → store ───────────────────────────────────────────────────
gameEvents.addEventListener('store:patch',        ({ detail }) => chickenStore.setState(detail));
gameEvents.addEventListener('store:cashout-feed', ({ detail }) => chickenStore.addCashoutFeed(detail));
gameEvents.addEventListener('store:history-add',  ({ detail }) => chickenStore.addHistory(detail));
