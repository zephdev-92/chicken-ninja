import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  DIFFICULTIES, isValidDifficulty,
  computeStepMultiplier, hmacMessage,
  hexToUnitInterval, outcomeFromUnitInterval,
} from '../src/shared/gameConfig.js';

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*' } });

const MIN_BET = 1;
const MAX_BET = 200;
const DEFAULT_BALANCE = 100;
const DEFAULT_WALLET  = 1000;

function sha256hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function hmacHex(serverSeed, message) {
  return createHmac('sha256', serverSeed).update(message).digest('hex');
}

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

class PlayerAccount {
  constructor() {
    this.balance = DEFAULT_BALANCE;
    this.wallet  = DEFAULT_WALLET;
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

// Provably-fair, per lane: HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${step}`)
// Computed on demand, server-authoritative — the client can't precompute a round
// because serverSeed stays secret until bust/cashout.
function resolveStep(serverSeed, clientSeed, nonce, step, deathChance) {
  const hex = hmacHex(serverSeed, hmacMessage(clientSeed, nonce, step));
  const r   = hexToUnitInterval(hex);
  return outcomeFromUnitInterval(r, deathChance);
}

// ── Per-socket session — solo round vs. the house, no shared room ────────────
class PlayerSession {
  constructor(socket, token, account) {
    this.socket      = socket;
    this.token        = token;
    this.account      = account;
    this.status       = 'idle'; // idle | active | busted | cashed
    this.round        = 0;      // nonce, increments per round started
    this.difficulty   = null;
    this.bet          = 0;
    this.step         = 0;
    this.serverSeed     = randomBytes(32).toString('hex');
    this.serverSeedHash = sha256hex(this.serverSeed);
    this.clientSeed      = 'default';
  }

  syncState() {
    return {
      token:      this.token,
      balance:    this.account.balance,
      wallet:     this.account.wallet,
      status:     this.status,
      difficulty: this.difficulty,
      step:       this.step,
      multiplier: this.difficulty
        ? computeStepMultiplier(DIFFICULTIES[this.difficulty].deathChance, this.step)
        : 1,
      provablyFair: {
        serverSeedHash: this.serverSeedHash,
        clientSeed:     this.clientSeed,
        nonce:          this.round,
        serverSeed:     (this.status === 'busted' || this.status === 'cashed') ? this.serverSeed : null,
      },
    };
  }

  startRound(bet, difficultyKey) {
    if (this.status === 'active') return { error: 'already_active' };
    if (!isValidDifficulty(difficultyKey)) return { error: 'invalid_difficulty' };
    const cleanBet = Math.round(Number(bet));
    if (!Number.isFinite(cleanBet) || cleanBet < MIN_BET || cleanBet > MAX_BET) {
      return { error: 'invalid_bet' };
    }
    if (cleanBet > this.account.balance) return { error: 'insufficient_balance' };

    this.account.balance = +(this.account.balance - cleanBet).toFixed(2);

    this.round++;
    this.difficulty = difficultyKey;
    this.bet        = cleanBet;
    this.step        = 0;
    this.status       = 'active';
    // Fresh seed each round — locked in now, revealed at bust/cashout.
    this.serverSeed     = randomBytes(32).toString('hex');
    this.serverSeedHash = sha256hex(this.serverSeed);

    return {
      data: {
        round: this.round,
        difficulty: this.difficulty,
        bet: this.bet,
        lanes: DIFFICULTIES[difficultyKey].lanes,
        serverSeedHash: this.serverSeedHash,
        clientSeed: this.clientSeed,
        nonce: this.round,
        balance: this.account.balance,
      },
    };
  }

  step_() {
    if (this.status !== 'active') return { error: 'not_active' };
    const { lanes, deathChance } = DIFFICULTIES[this.difficulty];
    if (this.step >= lanes) return { error: 'lanes_exhausted' };

    const nextStep = this.step + 1;
    const outcome  = resolveStep(this.serverSeed, this.clientSeed, this.round, nextStep, deathChance);

    if (outcome === 'star') {
      this.status = 'busted';
      return { data: { busted: true, step: nextStep, serverSeed: this.serverSeed } };
    }

    this.step = nextStep;
    const multiplier     = computeStepMultiplier(deathChance, this.step);
    const lanesRemaining = lanes - this.step;

    if (lanesRemaining === 0) {
      // Cleared every lane — auto-cashout at the max multiplier.
      this.status = 'cashed';
      const payout = +(this.bet * multiplier).toFixed(2);
      this.account.balance = +(this.account.balance + payout).toFixed(2);
      return {
        data: {
          busted: false, step: this.step, multiplier, lanesRemaining,
          autoCashout: { multiplier, payout, bet: this.bet, serverSeed: this.serverSeed, balance: this.account.balance },
        },
      };
    }

    return { data: { busted: false, step: this.step, multiplier, lanesRemaining } };
  }

  cashOut() {
    if (this.status !== 'active') return { error: 'not_active' };
    if (this.step < 1) return { error: 'no_progress' };

    const { deathChance } = DIFFICULTIES[this.difficulty];
    const multiplier = computeStepMultiplier(deathChance, this.step);
    const payout      = +(this.bet * multiplier).toFixed(2);
    this.status        = 'cashed';
    this.account.balance = +(this.account.balance + payout).toFixed(2);

    return {
      data: {
        step: this.step, multiplier, payout, bet: this.bet,
        serverSeed: this.serverSeed, balance: this.account.balance,
      },
    };
  }

  setClientSeed(seed) {
    if (this.status === 'active') return false;
    const clean = String(seed ?? '').trim().slice(0, 64).replace(/[^\w-]/g, '');
    if (!clean) return false;
    this.clientSeed = clean;
    return true;
  }

  // Moves funds between the reserve wallet and the in-play balance — clamped
  // to what's actually available on each side, never goes negative.
  deposit(amount) {
    const clean = Math.min(this.account.wallet, Math.round(Number(amount)));
    if (!Number.isFinite(clean) || clean <= 0) return { error: 'invalid_amount' };
    this.account.wallet  = +(this.account.wallet - clean).toFixed(2);
    this.account.balance = +(this.account.balance + clean).toFixed(2);
    return { data: { balance: this.account.balance, wallet: this.account.wallet } };
  }

  withdraw(amount) {
    const clean = Math.min(this.account.balance, Math.round(Number(amount)));
    if (!Number.isFinite(clean) || clean <= 0) return { error: 'invalid_amount' };
    this.account.balance = +(this.account.balance - clean).toFixed(2);
    this.account.wallet  = +(this.account.wallet + clean).toFixed(2);
    return { data: { balance: this.account.balance, wallet: this.account.wallet } };
  }
}

io.on('connection', (socket) => {
  console.log('[server] connected:', socket.id);

  // Resolve (or mint) the anonymous player identity for this connection —
  // never trust a client-supplied playerId without re-checking its signature.
  const presentedToken = socket.handshake.auth?.token;
  const verifiedId      = verifyToken(presentedToken);
  const playerId        = verifiedId ?? randomBytes(16).toString('hex');
  const token            = verifiedId ? presentedToken : `${playerId}.${signPlayerId(playerId)}`;
  const account          = getOrCreateAccount(playerId);
  const session          = new PlayerSession(socket, token, account);

  socket.emit('session:sync', session.syncState());

  socket.on('round:start', ({ bet, difficulty }) => {
    const { data, error } = session.startRound(bet, difficulty);
    if (error) { socket.emit('server:error', { code: error }); return; }
    socket.emit('round:started', data);
  });

  socket.on('round:step', () => {
    const { data, error } = session.step_();
    if (error) { socket.emit('server:error', { code: error }); return; }

    if (data.busted) {
      socket.emit('round:busted', { round: session.round, step: data.step, serverSeed: data.serverSeed });
      return;
    }
    socket.emit('step:result', {
      step: data.step, outcome: 'safe',
      multiplier: data.multiplier, lanesRemaining: data.lanesRemaining,
    });
    if (data.autoCashout) {
      socket.emit('round:cashout', { round: session.round, step: data.step, ...data.autoCashout });
      io.emit('cashout:feed', {
        shortId: socket.id.slice(-4), difficulty: session.difficulty,
        step: data.step, multiplier: data.autoCashout.multiplier,
        payout: data.autoCashout.payout,
      });
    }
  });

  socket.on('round:cashout', () => {
    const { data, error } = session.cashOut();
    if (error) { socket.emit('server:error', { code: error }); return; }
    socket.emit('round:cashout', { round: session.round, ...data });
    io.emit('cashout:feed', {
      shortId: socket.id.slice(-4), difficulty: session.difficulty,
      step: data.step, multiplier: data.multiplier, payout: data.payout,
    });
  });

  socket.on('wallet:deposit', ({ amount }) => {
    const { data, error } = session.deposit(amount);
    if (error) { socket.emit('server:error', { code: error }); return; }
    socket.emit('wallet:sync', data);
  });

  socket.on('wallet:withdraw', ({ amount }) => {
    const { data, error } = session.withdraw(amount);
    if (error) { socket.emit('server:error', { code: error }); return; }
    socket.emit('wallet:sync', data);
  });

  socket.on('player:set-client-seed', ({ seed }) => {
    if (session.setClientSeed(seed)) {
      socket.emit('session:sync', session.syncState());
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
