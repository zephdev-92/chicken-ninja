// Pure game math — no crypto here (Node `crypto` and Web Crypto diverge on the
// HMAC call itself, so that part stays duplicated in server/ and ProvablyFair.jsx,
// same as CRASH-GAME). Everything that's pure math lives here and is imported by
// both sides so the two never drift apart.

export const RTP = 0.97; // 3 % house edge, same convention as CRASH-GAME

export const DIFFICULTIES = {
  easy:     { label: 'Facile',   lanes: 24, deathChance: 0.03 },
  medium:   { label: 'Moyen',    lanes: 24, deathChance: 0.07 },
  hard:     { label: 'Difficile', lanes: 24, deathChance: 0.15 },
  hardcore: { label: 'Extrême',  lanes: 24, deathChance: 0.30 },
};

export const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);

export function isValidDifficulty(key) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTIES, key);
}

// Multiplier after `step` consecutive safe lanes at a given death chance.
// Fair value would be (1/survival)^step; RTP scales it down for the house edge.
export function computeStepMultiplier(deathChance, step) {
  const survival = 1 - deathChance;
  const raw = RTP * Math.pow(1 / survival, step);
  return Math.max(1, +raw.toFixed(2));
}

export function buildMultiplierLadder(deathChance, lanes) {
  return Array.from({ length: lanes }, (_, i) => computeStepMultiplier(deathChance, i + 1));
}

// HMAC message for a given round/step — identical shape on both sides.
export function hmacMessage(clientSeed, nonce, step) {
  return `${clientSeed}:${nonce}:${step}`;
}

// First 52 bits of a hex digest → float in [0, 1). Same trick as CRASH-GAME.
export function hexToUnitInterval(hex) {
  const seed = parseInt(hex.slice(0, 13), 16);
  return seed / Math.pow(2, 52);
}

export function outcomeFromUnitInterval(r, deathChance) {
  return r < deathChance ? 'star' : 'safe';
}
