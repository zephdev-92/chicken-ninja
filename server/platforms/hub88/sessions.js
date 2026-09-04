// Maps our own session key (minted by gamesApi.js's /game/url handler, the value
// the client presents as `token` on socket.io connect — same mechanism as the
// standalone anonymous token in server/index.js) to the context a Hub88Ledger
// needs to call the Wallet API.
//
// Note the two distinct "tokens" in play: `token` below is OUR session key
// (socket.io-facing); `hub88Token` inside the stored context is the *player's*
// token as Hub88 gave it to us in the /game/url request body, which is what
// Hub88Ledger sends back to the Wallet API as its own `token` field. Never
// confuse the two — session context must never carry its own `token` key, or
// it would silently shadow the session key below.
//
// In-memory only, same posture as server/index.js's anonymous token store — a
// restart drops every session, which is fine here because Hub88's wallet (not
// ours) is the one holding the balance; nothing of value is lost, the player
// just has to relaunch from the operator.
const sessions = new Map(); // token -> { token, gameCode, hub88Token, currency, user, operatorId, isDemo }

export function createHub88Session(token, context) {
  sessions.set(token, { ...context, token });
}

export function getHub88Session(token) {
  return sessions.get(token) ?? null;
}
