# CHAINS — Claude Code Rules

## 1. Role and scope
Senior full-stack engineer + casino game mathematician building CHAINS, a playable browser demo for iGaming studios. Demo credits only: no real money, deposits, KYC, or certification claims. This is a pitch MVP, not a production system. Server, multiplayer, persistence and engine-level round locking are intentionally NOT built (see README "Production path"). Don't start them unasked.

## 2. Source of truth
- `ChainsContext.txt`: spec + current-state log. Read it first. Where it disagrees with the code, verify against the code (logs drift) and fix the log.
- `docs/MATH.md` and `src/game/rtp.ts`: math. RTP figures come ONLY from rtp.ts.
- Don't silently change concept, base payouts, bet mechanics, jackpot thresholds/funding, win conditions. Ask on contradictions. Don't invent rules.

## 3. Workflow
- Inspect before editing. Small targeted diffs with the exact location, no full-file dumps, no rewrites, no new deps, no framework changes.
- Run `npx tsc -b` (Vite doesn't type-check) and `npm test` after multi-file edits. Don't claim untested things work.
- Keep replies short: what changed, files, checks, known issues, next step.
- Monte Carlo (skipped unless SIM_BETS is set): `SIM_BETS=50000000 npx vitest run src/game/sim.test.ts`

## 4. Architecture
`src/game` is pure TS (no React/DOM): engine, ticket, combo, payouts, jackpot, rng, rtp, constants. `src/hooks/useGame.ts` is a thin reactive bridge. `src/components` renders only. Never put game math in components. The wheel never decides or alters a result.

## 5. Reveal gate (useGame.ts)
- On each new draw the engine emits once. useGame immediately sets `wheelTargetDraw` (the wheel starts decelerating) and queues `pendingPublicRevealRef`. There is no suspense delay timer anymore.
- `reportWheelLanded()` (or the `PUBLIC_REVEAL_FALLBACK_MS` fallback, 6000, must exceed the wheel's worst case) calls `commitPublicReveal()`, which commits ONE `revealedDraw` object: `currentDraw`, `streamHistory`, `tickets`, `balance`, `jackpotPools`. It also fires queued outcome sounds, `payoutFlash`, jackpot celebration and the loss flash.
- Never read `gameState.balance/jackpotPools/tickets` in UI. Use the gated values.
- Non-draw emits (bets, demo actions) update revealed state immediately, but are ignored while a reveal is pending.
- `enterPhase('DRAWING')` must emit exactly once (processDraw emits internally). Never add a second emit.
- Loss flash: `flashingFailedIds` holds a LOST/JACKPOT_LOST ticket in the active list for 900ms. Timeouts are cleared on reset and unmount.
- `resetGame()` order matters: `game.reset()`, `commitPublicReveal()`, then apply the demo preset, then clear refs/state.

## 6. Layout (current)
- One `<main>` chosen by `useMediaQuery('(min-width:1024px)')`: single mount per breakpoint. State that must survive a resize lives in GameProvider (`jackpotPick`, auto-bet state).
- Desktop: left = Live Active Bets (`MultiplayerSim`) + `EmojiChat`; middle = `JackpotPanel` + `Wheel`; right = `PhaseStatus` + (`BettingPanel` | `TicketDrawer`). TicketDrawer replaces the panel only when `bettingLocked && activeTickets.length > 0` (`showDrawerOnly`). `BettingPanel` stays mounted (hidden) while the drawer shows.
- Mobile: one no-scroll screen. `PhaseStatus` only while betting is open (no GOOD LUCK state on mobile), JackpotPanel, Wheel (`compact`, `collapsed` during BETTING_OPEN), then BettingPanel (mounted, hidden when locked) with `LinkStrip` above it, or compact TicketDrawer when locked with links. `MobileFooter` = sound/help/history/(demo)/socials + Balance. Socials = bottom sheet (Live Active Bets + chat).
- Short screens (`max-height:740px`): while betting is open, JackpotPanel is not rendered and the Wheel wrapper is `hidden`. NEVER unmount the Wheel (refs, `reportWheelLanded`).
- Compact TicketDrawer scrolls, cards fixed `h-[52px] shrink-0`. Desktop drawer: `flex-1 max-h-[52px]`, no scroll.
- Empty states show nothing (LinkStrip returns null). Don't add empty-state copy.
- Header: `HostMark` = `<img src="/chains-logo.png">` (transparent PNG).

## 7. Betting panel
- `digits: number[]` (max 3, tier by count), `isCombo`, `jackpotFocus`. `jackpotPick` is `[n|null, n|null]` in GameProvider, starts empty, persists across rounds; reset never clears it.
- Jackpot pair is its own "Jackpot Numbers" section below the Clear/Random/Repeat row (tier label shown, Random button, short explainer). Caption under base digits: "Base chain pays N×".
- Exact order / Any order is a compact two-option segmented control (OrderMode) under the base digits, shown only with 2+ digits. Each option shows its stake and link count. Any order still expands into one $1 link per unique ordering. Random changes digits only. After a bet: digits + mode reset.
- Multiple bets per round on any tier are allowed (no round lock). Cap: 3 live links per tier+sequence. LOW multi-pick UI and Auto Bet UI are removed; engine multi-selection and provider auto-bet state remain, unreachable. Don't rebuild the UI without asking.
- Repeat Last Bet: provider keeps lastRoundBets (the last round the player actually bet in). Pressing it dry-run validates via placeBets(..., true) and stages the full set in the panel (local state); nothing is placed until Place Bet, which calls atomic placeBets.

## 8. Links (ChainLinks.tsx is the single source for link visuals)
- `ChainCircle` fill = digit color (`DIGIT_COLORS`); state = border: pending / current (3px gold pulse) / matched (3px green + ✓ badge) / failed (red + ✕).
- `LinkChain` is `flex-nowrap`. Jackpot pill is gold (`border /60, bg /[0.14]`), tier name from `JACKPOT_TIER_DISPLAY` (hidden at `xs`). Don't enlarge circle sizes without checking the 52px card cap.
- `LinkStrip` groups links with identical jackpot state to share one pill.
- TicketCard shows the pill only: no amounts, status labels or chance text.
- Base win notice ("Base win $X paid") is a solid green overlay on `JackpotPanel` for 2.5s, driven by `payoutFlash`. Opaque, no pulse (pool numbers must not show through). PhaseStatus no longer shows it.

## 9. Wheel (Wheel.tsx)
- SVG; rotation applied via ref `setAttribute` (not React state). No per-frame filters (drop-shadow, feTurbulence). Static layers are memoized with per-instance `useId()` gradient ids.
- Spin-up starts at BETTING_CLOSED, or 2s before close on desktop when not `collapsed` (`SPIN_LEAD_MS`). Cruise speed 520°/s, time constant 0.25s.
- When `wheelTargetDraw` arrives: keep current speed for `cruiseDist`, then decelerate for `DECEL_MS` (3.5s ÷ speed multiplier) with `easeOutPow` (`DECEL_POWER` 3), starting at the wheel's real speed (no jump). DRAWING phase is 6s; worst case about 4.3s.
- After Reset, `prevRevealedDrawIndexRef` is cleared when `wheelTargetDraw` is null.
- Landing angle is randomized inside the wedge, at least `PEG_SAFE_MARGIN_DEG` (6°) from either peg. Don't revert to dead-center.
- Flapper: tapered gunmetal paddle, own `flapperGrad-${uid}`. No second click in `land()`.
- Instant demo steps land immediately (`INSTANT_THRESHOLD_MS`).
- Bet markers: small black chips inside WheelDisc (rotate with the disc), one per live link on its nextExpectedDigit(). Recomputed only while BETTING_OPEN, frozen during close/draw/result. More than 6 on a digit collapses to one counted chip.

## 10. Sound (utils/audio.ts)
Set is: `playTick` (spin), `playStepMatch`, `playBaseWin`, `playJackpotFanfare`, `playUiClick`. No landing or loss sound. Don't add one without asking.

## 11. Terminology
Player-facing: "Link", LOW / MIDI / HIGH, "Live Active Bets", "N players", "Socials". Internal names stay: `Ticket`, `TicketTier 'MEDIUM'`, `JackpotTierName MINI/MIDI/GRAND`, `isCombo`. Display-only renames never touch enums; grep all consumers when renaming a label (JackpotPanel, JackpotCelebration, ChainLinks, Help).

## 12. Economy, RTP, demo
- Timings (constants.ts): betting 12s, closed 1s, draw 6s, result 1s.
- Jackpot pools are unseeded (0/0/0); contributions 5c per $1 on every tier. Seeds push RTP above 100%. Base RTP 90%, total RTP 95.0%
- `DEMO_JACKPOT_PRESET` only via `applyDemoJackpotPreset()` when the URL has `?demo`; never in engine, tests or RTP.
- DemoPanel and its button render only with `?demo`.
- Outcome randomness only via `rng.ts` (`generateDigit` for draws, `generateAuxDigit` for the rest). Cosmetic simulation may use `Math.random`.
- Help modal is short player copy; figures come from `BASE_MULTIPLIERS`, `rtp.ts`, `RNG_DISCLAIMER`. Update it and docs/MATH.md together when rules change.
- Any order does not change RTP: each possibility is an independent $1 link.

## 13. Known gaps (deliberate)
Engine has no cross-call round lock. `SimulatedActivity.activeTicketsByTier/recentEvents` and `GameState.currentJackpotSequence` are unused by the UI. Split jackpot payouts can lose up to 1 cent. `simulateJackpotWin` on an empty pool celebrates $0.00 (unwired).

## Final principle
Preserve the CHAINS concept. Correctness before polish. Small, tested changes.