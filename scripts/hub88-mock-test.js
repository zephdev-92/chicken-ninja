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

// ── Signature — Hub88's own published test vectors ─────────────────────────
// Self-consistency (sign with our key, verify with our key) only proves
// signature.js agrees with itself — it doesn't prove compatibility with Hub88's
// actual crypto stack. These come straight from Hub88's own public reference
// implementation and demo keypair (github.com/coingaming/Hub88-Examples,
// signatures.csv + priv/*.pem; the Node reference lib, hm-crypto-nodejs, signs
// with `createSign(digestType).update(message).sign(privateKey, 'base64')` —
// exactly what signBody/verifyBody do). Confirmed 2026-09-04.
console.log('\n── Signature — Hub88\'s own published test vectors (coingaming/Hub88-Examples) ──');
{
  const hub88DemoPrivateKey = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAx3IRpSri/9SjA7f9me35v6LtJzn8drb1vg/UeGaPPFR16KsU
OPqbGJ2r1pRPJMedqqbO7Agt/HavWDcQhNZlc9VrVQcWK/w2HD9PflQYv0oQMiPK
5Mut/eIdFOpwwwaRAU4s6WOkJdSmP9F4cfr/amTZZoY59/t3SZWYjgZ9/LDI2X8S
3uLW/JPiH+6dm2bU8ykhxoWwLE/piJxynS73EzM0tgjHyTUMkarhK9qRVZk581/k
zmtJLLBZQl9XrQQcIfQ+zFZj7ijddOptxpxqCmq8gQNohB56p34yjVH3uAJAaFvI
Vg5mEkprrvNVDJwGonHSaaq7AICmzrF6h/r5dwIDAQABAoIBAFNIGIIlpGA7hE57
N9RdANq6x9iHaBqST48rwQb9nHYOtqWPOoSIcNcYj7ase1faWsX1nZYF3F39mT52
z9kIRZjW11jL+sAnMtkcvq77otHNtXGabJCZVHAdSROAydFGHqqy4CIcz2BUqY8g
gvDlZF4i+nzLM82PHcKGSwuTPmyTED37RqtscSxd7cGQkuL6OnohSFpW+5tvZcGZ
Ui4oVRrX4oVXz//3TDESRfondwQVKPoqQr7aiyYSKOJJMngIXmCvJ6p3XNiEW+dP
uXxm5N9QRkkX00v3vPTdsuwUjt3wepDJhR9BecRERRYNJIrqsgNxkJTJEDlsGqi5
kIKPb/ECgYEA8nKLPCfIaZ4G/7pUXQ64MMemS7qH17aU7Eb+mqDpFRt2bNr/yw12
qIhUkb6XyI/ZwOF2gdhPzte25CuZzNsMu3GqlEQ77AR1XCyu1AY8oiJS4TSmRovJ
x86BK8C8OY75myYcmRIvsusxviZfUCunDaexVGOqIKMRNrgJ2i8194UCgYEA0pgp
nzxI4H/Ej+5KOmEw9P2xstIXpW+CcEDbrh5pqW+PwNP/TUxC445Rn4R8AVXFVnbH
6DLrW35A9KBcA7Ve37vkVUILxPC+S967+gdRAd3BQTuUmi31+7cBjmNLKJMMC8Fl
DZ5S8zwRuVrU6o3bbPUbC5gDb/cN/7GVtb/D18sCgYEA2ma+8LCxxBr8GRAkATRK
Tn77WgqtZm/uVa5amrbLYR09IDBj7umw837kF+qGVsDnGu6/z5Ypxp3h/kccpELL
hGuPi0KwbBtUEXWbBBqeMjwTRxYjlzdDzP9Es0JLDNq0FcROTMHqQBXI2I8+mzzH
nvBqOSgS0JW04wMEtQyEY/UCgYBNMDKJR9paVtpf+vJABaGhGl+IcJL0MzP3Gv6q
CkGmNdrVzZ5U4a/eoipusmuVPa/P6keJZyh254a9Yw122oKEtOSTD1sq+yZ0vpXd
pdLeQT51P3ZPMKtpcIFkhCZnH8aZhHAalr5GouzIKG/D7OzROeGI1VXlMwNxhdCe
xkPtEwKBgG8IJGHMuzBGDtykqPwOdz7llWwzl3GgWiEDqt6kbIEr8F7CbbnlvrhJ
HRmd9tFEtYz2/3x9VTv9NCjd8FiWyPcivkd4dvMInfgBoCBJxw0I+nyjqQpiLuhx
x4xyX1tFKW+sAN+Mb9dO+ZHGpcz2FpPz5uXv6oCzTG9BLcgg0mwx
-----END RSA PRIVATE KEY-----`;
  const hub88DemoPublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAx3IRpSri/9SjA7f9me35
v6LtJzn8drb1vg/UeGaPPFR16KsUOPqbGJ2r1pRPJMedqqbO7Agt/HavWDcQhNZl
c9VrVQcWK/w2HD9PflQYv0oQMiPK5Mut/eIdFOpwwwaRAU4s6WOkJdSmP9F4cfr/
amTZZoY59/t3SZWYjgZ9/LDI2X8S3uLW/JPiH+6dm2bU8ykhxoWwLE/piJxynS73
EzM0tgjHyTUMkarhK9qRVZk581/kzmtJLLBZQl9XrQQcIfQ+zFZj7ijddOptxpxq
Cmq8gQNohB56p34yjVH3uAJAaFvIVg5mEkprrvNVDJwGonHSaaq7AICmzrF6h/r5
dwIDAQAB
-----END PUBLIC KEY-----`;
  const vectors = [
    ['test', 'V3bEXE72v0fbrKNV6bHW945WgsuRvkKcUBA4+C2AiUp+ssrItfk4btBhQfuupBsUXY11JZY+2DSK15NlXeziZbtGQRbgq6v/Ou2tWd652r39nKCfwpxLw1foXaLiSP5ZPudi42M7ANG4XygjaErPiIMHHQaEA6WKqSLIPmJmJJ1u6PkLulpG5CEMO+/6tWRBMMd5vZuHxqc2koaCWI6a3sW+75INSPXbSAEnwVkWPIeUg+EYCdUE7RARSlT/xf5Bp37qtEGZSG7TF7198HDQjAMpC7HBY+tUXsNZwXJJpcRxRh0Pqfz7Q9LG0ikFfdQE+0gCnuLOmx0IMtLIFjVQpA=='],
    ['example', 'KzpO4V0hQzF5QXl6VxBurWImpi1XhY0/nfezuaNJd3IE1YvIX1uRqgVcKRRLOcBVDg9uT7oQNOyuBSIYmNqc6YR3IJyWNPol0wPObBi71fpDtDxIuZmAW6CHsoKgjSlP3NPP7X4CheJW/xaVgWW2hveAcV4mXvbY2cIVywVeCE6y+LrKI+doq1sRXAx7akQsAe5aQvFNo419zme682eddwkgESDdlJY2vCQ7mFxpxrnXQ3kqefq6JuGizGwgGLaqsp79hu9rc6Bnkvevhq0LcyLZ4SnHfVnv6sxZGyPEFQLslgk/jtww+IXXna6pI0ki2nxSc4UVbFTUIBL4B3lm/A=='],
    ['{"test":"test"}', 'LMYX772LMBO+r83MakogTLoYnUmkR5TTSCMbzbzWPQBgqakoUwjsQnGAbIvA2ZEZXKgbygEW32crr/OzkJbXJp/XSeXPg93IvlOOiaItcPZAIx2MvBh7tY2vtcNMfodlrEvvG5ySDJQWO4LD/Gv7v6dpJJEsVy7AFdT8Azix2MUGcsljIJFWclYsHjJ96OCm5z4RZeA4tp49QCMKb3AL0TZojxxPL/9vSO//o4IcGQCQ02Sw7/p1c8EogCKI9AcMA2fmcog5fy853wMoZJem+qzLtQfBNKLmmKvFE02V7AkRdPn4q7ilCFzkpmN3T5Rhmazv5JHUIvjokR9c0p/4UQ=='],
    ['{"game_id":132,"request_uuid":"583c985f-fee6-4c0e-bbf5-308aad6265af","token":"55b7518e-b89e-11e7-81be-58404eea6d16"}', 'Kd+/B1NealiUiv/9cI/0MQuwnLiAMteKFesys/b8Koe9pVP/H7Hw54W99+q1uMGizaXj+nMIzcwerFSlSkMj94uqXHueGFvDKI4YGKqntlj7EvID1B7P+VlS/A5RN4RjghIMR3MGnsJZT43G8tAju+xJCzjzDmgS25IPVIZobabIpct87ReqxYfkqIlqgH/uKkpU0ezG25mmhMa82Umat1eu88dJDCa1NsbX9SF5gtdC+A8pYS/o87s2RWHG5VVYM8awAwxPnwZacyKIEbXS59BcAI6StUm+/sJWvSKKvR6lxCiJyQOWzG1IwN9NxBthp5AfQx23G5aDMnYDkSUsIw=='],
    ['{"user":"3nYTOSjdlF6UTz9Ir","country":"XX","currency":"BTC","operator_id":1,"token":"cd6bd8560f3bb8f84325152101adeb45","platform":"GPL_DESKTOP","game_id":39,"lang":"en","lobby_url":"https://examplecasino.io","ip":"::ffff:10.0.0.39"}', 'bL7uNP1K3S0HG8IOC0A5Gf/Cl+Hs3YCVfA0ZrjPgGJFnOstxshCQHB7JbeBhTEDhsqd6CFj4U5xOjzselFkO1HhFrTWssB7CNiXaNmizYp2NKuZhkJcrTswVlk8z9NzAkYJfcqnXiC6lMX1X5t6/+dOX6rvLlHM7yfo9LzhVjKo1on9JMHoW8AiYcC8clKEqpyWTQ70euGXnqxRay5RVAmD1sxOlmz8VIX5irtpMOugNDIL1G3g4IgauPk8T2IfVierOFeALQrNx88Es6Dl8Bgb9ogm1W4xgL3Ve01p59DQNt0oorm0LZt/YqkWYGLL2lpd5Qb1FiX4O7+hfyPKN1Q=='],
  ];
  let vectorsOk = true;
  for (const [data, expectedSig] of vectors) {
    const bytes = Buffer.from(data, 'utf8');
    if (!verifyBody(bytes, expectedSig, hub88DemoPublicKey)) vectorsOk = false;
    if (signBody(bytes, hub88DemoPrivateKey) !== expectedSig) vectorsOk = false;
  }
  check('all 5 of Hub88\'s published vectors verify AND our signBody reproduces them byte-for-byte', vectorsOk);
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
