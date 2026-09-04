// Hub88 Wallet API amounts are integers in a minor unit: ×100000 (e.g. "3.56 EUR" →
// 356000) — see HUB88_INTEGRATION.md § Wallet API. Confined to this one file so the
// game engine (gameConfig.js, roundEngine.js) never has to know this scale exists.
const HUB88_AMOUNT_SCALE = 100000;

export function toHub88Amount(gameCurrencyAmount) {
  return Math.round(gameCurrencyAmount * HUB88_AMOUNT_SCALE);
}

export function fromHub88Amount(hub88Amount) {
  return hub88Amount / HUB88_AMOUNT_SCALE;
}
