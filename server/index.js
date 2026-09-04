import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Round } from './core/roundEngine.js';
import { LocalLedger } from './platforms/standalone/localLedger.js';

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*' } });

const DEFAULT_BALANCE = 100;
const DEFAULT_WALLET  = 1000;

// ── Player identity — anonymous, signed, in-memory ────────────────────────────
// The signing secret lives only for the life of this process: a server restart
// invalidates every outstanding token, which is fine since accounts themselves
// are in-memory too (see PlayerAccount / accounts below) — nothing to keep
// tokens valid for once the balances they point to are gone anyway.
const TOKEN_SECRET = randomBytes(32).toString('hex');

function signPlayerId(playerId) {
  return createHmac('sha256', TOKEN_SECRET).update(playerId).digest('hex');
}

// Returns the playerId if the token is well-formed and its signature checks
// out, otherwise null — never trust a playerId without re-deriving its
// signature from our own secret.
function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const [playerId, signature] = token.split('.');
  if (!playerId || !signature) return null;
  const expected = signPlayerId(playerId);
  if (expected.length !== signature.length) return null;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return playerId;
}

// Standalone/demo platform account: `balance` (in-play, drives Round via
// LocalLedger) and `wallet` (reserve). The wallet ↔ balance split has no
// equivalent on aggregator platforms (Hub88, ...) — there, the operator IS the
// wallet, there's no separate reserve to transfer from. See HUB88_INTEGRATION.md.
class PlayerAccount {
  constructor() {
    this.balance = DEFAULT_BALANCE;
    this.wallet  = DEFAULT_WALLET;
  }

  // Moves funds between the reserve wallet and the in-play balance — clamped
  // to what's actually available on each side, never goes negative.
  deposit(amount) {
    const clean = Math.min(this.wallet, Math.round(Number(amount)));
    if (!Number.isFinite(clean) || clean <= 0) return { error: 'invalid_amount' };
    this.wallet  = +(this.wallet - clean).toFixed(2);
    this.balance = +(this.balance + clean).toFixed(2);
    return { data: { balance: this.balance, wallet: this.wallet } };
  }

  withdraw(amount) {
    const clean = Math.min(this.balance, Math.round(Number(amount)));
    if (!Number.isFinite(clean) || clean <= 0) return { error: 'invalid_amount' };
    this.balance = +(this.balance - clean).toFixed(2);
    this.wallet  = +(this.wallet + clean).toFixed(2);
    return { data: { balance: this.balance, wallet: this.wallet } };
  }
}

const accounts = new Map(); // playerId -> PlayerAccount

function getOrCreateAccount(playerId) {
  let account = accounts.get(playerId);
  if (!account) {
    account = new PlayerAccount();
    accounts.set(playerId, account);
  }
  return account;
}

io.on('connection', async (socket) => {
  console.log('[server] connected:', socket.id);

  // Resolve (or mint) the anonymous player identity for this connection —
  // never trust a client-supplied playerId without re-checking its signature.
  const presentedToken = socket.handshake.auth?.token;
  const verifiedId      = verifyToken(presentedToken);
  const playerId        = verifiedId ?? randomBytes(16).toString('hex');
  const token            = verifiedId ? presentedToken : `${playerId}.${signPlayerId(playerId)}`;
  const account          = getOrCreateAccount(playerId);
  // The platform-agnostic round engine (server/core/roundEngine.js), driven here
  // by the standalone Ledger. Swapping LocalLedger for an aggregator's Ledger
  // (Hub88, ...) is the only thing a new platform needs to change at this layer —
  // see HUB88_INTEGRATION.md.
  const round             = new Round(new LocalLedger(account));

  const syncState = async () => ({ token, wallet: account.wallet, ...(await round.state()) });

  socket.emit('session:sync', await syncState());

  socket.on('round:start', async ({ bet, difficulty }) => {
    const { data, error } = await round.startRound(bet, difficulty);
    if (error) { socket.emit('server:error', { code: error }); return; }
    socket.emit('round:started', data);
  });

  socket.on('round:step', async () => {
    const { data, error } = await round.step_();
    if (error) { socket.emit('server:error', { code: error }); return; }

    if (data.busted) {
      socket.emit('round:busted', { round: round.round, step: data.step, serverSeed: data.serverSeed });
      return;
    }
    socket.emit('step:result', {
      step: data.step, outcome: 'safe',
      multiplier: data.multiplier, lanesRemaining: data.lanesRemaining,
    });
    if (data.autoCashout) {
      socket.emit('round:cashout', { round: round.round, step: data.step, ...data.autoCashout });
      io.emit('cashout:feed', {
        shortId: socket.id.slice(-4), difficulty: round.difficulty,
        step: data.step, multiplier: data.autoCashout.multiplier,
        payout: data.autoCashout.payout,
      });
    }
  });

  socket.on('round:cashout', async () => {
    const { data, error } = await round.cashOut();
    if (error) { socket.emit('server:error', { code: error }); return; }
    socket.emit('round:cashout', { round: round.round, ...data });
    io.emit('cashout:feed', {
      shortId: socket.id.slice(-4), difficulty: round.difficulty,
      step: data.step, multiplier: data.multiplier, payout: data.payout,
    });
  });

  socket.on('wallet:deposit', ({ amount }) => {
    const { data, error } = account.deposit(amount);
    if (error) { socket.emit('server:error', { code: error }); return; }
    socket.emit('wallet:sync', data);
  });

  socket.on('wallet:withdraw', ({ amount }) => {
    const { data, error } = account.withdraw(amount);
    if (error) { socket.emit('server:error', { code: error }); return; }
    socket.emit('wallet:sync', data);
  });

  socket.on('player:set-client-seed', async ({ seed }) => {
    if (round.setClientSeed(seed)) {
      socket.emit('session:sync', await syncState());
    }
  });

  socket.on('disconnect', () => {
    console.log('[server] disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[server] Chicken Ninja on http://localhost:${PORT}`);
});
