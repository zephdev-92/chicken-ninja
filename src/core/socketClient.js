import { io } from 'socket.io-client';
import { gameEvents } from './gameEvents.js';
import { chickenStore } from './chickenStore.js';
import { DIFFICULTIES } from '../shared/gameConfig.js';

export const socket = io({ autoConnect: true });

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

socket.on('session:sync', ({ status, difficulty, step, multiplier, provablyFair }) => {
  chickenStore.setState({
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

socket.on('round:started', ({ round, difficulty, bet, lanes, serverSeedHash, clientSeed, nonce }) => {
  const { provablyFair } = chickenStore.getState();
  chickenStore.setState({
    status: 'active', difficulty, activeBet: bet, lanes,
    step: 0, multiplier: 1, lanesRemaining: lanes, lastOutcome: null,
    cashoutMultiplier: null,
    provablyFair: { ...provablyFair, serverSeedHash, clientSeed, nonce, serverSeed: null },
    message: messageForStatus('active', difficulty),
  });
  dispatch('round:started', { round, difficulty, bet });
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

socket.on('round:cashout', ({ round, step, multiplier, payout, bet, serverSeed }) => {
  const { provablyFair, difficulty } = chickenStore.getState();
  chickenStore.setState({
    status: 'cashed', cashoutMultiplier: multiplier,
    provablyFair: { ...provablyFair, serverSeed },
    message: `Encaissé à la case ${step} — gain ${payout} €.`,
  });
  chickenStore.addHistory({
    round, difficulty, bet, step,
    result: 'cashout', multiplier, payout, profit: +(payout - bet).toFixed(2),
  });
  dispatch('player:cashout:result', { multiplier, payout, bet });
});

// ── Feed global (cosmétique) ─────────────────────────────────────────────────

socket.on('cashout:feed', (entry) => {
  dispatch('store:cashout-feed', entry);
});
