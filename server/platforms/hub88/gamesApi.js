import { Router, raw } from 'express';
import { randomUUID } from 'crypto';
import { verifyBody } from './signature.js';
import { createHub88Session } from './sessions.js';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Games API — Hub88/the operator calls these on us. Mounted in server/index.js
// only when Hub88 credentials are configured (see server/index.js's HUB88_* env
// check) so the standalone product is completely unaffected when they aren't.
// See HUB88_INTEGRATION.md § Endpoints Games API for the spec this implements.
//
// `hub88PublicKeyPem` verifies Hub88's signature on every incoming request — never
// skip this, an unverified body is an unauthenticated instruction to launch a
// session or (eventually) move money.
//
// `launchBaseUrl`: where the actual game frontend is served from (the Vite build
// in production) — /game/url hands the operator a URL into that with the session
// token attached as a query param, for the iframe integration path (see
// HUB88_INTEGRATION.md § Front-end: iframe classique vs Supplier Games SDK).
export function createGamesApiRouter({
  hub88PublicKeyPem, gameCode, gameName, launchBaseUrl,
  // Required by /game/list per HUB88_INTEGRATION.md — no real hosted assets or
  // confirmed category value exist yet (no CDN, no confirmation from Hub88 on
  // which category enum value fits a Chicken-Road-style instant-win game), so
  // these arrive as explicit params with honest placeholders rather than silently
  // baked-in fake URLs — must be real before this ever reaches a real /game/list.
  thumbUrl = '', backgroundUrl = '', category = 'instant_win',
  // The process-wide TransactionLog (transactionLog.js), injected the same way
  // Ledger is injected into Round — /game/round reads it back to answer "what
  // happened in this round". Optional: without one, /game/round can only answer
  // honestly with 501, which is what it did before the log existed.
  transactionLog = null,
}) {
  const router = Router();

  // Raw bytes, not express.json()'s parsed object — the signature covers the
  // exact bytes Hub88 sent, and re-serializing a parsed object isn't guaranteed
  // to reproduce them byte-for-byte (key order, whitespace).
  //
  // POST only: every signed Hub88-to-us Games API call is a POST. GET /round/view
  // below is the recap page an operator's browser/iframe opens directly — it has
  // no body and carries no X-Hub88-Signature, so running it through this would
  // reject it 401 every time. It is read-only and exposes nothing the operator
  // didn't already receive from /game/round.
  router.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    raw({ type: 'application/json' })(req, res, (err) => {
      if (err) return res.status(400).json({ error: 'wrong_syntax' });
      next();
    });
  });

  router.use((req, res, next) => {
    if (req.method !== 'POST') return next();
    const signature = req.get('X-Hub88-Signature');
    if (!verifyBody(req.body, signature, hub88PublicKeyPem)) {
      return res.status(401).json({ error: 'invalid_signature' });
    }
    try {
      req.body = JSON.parse(req.body.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'wrong_syntax' });
    }
    next();
  });

  router.post('/game/url', (req, res) => {
    const {
      user, token: hub88Token, currency, lang,
      operator_id: operatorId, game_code: requestedGameCode,
    } = req.body;

    if (requestedGameCode !== gameCode) {
      return res.status(400).json({ error: 'invalid_game' });
    }

    // DEMO mode (Core API Flow doc): no token/user, or currency "XXX" — no Wallet
    // API calls are ever expected for this session. isDemo is read back in
    // server/index.js to decide LocalLedger (fake balance, exactly like the
    // standalone product) vs Hub88Ledger — a demo session never needs the real
    // Wallet API at all.
    const isDemo = !hub88Token || !user || currency === 'XXX';

    // Our own session token is distinct from Hub88's — minted here so a restart
    // (which drops `sessions`, see sessions.js) can't be replayed with a stale
    // Hub88 token against a session we no longer recognize. `hub88Token` (the
    // player's own token as Hub88 gave it to us) is kept in the session context
    // for Hub88Ledger to send back on every Wallet API call — never exposed to
    // the frontend, which only ever sees our own `sessionToken`.
    const sessionToken = randomUUID();
    createHub88Session(sessionToken, {
      gameCode: requestedGameCode,
      currency: currency ?? 'XXX',
      hub88Token,
      user, operatorId, isDemo,
    });

    const url = new URL(launchBaseUrl);
    url.searchParams.set('token', sessionToken);
    url.searchParams.set('lang', lang ?? 'en');
    if (isDemo) url.searchParams.set('demo', '1');

    res.json({ url: url.toString() });
  });

  router.post('/game/list', (req, res) => {
    res.json([{
      game_code: gameCode,
      name: gameName,
      product: 'Chicken Ninja Studio', // TODO: confirm the exact value Hub88 expects here
      category,                        // TODO: confirm against Hub88's actual category enum
      enabled: true,
      platforms: ['GPL_DESKTOP', 'GPL_MOBILE'],
      blocked_countries: [],
      url_thumb: thumbUrl,
      url_background: backgroundUrl,
      freebet_support: false,
    }]);
  });

  // Per Hub88's Supplier Games API spec, success is { url } — a link to an
  // embeddable round-details page, not raw transaction JSON. Backed by
  // transactionLog.js (HUB88_INTEGRATION.md plan item 7), which hub88Ledger.js
  // populates on every bet/win/rollback call.
  router.post('/game/round', (req, res) => {
    const { operator_id: operatorId, transaction_uuid: transactionUuid, round, user } = req.body;
    if (!operatorId) return res.status(400).json({ error: 'wrong_syntax' });
    if (!transactionLog) return res.status(501).json({ error: 'not_implemented' });

    // Hub88 may identify the round either by one of its transactions or by
    // (round, user) directly — resolve both to the same list of records.
    let records;
    if (transactionUuid) {
      const record = transactionLog.get(transactionUuid);
      records = record ? transactionLog.forRound(record.round, record.user) : [];
    } else if (round && user) {
      records = transactionLog.forRound(round, user);
    } else {
      return res.status(400).json({ error: 'wrong_syntax' });
    }

    if (records.length === 0) return res.status(400).json({ error: 'transaction_not_found' });

    const url = new URL(`${req.protocol}://${req.get('host')}${req.baseUrl}/round/view`);
    url.searchParams.set('round', records[0].round);
    url.searchParams.set('user', records[0].user);
    res.json({ url: url.toString() });
  });

  // The embeddable recap page /game/round hands back a URL to. Read-only,
  // server-rendered, no external assets — an operator-facing utility page, not
  // part of the player-facing product (which stays React/Pixi elsewhere).
  router.get('/round/view', (req, res) => {
    const { round, user } = req.query;
    if (!round || !user) return res.status(400).send('Missing round or user');
    if (!transactionLog) return res.status(404).send('Round not found');

    const records = transactionLog.forRound(round, user);
    if (records.length === 0) return res.status(404).send('Round not found');

    const rows = records.map((r) => `
      <tr>
        <td>${escapeHtml(r.createdAt)}</td>
        <td>${escapeHtml(r.type)}</td>
        <td>${r.amount != null ? Number(r.amount).toFixed(2) : ''} ${escapeHtml(r.currency ?? '')}</td>
        <td>${escapeHtml(r.status)}</td>
        <td>${escapeHtml(r.error ?? '')}</td>
        <td>${r.balance != null ? Number(r.balance).toFixed(2) : ''}</td>
      </tr>`).join('');

    res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Round ${escapeHtml(round)} — Chicken Ninja</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 16px; color: #1a1a1a; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; font-size: 13px; }
  th { background: #f5f5f5; }
</style></head>
<body>
  <h3>Round ${escapeHtml(round)} — player ${escapeHtml(user)}</h3>
  <table>
    <thead><tr><th>Time</th><th>Type</th><th>Amount</th><th>Status</th><th>Error</th><th>Balance after</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`);
  });

  return router;
}
