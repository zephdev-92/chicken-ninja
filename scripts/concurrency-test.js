#!/usr/bin/env node
// Concurrency / balance-consistency stress test — spawns a REAL server/index.js
// instance (child process, real port) and drives it with real socket.io-client
// connections. Unlike rtp-simulation.js (single-process math, no network), this
// exercises the actual protocol under concurrent traffic to catch bugs a solo
// client can't: a bet accepted twice on the same session, a cashout paid twice,
// or the account balance drifting away from bet/payout math.
//
// Usage:
//   node scripts/concurrency-test.js
//   node scripts/concurrency-test.js --players=50 --rounds=25 --port=3987

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import { io } from 'socket.io-client';
import { DIFFICULTY_KEYS } from '../src/shared/gameConfig.js';

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const PLAYERS = flag('players', 30);
const ROUNDS  = flag('rounds', 15);
const PORT    = flag('port', 3987);

const MAX_TEST_BET       = 20;
const DOUBLE_START_RATE   = 0.2;  // fraction of rounds that race a duplicate round:start
const DOUBLE_CASHOUT_RATE = 0.2;  // fraction of rounds that race a duplicate round:cashout
const EVENT_TIMEOUT_MS     = 4000;

// ── Helpers ──────────────────────────────────────────────────────────────────
function round2(n) { return +n.toFixed(2); }
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function raceEvents(socket, events, timeoutMs = EVENT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const cleanups = [];
    const timer = setTimeout(() => {
      cleanups.forEach(fn => fn());
      reject(new Error(`timeout waiting for one of [${events.join(', ')}]`));
    }, timeoutMs);
    for (const ev of events) {
      const handler = (data) => {
        clearTimeout(timer);
        cleanups.forEach(fn => fn());
        resolve({ event: ev, data });
      };
      socket.on(ev, handler);
      cleanups.push(() => socket.off(ev, handler));
    }
  });
}

// Fires round:start twice back-to-back on the same socket — exactly one should
// be accepted (the session was idle), the other rejected as already_active.
// A double-accept here would mean the same session paid out on two rounds it
// only ever placed one bet for.
function raceStart(bot, bet, difficulty, timeoutMs = 250) {
  return new Promise((resolve) => {
    let started = 0, rejected = 0, startedData = null;
    const onStarted = (d) => { started++; startedData = d; };
    const onError = (e) => { if (e.code === 'already_active') rejected++; };
    bot.socket.on('round:started', onStarted);
    bot.socket.on('server:error', onError);
    bot.socket.emit('round:start', { bet, difficulty });
    bot.socket.emit('round:start', { bet, difficulty });
    setTimeout(() => {
      bot.socket.off('round:started', onStarted);
      bot.socket.off('server:error', onError);
      resolve({ started, rejected, startedData });
    }, timeoutMs);
  });
}

// Same idea for cashout — a double-accept here would mean the same round got
// paid out twice, straight-up printing money.
function raceCashout(bot, timeoutMs = 250) {
  return new Promise((resolve) => {
    let cashed = 0, rejected = 0, cashData = null;
    const onCashout = (d) => { cashed++; cashData = d; };
    const onError = (e) => { if (e.code === 'not_active' || e.code === 'no_progress') rejected++; };
    bot.socket.on('round:cashout', onCashout);
    bot.socket.on('server:error', onError);
    bot.socket.emit('round:cashout');
    bot.socket.emit('round:cashout');
    setTimeout(() => {
      bot.socket.off('round:cashout', onCashout);
      bot.socket.off('server:error', onError);
      resolve({ cashed, rejected, cashData });
    }, timeoutMs);
  });
}

// ── Server lifecycle ─────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverEntry = path.join(__dirname, '..', 'server', 'index.js');

function startServer(port) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [serverEntry], {
      env: { ...process.env, PORT: String(port) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const readyTimer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`server on port ${port} did not report ready within 5s`));
    }, 5000);
    child.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('Chicken Ninja on http://localhost')) {
        clearTimeout(readyTimer);
        resolve(child);
      }
    });
    child.stderr.on('data', (chunk) => process.stderr.write(`[server stderr] ${chunk}`));
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code !== null && code !== 0) console.error(`[server] exited early with code ${code}`);
    });
  });
}

// ── Player bot ───────────────────────────────────────────────────────────────
class PlayerBot {
  constructor(id, port, token) {
    this.id = id;
    this.violations = [];
    this.stats = { rounds: 0, busts: 0, cashouts: 0 };
    this.balance = null;
    this.wallet = null;
    this.token = token || null;
    this.socket = io(`http://localhost:${port}`, {
      auth: token ? { token } : {},
      reconnection: false,
      forceNew: true,
    });
  }

  ready() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`bot ${this.id}: session:sync timeout`)), 5000);
      this.socket.once('session:sync', (data) => {
        clearTimeout(timer);
        this.balance = data.balance;
        this.wallet = data.wallet;
        this.token = data.token;
        resolve();
      });
      this.socket.once('connect_error', (err) => {
        clearTimeout(timer);
        reject(new Error(`bot ${this.id}: connect_error ${err.message}`));
      });
    });
  }

  close() { this.socket.close(); }
}

function assertEqual(actual, expected, msg, bot) {
  if (Math.abs(actual - expected) > 0.005) {
    bot.violations.push(`${msg}: expected ${expected}, got ${actual}`);
  }
}
function assert(cond, msg, bot) {
  if (!cond) bot.violations.push(msg);
}

// ── One round of play for one bot ───────────────────────────────────────────
async function playRound(bot) {
  if (bot.balance < 1) return; // broke — nothing left to bet
  const difficulty = pick(DIFFICULTY_KEYS);
  const bet = randInt(1, Math.min(MAX_TEST_BET, Math.floor(bot.balance)));

  let startedData;
  if (Math.random() < DOUBLE_START_RATE) {
    const r = await raceStart(bot, bet, difficulty);
    assert(r.started === 1, `double-start: expected exactly 1 round:started, got ${r.started}`, bot);
    assert(r.rejected === 1, `double-start: expected exactly 1 already_active rejection, got ${r.rejected}`, bot);
    if (!r.startedData) return; // already logged a violation above
    startedData = r.startedData;
  } else {
    bot.socket.emit('round:start', { bet, difficulty });
    const res = await raceEvents(bot.socket, ['round:started', 'server:error']);
    if (res.event === 'server:error') {
      bot.violations.push(`unexpected server:error on round:start: ${res.data.code}`);
      return;
    }
    startedData = res.data;
  }

  assertEqual(startedData.balance, round2(bot.balance - bet), 'balance after round:started', bot);
  bot.balance = startedData.balance;
  bot.stats.rounds++;

  // Always advance at least one lane so the round is always in a cashable
  // state afterward (unless it busts) — avoids leaving a round dangling
  // active with zero progress, which would make the *next* round's
  // round:start correctly fail with already_active and look like a bug.
  let ended = false;
  const stepsToTry = randInt(1, 4);
  for (let i = 0; i < stepsToTry && !ended; i++) {
    bot.socket.emit('round:step');
    const r = await raceEvents(bot.socket, ['step:result', 'round:busted', 'round:cashout']);
    if (r.event === 'round:busted') {
      ended = true;
      bot.stats.busts++;
    } else if (r.event === 'round:cashout') { // full lane clear, auto-cashout
      assertEqual(r.data.balance, round2(bot.balance + r.data.payout), 'balance after auto-cashout', bot);
      bot.balance = r.data.balance;
      bot.stats.cashouts++;
      ended = true;
    }
  }
  if (ended) return;

  let cashData;
  if (Math.random() < DOUBLE_CASHOUT_RATE) {
    const r = await raceCashout(bot);
    assert(r.cashed <= 1, `double-cashout: got ${r.cashed} successful cashouts (must never exceed 1)`, bot);
    assert(r.cashed >= 1, `double-cashout: got 0 successful cashouts, expected 1`, bot);
    cashData = r.cashData;
  } else {
    bot.socket.emit('round:cashout');
    const res = await raceEvents(bot.socket, ['round:cashout', 'server:error']);
    if (res.event === 'server:error') {
      bot.violations.push(`unexpected server:error on round:cashout: ${res.data.code}`);
      return;
    }
    cashData = res.data;
  }
  if (!cashData) return;
  assertEqual(cashData.balance, round2(bot.balance + cashData.payout), 'balance after cashout', bot);
  bot.balance = cashData.balance;
  bot.stats.cashouts++;
}

async function runBot(id, port, rounds) {
  const bot = new PlayerBot(id, port);
  await bot.ready();
  for (let i = 0; i < rounds; i++) {
    try {
      await playRound(bot);
    } catch (err) {
      bot.violations.push(`round ${i}: ${err.message}`);
    }
  }
  bot.close();
  return bot;
}

// ── Multi-tab: two sockets sharing one signed token (same account) ──────────
// PlayerSession (round/step/status) lives per-socket, but the balance lives on
// the shared PlayerAccount — this is the scenario that actually stresses that
// split. Two independent sockets starting a round "at the same time" on the
// same account is expected to behave like two browser tabs: both rounds start
// (each session is independently idle), both debit the same shared balance.
// What must never happen: a debit lost, a debit applied twice, or the balance
// going negative.
async function runSharedTokenTest(port) {
  const violations = [];
  const a = new PlayerBot('shared-A', port);
  await a.ready();
  const b = new PlayerBot('shared-B', port, a.token);
  await b.ready();

  if (a.balance !== b.balance) {
    violations.push(`shared-token bots disagree on starting balance: A=${a.balance} B=${b.balance}`);
  }
  const startingBalance = a.balance;
  const betA = 15, betB = 20, difficulty = 'easy';

  const pA = raceEvents(a.socket, ['round:started', 'server:error']);
  const pB = raceEvents(b.socket, ['round:started', 'server:error']);
  a.socket.emit('round:start', { bet: betA, difficulty });
  b.socket.emit('round:start', { bet: betB, difficulty });
  const [ra, rb] = await Promise.all([pA, pB]);

  if (ra.event !== 'round:started') violations.push(`shared-token: socket A round:start failed unexpectedly: ${ra.data?.code}`);
  if (rb.event !== 'round:started') violations.push(`shared-token: socket B round:start failed unexpectedly: ${rb.data?.code}`);

  let balanceAfterDebits = startingBalance;
  if (ra.event === 'round:started' && rb.event === 'round:started') {
    // Order-independent invariant: whichever debit was applied second must
    // reflect BOTH bets removed — that response's balance is the true final
    // state no matter which socket the server happened to process first.
    balanceAfterDebits = round2(startingBalance - betA - betB);
    const observed = Math.min(ra.data.balance, rb.data.balance);
    if (Math.abs(observed - balanceAfterDebits) > 0.005) {
      violations.push(`shared-token concurrent starts: expected combined debit to settle at ${balanceAfterDebits}, observed ${observed} (A=${ra.data.balance}, B=${rb.data.balance})`);
    }
    if (observed < 0) violations.push(`shared-token: balance went negative (${observed}) during concurrent starts`);
  }

  if (ra.event === 'round:started' && rb.event === 'round:started') {
    async function advanceThenCashout(bot) {
      bot.socket.emit('round:step');
      const stepRes = await raceEvents(bot.socket, ['step:result', 'round:busted', 'round:cashout']);
      if (stepRes.event === 'round:busted') return { busted: true };
      if (stepRes.event === 'round:cashout') return { data: stepRes.data }; // auto-cashout
      bot.socket.emit('round:cashout');
      const cashRes = await raceEvents(bot.socket, ['round:cashout', 'server:error']);
      return cashRes.event === 'round:cashout' ? { data: cashRes.data } : { error: cashRes.data };
    }
    const [resA, resB] = await Promise.all([advanceThenCashout(a), advanceThenCashout(b)]);

    if (resA.error) violations.push(`shared-token: socket A cashout unexpectedly errored: ${resA.error.code}`);
    if (resB.error) violations.push(`shared-token: socket B cashout unexpectedly errored: ${resB.error.code}`);

    const creditEvents = [resA, resB].filter(r => r.data);
    if (creditEvents.length === 1) {
      const expected = round2(balanceAfterDebits + creditEvents[0].data.payout);
      if (Math.abs(creditEvents[0].data.balance - expected) > 0.005) {
        violations.push(`shared-token cashout: expected ${expected}, got ${creditEvents[0].data.balance}`);
      }
    } else if (creditEvents.length === 2) {
      const totalPayout = creditEvents[0].data.payout + creditEvents[1].data.payout;
      const expected = round2(balanceAfterDebits + totalPayout);
      // Unlike the debit case, credits stack additively — whichever response
      // was processed second reflects BOTH payouts applied, i.e. the larger
      // of the two reported balances, not the smaller.
      const observed = Math.max(creditEvents[0].data.balance, creditEvents[1].data.balance);
      if (Math.abs(observed - expected) > 0.005) {
        violations.push(`shared-token concurrent cashouts: expected combined credit to settle at ${expected}, observed ${observed} (A=${creditEvents[0].data.balance}, B=${creditEvents[1].data.balance})`);
      }
    }
  }

  a.close();
  b.close();
  return violations;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\nChicken Ninja — concurrency / balance-consistency stress test');
  console.log(`players=${PLAYERS}  rounds/player=${ROUNDS}  port=${PORT}\n`);

  const server = await startServer(PORT);
  let exitCode;

  try {
    const bots = await Promise.all(
      Array.from({ length: PLAYERS }, (_, i) => runBot(`p${i}`, PORT, ROUNDS)),
    );

    console.log('── Cross-player concurrent bet/cashout stress ──');
    let totalRounds = 0, totalBusts = 0, totalCashouts = 0, totalViolations = 0;
    for (const bot of bots) {
      totalRounds += bot.stats.rounds;
      totalBusts += bot.stats.busts;
      totalCashouts += bot.stats.cashouts;
      if (bot.violations.length) {
        totalViolations += bot.violations.length;
        console.log(`  ✗ ${bot.id}:`);
        for (const v of bot.violations) console.log(`      - ${v}`);
      }
    }
    console.log(`  rounds=${totalRounds}  busts=${totalBusts}  cashouts=${totalCashouts}  violations=${totalViolations}`);
    console.log(totalViolations === 0
      ? '  ✅ no balance/protocol violation across all concurrent players'
      : '  ❌ violations found — see above');

    console.log('\n── Shared-token (multi-tab) concurrent bet/cashout test ──');
    const sharedViolations = await runSharedTokenTest(PORT);
    if (sharedViolations.length) {
      for (const v of sharedViolations) console.log(`  ✗ ${v}`);
    }
    console.log(sharedViolations.length === 0
      ? '  ✅ shared-account concurrent bets/cashouts stayed balance-consistent (no lost/duplicated debit or credit, never negative)'
      : `  ❌ ${sharedViolations.length} violation(s)`);

    exitCode = (totalViolations + sharedViolations.length) === 0 ? 0 : 1;
  } catch (err) {
    console.error('Fatal error during test run:', err);
    exitCode = 1;
  } finally {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }

  process.exit(exitCode);
}

main();
