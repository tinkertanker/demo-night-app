import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createIdleMonitor } from "./idleMonitor";

function fakeClock() {
  let now = 0;
  let nextId = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  return {
    now: () => now,
    setTimeout: (callback: () => void, ms: number) => {
      timers.set(++nextId, { at: now + ms, callback });
      return nextId;
    },
    clearTimeout: (id: unknown) => {
      timers.delete(id as number);
    },
    pending: () => timers.size,
    advance(ms: number) {
      const target = now + ms;
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, timer]) => timer.at <= target)
          .sort(([, a], [, b]) => a.at - b.at)[0];
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].callback();
      }
      now = target;
    },
  };
}

describe("createIdleMonitor", () => {
  it("goes idle after the timeout without activity", () => {
    const clock = fakeClock();
    const monitor = createIdleMonitor(1_000, clock);
    monitor.start();
    clock.advance(999);
    assert.equal(monitor.isIdle(), false);
    clock.advance(1);
    assert.equal(monitor.isIdle(), true);
    assert.equal(clock.pending(), 0);
  });

  it("activity pushes the deadline back without extra timers", () => {
    const clock = fakeClock();
    const monitor = createIdleMonitor(1_000, clock);
    monitor.start();
    clock.advance(600);
    monitor.markActivity();
    monitor.markActivity();
    assert.equal(clock.pending(), 1);
    clock.advance(600);
    assert.equal(monitor.isIdle(), false);
    clock.advance(399);
    assert.equal(monitor.isIdle(), false);
    clock.advance(1);
    assert.equal(monitor.isIdle(), true);
  });

  it("activity while idle resumes and notifies listeners", () => {
    const clock = fakeClock();
    const monitor = createIdleMonitor(1_000, clock);
    const changes: boolean[] = [];
    monitor.subscribe((idle) => changes.push(idle));
    monitor.start();
    clock.advance(1_000);
    monitor.markActivity();
    assert.equal(monitor.isIdle(), false);
    clock.advance(1_000);
    assert.deepEqual(changes, [true, false, true]);
  });

  it("stop cancels the pending check", () => {
    const clock = fakeClock();
    const monitor = createIdleMonitor(1_000, clock);
    monitor.start();
    monitor.stop();
    clock.advance(5_000);
    assert.equal(monitor.isIdle(), false);
    assert.equal(clock.pending(), 0);
  });
});
