import { io } from 'socket.io-client';
import { gameEvents } from './gameEvents.js';
import { chickenStore } from './chickenStore.js';
import { DIFFICULTIES } from '../shared/gameConfig.js';

const TOKEN_KEY = 'chicken:playerToken';

function readStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY) ?? undefined; } catch { return undefined; }
}

// Persists whatever token the server confirms — a fresh mint on first visit,
// or the same one echoed back on every reconnect. Idempotent: writing the
// same value back is a no-op in practice.
function storeToken(token) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* localStorage unavailable */ }
}

export const socket = io({ autoConnect: true, auth: { token: readStoredToken() } });

// ── Helpers ──────────────────────────────────────────────────────────────────

function dispatch(name, detail) {
  gameEvents.dispatchEvent(new CustomEvent(name, { detail }));
}

function difficultyLabel(key) {
  return DIFFICULTIES[key]?.label ?? key ?? '';
}

function messageForStatus(status, difficulty) {
  switch (status) {
    case 'active': return `Tour en cours (${difficultyLabel(difficulty)}) — avancez ou encaissez.`;
    case 'busted': return 'Aïe — étoile ninja ! Tour perdu.';
    case 'cashed': return 'Encaissé — bien joué !';
    default:       return 'Choisissez une difficulté et misez.';
  }
}

// ── Connexion ────────────────────────────────────────────────────────────────

socket.on('connect', () => console.log('[socket] connected:', socket.id));

socket.on('disconnect', () => {
  dispatch('store:patch', { message: 'Connexion perdue — reconnexion...' });
});

socket.on('session:sync', ({ token, balance, wallet, status, difficulty, step, multiplier, provablyFair }) => {
  if (token) storeToken(token);
  chickenStore.setState({
    balance, walletBalance: wallet,
    status, difficulty, step, multiplier,
    provablyFair: provablyFair ?? chickenStore.getState().provablyFair,
    message: messageForStatus(status, difficulty),
  });
});

socket.on('server:error', ({ code }) => {
  console.warn('[socket] server error:', code);
  dispatch('store:patch', { message: `Erreur : ${code}` });
  dispatch('server:error', { code });
});

// ── Cycle de tour ────────────────────────────────────────────────────────────

socket.on('round:started', ({ difficulty, bet, lanes, serverSeedHash, clientSeed, nonce, balance }) => {
  const { provablyFair } = chickenStore.getState();
  chickenStore.setState({
    balance,
    status: 'active', difficulty, activeBet: bet, lanes,
    step: 0, multiplier: 1, lanesRemaining: lanes, lastOutcome: null,
    cashoutMultiplier: null,
    provablyFair: { ...provablyFair, serverSeedHash, clientSeed, nonce, serverSeed: null },
    message: messageForStatus('active', difficulty),
  });
});

socket.on('step:result', ({ step, multiplier, lanesRemaining }) => {
  const { difficulty } = chickenStore.getState();
  chickenStore.setState({
    step, multiplier, lanesRemaining, lastOutcome: 'safe',
    message: `Case ${step} franchie — ${multiplier.toFixed(2)}x (${difficultyLabel(difficulty)})`,
  });
});

socket.on('round:busted', ({ round, step, serverSeed }) => {
  const { provablyFair, difficulty, activeBet } = chickenStore.getState();
  chickenStore.setState({
    status: 'busted', lastOutcome: 'star',
    provablyFair: { ...provablyFair, serverSeed },
    message: `Étoile ninja à la case ${step} — perdu ${activeBet} €.`,
  });
  chickenStore.addHistory({
    round, difficulty, bet: activeBet, step,
    result: 'busted', multiplier: null, payout: 0, profit: -activeBet,
  });
  dispatch('round:busted', { step });
});

socket.on('round:cashout', ({ round, step, multiplier, payout, bet, serverSeed, balance }) => {
  const { provablyFair, difficulty } = chickenStore.getState();
  chickenStore.setState({
    balance,
    status: 'cashed', cashoutMultiplier: multiplier,
    provablyFair: { ...provablyFair, serverSeed },
    message: `Encaissé à la case ${step} — gain ${payout} €.`,
  });
  chickenStore.addHistory({
    round, difficulty, bet, step,
    result: 'cashout', multiplier, payout, profit: +(payout - bet).toFixed(2),
  });
});

socket.on('wallet:sync', ({ balance, wallet }) => {
  chickenStore.setState({ balance, walletBalance: wallet });
});

// ── Feed global (cosmétique) ─────────────────────────────────────────────────

socket.on('cashout:feed', (entry) => {
  dispatch('store:cashout-feed', entry);
});
