# CHAINS: Math Sheet

Demo build. Not a certified RNG; not for real-money play.
© Milutin Erdevicki, concept and code, 2026.

## 1. Game model

- One shared stream of independent, uniform digits 0-9.
- A $1 link has a target sequence of 1 / 2 / 3 digits (LOW / MIDI / HIGH).
  It must match exactly, in order, on consecutive draws. One miss ends it.
- On a base win the payout is credited immediately and cannot be lost.
  The link then needs the next 2 draws to match its jackpot pair
  to win that tier's progressive pool.
- Every $1 staked adds a fixed share to the tier's pool:
  5c (MINI, LOW) / 5c (MIDI) / 5c (GRAND, HIGH).
- Pools are unseeded (start at $0): jackpots are funded 100% by player bets.

## 2. Base game

| Tier | Digits | Hit probability p | Hit frequency | Total return (per $1) | Base RTP = p x payout |
|---|---|---|---|---|---|
| LOW | 1 | 10^-1 | 1 in 10 | 9x | 90.0% |
| MIDI | 2 | 10^-2 | 1 in 100 | 90x | 90.0% |
| HIGH | 3 | 10^-3 | 1 in 1,000 | 900x | 90.0% |

## 3. Jackpot

Because pools have no seed and every contribution is eventually paid out,
jackpot RTP equals the contribution rate (money is conserved; covered by a
unit test).

| Tier | Pool | Contribution per $1 | Jackpot hit probability (base win, then the pair) | Jackpot frequency | Average pool at win |
|---|---|---|---|---|---|
| LOW | MINI | $0.05 | 10^-1 x 10^-2 = 10^-3 | 1 in 1,000 links | $50 |
| MIDI | MIDI | $0.05 | 10^-2 x 10^-2 = 10^-4 | 1 in 10,000 links | $500 |
| HIGH | GRAND | $0.05 | 10^-3 x 10^-2 = 10^-5 | 1 in 100,000 links | $5,000 |

Average pool at win = contribution / hit probability (steady state).

## 4. Total RTP

| Tier | Base | Jackpot | **Total** | House edge |
|---|---|---|---|---|
| LOW | 90% | 5.0% | **95%** | 5.0% |
| MIDI | 90% | 5.0% | **95%** | 5.0% |
| HIGH | 90% | 5.0% | **95%** | 5.0% |
| Equal-weighted average | | | **95.00%** | 5.00% |

Figures are derived in code from `src/game/rtp.ts`, never hardcoded.

## 5. Volatility (base game, per $1 link)

Variance = p x m^2 - (p x m)^2

| Tier | Std. deviation |
|---|---|
| LOW | 2.70 |
| MIDI | 8.96 |
| HIGH | 28.45 |

## 6. Limits and exposure

- Any number of bets per round, on any tier; max 3 concurrent live links per tier + sequence.
- Link cost: $1. Combo: $1 per unique ordering (max 6 links / $6 for
  3 distinct digits).
- Max concurrent live links on the same tier + sequence: 3.
- Max single-link win: 900x stake plus the GRAND pool.
- Base payouts are locked in and cannot be taken back by jackpot outcomes.

## 6b. Combo and multi-pick do not change the math

Each possibility is an independent $1 link evaluated against the same stream,
so RTP per $1 is identical to a straight bet.

## 7. Verification

- Unit tests: base payouts, jackpot qualification, repeated digits, timelines,
  combo expansion, split payouts, money conservation, RTP formulas.
- Monte Carlo through the real ticket state machine, 50,000,000 links per tier,
  base game only (jackpots are rare, so they are verified by the conservation
  test instead):

| Tier | Measured | Theory | Deviation |
|---|---|---|---|
| LOW | 90.031% | 90.000% | +0.8 sigma |
| MIDI | 89.998% | 90.000% | -0.02 sigma |
| HIGH | 90.502% | 90.000% | +1.25 sigma |

Reproduce: 
macOS/Linux `SIM_BETS=50000000 npx vitest run src/game/sim.test.ts` 
PowerShell: `$env:SIM_BETS=50000000; npx vitest run src/game/sim.test.ts`

## 8. RNG note

Draws use the Web Crypto API with rejection sampling (no modulo bias).
A seeded generator exists for reproducible tests only. A production version
requires a certified RNG.