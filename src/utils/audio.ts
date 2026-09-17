// ============================================================================
// CHAINS — Lightweight Web Audio Synthesizer
// Generates every sound procedurally via oscillators + gain envelopes — no
// external audio files. Safe to import anywhere: the AudioContext is only
// ever created lazily on first real use, inside the browser, so this module
// has no effect if imported in a non-browser environment.
// ============================================================================

type ToneShape = 'sine' | 'square' | 'sawtooth' | 'triangle';

// `AudioContext` is declared by TypeScript's DOM lib as a global `declare
// var`, not as a member of the `Window` interface — so it must be read off
// the global scope directly rather than off a `window`-typed object (which
// would fail to compile under strict mode). `webkitAudioContext` has no
// ambient type at all (it's a vendor-prefixed legacy fallback for older
// Safari), so it's read via an explicit narrow cast instead.
interface LegacyWebkitWindow {
  webkitAudioContext?: typeof AudioContext;
}

let audioContext: AudioContext | null = null;
let audioEnabled = true;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  const AudioContextCtor: typeof AudioContext | undefined =
    typeof AudioContext !== 'undefined' ? AudioContext : (window as LegacyWebkitWindow).webkitAudioContext;
  if (!AudioContextCtor) return null;

  // Read-modify-write through a local `const` (rather than narrowing the
  // outer `let audioContext` in place) so it's always provably non-null at
  // the point of use, regardless of how the compiler's control-flow
  // analysis treats a module-scoped mutable binding.
  const ctx = audioContext ?? new AudioContextCtor();
  audioContext = ctx;

  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

/** Enables or mutes all CHAINS sound effects. Also proactively (re)creates /
 * resumes the AudioContext on enable, since browsers require it to be
 * created or resumed from within a user gesture. Not exported — nothing
 * outside this module needs to explicitly set on/off, only toggle it (see
 * toggleAudioEnabled below), which is what GameHeader's mute button uses. */
function setAudioEnabled(enabled: boolean): void {
  audioEnabled = enabled;
  if (enabled) {
    getAudioContext();
  }
}

export function isAudioEnabled(): boolean {
  return audioEnabled;
}

export function toggleAudioEnabled(): boolean {
  setAudioEnabled(!audioEnabled);
  return audioEnabled;
}

interface ToneOptions {
  frequency: number;
  durationMs: number;
  shape?: ToneShape;
  gain?: number;
  delayMs?: number;
  /** If set, the oscillator glides from `frequency` to this value over the
   * tone's duration, using an exponential ramp. */
  frequencyGlideTo?: number;
}

function playTone(options: ToneOptions): void {
  if (!audioEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const { frequency, durationMs, shape = 'sine', gain = 0.15, delayMs = 0, frequencyGlideTo } = options;
  const startTime = ctx.currentTime + delayMs / 1000;
  const duration = durationMs / 1000;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = shape;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (frequencyGlideTo !== undefined) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, frequencyGlideTo), startTime + duration);
  }

  // Simple attack/decay envelope: ramp up fast, decay exponentially to
  // (near) silence, which avoids the audible "click" of a hard stop.
  gainNode.gain.setValueAtTime(0.0001, startTime);
  gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.012);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

/** Very short, quiet tick — played on every rapid digit swap while the
 * wheel is spinning. */
export function playTick(): void {
  playTone({ frequency: 720, durationMs: 35, shape: 'square', gain: 0.045 });
}

/** Slightly heavier thunk played the instant the wheel settles on the
 * actual drawn digit. */
export function playDrawSettle(): void {
  playTone({ frequency: 300, durationMs: 170, shape: 'triangle', gain: 0.18, frequencyGlideTo: 170 });
}

/** Low descending buzz when a ticket (base or jackpot) loses. */
export function playLoss(): void {
  playTone({ frequency: 220, durationMs: 260, shape: 'sawtooth', gain: 0.1, frequencyGlideTo: 90 });
}

/** Warm three-note ascending chime on a base win. */
export function playBaseWin(): void {
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    playTone({ frequency: freq, durationMs: 220, shape: 'sine', gain: 0.16, delayMs: i * 90 });
  });
}

/** Big five-note ascending fanfare (with a sub-octave layer) on a
 * progressive jackpot win. */
export function playJackpotFanfare(): void {
  const sequence = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  sequence.forEach((freq, i) => {
    playTone({ frequency: freq, durationMs: 380, shape: 'triangle', gain: 0.2, delayMs: i * 120 });
    playTone({ frequency: freq / 2, durationMs: 380, shape: 'sine', gain: 0.1, delayMs: i * 120 });
  });
}

/** Soft neutral click for general UI interactions (digit pad, demo panel
 * buttons, toggles). */
export function playUiClick(): void {
  playTone({ frequency: 900, durationMs: 28, shape: 'square', gain: 0.04 });
}

// Browsers only allow an AudioContext to resume inside a real user gesture.
// If the first thing that tries to play a sound is an automatic engine
// event (not a click), the context gets created suspended and stays that
// way forever. Unlocking it on the very first gesture anywhere — rather
// than relying on whichever control happens to be clicked first — fixes
// that regardless of what the player interacts with first.
if (typeof window !== 'undefined') {
  const unlockOnFirstGesture = () => {
    getAudioContext();
    window.removeEventListener('pointerdown', unlockOnFirstGesture);
    window.removeEventListener('keydown', unlockOnFirstGesture);
  };
  window.addEventListener('pointerdown', unlockOnFirstGesture, { once: true });
  window.addEventListener('keydown', unlockOnFirstGesture, { once: true });
}