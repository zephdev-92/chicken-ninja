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

// Thin signed HTTP client for the Hub88 Wallet API (POST /supplier/generic/v2/...).
// One responsibility: sign, send, parse RS_OK/RS_ERROR_* into a uniform
// { ok, data|error } shape. Business logic (which endpoint, what body) belongs to
// hub88Ledger.js — this file doesn't know about rounds, bets or the game at all.
export class WalletClient {
  constructor({ baseUrl, privateKeyPem, fetchImpl = fetch }) {
    this.baseUrl        = baseUrl.replace(/\/+$/, '');
    this.privateKeyPem  = privateKeyPem;
    this.fetch           = fetchImpl;
  }

  async post(path, body) {
    // request_uuid: per-attempt idempotency key. Generated once here (not inside
    // the caller) and reused verbatim if this exact call is retried, so a retried
    // request that actually succeeded the first time is recognized as a duplicate
    // rather than replayed as a second one.
    const fullBody   = { request_uuid: randomUUID(), ...body };
    const bodyBytes  = Buffer.from(JSON.stringify(fullBody), 'utf8');
    const signature  = signBody(bodyBytes, this.privateKeyPem);

    let res;
    try {
      res = await this.fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Hub88-Signature': signature },
        body: bodyBytes,
      });
    } catch {
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
