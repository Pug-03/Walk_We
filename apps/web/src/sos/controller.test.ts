import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSosController, type SosState } from './controller.ts';

// Brief §11: "SOS: cancel within 5 s → nothing sent; release before 1 s →
// countdown never starts".

function setup() {
  const states: SosState[] = [];
  const ticks: number[] = [];
  const onSend = vi.fn();
  const c = createSosController({
    holdMs: 1000,
    countdownS: 5,
    onState: (s) => states.push(s),
    onTick: (n) => ticks.push(n),
    onSend,
    timers: { setTimeout, clearTimeout, now: () => Date.now() },
  });
  return { c, states, ticks, onSend };
}

describe('SOS controller', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('release before 1 s → the countdown never starts', () => {
    const { c, states, ticks, onSend } = setup();
    c.press();
    vi.advanceTimersByTime(900);
    c.release();
    vi.advanceTimersByTime(10_000);
    expect(states).not.toContain('countdown');
    expect(ticks).toEqual([]);
    expect(onSend).not.toHaveBeenCalled();
    expect(c.state).toBe('idle');
  });

  it('cancel within 5 s → nothing is sent', () => {
    const { c, onSend, ticks } = setup();
    c.press();
    vi.advanceTimersByTime(1000);
    expect(c.state).toBe('countdown');
    vi.advanceTimersByTime(4900); // 4.9 s into the countdown
    c.cancel();
    vi.advanceTimersByTime(10_000);
    expect(onSend).not.toHaveBeenCalled();
    expect(c.state).toBe('cancelled');
    expect(ticks).toEqual([5, 4, 3, 2, 1]);
  });

  it('hold 1 s and wait 5 s → sends exactly once, ticking every second', () => {
    const { c, onSend, ticks, states } = setup();
    c.press();
    vi.advanceTimersByTime(1000);
    vi.advanceTimersByTime(5000);
    vi.advanceTimersByTime(10_000);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(ticks).toEqual([5, 4, 3, 2, 1]);
    expect(states).toEqual(['holding', 'countdown', 'sent']);
  });

  it('letting go during the countdown does not cancel it (only Cancel does)', () => {
    const { c, onSend } = setup();
    c.press();
    vi.advanceTimersByTime(1100);
    c.release();
    vi.advanceTimersByTime(6000);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('a second press during the countdown is ignored', () => {
    const { c, onSend } = setup();
    c.press();
    vi.advanceTimersByTime(1000);
    c.press();
    vi.advanceTimersByTime(6000);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});
