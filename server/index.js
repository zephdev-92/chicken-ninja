import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { Round } from './core/roundEngine.js';
import { LocalLedger } from './platforms/standalone/localLedger.js';
import { createGamesApiRouter } from './platforms/hub88/gamesApi.js';
import { WalletClient } from './platforms/hub88/walletClient.js';
import { Hub88Ledger } from './platforms/hub88/hub88Ledger.js';
import { getHub88Session } from './platforms/hub88/sessions.js';

const app        = express();
const httpServer = createServer(app);
const io         = new Server(httpServer, { cors: { origin: '*' } });

const DEFAULT_BALANCE = 100;
const DEFAULT_WALLET  = 1000;

// ── Hub88 platform wiring — inert unless every required env var is set, so the
// standalone product (and its tests) are completely unaffected by default. Real
// values only exist once Hub88 onboarding is done — see HUB88_INTEGRATION.md.
const hub88Config = (() => {
  const {
    HUB88_PRIVATE_KEY, HUB88_REMOTE_PUBLIC_KEY, HUB88_WALLET_BASE_URL,
    HUB88_GAME_CODE, HUB88_GAME_NAME, HUB88_LAUNCH_BASE_URL,
    HUB88_THUMB_URL, HUB88_BACKGROUND_URL, HUB88_CATEGORY,
  } = process.env;
  if (!HUB88_PRIVATE_KEY || !HUB88_REMOTE_PUBLIC_KEY || !HUB88_WALLET_BASE_URL
    || !HUB88_GAME_CODE || !HUB88_LAUNCH_BASE_URL) {
    return null;
  }
  return {
    walletClient: new WalletClient({ baseUrl: HUB88_WALLET_BASE_URL, privateKeyPem: HUB88_PRIVATE_KEY }),
    gamesApiRouter: createGamesApiRouter({
      hub88PublicKeyPem: HUB88_REMOTE_PUBLIC_KEY,
      gameCode:            HUB88_GAME_CODE,
      gameName:              HUB88_GAME_NAME || 'Chicken Ninja',
      launchBaseUrl:           HUB88_LAUNCH_BASE_URL,
      // Required by Hub88's /game/list — genuinely unset until real assets are
      // hosted and the category enum is confirmed with Hub88 (see
      // HUB88_INTEGRATION.md), not silently defaulted to something fake.
      thumbUrl:              HUB88_THUMB_URL || '',
      backgroundUrl:           HUB88_BACKGROUND_URL || '',
      ...(HUB88_CATEGORY ? { category: HUB88_CATEGORY } : {}),
    }),
  };
})();

if (hub88Config) {
  app.use('/hub88/supplier/generic/v2', hub88Config.gamesApiRouter);
  console.log('[server] Hub88 Games API mounted at /hub88/supplier/generic/v2');
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

  const presentedToken = socket.handshake.auth?.token;

  // A token minted by /game/url (see platforms/hub88/gamesApi.js) resolves to a
  // Hub88 session — that's the only signal distinguishing a Hub88-launched socket
  // from a standalone one; both speak the exact same Socket.IO protocol from here
  // on, see HUB88_INTEGRATION.md § Ce qui reste commun à toutes les plateformes.
  const hub88Session = hub88Config ? getHub88Session(presentedToken) : null;

  // `account` stays null on the Hub88 real-money path — there's no local
  // wallet/reserve to speak of, the operator's Wallet API is the only truth (see
  // Hub88Ledger). It's only used below to gate wallet:deposit/withdraw, which are
  // a standalone-only concept.
  let token, account, ledger;

  if (hub88Session) {
    token = hub88Session.token;
    // DEMO mode never touches the real Wallet API (Core API Flow doc) — it gets
    // exactly the standalone experience (fake balance) under a Hub88-issued token.
    ledger = hub88Session.isDemo
      ? new LocalLedger(new PlayerAccount())
      : new Hub88Ledger(hub88Config.walletClient, hub88Session);
  } else {
    // Resolve (or mint) the anonymous player identity for this connection —
    // never trust a client-supplied playerId without re-checking its signature.
    const verifiedId = verifyToken(presentedToken);
    const playerId    = verifiedId ?? randomBytes(16).toString('hex');
    token              = verifiedId ? presentedToken : `${playerId}.${signPlayerId(playerId)}`;
    account             = getOrCreateAccount(playerId);
    ledger               = new LocalLedger(account);
  }

  // The platform-agnostic round engine (server/core/roundEngine.js) — the only
  // thing that changed above between platforms is which Ledger drives it.
  const round = new Round(ledger);

  const syncState = async () => ({ token, wallet: account?.wallet ?? null, ...(await round.state()) });

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

  // Wallet reserve transfers are a standalone-only concept — no `account` exists
  // on a real-money Hub88 session (the operator's wallet IS the balance, nothing
  // to transfer from on our side). See PlayerAccount / HUB88_INTEGRATION.md.
  socket.on('wallet:deposit', ({ amount }) => {
    if (!account) { socket.emit('server:error', { code: 'wallet_not_available' }); return; }
    const { data, error } = account.deposit(amount);
    if (error) { socket.emit('server:error', { code: error }); return; }
    socket.emit('wallet:sync', data);
  });

  socket.on('wallet:withdraw', ({ amount }) => {
    if (!account) { socket.emit('server:error', { code: 'wallet_not_available' }); return; }
    const { data, error } = account.withdraw(amount);
    if (error) { socket.emit('server:error', { code: error }); return; }
    socket.emit('wallet:sync', data);
  });

  socket.on('player:set-client-seed', async ({ seed }) => {
    if (round.setClientSeed(seed)) {
      socket.emit('session:sync', await syncState());
    }
  });

  socket.on('disconnect', async () => {
    console.log('[server] disconnected:', socket.id);
    // Only unwinds a bet that hasn't risked anything yet (status active, step 0)
    // — see Round.abandon() in roundEngine.js. Anything further along forfeits,
    // same as always; the socket is gone either way, nothing more can happen on
    // this Round instance after this.
    try {
      await round.abandon();
    } catch (err) {
      console.error('[server] round.abandon() failed:', err);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[server] Chicken Ninja on http://localhost:${PORT}`);
});
