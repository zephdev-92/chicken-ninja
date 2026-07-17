import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createHmac, createHash, randomBytes } from 'crypto';
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

function sha256hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

function hmacHex(serverSeed, message) {
  return createHmac('sha256', serverSeed).update(message).digest('hex');
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
  constructor(socket) {
    this.socket      = socket;
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
      return {
        data: {
          busted: false, step: this.step, multiplier, lanesRemaining,
          autoCashout: { multiplier, payout, bet: this.bet, serverSeed: this.serverSeed },
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

    return {
      data: {
        step: this.step, multiplier, payout, bet: this.bet,
        serverSeed: this.serverSeed,
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
}

io.on('connection', (socket) => {
  console.log('[server] connected:', socket.id);
  const session = new PlayerSession(socket);

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
