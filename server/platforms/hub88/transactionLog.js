import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Append-only, durable transaction log for the Hub88 real-money path — the
// standalone platform needs none of this (nothing to reconcile, no operator
// audit obligation). See HUB88_INTEGRATION.md plan item 7: Hub88's Wallet API
// requires transactions kept 4+ months, and /game/round (gamesApi.js) needs to
// answer "what happened in this round" without fabricating an answer.
//
// One JSON object per line (JSONL), one file for the process's lifetime. Kept
// deliberately as a flat file rather than a DB — this repo has none yet
// (server/index.js's `accounts` Map is the same posture) and volume here is
// low (one line per bet/win/rollback call, not per request). Appends are
// synchronous: Node is single-threaded, so `appendFileSync` calls from
// concurrent async handlers can never interleave mid-line — the simplest way
// to guarantee well-formed JSONL without a write queue.
//
// Retention: nothing here auto-purges after 4 months — that's a log-rotation
// concern for whoever operates the process (logrotate, a cron trim, etc.),
// deliberately not invented here. This module only guarantees the data is
// durable and queryable for as long as it's kept on disk.

const byTransactionUuid = new Map(); // transaction_uuid -> record
const byRoundUser       = new Map(); // `${round}:${user}` -> record[]

let logPath   = null;
let dirReady  = false;

function indexRecord(record) {
  byTransactionUuid.set(record.transactionUuid, record);
  const key  = `${record.round}:${record.user}`;
  const list = byRoundUser.get(key);
  if (list) list.push(record);
  else byRoundUser.set(key, [record]);
}

// Explicit init, not an import-time side effect — lets server/index.js pick
// the real path (HUB88_TRANSACTION_LOG_PATH or the default) once Hub88 is
// actually configured, and lets hub88-mock-test.js point at a throwaway temp
// file instead. Replays whatever's already on disk so a restart doesn't lose
// query-ability for rounds logged before it. Safe to call again with a
// different path — clears the in-memory index first.
export function initTransactionLog(path = process.env.HUB88_TRANSACTION_LOG_PATH || 'data/hub88-transactions.log') {
  logPath  = path;
  dirReady = false;
  byTransactionUuid.clear();
  byRoundUser.clear();
  if (!existsSync(logPath)) return;
  for (const line of readFileSync(logPath, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      indexRecord(JSON.parse(line));
    } catch (err) {
      console.error(`[hub88 transactionLog] skipping unparseable line in ${logPath}:`, err.message);
    }
  }
}

// record: { type: 'bet'|'win'|'rollback', transactionUuid, referenceTransactionUuid,
//           round, user, operatorId, gameCode, currency, amount, roundClosed,
//           status: 'ok'|'error', error, balance }
// amount/balance are game-currency units (not Hub88's ×100000 minor units) —
// this log is for human/operator review, not another Wallet API call.
export function logTransaction(record) {
  if (!logPath) initTransactionLog();
  const full = { ts: new Date().toISOString(), ...record };
  if (!dirReady) {
    mkdirSync(dirname(logPath), { recursive: true });
    dirReady = true;
  }
  appendFileSync(logPath, `${JSON.stringify(full)}\n`);
  indexRecord(full);
  return full;
}

export function getTransaction(transactionUuid) {
  return byTransactionUuid.get(transactionUuid) ?? null;
}

export function getRoundTransactions(round, user) {
  return (byRoundUser.get(`${round}:${user}`) ?? []).slice().sort((a, b) => a.ts.localeCompare(b.ts));
}
