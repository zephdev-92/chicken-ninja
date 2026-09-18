import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Minimal durable transaction log for the Hub88 path — see HUB88_INTEGRATION.md plan
// item 7. Append-only JSON Lines file on disk, rebuilt into an in-memory index at
// startup for fast lookups. This is the only thing in the whole app that survives a
// server restart: `accounts`, `sessions` (server/platforms/hub88/sessions.js) and
// everything else stay in-memory-only by design (see CLAUDE.md § Solde
// server-authoritative) — but a transaction log that vanished on restart would defeat
// its own purpose (reconciliation, /game/round), so this one is deliberately different.
//
// Retention: Hub88's Wallet API requires transactions kept 4+ months. Nothing here ever
// deletes an entry, so that requirement is satisfied unconditionally — there's no purge
// logic to write, test, or get wrong. Rotating/archiving this file after 4+ months is an
// ops concern for whoever deploys this, not application logic.
//
// Scope: only the Hub88 path calls this. The standalone platform's LocalLedger has no
// external settlement system to reconcile against, so it has nothing to log here.
export class TransactionLog {
  constructor(filePath) {
    this.filePath = filePath;
    this.byUuid   = new Map(); // transaction_uuid -> record
    this.byRound  = new Map(); // round -> record[]
    this._load();
  }

  _load() {
    if (!existsSync(this.filePath)) return;
    const lines = readFileSync(this.filePath, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      // A truncated last line (process killed mid-write) shouldn't take the whole
      // log — and therefore the server boot — down with it. Skip and move on.
      try { this._index(JSON.parse(line)); } catch { /* corrupt line, skip */ }
    }
  }

  _index(record) {
    this.byUuid.set(record.transactionUuid, record);
    if (!this.byRound.has(record.round)) this.byRound.set(record.round, []);
    this.byRound.get(record.round).push(record);
  }

  // One entry per Wallet API attempt (bet/win/rollback), success or failure — a
  // failed attempt is exactly the kind of thing reconciliation needs to see, not
  // just the successful ones. `amount`/`currency` are game-currency units (the
  // same scale roundEngine.js and Ledger use), not Hub88's ×100000 integers —
  // this log reads naturally next to the rest of the app, the Hub88-specific
  // encoding is hub88Ledger.js/currency.js's concern alone.
  // `balance` is the wallet balance Hub88 reported *after* the call (null on a
  // failed one, since there's nothing authoritative to record) — kept because the
  // /round/view recap page (gamesApi.js) shows it, and re-deriving it from amounts
  // alone would be a guess: the same player's wallet moves outside this game too.
  record({
    transactionUuid, referenceTransactionUuid = null, round, type, amount,
    currency, user, gameCode, status, error = null, balance = null,
  }) {
    const entry = {
      transactionUuid, referenceTransactionUuid, round, type, amount, currency,
      user, gameCode, status, error, balance, createdAt: new Date().toISOString(),
    };
    mkdirSync(dirname(this.filePath), { recursive: true });
    appendFileSync(this.filePath, JSON.stringify(entry) + '\n', 'utf8');
    this._index(entry);
    return entry;
  }

  get(transactionUuid) {
    return this.byUuid.get(transactionUuid) ?? null;
  }

  // `user` is optional but is what /game/round actually asks with: a round id is
  // only unique per operator+player, so scoping by user is what keeps one player's
  // recap page from ever showing another's transactions. Sorted chronologically —
  // the index preserves append order, but a restart replays the file, so sorting
  // explicitly keeps the order a caller sees independent of how it was loaded.
  forRound(round, user) {
    return (this.byRound.get(round) ?? [])
      .filter((r) => user == null || r.user === user)
      .slice()
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
