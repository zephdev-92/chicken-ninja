// Hub88 platform adapter test — mocks a Hub88 wallet + signs Games API calls to
// exercise signature.js, walletClient.js, hub88Ledger.js and gamesApi.js end to
// end, without needing real Hub88 credentials. Complements concurrency-test.js
// (which only exercises the standalone platform) — see HUB88_INTEGRATION.md plan
// item 8. No real network calls: both "Hub88" endpoints here are local mocks.
import { createServer } from 'http';
import express from 'express';
import { randomUUID } from 'crypto';
import {
  generateDevKeyPair, signBody, verifyBody,
} from '../server/platforms/hub88/signature.js';
import { WalletClient } from '../server/platforms/hub88/walletClient.js';
import { Hub88Ledger } from '../server/platforms/hub88/hub88Ledger.js';
import { createGamesApiRouter } from '../server/platforms/hub88/gamesApi.js';
import { getHub88Session } from '../server/platforms/hub88/sessions.js';
import { fromHub88Amount } from '../server/platforms/hub88/currency.js';
import { Round } from '../server/core/roundEngine.js';

let passed = 0, failed = 0;
function check(label, cond) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`); }
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

// ── keys — `ours` stands in for our real supplier keypair, `theirs` for Hub88's ──
const ours   = generateDevKeyPair();
const theirs = generateDevKeyPair();

// ── mock Hub88 Wallet API ──────────────────────────────────────────────────────
// Verifies every request with OUR public key (what we'd register with Hub88),
// keeps a fake balance per player token, rejects a replayed transaction_uuid —
// same contract walletClient.js/hub88Ledger.js are written against.
const walletBalances = new Map(); // hub88Token -> balance, Hub88 amount units (×100000)
// transaction_uuid -> { type: 'bet'|'win', amount, token, rolledBack } — full enough to
// actually undo a bet on rollback (refund) rather than just acknowledging it, which
// would leave Round.abandon()'s effect on the balance untested.
const transactions = new Map();

function mockWallet(req, res, bodyBytes) {
  const signature = req.headers['x-hub88-signature'];
  if (!verifyBody(bodyBytes, signature, ours.publicKey)) {
    return json(res, 200, { status: 'RS_ERROR_INVALID_SIGNATURE' });
  }
  const body = JSON.parse(bodyBytes.toString('utf8'));

  if (req.url === '/user/balance') {
    return json(res, 200, { status: 'RS_OK', balance: walletBalances.get(body.token) ?? 0 });
  }

  if (req.url === '/transaction/bet') {
    if (transactions.has(body.transaction_uuid)) {
      return json(res, 200, { status: 'RS_ERROR_DUPLICATE_TRANSACTION' });
    }
    const balance = walletBalances.get(body.token) ?? 0;
    if (body.amount > balance) return json(res, 200, { status: 'RS_ERROR_NOT_ENOUGH_MONEY' });
    transactions.set(body.transaction_uuid, { type: 'bet', amount: body.amount, token: body.token, rolledBack: false });
    const next = balance - body.amount;
    walletBalances.set(body.token, next);
    return json(res, 200, { status: 'RS_OK', balance: next });
  }

  if (req.url === '/transaction/win') {
    if (transactions.has(body.transaction_uuid)) {
      return json(res, 200, { status: 'RS_ERROR_DUPLICATE_TRANSACTION' });
    }
    transactions.set(body.transaction_uuid, { type: 'win', amount: body.amount, token: body.token, rolledBack: false });
    const next = (walletBalances.get(body.token) ?? 0) + body.amount;
    walletBalances.set(body.token, next);
    return json(res, 200, { status: 'RS_OK', balance: next });
  }

  if (req.url === '/transaction/rollback') {
    const ref = transactions.get(body.reference_transaction_uuid);
    if (!ref) return json(res, 200, { status: 'RS_ERROR_TRANSACTION_DOES_NOT_EXIST' });
    if (ref.rolledBack) return json(res, 200, { status: 'RS_ERROR_DUPLICATE_TRANSACTION' });
    ref.rolledBack = true;
    // Undo a bet by refunding it, undo a win by taking it back.
    const delta = ref.type === 'bet' ? ref.amount : -ref.amount;
    const next = (walletBalances.get(ref.token) ?? 0) + delta;
    walletBalances.set(ref.token, next);
    return json(res, 200, { status: 'RS_OK', balance: next });
  }

  json(res, 404, { status: 'RS_ERROR_UNKNOWN' });
}

// Test-only failure injection: when > 0, the next N requests get their socket
// destroyed instead of a response — a real connection reset/timeout, not an HTTP
// error, so it reaches walletClient.js's fetch() `catch` exactly like an actual
// network fault would (an HTTP 500 would be a parsed, definitive response, the
// wrong kind of failure to simulate the "we don't know if it landed" case).
let failNextNRequests = 0;

const mockWalletServer = createServer((req, res) => {
  if (failNextNRequests > 0) {
    failNextNRequests--;
    req.socket.destroy();
    return;
  }
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => mockWallet(req, res, Buffer.concat(chunks)));
});
await new Promise((resolve) => mockWalletServer.listen(0, resolve));
const walletBaseUrl = `http://127.0.0.1:${mockWalletServer.address().port}`;

// ── Games API router under test, mounted on its own express app ───────────────
const gamesApp = express();
gamesApp.use('/hub88/supplier/generic/v2', createGamesApiRouter({
  hub88PublicKeyPem: theirs.publicKey,
  gameCode:            'chicken_ninja',
  gameName:              'Chicken Ninja',
  launchBaseUrl:           'http://localhost:5173/',
}));
const gamesApiServer = createServer(gamesApp);
await new Promise((resolve) => gamesApiServer.listen(0, resolve));
const gamesApiBaseUrl = `http://127.0.0.1:${gamesApiServer.address().port}`;

console.log('\nChicken Ninja — Hub88 platform adapter test (mock wallet + signed Games API)\n');

// ── Signature ───────────────────────────────────────────────────────────────
console.log('── Signature (RSA-SHA256) ──');
{
  const body = Buffer.from(JSON.stringify({ hello: 'world' }));
  const sig = signBody(body, ours.privateKey);
  check('valid signature verifies', verifyBody(body, sig, ours.publicKey));
  check('signature checked against the wrong public key fails', !verifyBody(body, sig, theirs.publicKey));
  check('tampered body fails verification', !verifyBody(Buffer.from(JSON.stringify({ hello: 'WORLD' })), sig, ours.publicKey));
}

// ── Games API — /game/url ──────────────────────────────────────────────────
console.log('\n── Games API — /game/url ──');
let sessionToken;
const playerHub88Token = 'hub88-session-abc';
{
  const body = {
    user: 'player-1', token: playerHub88Token, platform: 'GPL_DESKTOP',
    lobby_url: 'https://casino.example', lang: 'en', operator_id: 42,
    currency: 'EUR', country: 'FR', game_code: 'chicken_ninja',
  };
  const bodyBytes = Buffer.from(JSON.stringify(body));
  const signature = signBody(bodyBytes, theirs.privateKey);

  const res = await fetch(`${gamesApiBaseUrl}/hub88/supplier/generic/v2/game/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub88-Signature': signature },
    body: bodyBytes,
  });
  const resBody = await res.json();
  check('/game/url responds 200', res.status === 200);
  check('/game/url returns a url', typeof resBody.url === 'string');
  sessionToken = resBody.url ? new URL(resBody.url).searchParams.get('token') : null;
  check('session token minted and embedded in the launch url', !!sessionToken);

  const session = getHub88Session(sessionToken);
  check('session resolves via getHub88Session', session?.user === 'player-1');
  check('session keeps the player\'s Hub88 token for Wallet API calls', session?.hub88Token === playerHub88Token);
  check('session key itself is never the Hub88 wallet token (no leak)', session?.token !== playerHub88Token);

  // Seed the mock operator balance under the *player's* Hub88 token — the key
  // hub88Ledger addresses it by, not our own session token.
  walletBalances.set(playerHub88Token, 10000000); // 100.00 EUR in Hub88 units (×100000)
}
{
  const bodyBytes = Buffer.from(JSON.stringify({ game_code: 'chicken_ninja' }));
  const res = await fetch(`${gamesApiBaseUrl}/hub88/supplier/generic/v2/game/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub88-Signature': 'not-a-real-signature' },
    body: bodyBytes,
  });
  check('request with an invalid signature is rejected (401)', res.status === 401);
}
{
  const body = { user: 'x', token: 'y', currency: 'EUR', game_code: 'some_other_game' };
  const bodyBytes = Buffer.from(JSON.stringify(body));
  const signature = signBody(bodyBytes, theirs.privateKey);
  const res = await fetch(`${gamesApiBaseUrl}/hub88/supplier/generic/v2/game/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Hub88-Signature': signature },
    body: bodyBytes,
  });
  check('request for the wrong game_code is rejected (400)', res.status === 400);
}

// ── Hub88Ledger against the mock wallet ────────────────────────────────────
console.log('\n── Hub88Ledger — debit/credit/rollback against the mock wallet ──');
{
  const walletClient = new WalletClient({ baseUrl: walletBaseUrl, privateKeyPem: ours.privateKey });
  const session = getHub88Session(sessionToken);
  const ledger = new Hub88Ledger(walletClient, session);

  const bal0 = await ledger.getBalance();
  check('getBalance reads the mock operator balance', bal0 === 100);

  const betTxId = randomUUID();
  const debitRes = await ledger.debit(10, { roundId: '1', transactionUuid: betTxId });
  check('debit succeeds and returns the new balance', debitRes.ok && debitRes.balance === 90);

  // Raw wallet-level dedup, bypassing hub88Ledger's own error handling — this is
  // specifically testing the mock's/Wallet API's own duplicate detection, not
  // hub88Ledger's policy on top of it (see the next block for that).
  const rawDupRes = await walletClient.post('/transaction/bet', {
    game_code: 'chicken_ninja', token: playerHub88Token,
    transaction_uuid: betTxId, round: '1', round_closed: false, currency: 'EUR', amount: 1000000,
  });
  check(
    'replaying the same transaction_uuid at the wallet level is rejected as a duplicate',
    !rawDupRes.ok && rawDupRes.error === 'duplicate_transaction',
  );
  check('a rejected duplicate at the wallet level does not move the balance', walletBalances.get(playerHub88Token) === 9000000);

  // hub88Ledger.debit()'s own policy (per Hub88's Wallet API docs): any bet
  // failure other than insufficient_balance/limit_reached triggers a best-effort
  // rollback — including duplicate_transaction, e.g. from a stale retry that
  // turned out to have already succeeded. Replaying betTxId through the ledger
  // (not the raw client) should therefore roll the original bet back.
  const ledgerDupRes = await ledger.debit(10, { roundId: '1', transactionUuid: betTxId });
  check(
    'replaying a transaction_uuid through the ledger reports duplicate_transaction',
    !ledgerDupRes.ok && ledgerDupRes.error === 'duplicate_transaction',
  );
  check(
    'and triggers an automatic rollback of the original bet, restoring the balance',
    fromHub88Amount(walletBalances.get(playerHub88Token)) === 100,
  );

  // Fresh bet to exercise credit/rollback against, now that the balance is back
  // to a known 100.
  const betTxId2 = randomUUID();
  const debitRes2 = await ledger.debit(10, { roundId: '4', transactionUuid: betTxId2 });
  check('a fresh bet after the rollback succeeds normally', debitRes2.ok && debitRes2.balance === 90);

  const winRes = await ledger.credit(25, {
    roundId: '4', transactionUuid: randomUUID(), referenceTransactionUuid: betTxId2, roundClosed: true,
  });
  check('credit succeeds and returns the new balance', winRes.ok && winRes.balance === 115);

  const bustRes = await ledger.credit(0, {
    roundId: '5', transactionUuid: randomUUID(), referenceTransactionUuid: randomUUID(), roundClosed: true,
  });
  check('a 0-amount win (bust close) is accepted and leaves the balance unchanged', bustRes.ok && bustRes.balance === 115);

  const overdraftRes = await ledger.debit(999999, { roundId: '6', transactionUuid: randomUUID() });
  check(
    'a debit past the mock balance is rejected as insufficient_balance, no rollback attempted',
    !overdraftRes.ok && overdraftRes.error === 'insufficient_balance',
  );

  const rollbackRes = await ledger.rollback({ transactionUuid: betTxId2 });
  check('rollback refunds the bet and returns the new balance', rollbackRes.ok && rollbackRes.balance === 125);

  const dupRollbackRes = await ledger.rollback({ transactionUuid: betTxId2 });
  check(
    'rolling back the same transaction twice is rejected as a duplicate',
    !dupRollbackRes.ok && dupRollbackRes.error === 'duplicate_transaction',
  );

  const ghostRollbackRes = await ledger.rollback({ transactionUuid: randomUUID() });
  check(
    'rolling back an unknown transaction is rejected as transaction_not_found',
    !ghostRollbackRes.ok && ghostRollbackRes.error === 'transaction_not_found',
  );
}

// ── Round.abandon() — narrow rollback-only-if-step-0 policy ───────────────────
console.log('\n── Round.abandon() — rollback only if the round never took a step ──');
{
  const walletClient = new WalletClient({ baseUrl: walletBaseUrl, privateKeyPem: ours.privateKey });

  // Case A: bet placed, no step taken — abandon() must roll it back.
  {
    const token = 'abandon-case-a';
    walletBalances.set(token, 10000000); // 100.00 EUR
    const session = { gameCode: 'chicken_ninja', hub88Token: token, currency: 'EUR' };
    const round = new Round(new Hub88Ledger(walletClient, session));

    const { error } = await round.startRound(10, 'easy');
    check('case A: startRound succeeds', !error);

    await round.abandon();
    check('case A (step 0): abandon() rolls back the bet, balance restored to 100.00 EUR', fromHub88Amount(walletBalances.get(token)) === 100);
    check('case A: round status reverts to idle after rollback', round.status === 'idle');
  }

  // Case B: bet placed, at least one step taken — abandon() must be a no-op.
  // Whatever step_() resolves to (safe → status stays 'active' with step 1, or
  // bust → status moves to 'busted'), one of abandon()'s two guard conditions
  // (status !== 'active' or step !== 0) is already true either way.
  {
    const token = 'abandon-case-b';
    walletBalances.set(token, 10000000);
    const session = { gameCode: 'chicken_ninja', hub88Token: token, currency: 'EUR' };
    const round = new Round(new Hub88Ledger(walletClient, session));

    await round.startRound(10, 'easy');
    await round.step_();
    const balanceBeforeAbandon = walletBalances.get(token);

    await round.abandon();
    check(
      'case B (step > 0): abandon() is a no-op, balance untouched',
      walletBalances.get(token) === balanceBeforeAbandon,
    );
  }
}

// ── Network-failure policy — retry win/rollback, best-effort rollback a bet ───
console.log('\n── Network-failure policy (HUB88_INTEGRATION.md § Politique réseau) ──');
{
  const walletClient = new WalletClient({ baseUrl: walletBaseUrl, privateKeyPem: ours.privateKey });
  const token = 'network-policy-player';
  walletBalances.set(token, 10000000); // 100.00 EUR
  const session = { gameCode: 'chicken_ninja', hub88Token: token, currency: 'EUR' };
  const ledger = new Hub88Ledger(walletClient, session);

  // A network fault on a bet call is ambiguous (did it land or not?) — debit()
  // must not retry blindly (risk of double-debit) and must instead attempt a
  // best-effort rollback of that same transaction_uuid to resolve it definitively.
  {
    const betTxId = randomUUID();
    failNextNRequests = 1; // the /transaction/bet call itself never reaches the mock
    const debitRes = await ledger.debit(10, { roundId: '1', transactionUuid: betTxId });
    check('bet: a network fault is reported as network_error, not retried', !debitRes.ok && debitRes.error === 'network_error');
    check('bet: balance is untouched (the mock genuinely never saw the bet)', walletBalances.get(token) === 10000000);
    check('bet: the follow-up rollback found nothing to undo (transaction never landed)', !transactions.has(betTxId));

    // Confirms the mock truly has no record of it: a fresh bet with that exact
    // transaction_uuid is accepted as new, not rejected as a duplicate.
    const retryRes = await ledger.debit(10, { roundId: '1', transactionUuid: betTxId });
    check('bet: the same transaction_uuid is free to use for a real retry afterwards', retryRes.ok);
    await ledger.rollback({ transactionUuid: betTxId }); // clean up for the next block
  }

  // A network fault on a win call is safe to retry (idempotent via
  // transaction_uuid) — credit() must recover transparently within walletClient's
  // built-in retries rather than surfacing the transient fault to the caller.
  {
    const winTxId = randomUUID();
    failNextNRequests = 1; // only the first attempt fails, the retry reaches the mock
    const creditRes = await ledger.credit(15, {
      roundId: '2', transactionUuid: winTxId, referenceTransactionUuid: randomUUID(), roundClosed: true,
    });
    check('win: a transient network fault is recovered via retry, not surfaced', creditRes.ok && creditRes.balance === 115);
  }

  // More failures than the retry budget allows still surfaces as network_error,
  // rather than retrying forever. hub88Ledger.js's WALLET_CORRECTION_RETRIES is 2
  // (initial attempt + 2 retries = 3 total) — 3 consecutive faults exhausts it.
  {
    failNextNRequests = 3;
    const rollbackRes = await ledger.rollback({ transactionUuid: randomUUID() });
    check('rollback: exhausting all retries still reports network_error', !rollbackRes.ok && rollbackRes.error === 'network_error');
    failNextNRequests = 0; // don't leak into any test added after this one
  }
}

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed\n`);
mockWalletServer.close();
gamesApiServer.close();
process.exit(failed === 0 ? 0 : 1);
