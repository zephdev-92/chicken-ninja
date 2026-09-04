import { Router, raw } from 'express';
import { randomUUID } from 'crypto';
import { verifyBody } from './signature.js';
import { createHub88Session } from './sessions.js';

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
}) {
  const router = Router();

  // Raw bytes, not express.json()'s parsed object — the signature covers the
  // exact bytes Hub88 sent, and re-serializing a parsed object isn't guaranteed
  // to reproduce them byte-for-byte (key order, whitespace).
  router.use(raw({ type: 'application/json' }));

  router.use((req, res, next) => {
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

  router.post('/game/round', (req, res) => {
    // Needs a persisted transaction/round log to answer honestly — not built yet,
    // see HUB88_INTEGRATION.md plan item 7 (Persistance minimale des transactions).
    // Returning a fabricated URL here would be worse than admitting the gap.
    res.status(501).json({ error: 'not_implemented' });
  });

  return router;
}
