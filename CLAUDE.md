
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

Keep animation timing configurable (`DRAW_ANIMATION_DURATION` in `constants.ts`; currently 5s , betting duration unchanged). SVG render size increased to 340×340 (was 260×260) for visual presence — geometry/viewBox math is untouched, only the rendered `width`/`height`.

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


## 14. Patterns established this session (chain-circle UI, mobile footer, dual-mount bet lock)

**Active Links redesigned as a connected chain of circles, not chip rows.**
New file `src/components/ChainLinks.tsx` exports `ChainCircle` (single circle,
states: `pending` / `matched` / `failed` / `current`) and `LinkChain` (renders
a ticket's full base sequence + jackpot sequence as ONE continuous chain,
divided by a small "JP" label). Jackpot digits are now ALWAYS visible in the
chain (grayed/pending before qualification starts), not just shown once
qualification begins — this is a deliberate spec extension beyond Section 9/14,
approved this session. `Ticket.tsx`'s old `DigitChip`/`baseChipState`/
`jackpotChipState`/`CheckMark`/`CrossMark` were deleted (replaced by
`LinkChain`) — do not recreate them; extend `ChainLinks.tsx` instead if the
chain visual needs new states.

**`ChainLinks.tsx` is now the single source of truth for link-progress
visuals** — used by both `TicketCard` (desktop drawer, `size="md"`) and
`MobileFooter` (sticky footer strip, `size="xs"`, per CLAUDE.md "no duplicate
components" rule). Any future surface showing link progress (e.g. a future
history view) should reuse `LinkChain`, not reimplement chip rendering.

**Mobile bottom nav replaced.** The old BET/TABLE/LINKS tab bar (non-functional
per user report) is gone. `App.tsx`'s mobile `<main>` is now three full-width
snap-scroll panels (`overflow-x-auto snap-x snap-mandatory`, refs
`betPanelRef`/`tablePanelRef`) instead of conditionally-rendered tab content.
Phase changes now `scrollIntoView` the relevant panel (BETTING_OPEN -> bet
panel, anything else -> table panel) instead of setting tab state. New file
`src/components/MobileFooter.tsx` is a sticky bar with: sound toggle (left),
help button (left), a live horizontal-scroll strip of `LinkChain` (`size="xs"`)
for every active ticket (center), and a chat button (right) that opens
`EmojiChat` in a slide-up sheet. `EmojiChat.tsx` itself is unchanged — it's
just rendered inside a modal wrapper now on mobile, still rendered directly in
the desktop left column as before (two render sites, same component, same
localStorage-backed state — this is fine, `EmojiChat` has no per-instance lock
state unlike `BettingPanel`, see next entry).

**No page-dot / progress indicator added yet for the 3 swipeable mobile
panels** — flagged as a known gap, not forgotten.

**Fixed: desktop + mobile could each place an independent bet in the same
round.** Root cause: `App.tsx`'s desktop and mobile `<main>` blocks are BOTH
always mounted (Tailwind `hidden`/`lg:hidden` is visibility-only, same
dual-mount trap `<Wheel />` already had per Section 3/13's original entry) —
so the desktop and mobile `<BettingPanel>` were two separate component
instances, each with its own local `hasBetThisRound` state. Fixed by lifting
the lock into `useGame.ts`: `hasBetThisRound` is now engine-round-scoped
state inside `GameProvider` (reset via a `useEffect` keyed on
`gameState.phase === 'BETTING_OPEN'`, set by the `placeBet` wrapper on
success), exposed on `UseGameValue`, and consumed by `BettingPanel` instead
of a local `useState`. **`autoBet` is still per-instance** (desktop-only,
unchanged from the existing "only wired to desktop `BettingPanel`" design) —
same class of risk, smaller blast radius, explicitly NOT fixed this session,
pending a decision on whether Auto Bet should also become instance-shared or
stay desktop-exclusive by design.

**Fixed: flapper double-click ("pinball") on landing.** `Wheel.tsx`'s `land()`
previously called `fireFlapperClick()` unconditionally right after the final
approach-step's own boundary-crossing click had already fired moments
earlier, producing two rapid clicks read as a bounce. Removed the
`fireFlapperClick()` call from `land()` — `playDrawSettle()` alone now
carries the landing sound; the mechanical ticking during approach is still
handled entirely by the boundary-crossing clicks in the step loop (unchanged).
If a "pinball" feel reappears, look at the step loop's `t < 1` guard and
`digitAtSpinAngle` boundary math (Section 13's original entry) before
re-adding a click here — do not add a second click back to `land()`.

**Open/minor issues carried into next session (explicitly deferred, not
forgotten):**
- `autoBet` per-instance desktop/mobile inconsistency (see above).
- No swipe-position indicator on mobile's 3 panels.
- Possible remaining polish items on chain-circle sizing/spacing at `xs` size
  in the footer strip on very narrow viewports — not yet tested below ~360px.

## 15. Patterns established this session (Active Links redesign, wheel texture, mobile fixes)

**Link digit color now matches the wheel/digit-pad palette.** `ChainCircle`
in `ChainLinks.tsx` pulls its background tint from `DIGIT_COLORS` (the same
shared array `Wheel.tsx` and `BettingPanel.tsx`'s digit pad already used) at
every progress state — state (pending/current/matched/failed) is expressed
via border color + glow/pulse only, never by overriding the digit's own
color. Any future circle/chip UI showing a digit should follow this same
split (identity color = fill, progress state = border) rather than
reinventing a separate palette.

**"Active Links" fits without scrolling by design, not by accident.**
`TicketDrawer`'s card list is a `flex flex-col` container where each
`TicketCard` sits in a `min-h-0 flex-1` wrapper — this is what makes up to
~8 concurrent links (the realistic max under the existing 3-per-sequence /
3-tier concurrency rules) divide the available vertical space evenly with
no scrollbar, and degrade to thinner rows rather than breaking past 8. Do
not reintroduce a fixed card height + `overflow-y-auto` here; that was the
pre-redesign approach and is exactly what this was built to replace. The
outer `overflow-hidden` wrappers in `App.tsx` (both the desktop swap area
and the mobile links panel) are required for this to actually reach full
height — if you add a new sibling above/below `TicketDrawer` in either of
those containers, make sure it doesn't reintroduce a forced scroll.

**Jackpot-strip-vs-inline was tried both ways this session; inline won.**
A once-per-round shared jackpot readout (rendered once above the card
list) was built and then explicitly reverted once the 8-card layout freed
up enough per-card width — see the IMPLEMENTATION LOG entry. `LinkChain`'s
`showJackpot` prop and its `flex flex-wrap` fallback exist specifically so
each card can independently drop jackpot digits to a second line on the
rare narrow-card case, rather than overflowing. Do not re-derive a shared
strip without confirming first — it's a deliberate reversal, not something
that was simply never built.

**Wheel texture is intentionally two SEPARATE fixed (non-rotating) layers,
not wedge-level.** (1) A brushed-metal rim ring using an SVG
`feTurbulence`+`feColorMatrix` filter, stroked between `RIM_OUTER_R` and
`RIM_INNER_R`. (2) A full-disc specular sheen — a single low-opacity
(~0.14 peak) wide radial-gradient circle at `r={RIM_INNER_R}`, placed
directly after the rotating `<g>` closes so it overlays the spinning disc
without itself rotating. A smaller/offset specular ellipse was tried first
and explicitly rejected as looking like a UI glow rather than ambient
light — do not shrink the specular layer back down. Wedge-level texture
(noise on the individual color fills) was discussed and deliberately
deferred as a lower-priority/higher-risk follow-up, not forgotten.

**Flapper is now smaller/thinner/darker — this is the approved final
look**, not a placeholder. Gradient stops are gunmetal (light gray -> mid
gray -> near-black), down from a prior near-white/steel palette. Follow
the existing per-instance `flapperGrad-${uid}` id-suffixing rule (Section 3)
if this is ever touched again.

**Mobile now shows balance (via `GameHeader`, `lg:hidden`) and the table
chat sheet opens to a real `80dvh` flex-column height with safe-area
bottom padding** — both were gaps found by hands-on mobile testing, not
spec omissions. If any future bottom-sheet-style mobile overlay is added,
follow the same `h-[80dvh] flex flex-col overflow-hidden` +
`pb-[env(safe-area-inset-bottom,0px)]` pattern rather than a bare
`max-h-*` block.

**MobileFooter / DemoPanel
- Fixed `DemoPanel` overlapping `MobileFooter` on mobile and intercepting footer taps.
- `DemoPanel` now sits above the mobile footer and returns to `bottom-0` on `lg+`.
- Increased mobile footer button hit targets from 36px to 44px.
- Added safe-area bottom padding for mobile devices.

**Table Chat
- Fixed chat sheet layout so `EmojiChat` has a properly bounded flex container.
- Message list now scrolls within the available space while emoji controls and input remain pinned/reachable.
- Increased chat dialog z-index to `z-[55]` so it sits above normal modals but below jackpot celebration overlays.
- No changes were required to `EmojiChat.tsx`.


## 16. Patterns established this session (control cluster, Demo Panel as button, Bet History, LOW multi-pick)

Controls consolidated into one cluster — LeftColumnControls.tsx is GONE. Help / Sound / Bet History / Demo Panel / Balance now all live together: desktop in GameHeader's top-right cluster (roulette-style), mobile as icon buttons in MobileFooter (plus Chat). Do not recreate LeftColumnControls.tsx or reintroduce a second scattered-controls layout — if a new global control is needed (e.g. a future settings button), add it to this same cluster in both GameHeader and MobileFooter, not as a new standalone component.

Mobile active-links display moved from MobileFooter to GameHeader. GameHeader now renders a full-width row of LinkChain (size="xs") for every active ticket directly below its top bar, mobile-only (lg:hidden). MobileFooter no longer shows any ticket/link data at all — it's a pure utility bar. If a future change needs to show link progress on mobile, extend GameHeader's row, don't put it back in the footer.

Balance renders exactly once per breakpoint. Desktop: inside GameHeader's cluster. Mobile: GameHeader's own lg:hidden block. There is no LeftColumnControls copy anymore. If you ever see Balance imported into a third location, that's a bug — check for accidental duplication before shipping.

DemoPanel is now a controlled component, not self-toggling. It takes isOpen: boolean and renders null when closed — no more internal useState for open/collapsed, no more persistent docked toggle-bar sitting above the mobile footer at all times. State (demoOpen) is lifted into AppShell in App.tsx, opened via a Demo button in the same cluster as Help/History (both breakpoints), same lifting pattern already used for helpOpen/historyOpen. This was done specifically because the old persistent bar depended on a hardcoded mobile bottom-offset (bottom-[calc(3.75rem+env(safe-area-inset-bottom,0px))]) that had to be manually kept in sync with MobileFooter's height — since the panel no longer persists when closed, that fragility is gone. If DemoPanel's open-state layout changes in the future (e.g. new content that changes its rendered height while open), there's no longer a closed-state offset to worry about, but double check the open-state positioning still reads correctly on mobile.

History icon is a specific user-supplied glyph — don't swap it back to a generic clock. GameHeader.tsx's HistoryIcon() renders a circular counter-clockwise restore-arrow combined with clock hands (hour+minute) inside the circle — matches a specific reference image the user provided. If this needs to change again, get an explicit reference first rather than substituting a different "history-ish" icon.

Bet History is real now — GameHistory.tsx was NOT actually wired in before, despite what an earlier IMPLEMENTATION LOG entry claimed. A prior session's log said GameHistory was mounted inside DemoPanel under a "Draw & Link History" heading. On fresh inspection this session, that was false — the file existed but was never imported anywhere, same situation as MultiplayerSim.tsx. It is now genuinely mounted, via the new BetHistoryModal.tsx (opened from the control cluster's History button), reusing GameHistory.tsx essentially unmodified (one additive defaultTab prop, defaulting to the original 'GLOBAL' behavior so nothing else that might call it without the prop changes behavior). Lesson for future sessions: don't fully trust an IMPLEMENTATION LOG claim about where something is mounted without verifying the actual current file/import graph first — logs can drift from reality across sessions, same caution CLAUDE.md §12 already gives for "do not assume a stale prior-session description of App.tsx's layout is current," now confirmed to apply to other files too, not just App.tsx.

Session Net total in Bet History is pure derived display math, kept OUT of the engine on purpose. BetHistoryModal.tsx computes Σ (totalReturn - stake) across history (resolved tickets) inline, client-side. Do not add a sessionNet field to GameState/ChainsGame for this — per CLAUDE.md §6's "small targeted edits" principle and to keep the engine free of pure-presentation concerns, this kind of derived total belongs in the component that displays it, not in engine state. Follow this same pattern for any future purely-derived stat (e.g. win rate, biggest win) unless there's a specific reason the engine itself needs to know it.

Active Links cards now have a height CAP, not just a stretch. TicketDrawer's per-card wrapper is min-h-0 flex-1 max-h-[104px] (was min-h-0 flex-1 with no cap). This fixes oversized/awkwardly-centered cards when only 1-2 links are active, while leaving the existing ~8-card-no-scrollbar behavior at the high end untouched (at that density the cap never engages). The 104px figure is an ESTIMATE, not yet pixel-verified against real rendering — treat it as a tunable constant that may need a small adjustment once actually seen, not a fixed requirement. Combo-group visual bundling (grouping same-comboGroupId tickets into one visual block) was explicitly discussed and rejected as out of scope for this fix — do not add it without a fresh explicit ask, this was a considered decision, not an oversight.

LOW multi-pick — new mechanic, engine relaxed via approved "Option B." Players can now batch up to 3 independent $1 LOW picks (single distinct digits, each its own ticket) into ONE atomic submit action, via a new "+ Add another pick" UI in BettingPanel.tsx — visually and interactionally DISTINCT from the Combo toggle (Combo permutes one typed sequence; multi-pick batches several independently-chosen picks). This required relaxing ChainsGame.placeBetInternal()'s previous hard length-1 cap on BetRequest.selections: a request may now carry multiple selections as long as they all share the same tier (the "one tier per round" rule itself is unchanged, just restated as a tier-uniqueness check across the whole selections array rather than an implicit single-element assumption). This was flagged to the user as a betting-request-shape change per CLAUDE.md §2 BEFORE implementation, and approved explicitly ("Option B") over the alternative of faking atomicity with multiple client-side placeBet() calls.

Atomicity is preserved exactly like Combo already had: ALL validation (per-selection digit/jackpot validation, concurrency-cap check — now also counting duplicate picks WITHIN the same batch, not just against already-active tickets — and balance check) runs before ANY ticket is created or balance touched. A failing batch creates zero tickets.
A request mixing isCombo: true with more than one selection is explicitly rejected — Combo and multi-pick must never combine in one request, to keep the two mechanics unambiguous.
Multi-pick tickets get comboGroupId: null / comboDigits: null — NOT grouped like combo possibilities are. Same "no bundling" decision as the Active Links card-cap entry above.
MAX_LOW_PICKS = 3 lives in BettingPanel.tsx (UI layer), NOT in constants.ts — it's a UI batching ceiling, not a payout/engine rule. Chosen to match MAX_CONCURRENT_TICKETS_PER_SEQUENCE and the existing 3-digit-slot ceiling HIGH already uses, so "max 3" is one consistent rule across the whole betting UI rather than a LOW-specific new number.
Confirmed NO changes to BASE_SEQUENCE_LENGTH.LOW, TIER_TO_JACKPOT, JACKPOT_SEQUENCE_LENGTH, or any payout math — this is purely a batching/UI mechanic on top of unchanged 1-digit LOW economics.

Known pre-existing gap surfaced (not caused) by the multi-pick work — flagged, not fixed: engine.test.ts has a test ("rejects a second bet with a different tier placed in the same still-open round") that calls ChainsGame.placeBet() twice directly and expects the second call (different tier) to fail. No engine-level state actually enforces that — the real lock (hasBetThisRound) lives only in useGame.ts's React layer (see the Section 14/15 entries above re: the desktop/mobile dual-mount bet-lock fix). This test's premise appears to predate that fix, or was never actually engine-enforced. Needs a decision in a future session — either correct the test's premise (accept that engine-level placeBet calls don't enforce cross-call tier-locking on their own) or add genuine engine-side locking if that's actually wanted. Do not "fix" this silently by adding engine-level round-locking as a side effect of an unrelated future change — it's a deliberate flag for a dedicated decision.

## 17. Patterns established this session (balance relocation, phase status
component, inline tickets-while-betting fix, betting panel restructure)

**Balance now lives in MobileFooter on mobile, not GameHeader.** This
directly supersedes a claim in Section 16 ("Balance renders exactly once
per breakpoint... Mobile: GameHeader's own lg:hidden block"). That is now
FALSE — check the actual current file before trusting it, same caution
Section 16 itself gave about GameHistory. Current truth: desktop =
GameHeader's cluster (unchanged), mobile = MobileFooter, right-aligned
after a flex-1 spacer. Still exactly one instance per breakpoint, just a
different location on mobile.

**Phase/countdown display is no longer part of Wheel.tsx.** New
`PhaseStatus.tsx` component, mounted three times (desktop right column,
mobile bet panel, mobile tickets panel), driven by a locked/timeRemaining
prop pair rather than reading phase directly. Desktop passes the existing
lifted `bettingLocked`; mobile computes its own `mobileLocked` in App.tsx
since there's no per-instance callback wired on the mobile BettingPanel.
Wheel.tsx now renders ONLY the wheel graphic + recent-digits strip —
no phase bar, no Live/draw-index bar. Do not add either back to Wheel.tsx;
extend PhaseStatus or add a new small component instead, following this
same "phase chrome lives outside Wheel" pattern.

**Active tickets must be visible WHENEVER the betting panel is visible,
on both breakpoints.** This was a real bug (not just polish) surfaced by
testing: Section 6's rebet-while-qualifying rule means BettingPanel can
be interactable again while other tickets are still live, but the old
desktop XOR-swap and mobile swipe-only-tickets-panel both hid active
tickets in exactly that situation. Fix: TicketDrawer is rendered INLINE
under BettingPanel on both breakpoints (conditional on
activeTickets.length > 0), IN ADDITION to its pre-existing standalone
mounts (desktop's post-lock swap slot, mobile's dedicated tickets swipe
panel). This redundancy is intentional — do not remove one mount thinking
the other makes it redundant; they serve different scroll positions the
player is at.

**LOW multi-pick input reuses the single DigitPad, does not spawn a
second one.** `EditTarget` (in BettingPanel.tsx) gained a `{ kind:
'lowPick' }` variant. "+ Add another pick" calls `focusAddPick()`, which
just retargets the SAME DigitPad already on screen — a digit press there
appends to `lowPicks` state and clears the target. There is no longer a
second inline digit grid anywhere in BettingPanel. If extending
EditTarget further (e.g. for a future input mode), follow this same
"retarget the existing pad" pattern rather than building parallel pads —
Section 3's dual-mount SVG-id warning is a different problem, but the
underlying "don't duplicate an interactive surface" principle is the same
spirit.

**Auto Bet is now preset-based, not a stepper.** The old +/- stepper
(`autoBetRounds` state, `MIN_AUTO_BET_ROUNDS`/`MAX_AUTO_BET_ROUNDS`
constants from Section 16's own log entry) is GONE — fully replaced by
four fixed preset buttons (5/10/25/50) that appear when "Auto Bet" is
tapped once. Tapping a preset places the bet AND starts autoplay in one
action for that exact count. `handleStartAutoBet(rounds: number)` now
takes the count as a parameter instead of reading component state. Do not
reintroduce a numeric stepper without discussing first — this was a
deliberate space-saving simplification, not an oversight.

**Submit button label carries the dollar amount now; there's no separate
"Total Stake" readout row.** The sticky submit button's own text is one
of: "Select Digits" (disabled/no tier yet), "Place $X Bet", "Place N Bets
— $X", or "Place $X Combo Bet". If a future change needs the numeric
stake surfaced elsewhere (e.g. for a screen-reader-only string or a
tooltip), pull it from the same `totalStake` value already computed in
the component — don't reintroduce the old separate label+amount pair in
the visible layout.

**Loss sound removed, not the loss detection.** `playLoss()` is no longer
invoked in `useGame.ts`'s `applyTicketSounds`, but ticket status changes
to LOST/JACKPOT_LOST are still fully tracked (the sound call was simply
deleted from that branch, which now falls through with no side effect).
`playLoss` itself still exists in `utils/audio.ts`, unused — don't delete
the function, and don't reconnect it without being asked again.

## Final principle

Preserve the CHAINS concept.

Correctness before visual polish.

Small, tested changes before large rewrites.

Build a convincing playable casino game prototype.
