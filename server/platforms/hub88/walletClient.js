import { randomUUID } from 'crypto';
import { signBody } from './signature.js';

// Maps Hub88's RS_ERROR_* status codes (seamless-wallet-response-statuses-supplier-api,
// see HUB88_INTEGRATION.md) to the error vocabulary already used by Round/server:error
// (insufficient_balance, invalid_bet, etc.) — hub88Ledger.js is the only place that
// needs to know Hub88's own vocabulary exists.
const RS_ERROR_MAP = {
  RS_ERROR_INVALID_TOKEN:              'invalid_token',
  RS_ERROR_TOKEN_EXPIRED:              'invalid_token',
  RS_ERROR_NOT_ENOUGH_MONEY:           'insufficient_balance',
  RS_ERROR_INVALID_SIGNATURE:          'invalid_signature',
  RS_ERROR_USER_DISABLED:              'user_disabled',
  RS_ERROR_DUPLICATE_TRANSACTION:      'duplicate_transaction',
  RS_ERROR_LIMIT_REACHED:              'limit_reached',
  RS_ERROR_WRONG_SYNTAX:               'wrong_syntax',
  RS_ERROR_WRONG_TYPES:                'wrong_syntax',
  RS_ERROR_WRONG_CURRENCY:             'wrong_currency',
  RS_ERROR_TRANSACTION_DOES_NOT_EXIST: 'transaction_not_found',
  RS_ERROR_INVALID_PARTNER:            'invalid_partner',
  RS_ERROR_INVALID_GAME:               'invalid_game',
  RS_ERROR_OPERATOR_API:               'operator_api_error',
  RS_ERROR_UNKNOWN:                    'unknown_error',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Thin signed HTTP client for the Hub88 Wallet API (POST /supplier/generic/v2/...).
// One responsibility: sign, send, parse RS_OK/RS_ERROR_* into a uniform
// { ok, data|error } shape. Business logic (which endpoint, what body, and whether
// a network failure should retry or trigger a rollback) belongs to hub88Ledger.js —
// this file doesn't know about rounds, bets or the game at all.
export class WalletClient {
  constructor({ baseUrl, privateKeyPem, fetchImpl = fetch }) {
    this.baseUrl        = baseUrl.replace(/\/+$/, '');
    this.privateKeyPem  = privateKeyPem;
    this.fetch           = fetchImpl;
  }

  // `retries`: how many extra attempts on a *network*-level failure (connection
  // refused/reset, timeout) — never on a parsed RS_ERROR_* business response,
  // which is a definitive answer, not a transient fault. Retrying is only safe
  // because request_uuid is generated once below and reused verbatim across
  // attempts, so a retried request that actually landed the first time is
  // recognized as a duplicate rather than replayed as a second one. hub88Ledger.js
  // decides retries per endpoint (0 for bet — see its debit() for why retrying a
  // bet blindly is unsafe; >0 for win/rollback, themselves corrections that are
  // safe to retry — see HUB88_INTEGRATION.md § Politique réseau Wallet API).
  async post(path, body, { retries = 0, retryDelayMs = 200 } = {}) {
    const fullBody   = { request_uuid: randomUUID(), ...body };
    const bodyBytes  = Buffer.from(JSON.stringify(fullBody), 'utf8');
    const signature  = signBody(bodyBytes, this.privateKeyPem);

    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await this.fetch(`${this.baseUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Hub88-Signature': signature },
          body: bodyBytes,
        });
      } catch {
        if (attempt < retries) {
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        return { ok: false, error: 'network_error' };
      }

      let json;
      try {
        json = await res.json();
      } catch {
        return { ok: false, error: 'wrong_syntax' };
      }

      if (json.status && json.status !== 'RS_OK') {
        return { ok: false, error: RS_ERROR_MAP[json.status] ?? 'unknown_error', hub88Status: json.status };
      }
      return { ok: true, data: json };
    }
  }
}
