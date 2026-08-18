#!/usr/bin/env node
// Monte Carlo RTP validator — exercises the REAL provably-fair path (Node
// `crypto` HMAC-SHA256, the same hex→[0,1) extraction and cutoff as
// server/index.js) rather than re-deriving the math abstractly. The formula
// `RTP * (1/survival)^step` is exact by construction, so this script isn't
// proving the algebra — it's checking that the actual bit-level implementation
// (hex slicing, float precision, HMAC digest) doesn't introduce sampling bias.
//
// Usage:
//   node scripts/rtp-simulation.js                  # quick pass, ~a few seconds
//   node scripts/rtp-simulation.js --deep            # higher confidence, slower
//   node scripts/rtp-simulation.js --trials=20000 --min-wins=80

import { createHmac, randomBytes } from 'crypto';
import {
  DIFFICULTIES, DIFFICULTY_KEYS, RTP,
  computeStepMultiplier, hmacMessage, hexToUnitInterval, outcomeFromUnitInterval,
} from '../src/shared/gameConfig.js';

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const deep = args.includes('--deep');

const BASE_TRIALS      = flag('trials',   deep ? 40000 : 5000);
const MIN_EXPECTED_WINS = flag('min-wins', deep ? 200   : 25);
const MAX_TRIALS        = flag('max-trials', deep ? 2_000_000 : 150_000);

// ── Real provably-fair path (mirrors server/index.js exactly) ────────────────
function hmacHex(serverSeed, message) {
  return createHmac('sha256', serverSeed).update(message).digest('hex');
}

function resolveStep(serverSeed, clientSeed, nonce, step, deathChance) {
  const hex = hmacHex(serverSeed, hmacMessage(clientSeed, nonce, step));
  const r = hexToUnitInterval(hex);
  return outcomeFromUnitInterval(r, deathChance);
}

// ── Stats helpers ────────────────────────────────────────────────────────────
function requiredTrials(survivalP) {
  const bySignal = Math.ceil(MIN_EXPECTED_WINS / Math.max(survivalP, 1e-12));
  return Math.min(Math.max(BASE_TRIALS, bySignal), MAX_TRIALS);
}

// 95% CI half-width, in "return per unit bet" units, for a Bernoulli(p) payoff of `payout`.
function ci95HalfWidth(p, n, payout) {
  return 1.96 * payout * Math.sqrt((p * (1 - p)) / n);
}

// ── Simulate one (difficulty, target step) cell ───────────────────────────────
function simulateCell(deathChance, step, nonceOffset) {
  const survivalP = Math.pow(1 - deathChance, step);
  const n = requiredTrials(survivalP);
  const payout = computeStepMultiplier(deathChance, step);

  let wins = 0;
  for (let i = 0; i < n; i++) {
    const serverSeed = randomBytes(32).toString('hex');
    const clientSeed = randomBytes(6).toString('hex');
    const nonce = nonceOffset + i + 1;

    let survived = true;
    for (let s = 1; s <= step; s++) {
      if (resolveStep(serverSeed, clientSeed, nonce, s, deathChance) === 'star') {
        survived = false;
        break;
      }
    }
    if (survived) wins++;
  }

  const empiricalReturn = (wins * payout) / n;
  const halfWidth = ci95HalfWidth(survivalP, n, payout);
  const low = RTP - halfWidth, high = RTP + halfWidth;
  const pass = empiricalReturn >= low && empiricalReturn <= high;
  return { n, wins, payout, empiricalReturn, low, high, pass, capped: n === MAX_TRIALS };
}

// ── Report ────────────────────────────────────────────────────────────────────
// `lanes` is a soft ceiling (see gameConfig.js), not a proportional gameplay milestone —
// spot-checking fixed fractions of it (lanes/4, lanes/2, ...) would drive high-deathChance
// difficulties into astronomically-improbable step counts (survival ~1e-30), producing
// meaningless capped/noisy cells. Target fixed survival probabilities instead, so every
// difficulty gets spot-checked at steps players actually reach.
const TARGET_SURVIVAL_PS = [0.5, 0.1, 0.01, 0.001];

function spotSteps(deathChance, lanes) {
  const survivalLog = Math.log(1 - deathChance);
  const steps = TARGET_SURVIVAL_PS.map(p => clampInt(Math.round(Math.log(p) / survivalLog), 1, lanes));
  return [...new Set([1, ...steps])];
}

function clampInt(v, min, max) { return Math.min(Math.max(v, min), max); }

function pct(x) { return `${(x * 100).toFixed(3)}%`; }

function main() {
  console.log(`\nChicken Ninja — RTP Monte Carlo (${deep ? 'deep' : 'quick'} mode)`);
  console.log(`Theoretical RTP: ${pct(RTP)}   base trials: ${BASE_TRIALS}   min expected wins: ${MIN_EXPECTED_WINS}   trial cap: ${MAX_TRIALS}\n`);

  let allPass = true;
  let nonceOffset = 0;

  for (const key of DIFFICULTY_KEYS) {
    const { label, deathChance, lanes } = DIFFICULTIES[key];
    console.log(`── ${label}  (deathChance=${deathChance}, lanes=${lanes}) ──`);

    for (const step of spotSteps(deathChance, lanes)) {
      const r = simulateCell(deathChance, step, nonceOffset);
      nonceOffset += r.n;
      if (!r.pass) allPass = false;

      const capNote = r.capped ? '  [capped — widen --max-trials for a tighter CI]' : '';
      console.log(
        `  step ${String(step).padStart(2)}  n=${String(r.n).padStart(7)}  wins=${String(r.wins).padStart(6)}  ` +
        `RTP=${pct(r.empiricalReturn).padStart(9)}  95% CI=[${pct(r.low)}, ${pct(r.high)}]  ${r.pass ? 'OK' : 'FAIL'}${capNote}`
      );
    }
    console.log('');
  }

  if (allPass) {
    console.log('✅ Every spot-check fell inside its 95% confidence interval around the theoretical RTP.');
  } else {
    console.log('❌ At least one spot-check missed its CI — re-run with --deep before trusting a FAIL on a thin sample,');
    console.log('   then check src/shared/gameConfig.js math and server/index.js\'s resolveStep() if it persists.');
  }
  process.exit(allPass ? 0 : 1);
}

main();
