import { createHmac, createHash, randomBytes, randomUUID } from 'crypto';
import {
  DIFFICULTIES, isValidDifficulty,
  computeStepMultiplier, hmacMessage,
  hexToUnitInterval, outcomeFromUnitInterval,
} from '../../src/shared/gameConfig.js';

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

// Platform-agnostic round state machine — one round vs. the house, no shared room.
// All balance movement goes through the injected `ledger` (server/core/ledger.js),
// so this same class drives the standalone game AND every aggregator integration
// (Hub88, ...) without duplicating step/HMAC/multiplier logic per platform. See
// HUB88_INTEGRATION.md for the architecture this splits from (formerly PlayerSession).
export class Round {
  constructor(ledger, { clientSeed = 'default' } = {}) {
    this.ledger      = ledger;
    this.status       = 'idle'; // idle | active | busted | cashed
    this.round         = 0;      // nonce, increments per round started
    this.difficulty     = null;
    this.bet             = 0;
    this.step             = 0;
    this.serverSeed         = randomBytes(32).toString('hex');
    this.serverSeedHash     = sha256hex(this.serverSeed);
    this.clientSeed          = clientSeed;
    // The bet's transaction_uuid, referenced by the closing win/rollback call —
    // aggregator platforms (Hub88) require win/rollback to reference the bet they
    // settle; the standalone Ledger ignores it entirely.
    this.lastBetTransactionUuid = null;
  }

  async state() {
    return {
      balance:    await this.ledger.getBalance(),
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

  async startRound(bet, difficultyKey) {
    if (this.status === 'active' || this.status === 'starting') return { error: 'already_active' };
    if (!isValidDifficulty(difficultyKey)) return { error: 'invalid_difficulty' };
    const cleanBet = Math.round(Number(bet));
    if (!Number.isFinite(cleanBet) || cleanBet < MIN_BET || cleanBet > MAX_BET) {
      return { error: 'invalid_bet' };
    }

    // Claim the round synchronously, before the first `await` below — unlike the
    // fully-synchronous debit this replaced, `ledger.debit` always yields to the
    // event loop at least once, so a second round:start fired before this one
    // resolves would otherwise also pass the guard above. 'starting' (not
    // 'active') also blocks a racing round:step/cashOut, both of which require
    // status === 'active' — this round isn't playable until the bet actually clears.
    const previousStatus = this.status;
    this.status = 'starting';

    const transactionUuid = randomUUID();
    const { ok, balance, error } = await this.ledger.debit(cleanBet, {
      roundId: String(this.round + 1), transactionUuid,
    });
    if (!ok) {
      this.status = previousStatus;
      return { error: error ?? 'insufficient_balance' };
    }

    this.round++;
    this.difficulty = difficultyKey;
    this.bet        = cleanBet;
    this.step        = 0;
    this.status       = 'active';
    this.lastBetTransactionUuid = transactionUuid;
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
        balance,
      },
    };
  }

  async step_() {
    if (this.status !== 'active') return { error: 'not_active' };
    const { lanes, deathChance } = DIFFICULTIES[this.difficulty];
    if (this.step >= lanes) return { error: 'lanes_exhausted' };

    const nextStep = this.step + 1;
    const outcome  = resolveStep(this.serverSeed, this.clientSeed, this.round, nextStep, deathChance);

    if (outcome === 'star') {
      this.status = 'busted';
      // amount 0: no payout, but the round still closes through the ledger — a
      // no-op for the standalone Ledger, but aggregator platforms (Hub88) require
      // a win call with round_closed:true even on a loss to settle the round.
      const { balance } = await this.ledger.credit(0, {
        roundId: String(this.round), transactionUuid: randomUUID(),
        referenceTransactionUuid: this.lastBetTransactionUuid, roundClosed: true,
      });
      return { data: { busted: true, step: nextStep, serverSeed: this.serverSeed, balance } };
    }

    this.step = nextStep;
    const multiplier     = computeStepMultiplier(deathChance, this.step);
    const lanesRemaining = lanes - this.step;

    if (lanesRemaining === 0) {
      // Cleared every lane — auto-cashout at the max multiplier.
      this.status = 'cashed';
      const payout = +(this.bet * multiplier).toFixed(2);
      const { balance } = await this.ledger.credit(payout, {
        roundId: String(this.round), transactionUuid: randomUUID(),
        referenceTransactionUuid: this.lastBetTransactionUuid, roundClosed: true,
      });
      return {
        data: {
          busted: false, step: this.step, multiplier, lanesRemaining,
          autoCashout: { multiplier, payout, bet: this.bet, serverSeed: this.serverSeed, balance },
        },
      };
    }

    return { data: { busted: false, step: this.step, multiplier, lanesRemaining } };
  }

  async cashOut() {
    if (this.status !== 'active') return { error: 'not_active' };
    if (this.step < 1) return { error: 'no_progress' };

    const { deathChance } = DIFFICULTIES[this.difficulty];
    const multiplier = computeStepMultiplier(deathChance, this.step);
    const payout      = +(this.bet * multiplier).toFixed(2);
    this.status        = 'cashed';
    const { balance } = await this.ledger.credit(payout, {
      roundId: String(this.round), transactionUuid: randomUUID(),
      referenceTransactionUuid: this.lastBetTransactionUuid, roundClosed: true,
    });

    return {
      data: {
        step: this.step, multiplier, payout, bet: this.bet,
        serverSeed: this.serverSeed, balance,
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
