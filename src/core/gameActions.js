// Player actions — the only place that calls socket.emit.
// Import this in any frontend instead of touching socket directly.
import { socket } from './socketClient.js';

export const gameActions = {
  startRound(bet, difficulty) {
    socket.emit('round:start', { bet, difficulty });
  },
  step() {
    socket.emit('round:step');
  },
  cashOut() {
    socket.emit('round:cashout');
  },
  setClientSeed(seed) {
    socket.emit('player:set-client-seed', { seed });
  },
  deposit(amount) {
    socket.emit('wallet:deposit', { amount });
  },
  withdraw(amount) {
    socket.emit('wallet:withdraw', { amount });
  },
};
