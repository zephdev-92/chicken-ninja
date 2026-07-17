import { useSyncExternalStore, useEffect, useRef, useState } from 'react';
import { chickenStore } from '../core/chickenStore';
import { gameEvents } from '../core/gameEvents';
import { gameActions } from '../core/gameActions';
import { DIFFICULTIES, DIFFICULTY_KEYS } from '../shared/gameConfig';

const MIN_BET = 1;
const MAX_BET = 200;

function subscribeStore(callback) {
  chickenStore.addEventListener('change', callback);
  return () => chickenStore.removeEventListener('change', callback);
}

export function useChickenGame() {
  const gameState = useSyncExternalStore(
    subscribeStore,
    () => chickenStore.getState(),
  );

  const [walletBalance, setWalletBalance] = useState(() => {
    try { return parseFloat(localStorage.getItem('chicken:wallet')  ?? '1000'); } catch { return 1000; }
  });
  const [balance, setBalance] = useState(() => {
    try { return parseFloat(localStorage.getItem('chicken:balance') ?? '100');  } catch { return 100;  }
  });
  const [bet, setBetRaw]             = useState(10);
  const [betError, setBetError]      = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');

  useEffect(() => {
    try { localStorage.setItem('chicken:wallet',  String(walletBalance)); } catch { /* localStorage unavailable */ }
  }, [walletBalance]);
  useEffect(() => {
    try { localStorage.setItem('chicken:balance', String(balance)); } catch { /* localStorage unavailable */ }
  }, [balance]);

  // Deduct balance once the server confirms the round started
  useEffect(() => {
    const handler = ({ detail: { bet: confirmedBet } }) => {
      setBalance(b => +(b - confirmedBet).toFixed(2));
    };
    gameEvents.addEventListener('round:started', handler);
    return () => gameEvents.removeEventListener('round:started', handler);
  }, []);

  // Credit payout on cashout (manual or auto, at the end of the lanes)
  useEffect(() => {
    const handler = ({ detail: { payout } }) => {
      setBalance(b => +(b + payout).toFixed(2));
    };
    gameEvents.addEventListener('player:cashout:result', handler);
    return () => gameEvents.removeEventListener('player:cashout:result', handler);
  }, []);

  // Surface server errors in the UI
  useEffect(() => {
    const handler = ({ detail }) => {
      const msg = detail?.code ?? 'erreur inconnue';
      setBetError(`Erreur serveur : ${msg}`);
    };
    gameEvents.addEventListener('server:error', handler);
    return () => gameEvents.removeEventListener('server:error', handler);
  }, []);

  const isIdleLike = gameState.status === 'idle' || gameState.status === 'busted' || gameState.status === 'cashed';

  // Guards against double-firing `round:step` / `round:cashout` on a fast
  // double-click — the button stays enabled while awaiting the server's
  // response, so without this a single click could advance more than one lane.
  const [actionPending, setActionPending] = useState(false);
  const actionPendingRef = useRef(false);

  useEffect(() => {
    const clearPending = () => {
      actionPendingRef.current = false;
      setActionPending(false);
    };
    chickenStore.addEventListener('change', clearPending);
    return () => chickenStore.removeEventListener('change', clearPending);
  }, []);

  // ── Bet management ────────────────────────────────────────────────────────
  const setBet = (value) => {
    const v = Math.max(MIN_BET, Math.min(MAX_BET, Math.round(value)));
    if (v > balance) {
      setBetRaw(balance);
      setBetError('La mise ne peut pas dépasser la balance active.');
      return;
    }
    setBetRaw(v);
    setBetError('');
  };

  const setDifficulty = (key) => {
    if (!isIdleLike) return;
    if (Object.prototype.hasOwnProperty.call(DIFFICULTIES, key)) setSelectedDifficulty(key);
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const startRound = () => {
    if (!isIdleLike) return;
    if (bet < MIN_BET || bet > balance) {
      setBetError('Mise invalide.');
      return;
    }
    setBetError('');
    gameActions.startRound(bet, selectedDifficulty);
  };

  const step = () => {
    if (gameState.status !== 'active' || actionPendingRef.current) return;
    actionPendingRef.current = true;
    setActionPending(true);
    gameActions.step();
  };

  const cashOut = () => {
    if (gameState.status !== 'active' || gameState.step < 1 || actionPendingRef.current) return;
    actionPendingRef.current = true;
    setActionPending(true);
    gameActions.cashOut();
  };

  const depositToBankroll = (amount) => {
    const next = Math.min(walletBalance, Math.round(amount));
    if (next <= 0) return;
    setWalletBalance(w => +(w - next).toFixed(2));
    setBalance(b => +(b + next).toFixed(2));
  };

  const withdrawFromBankroll = (amount) => {
    const next = Math.min(balance, Math.round(amount));
    if (next <= 0) return;
    setBalance(b => +(b - next).toFixed(2));
    setWalletBalance(w => +(w + next).toFixed(2));
  };

  return {
    provablyFair:      gameState.provablyFair,
    status:            gameState.status,
    difficulty:        gameState.difficulty,
    lanes:             gameState.lanes,
    step_:             gameState.step,
    multiplier:        gameState.multiplier,
    lanesRemaining:    gameState.lanesRemaining,
    activeBet:         gameState.activeBet,
    lastOutcome:       gameState.lastOutcome,
    cashoutMultiplier: gameState.cashoutMultiplier,
    message:           gameState.message,
    history:           gameState.history,
    cashoutFeed:       gameState.cashoutFeed,
    walletBalance, balance,
    bet, setBet, betError,
    selectedDifficulty, setDifficulty,
    isIdleLike, actionPending,
    startRound, step, cashOut,
    setClientSeed: gameActions.setClientSeed,
    depositToBankroll, withdrawFromBankroll,
    difficulties: DIFFICULTIES,
    difficultyKeys: DIFFICULTY_KEYS,
    minBet: MIN_BET,
    maxBet: MAX_BET,
  };
}
