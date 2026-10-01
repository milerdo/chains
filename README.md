
test comm:
npx tsc -b
npm test
$env:SIM_BETS=50000000; npx vitest run src/game/sim.test.ts

# CHAINS

A live-casino game concept: one continuous stream of digits, shared by everyone.
Every player's bet is a **link** with its own timeline, starting from the first
draw after the bet.

> Demo only. Demo credits, no real money, not a certified RNG.
> © [Your Name], concept and code, 2026.

**Play:** [link after deploy]   |   **Math sheet:** [docs/MATH.md](docs/MATH.md)

![Gameplay](docs/screenshot-desktop.png)
![Mobile](docs/screenshot-mobile.png)

## How it plays

1. Pick 1-3 digits. The count sets the tier: **LOW 9x**, **MIDI 88x**, **HIGH 888x** ($1 per link).
2. Pick a 2-digit jackpot pair. Optionally play **Combo** (every ordering) or up to 3 LOW picks.
3. Each draw must match your next digit, in order. One miss ends the link.
4. Complete the sequence: the payout is credited instantly and can never be lost.
5. Then the next 2 draws must match your jackpot pair to win that tier's progressive pool.

## Why it's interesting

- **One shared stream, personal timelines:** simple to read, easy to follow live.
- **Risk-free jackpot step:** the base win is already banked, so the jackpot is pure upside.
- **Three volatility profiles in one game** (hit rates 1 in 10 / 100 / 1,000).
- **Unseeded progressives:** pools are funded only by bets; the math is closed
  (RTP 96.0 / 95.0 / 96.8%, avg 95.93%). See the math sheet.

## Architecture

```
src/game/   Pure TypeScript engine. No React, no DOM. Runs in Node (tests).
            engine, ticket state machine, combo, payouts, jackpot, rng, rtp
src/hooks/  useGame: subscribes React to the engine, gates the reveal
            until the wheel lands so the UI never spoils a result
src/components/  Rendering only. No game math.
src/utils/  Formatting, colors, Web Audio sounds (synthesized, no files)
```

Engine (decides the digit, settles tickets)
| emit()
useGame (holds the result back)
| wheelTargetDraw
Wheel (animates to the predetermined digit)
| reportWheelLanded()
UI reveals digit, links, balance, jackpots, sounds


The animation never influences the outcome; it only reveals it.

## Stack

React 19, TypeScript, Vite, Tailwind CSS, SVG wheel, Web Audio API, Vitest.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine, math and Monte Carlo tests
npx tsc -b       # type check
```

Presenter tools (force a digit, speed up, pause, reset) appear only with
`/?demo` in the URL.

## Quality

- Deterministic, headless engine with unit tests for payouts, jackpot
  qualification, combos, edge cases, split payouts and RNG routing.
- Monte Carlo (50M links per tier) through the real state machine matches
  the theoretical RTP.
- All outcome randomness goes through one RNG module (swappable).

## Production path (not built)

This is a single-player simulation of a multiplayer game. Taking it to
production means:

1. Split shared round state (phase loop, draws, pools) from player session
   (wallet, tickets).
2. Move the round to a WebSocket server; clients subscribe and animate.
3. Replace the RNG with a certified one; add audit logging.
4. Integrate the operator's wallet (idempotent transactions).
5. Responsible-gaming features: limits, reality checks, session timers.

The engine has no UI dependency, so steps 1-2 are plumbing rather than a rewrite.

## Simulated in the demo

Player counts, the bets heat map and table chat are simulated.
