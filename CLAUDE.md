
# CHAINS — Claude Code Development Rules

## 1. Project role

You are a senior full-stack engineer and casino game mathematician helping build CHAINS, a playable browser-based casino game MVP for demonstration to iGaming studios.

The project uses an existing React/TypeScript codebase.

Your job is to improve and extend the existing project without unnecessary rewrites.

The game is demo-only:
- Demo credits.
- No real-money gambling.
- No deposits or withdrawals.
- No KYC or payment processing.
- No claims of gambling certification.

## 2. Source of truth

The CHAINS game specification is available in the project knowledge / specification file (`updatedComboChains.txt`).

Read it before implementing game mechanics. Read the "IMPLEMENTATION LOG" section at the end of that file FIRST — it lists every place the live build has intentionally diverged from the original numbered spec (naming, UI behavior, timings). Treat the log as authoritative over the numbered sections wherever the two disagree.

The specification defines the intended game concept, rules, payouts, jackpots, betting and player experience.

Do not silently change:
- Game concept.
- Base payouts.
- Bet mechanics.
- Jackpot thresholds.
- Jackpot funding.
- Winning conditions.
- Core player experience.

If a requirement is contradictory, identify it and ask for clarification before implementing the affected mechanic.

Do not invent missing rules and present them as approved.

## 3. Existing codebase first

Before making major changes:

1. Inspect the existing project structure.
2. Identify the framework and package manager.
3. Inspect package.json.
4. Inspect the current game components.
5. Inspect the existing game logic.
6. Inspect existing tests and configuration.
7. Determine what is already working.
8. Reuse existing components and dependencies.

Do not replace the existing application with a new template.

Do not migrate frameworks unless explicitly approved.

Do not install new libraries unless there is a clear reason.

**Layout warning:** `<Wheel />` is currently mounted twice at once (desktop 3-col grid + mobile tabbed view), toggled via CSS breakpoints, not conditional unmounting. Any component rendered this way MUST use `useId()` (or another per-instance-unique mechanism) for any raw SVG `id`/`url(#...)` reference — duplicate ids across the two mounted instances previously caused gradient fills to silently fail to render below the `lg` breakpoint. Check for this pattern before adding new SVG defs anywhere in the app.

**Update:** `<Wheel />`'s actual DOM mount is now gated by `useMediaQuery('(min-width: 1024px)')` in `App.tsx` (see Section 13) rather than CSS alone, because the CSS-only approach also caused every sound effect and `reportWheelLanded()` call to double-fire. The `useId()` requirement above still stands regardless (defense in depth / in case this gating is ever changed), but the audio double-fire bug is fixed at the mount level now.

## 4. Architecture

Keep game logic independent of React.

Preferred separation:

src/
  components/
  game/
  hooks/
  utils/

The exact structure may differ if the existing project already has a good architecture.

The game engine should handle:
- Game state.
- Game phases.
- Bet validation.
- Number generation interface.
- Ticket progression.
- Win/loss resolution.
- Payout calculations.
- Jackpot qualification.
- Jackpot settlement.

React should render the engine state.

Do not put authoritative game mathematics inside visual components.

Do not let wheel animation determine the outcome.

**Reveal pipeline:** `useGame.ts` gates THREE things behind the same wheel-landing commit point (`commitPublicReveal()`), not just the draw digit: `currentDraw`, `streamHistory`, AND `tickets` (active/history lists). All three come from a single `revealedDraw` state object updated together. If you add any new UI element that reads live outcome data, route it through this same gated state rather than raw `gameState`, or it will spoil the result before the wheel visually lands. The one exception is the "not a new draw" branch (bets placed, demo-panel actions, jackpot pool ticks) — those update ticket state immediately since there's no pending reveal to protect.

**Sound timing:** ticket outcome sounds (`playBaseWin`/`playLoss`/`playJackpotFanfare`) fire from `applyTicketSoundsRef`, invoked ~260ms after `commitPublicReveal()`, deliberately staggered after the wheel's own landing thunk (`playDrawSettle`) so the two don't audibly collide. Do not move outcome sound calls earlier than this commit point — the engine's `enterPhase('DRAWING', ...)` previously double-emitted (`processDraw()` already emits internally; a second unconditional `this.emit()` right after it leaked sound at spin-start). That has been fixed — `enterPhase` now returns immediately after `processDraw()` + `armTimer()` for the DRAWING case. Do not reintroduce a second emit there.

## 5. Development strategy

Work in small, complete milestones.

Recommended priority:

1. Inspect and understand the existing project.
2. Resolve specification contradictions.
3. Build or correct the deterministic game engine.
4. Add automated tests.
5. Connect the engine to the existing UI.
6. Implement the wheel animation.
7. Implement demo wallet and jackpot display.
8. Implement help and developer controls.
9. Polish the responsive UI.
10. Verify the complete playable MVP.

Do not build every feature in one response.

Do not polish the UI before the underlying mechanics are working.

## 6. Token efficiency

I use Claude's free version.

Minimize unnecessary token usage.

Rules:
- Inspect before editing.
- Modify only relevant files.
- Do not rewrite working components unnecessarily.
- Do not repeat the entire specification.
- Do not generate long explanations unless requested.
- Do not add unrelated features.
- Do not create duplicate components.
- Do not install unnecessary dependencies.
- Prefer small targeted edits.
- Keep responses concise.
- Combine closely related changes when efficient.
- Do not ask for approval on trivial implementation decisions.
- When proposing a fix plan, give scoped diffs, not full file dumps, unless a file is being created new or is short.

Before large changes, explain the plan briefly.

## 7. Testing

Every important game mechanic must be deterministic and testable.

Prioritize tests for:
- Bet validation.
- Exact sequence matching.
- Combo expansion.
- Ticket timelines.
- Shared global draw results.
- Multiple active tickets.
- Base payouts.
- Jackpot qualification.
- Jackpot failure.
- Repeated digits.
- Balance updates.
- Betting phase restrictions.

Run available tests and type/build checks after meaningful changes.

Do not claim something works if it was not tested.

## 8. Wheel animation

The wheel must reveal a predetermined game result.
The wheel should look like 'wheel.png'
The engine generates the digit.
The wheel animates toward that digit.
The animation must not generate or alter the result.

Use a realistic mechanical 0–9 wheel with:
- Momentum.
- Deceleration.
- Pointer/flapper.
- Physical-looking movement.
- Clear final digit.

Keep animation timing configurable (`DRAW_ANIMATION_DURATION` in `constants.ts`; currently 9.5s — increased from the original 8s per demo feedback, betting duration unchanged). SVG render size increased to 340×340 (was 260×260) for visual presence — geometry/viewBox math is untouched, only the rendered `width`/`height`.

Do not spend excessive tokens on visual polish before the game is functional.

## 9. Security and future readiness

This is a demo MVP, not a production gambling system.

For the demo:
- Use a dedicated RNG abstraction.
- Keep the engine deterministic when testing.
- Keep demo wallet logic separate from game logic.
- Clearly label simulated systems.

For future real-money integration:
- Server-authoritative outcomes.
- Secure randomness.
- Transaction integrity.
- Idempotency.
- Audit logs.
- Proper regulated platform integration.

Never trust client-submitted results or balances in a real-money implementation.

## 10. Communication

Before implementation:
- Briefly state what you will change.
- Identify any important risks.

After implementation:
- Summarize what changed.
- List changed files.
- Report tests/checks.
- Report known issues.
- Suggest the next milestone.

Do not repeat unchanged code.

## 11. Terminology (frontend only)

The player-facing term for a bet/sequence is **"Link"**, not "ticket" — e.g. "Your Links", "Active links", "link closed". This applies ONLY to UI copy (component labels, aria-labels, tab names, DemoPanel readouts, Help modal prose, toast/feedback messages). Internal code — the `Ticket` type, `ticket` variables, file names (`ticket.ts`, `Ticket.tsx`), function names (`createTicket`, `evaluateTicketOnDraw`, etc.) — intentionally still says "ticket" and should NOT be renamed; that would be a large, functionally-pointless refactor. Only touch display strings.

## 12. First task

When asked to begin a new session:

- Read `updatedComboChains.txt`, including the IMPLEMENTATION LOG at the end.
- Read this file in full, including sections 3, 4, 8, and 11 above.
- Inspect the ACTUAL current codebase (App.tsx layout especially — it has changed shape more than once; do not assume a stale prior-session description of it is current).
- Do not rewrite the application.
- Do not build new features yet.
- Report the current state.
- Identify contradictions in the specification.
- Propose a practical implementation plan.

Wait for approval before major architectural changes.

## 13. Patterns established this session (read before touching Wheel, DemoPanel, App layout, or sound)

**Dual-mount hazard is not just an SVG-id problem.** Section 3's warning about
`<Wheel />` being mounted twice (desktop grid + mobile tab via CSS `hidden`/
`lg:hidden`) also caused a real bug: every tick/settle/flapper sound and
every `reportWheelLanded()` call fired TWICE per draw, since CSS-hiding
still leaves the component mounted and running. Fixed by gating the actual
mount (not just visibility) behind a real viewport check:

- New hook: `src/hooks/useMediaQuery.ts` — wraps `window.matchMedia`.
- `App.tsx` now does `{isDesktop && <Wheel />}` / `{!isDesktop && <Wheel />}`
  instead of relying on CSS alone for `<Wheel />` specifically.
- `JackpotPanel` and other side-effect-free components are still fine to
  dual-mount via CSS only — only components with audio/animation/callback
  side effects need this treatment. Apply this same pattern to any future
  component that plays sound, runs `requestAnimationFrame`, or calls a
  callback like `reportWheelLanded()`.

**Reveal-gating pipeline now covers celebration + step sounds too.**
`useGame.ts`'s `applyTicketSounds` closure (invoked only from
`commitPublicReveal`, per the existing gating rule in Section 4) now also:
- Fires `playStepMatch()` for a mid-sequence digit match (base or jackpot
  step advancing) even when `status` itself doesn't change this draw —
  tracked via a new `prevTicketProgressRef` (baseProgress/jackpotProgress
  per ticket id), separate from the existing `prevTicketStatusRef`.
- Sets `jackpotCelebration` state (full-screen overlay trigger) at the
  `JACKPOT_WON` status-change branch, same commit point as the fanfare
  sound. Never set outside `commitPublicReveal`.
- Both refs are cleared in `resetGame()` alongside `prevTicketStatusRef`.

**`resetGame()` bypasses the reveal delay.** Previously used the same
delayed-reveal path as a real draw, so Demo Panel's Reset button lagged
visually for up to `PUBLIC_REVEAL_FALLBACK_MS`. Now sets
`skipNextRevealDelayRef.current = true` around `game.reset()` (same flag
`instantStep()` uses) and calls `commitPublicReveal()` immediately after.
Follow this same pattern for any future instant/demo action that should
never wait on the normal draw-reveal timing.

**Wheel landing is intentionally NOT exact-center and NOT near a peg.**
The landing angle is `targetDigit * HOLE_STEP_DEG + restOffsetDeg`, where
`restOffsetDeg` is randomized within `±(HOLE_STEP_DEG/2 - PEG_SAFE_MARGIN_DEG)`
(`PEG_SAFE_MARGIN_DEG = 6`). This is deliberate physical realism — do not
"fix" this back to an exact-center or exact-ticks landing; that was tried
and reverted per direct feedback. `digitAtSpinAngle()`'s bucket width (±18°
per digit) guarantees the randomized offset still always resolves to the
correct digit.

**Flapper is a tapered paddle shape (SVG `<path>`), not a `<polygon>`
triangle.** Uses its own `flapperGrad-${uid}` radial gradient (cool
steel-white) deliberately distinct from the wheel's warm gold palette, for
contrast. Follow the same per-instance `useId()` suffixing rule from
Section 3 if this gradient is ever touched.

**Right-column swap pattern (BettingPanel ↔ TicketDrawer).** `App.tsx`
desktop layout: left column = `EmojiChat`, middle = `JackpotPanel` +
`Wheel`, right column = `BettingPanel` XOR `TicketDrawer`, swapped based on
a `bettingLocked` boolean lifted into `AppShell` state.

- `BettingPanel` takes an optional `onLockChange` prop and reports its own
  `locked` value (`!isBettingOpen || autoBetActive || hasBetThisRound`) up
  via `useEffect`. It stays MOUNTED (CSS `hidden`, never unmounted) while
  `TicketDrawer` is shown over it — this is required so its internal timers
  and phase-entry effects (which are what eventually flip `locked` back to
  `false`) keep running. Do not conditionally unmount `BettingPanel`.
- `BettingPanel` also takes an optional `onAutoBetChange` prop, reporting
  `{ roundsRemaining, roundsTotal, stop }` (or `null`) whenever its
  internal `autoBet` state changes. `App.tsx` renders a small persistent
  "Auto Bet N/M · Stop" bar ABOVE the swapped area (outside the
  `bettingLocked` hide toggle) using this — this exists specifically
  because Auto Bet's own Stop button lives inside `BettingPanel`, which
  gets hidden the instant autoplay starts (`autoBetActive` → `locked`).
  Without this bar, autoplay is unstoppable once started. Any future
  control the player must always be able to reach regardless of which
  panel is showing should follow this same "lift to a persistent bar
  outside the swap" pattern, not live inside the swapped component.
- Both `onLockChange`/`onAutoBetChange` are wired ONLY into the desktop
  `<BettingPanel>` instance, never the mobile one — mobile's dedicated
  `TICKETS` tab already solves the same problem, and wiring both instances
  would have two independent `BettingPanel`s racing to write the same
  lifted state.

**`GameHistory` and the old "Simulate" block are Demo-Panel-only now.**
`GameHistory` (Draw History / Your History tabs) is intentionally NOT in
the main player-facing layout — mounted inside `DemoPanel.tsx` under a
"Draw & Link History" heading instead, per explicit decision this session.
The old `DemoPanel` "Simulate" panel (jackpot-win / simulated-link buttons)
was removed entirely from the UI — `simulateJackpotWin` and
`createSimulatedTicket` still exist on `ChainsGame`/`useGame.ts`, just
unwired from any button. `MultiplayerSim.tsx` remains an intentionally
unmounted, unreferenced file — do not wire it in; the recent-digits strip
under the Wheel was judged sufficient "live table" signal on its own.

## Final principle

Preserve the CHAINS concept.

Correctness before visual polish.

Small, tested changes before large rewrites.

Build a convincing playable casino game prototype.
