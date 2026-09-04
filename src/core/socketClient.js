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

// A platform launch (Hub88's /game/url, or any future aggregator — see
// HUB88_INTEGRATION.md § Frontend) redirects the operator's iframe to us with
// the session token as a `?token=` query param. It always wins over whatever's
// already in localStorage: a fresh launch instruction is never stale, while
// localStorage can be a leftover from a previous tab/session/platform. Stored
// back into localStorage immediately so a reload on this tab still reconnects
// with the same identity once the query string itself is gone (see below) — the
// standalone anonymous flow (no `?token=`) is completely untouched by this,
// `readStoredToken()` alone is exactly what ran before this existed.
function resolveInitialToken() {
  const fromLaunchUrl = new URLSearchParams(window.location.search).get('token');
  if (fromLaunchUrl) {
    storeToken(fromLaunchUrl);
    return fromLaunchUrl;
  }
  return readStoredToken();
}

// Strips `?token=` (and the other launch params riding along with it) from the
// visible URL right after reading it — the token has already been captured into
// the socket handshake + localStorage above, and leaving a token that grants
// access to a real-money wallet-linked session sitting in the address bar means
// it's bookmarkable/shareable/screenshottable, which no token in this app was
// ever meant to be.
function stripLaunchParamsFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('token')) return;
  ['token', 'lang', 'demo'].forEach((key) => url.searchParams.delete(key));
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

const initialToken = resolveInitialToken();
stripLaunchParamsFromUrl();

export const socket = io({ autoConnect: true, auth: { token: initialToken } });

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
