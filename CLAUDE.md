
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

The CHAINS game specification is available in the project knowledge / specification file.

Read it before implementing game mechanics.

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
8. Implement history, help and developer controls.
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

Keep animation timing configurable.

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

## 11. First task

When asked to begin:

- Read the CHAINS specification.
- Inspect the existing codebase.
- Do not rewrite the application.
- Do not build new features yet.
- Report the current state.
- Identify contradictions in the specification.
- Propose a practical implementation plan.

Wait for approval before major architectural changes.

## Final principle

Preserve the CHAINS concept.

Correctness before visual polish.

Small, tested changes before large rewrites.

Build a convincing playable casino game prototype.