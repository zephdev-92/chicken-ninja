// Pure JS state machine — no React dependency.
// Subscribes to gameEvents; React uses useSyncExternalStore / addEventListener('change').
import { gameEvents } from './gameEvents.js';

class ChickenStore extends EventTarget {
  constructor() {
    super();
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
