// Pure game math — no crypto here (Node `crypto` and Web Crypto diverge on the
// HMAC call itself, so that part stays duplicated in server/ and ProvablyFair.jsx,
// same as CRASH-GAME). Everything that's pure math lives here and is imported by
// both sides so the two never drift apart.

export const RTP = 0.97; // 3 % house edge, same convention as CRASH-GAME

// `lanes` is a soft ceiling, not a target — at deathChance=0.03 (easy), survival past
// 100 steps is already under 5%, so 200 lanes is effectively unreachable in normal play.
// It exists so the road (and the server's auto-cashout-on-clear) has *a* bound, not to
// give the player a natural stopping point: a round should only end via bust or a manual
// cashout. Never drop this back near the number of visually reachable lanes.
export const DIFFICULTIES = {
  easy:     { label: 'Facile',   lanes: 200, deathChance: 0.03 },
  medium:   { label: 'Moyen',    lanes: 200, deathChance: 0.07 },
  hard:     { label: 'Difficile', lanes: 200, deathChance: 0.15 },
  hardcore: { label: 'Extrême',  lanes: 200, deathChance: 0.30 },
};

export const DIFFICULTY_KEYS = Object.keys(DIFFICULTIES);

export function isValidDifficulty(key) {
  return Object.prototype.hasOwnProperty.call(DIFFICULTIES, key);
}

// Extra house edge layered on top of RTP for the first few steps, scaled by
// deathChance so it mainly bites on hard/hardcore. Without this, the fair-odds
// compounding on high deathChance makes step 2 land near a flat x2 (e.g.
// hardcore: 0.7^-2 * 0.97 ≈ 1.98) — a near-coinflip parlay that pays out like
// a safe bet. The edge fades to 0 by EDGE_FADE_STEPS so late-game multipliers
// (the real risk/reward of the game) are untouched.
const MAX_EARLY_EDGE      = 0.15; // extra edge at deathChance=EDGE_REF_DEATH_CHANCE, step 2
const EDGE_REF_DEATH_CHANCE = 0.30; // hardcore — reference point for edgeScale
export const EDGE_FADE_STEPS = 8;   // step at which the extra edge reaches 0 (exported so
                                     // rtp-simulation.js can force spot-checks inside the window)

// Theoretical expected return for cashing out at exactly `step`, at a given
// deathChance. Equal to RTP everywhere except the damped early-step window.
export function effectiveRTP(deathChance, step) {
  if (step <= 1 || step >= EDGE_FADE_STEPS) return RTP;
  const edgeScale = Math.min(1, deathChance / EDGE_REF_DEATH_CHANCE);
  const stepFade  = 1 - (step - 1) / (EDGE_FADE_STEPS - 1);
  return RTP - MAX_EARLY_EDGE * edgeScale * stepFade;
}

// Multiplier after `step` consecutive safe lanes at a given death chance.
// Fair value would be (1/survival)^step; effectiveRTP scales it down for the
// house edge (flat 3% past the early-step window, more on hard/hardcore before it).
export function computeStepMultiplier(deathChance, step) {
  const survival = 1 - deathChance;
  const raw = effectiveRTP(deathChance, step) * Math.pow(1 / survival, step);
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
