---
name: rtp-simulation
description: Run a Monte Carlo simulation over Chicken Ninja's real provably-fair path (HMAC-SHA256, per-step RNG) to empirically validate that the RTP matches the theoretical 97% for every difficulty. Use when asked to validate RTP, check house edge, audit fairness, or before shipping a change to src/shared/gameConfig.js or server/index.js's resolveStep logic.
---

# RTP simulation

Validates that `src/shared/gameConfig.js`'s theoretical RTP (`RTP = 0.97`) actually
holds when the real provably-fair code path is exercised — not just proven on paper.

## Why this exists

`computeStepMultiplier(deathChance, step) = RTP * (1/(1-deathChance))^step` is exact
by algebra: `P(survive to step) * multiplier(step) = RTP` for any fixed step, for any
difficulty. That's a proof about the *formula*, not about the *implementation*. The
actual server path — `HMAC-SHA256(serverSeed, "clientSeed:nonce:step")` → take the
first 52 bits of the hex digest → divide by `2**52` → compare to `deathChance` — could
still have a subtle bug (off-by-one in the hex slice, a sign error, float precision)
that biases outcomes without being obvious from reading the code. This script runs
thousands of real rounds through that exact path and checks empirical RTP against a
95% confidence interval around the theoretical value.

This is the same category of check the `PROTOCOL.md` gaps in the original CRASH-GAME
project called out as a certification-lab requirement (iTech Labs, GLI-19): theoretical
and empirical RTP must agree before a real-money integration.

## Running it

```bash
npm run rtp-sim              # quick pass — ~5s, good for a sanity check after editing gameConfig.js
npm run rtp-sim -- --deep    # ~30s, tighter confidence intervals, closer to a real audit
```

Direct flags (bypass the npm script):

```bash
node scripts/rtp-simulation.js --trials=20000 --min-wins=80 --max-trials=500000
```

- `--trials`: baseline sample size per (difficulty, step) spot-check
- `--min-wins`: the script auto-scales `n` upward for rare/high-multiplier cells (e.g.
  Extrême at step 24) so there are still enough *wins* to say something statistically
  meaningful, not just enough trials
- `--max-trials`: runtime safety cap; a `[capped]` note in the output means that cell's
  CI is wider than it should be — rerun with a higher cap for that specific case if it
  matters

## Reading the output

Each difficulty gets 5 spot-checked steps (1, ~¼, ~½, ~¾, and the last lane). A line
looks like:

```
step 18  n=  40000  wins= 10910  RTP= 97.645%  95% CI=[95.441%, 98.559%]  OK
```

`FAIL` means the empirical RTP for that step fell outside the 95% CI around the
theoretical 97%. **Don't treat a single FAIL as a bug** — with ~20 independent 95% CI
checks per run, a false positive roughly every other run is expected by chance alone.
The correct response:

1. Re-run (plain or `--deep`) — if it passes now, it was noise.
2. If the *same* cell fails repeatedly across re-runs, that's a real signal — check
   `hexToUnitInterval`/`outcomeFromUnitInterval` in `src/shared/gameConfig.js` and
   `resolveStep` in `server/index.js` for a bias, not just re-run until it's green.

## When to run this

- After changing anything in `src/shared/gameConfig.js` (difficulty table, RTP
  constant, the multiplier formula, or the RNG→outcome cutoff)
- After touching `resolveStep` / the HMAC call in `server/index.js`
- Before adding a new difficulty tier or adjusting `deathChance` values
- Periodically as a regression check, especially before any real-money integration
