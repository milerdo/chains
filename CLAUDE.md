# CHAINS — Claude Code Rules

## 1. Role and scope
Senior full-stack engineer + casino game mathematician building CHAINS, a playable browser demo for iGaming studios. Demo credits only: no real money, deposits, KYC, or certification claims. This is a pitch MVP, not a production system. Server, multiplayer, persistence and engine-level round locking are intentionally NOT built (see README "Production path"). Don't start them unasked.

## 2. Source of truth
- `chainscontext.txt`: spec + current-state log. Read it first. Where it disagrees with the code, verify against the code (logs drift) and fix the log.
- `docs/MATH.md` and `src/game/rtp.ts`: math. RTP figures come ONLY from rtp.ts.
- Don't silently change concept, base payouts, bet mechanics, jackpot thresholds/funding, win conditions. Ask on contradictions. Don't invent rules.

## 3. Workflow
- Inspect before editing. Small targeted diffs with the exact location, no full-file dumps, no rewrites, no new deps, no framework changes.
- Run `npx tsc -b` (Vite doesn't type-check) and `npm test` after multi-file edits. Don't claim untested things work.
- Keep replies short: what changed, files, checks, known issues, next step.
- Monte Carlo (skipped unless SIM_BETS is set): `SIM_BETS=50000000 npx vitest run src/game/sim.test.ts`
- When a type changes shape (e.g. `JackpotSequence`), grep for the old shape (`grep -rn "\[number, number\]" src`) before declaring done, including tests.

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
- TicketDrawer (desktop and mobile): cards are fixed `h-[52px] shrink-0` and the list scrolls (`overflow-y-auto`). General rule: use scroll wherever content can exceed its container; don't squeeze or clip.
- Empty states show nothing (LinkStrip returns null). Don't add empty-state copy.
- Header: `HostMark` = `<img src="/chains-logo.png">` (transparent PNG).

## 7. Betting panel
- `digits: number[]` (max 3, tier by count), `isCombo`, `jackpotFocus: 0|1|2|null`, `staged`. `jackpotPick` is a `JackpotSequence` (3 digits) in GameProvider, randomly prefilled once per session, editable, persists across rounds and breakpoint remounts; a bet or reset never clears it.
- Base digit slots are `h-14 w-14`, `border-2`, `text-2xl`. Filled slots get a glow in their own `DIGIT_COLORS` color (`boxShadow 0 0 14px {color}99`). The next empty slot keeps the gold pulse. Caption under the slots: "Base chain pays N×".
- Order mode (`OrderMode`, under the base digits): two-option segmented control. Each option has "Numbers in" on line 1 and "Exact order · $1" / "Any order · $N" on line 2. No combination list, no link count. Shown only when `comboAvailable` (2+ digits and `countComboPossibilities(digits) > 1`), so it is hidden for 77, 777 and a single digit, where Any order would cost the same as Exact. Any order still expands into one $1 link per unique ordering in the engine.
- Pad is two rows of five. Row below: Clear / Random / Repeat Last Bet. Random changes base digits only and never touches the jackpot numbers.
- Jackpot Numbers section sits below that row: 3 slots (no arrows), a dice SVG icon button (random jackpot numbers) beside them, tier label, short explainer ("Win your base bet, then X, Y, Z in any order on the next 3 draws wins the {tier} jackpot."). Tap a slot to focus it; the next pad press fills it and advances to the next slot. Repeated digits are allowed and are NOT enforced away (they only change the jackpot odds, never payouts or RTP).
- Place Bet needs only 1-3 base digits (the jackpot numbers are always set). Labels: "Select Digits", "Place $X Bet", plus "Any order" second line only when Any order is active, "Repeat · N bets" when staged.
- Multiple bets per round on any tier are allowed (no round lock). Cap: 3 live links per tier+sequence. LOW multi-pick UI and Auto Bet UI are removed; engine multi-selection and provider auto-bet state remain, unreachable. Don't rebuild the UI without asking.
- Repeat Last Bet: provider keeps lastRoundBets (the last round the player actually bet in), each request stored with its own jackpot numbers. Pressing it dry-run validates via placeBets(..., true) and stages the full set in the panel (local state). The staged summary lists base picks only (e.g. `4→2→3 any`), no jackpot numbers. Place Bet then calls atomic placeBets and replays everything exactly as it was, including the stored jackpot numbers, even if the player has since edited the current ones.
- After a bet: digits + mode reset; jackpot numbers stay.

## 8. Links (ChainLinks.tsx is the single source for link visuals)
- `ChainCircle` fill = digit color (`DIGIT_COLORS`); state = border: pending / current (3px gold pulse) / matched (3px green + ✓ badge) / failed (red + ✕).
- `LinkChain` is `flex-nowrap`. Before the base win a link shows only its base circles. On `BASE_WON` (and through jackpot steps / outcome) `JackpotChain` REPLACES the base circles with the 3 jackpot circles (no arrows, no pill) plus a small "Jackpot / LOW|MIDI|HIGH" label (hidden at `xs`), from `JACKPOT_TIER_DISPLAY`. The base is already banked, and this keeps HIGH inside the 52px card cap. Don't enlarge circle sizes without checking that cap.
- `jackpotCircleStates` is a multiset match against `jackpotMatched`: matched / pending, `current` while qualifying, first pending becomes `failed` on JACKPOT_LOST.
- TicketCard (Ticket.tsx): the whole card turns gold-tinted (`border-[#eab308]/60 bg-[#eab308]/[0.12]`) while in qualification (BASE_WON / JACKPOT_STEP_1 / JACKPOT_STEP_2). JACKPOT_WON is the stronger gold glow, JACKPOT_LOST is green-tinted (base win stands), LOST is red-tinted. No amounts, status labels or chance text.
- `LinkStrip` groups links with identical jackpot state (`jackpotGroupKey`: tier + jackpot digits + sorted matched digits + status) to share one gold wrapper; pre-base links fall in one 'base' group.
- Base win notice ("Base win $X paid") is a solid green overlay on `JackpotPanel` for 2.5s, driven by `payoutFlash`. Opaque, no pulse (pool numbers must not show through). PhaseStatus no longer shows it.

## 9. Wheel (Wheel.tsx)
- SVG; rotation applied via ref `setAttribute` (not React state). No per-frame filters (drop-shadow, feTurbulence). Static layers are memoized with per-instance `useId()` gradient ids.
- Spin-up starts at BETTING_CLOSED, or 2s before close on desktop when not `collapsed` (`SPIN_LEAD_MS`). Cruise speed 520°/s, time constant 0.25s.
- When `wheelTargetDraw` arrives: keep current speed for `cruiseDist`, then decelerate for `DECEL_MS` (3.5s ÷ speed multiplier) with `easeOutPow` (`DECEL_POWER` 3), starting at the wheel's real speed (no jump). DRAWING phase is 6s; worst case about 4.3s.
- After Reset, `prevRevealedDrawIndexRef` is cleared when `wheelTargetDraw` is null.
- Landing angle is randomized inside the wedge, at least `PEG_SAFE_MARGIN_DEG` (6°) from either peg. Don't revert to dead-center.
- Flapper: tapered gunmetal paddle, own `flapperGrad-${uid}`. No second click in `land()`.
- Instant demo steps land immediately (`INSTANT_THRESHOLD_MS`).
- Bet markers: small black chips inside WheelDisc (rotate with the disc), one per distinct digit each live link can match next, from `expectedDigits(ticket)` (base digit while ACTIVE, the still-needed jackpot digits while qualifying). Chips orbit the numeral, not the hub: `CHIP_SLOTS` = inner (70, 0°), outer (113, 0°), left (92, -12°), right (92, +12°), inner-left (72, -10°), inner-right (72, +10°). More than 6 on a digit collapses to one counted chip at radius 70. Recomputed only while BETTING_OPEN, frozen during close/draw/result.

## 10. Sound (utils/audio.ts)
Set is: `playTick` (spin), `playStepMatch`, `playBaseWin`, `playJackpotFanfare`, `playUiClick`. No landing or loss sound. Don't add one without asking.

## 11. Terminology
Player-facing: "Link", LOW / MIDI / HIGH, "Live Active Bets", "N players", "Socials", "Jackpot Numbers", "Exact order" / "Any order". Internal names stay: `Ticket`, `TicketTier 'MEDIUM'`, `JackpotTierName MINI/MIDI/GRAND`, `isCombo`. Display-only renames never touch enums; grep all consumers when renaming a label (JackpotPanel, JackpotCelebration, ChainLinks, Help).

## 12. Economy, RTP, jackpot, demo
- Timings (constants.ts): betting 12s, closed 1s, draw 6s, result 1s.
- Base payouts (total return per $1): LOW 9×, MIDI 90×, HIGH 900×. Base RTP 90%.
- Jackpot: player-chosen set of 3 numbers (`JackpotSequence`, `JACKPOT_SEQUENCE_LENGTH` 3), locked at bet time and stored on each link. It is a bonus bet that only becomes active after the base win: the next 3 draws must be those 3 numbers in ANY order (multiset match via `remainingJackpotDigits`). Each draw must be one of the still-unmatched digits; anything else, including a repeat of an already-matched digit, ends the attempt and the base win stays. `JACKPOT_STEP_2` is in use.
- Odds: 3 distinct digits = 6/1000 = 1 in 166.7 after a base win; 112 = 3/1000; 111 = 1/1000. Per link (distinct digits): LOW 1 in 1,667, MIDI 1 in 16,667, HIGH 1 in 166,667. `rtp.ts` exposes `jackpotQualifyProbability` / `jackpotHitProbability`. The jackpot tier follows the base bet's digit count (1 = MINI/LOW, 2 = MIDI, 3 = GRAND/HIGH), not the jackpot numbers.
- Pools are unseeded (0/0/0); contribution 5c per $1 on every tier. Jackpot RTP equals the contribution rate (money conserved), so total RTP is 95.0% for every tier whatever digits the player picks. Seeds push RTP above 100%.
- `DEMO_JACKPOT_PRESET` (80 / 830 / 8,300) only via `applyDemoJackpotPreset()` when the URL has `?demo`; never in engine, tests or RTP.
- DemoPanel and its button render only with `?demo`.
- Outcome randomness only via `rng.ts` (`generateDigit` for draws, `generateAuxDigit` for the rest). Cosmetic simulation may use `Math.random`. The session-start `jackpotPick` prefill is a UI default, not an outcome, so `Math.random` is fine there.
- Help modal is short player copy; figures come from `BASE_MULTIPLIERS`, `rtp.ts`, `RNG_DISCLAIMER`. Update it and docs/MATH.md together when rules change.
- Any order does not change RTP: each possibility is an independent $1 link.

## 13. Known gaps (deliberate)
Engine has no cross-call round lock. `SimulatedActivity.activeTicketsByTier/recentEvents` and `GameState.currentJackpotSequence` are unused by the UI (the engine still regenerates it). Split jackpot payouts can lose up to 1 cent. `simulateJackpotWin` on an empty pool celebrates $0.00 (unwired).

## Final principle
Preserve the CHAINS concept. Correctness before polish. Small, tested changes.