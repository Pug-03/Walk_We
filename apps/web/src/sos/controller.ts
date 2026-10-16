// SOS press-and-hold → countdown → send, as a plain state machine (no DOM),
// so the brief's rules are unit-tested directly:
//   • release before holdMs → the countdown never starts
//   • cancel during the countdown → nothing is sent
//   • otherwise onSend fires exactly once, when the countdown reaches 0
// Releasing the button during the countdown does NOT cancel: only Cancel
// does, so a shaking hand can't abort a real emergency.

export type SosState = 'idle' | 'holding' | 'countdown' | 'sent' | 'cancelled';

export interface SosOptions {
  holdMs: number;
  countdownS: number;
  onState: (s: SosState) => void;
  /** Hold progress 0..1 (for the ring). */
  onHold?: (progress: number) => void;
  /** Seconds left, each second of the countdown (5, 4, … 1). */
  onTick: (secondsLeft: number) => void;
  onSend: () => void;
  /** Injected for tests. */
  timers?: { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout; now: () => number };
}

export interface SosController {
  press(): void;
  release(): void;
  cancel(): void;
  reset(): void;
  readonly state: SosState;
}

const HOLD_STEP_MS = 50;

export function createSosController(o: SosOptions): SosController {
  const t = o.timers ?? { setTimeout: globalThis.setTimeout.bind(globalThis), clearTimeout: globalThis.clearTimeout.bind(globalThis), now: () => Date.now() };
  let state: SosState = 'idle';
  let timer: ReturnType<typeof setTimeout> | null = null;
  let holdStart = 0;
  let left = 0;

  const set = (s: SosState) => {
    state = s;
    o.onState(s);
  };
  const clear = () => {
    if (timer) t.clearTimeout(timer);
    timer = null;
  };

  const holdStep = () => {
    const p = Math.min(1, (t.now() - holdStart) / o.holdMs);
    o.onHold?.(p);
    if (p >= 1) return startCountdown();
    timer = t.setTimeout(holdStep, HOLD_STEP_MS);
  };

  const startCountdown = () => {
    clear();
    left = o.countdownS;
    set('countdown');
    o.onTick(left);
    const tick = () => {
      left--;
      if (left <= 0) {
        timer = null;
        set('sent');
        o.onSend();
        return;
      }
      o.onTick(left);
      timer = t.setTimeout(tick, 1000);
    };
    timer = t.setTimeout(tick, 1000);
  };

  return {
    get state() {
      return state;
    },
    press() {
      if (state !== 'idle' && state !== 'cancelled' && state !== 'sent') return;
      clear();
      holdStart = t.now();
      set('holding');
      o.onHold?.(0);
      timer = t.setTimeout(holdStep, HOLD_STEP_MS);
    },
    release() {
      if (state !== 'holding') return; // releasing mid-countdown changes nothing
      clear();
      o.onHold?.(0);
      set('idle');
    },
    cancel() {
      if (state !== 'countdown' && state !== 'holding') return;
      clear();
      o.onHold?.(0);
      set('cancelled');
    },
    reset() {
      clear();
      o.onHold?.(0);
      set('idle');
    },
  };
}
