// Contract every platform's wallet backend must satisfy to drive roundEngine.js.
// No TypeScript in this repo — documented here, enforced by convention (and by
// scripts/concurrency-test.js exercising whichever Ledger backs the session).
//
// All methods are async: the standalone platform (server/platforms/standalone/
// localLedger.js) resolves immediately against an in-memory balance, but an
// aggregator platform (server/platforms/hub88/, ...) makes a real signed HTTP
// call — roundEngine.js must never assume either is synchronous.
//
// debit/credit resolve to { ok: true, balance } on success or
// { ok: false, error } on failure, using the same error vocabulary already
// emitted as `server:error` today (`insufficient_balance`, etc.) — translating
// a platform's own error codes (e.g. Hub88's RS_ERROR_NOT_ENOUGH_MONEY) into
// this shared vocabulary is each Ledger's job, never roundEngine's.
export class Ledger {
  async getBalance() {
    throw new Error('Ledger.getBalance not implemented');
  }

  // amount: game-currency units (same scale as bet/payout in gameConfig.js).
  // meta: { roundId, transactionUuid } — a platform may ignore fields it
  // doesn't need (the standalone Ledger ignores all of them).
  async debit(_amount, _meta) {
    throw new Error('Ledger.debit not implemented');
  }

  // meta: { roundId, transactionUuid, referenceTransactionUuid, roundClosed }
  async credit(_amount, _meta) {
    throw new Error('Ledger.credit not implemented');
  }

  // Undoes a debit that already succeeded but whose round never actually
  // started (e.g. the socket dropped before the first step). A no-op return
  // is a legitimate implementation for a platform with nothing to unwind.
  async rollback(_meta) {
    throw new Error('Ledger.rollback not implemented');
  }
}
