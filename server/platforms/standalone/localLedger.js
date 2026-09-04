import { Ledger } from '../../core/ledger.js';

// Standalone/demo platform's wallet backend — wraps a PlayerAccount's in-memory
// `balance` behind the Ledger contract. Work is synchronous but still wrapped in
// resolved promises so Round (roundEngine.js) can treat every platform uniformly;
// see HUB88_INTEGRATION.md for the aggregator-backed Ledger this pattern also drives.
export class LocalLedger extends Ledger {
  constructor(account) {
    super();
    this.account = account;
  }

  async getBalance() {
    return this.account.balance;
  }

  async debit(amount) {
    if (amount > this.account.balance) return { ok: false, error: 'insufficient_balance' };
    this.account.balance = +(this.account.balance - amount).toFixed(2);
    return { ok: true, balance: this.account.balance };
  }

  async credit(amount) {
    this.account.balance = +(this.account.balance + amount).toFixed(2);
    return { ok: true, balance: this.account.balance };
  }

  // Nothing to unwind: debit/credit already applied atomically and there is no
  // external system to reconcile with — the in-memory balance IS the ledger.
  async rollback() {
    return { ok: true, balance: this.account.balance };
  }
}
