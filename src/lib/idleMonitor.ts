type Clock = {
  now: () => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (id: unknown) => void;
};

const defaultClock: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export type IdleMonitor = ReturnType<typeof createIdleMonitor>;

// Reports idle once `timeoutMs` passes without markActivity(). Activity only
// records a timestamp; the single pending timer re-checks it when it fires.
export function createIdleMonitor(timeoutMs: number, clock = defaultClock) {
  let lastActivity = clock.now();
  let idle = false;
  let timer: unknown = null;
  let running = false;
  const listeners = new Set<(idle: boolean) => void>();

  function setIdle(next: boolean) {
    if (idle === next) return;
    idle = next;
    listeners.forEach((listener) => listener(idle));
  }

  function schedule(ms: number) {
    timer = clock.setTimeout(check, ms);
  }

  function check() {
    timer = null;
    const remaining = lastActivity + timeoutMs - clock.now();
    if (remaining > 0) {
      schedule(remaining);
    } else {
      setIdle(true);
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      if (!idle) schedule(Math.max(0, lastActivity + timeoutMs - clock.now()));
    },
    stop() {
      running = false;
      if (timer !== null) clock.clearTimeout(timer);
      timer = null;
    },
    markActivity() {
      lastActivity = clock.now();
      if (idle) {
        setIdle(false);
        if (running) schedule(timeoutMs);
      }
    },
    isIdle: () => idle,
    subscribe(listener: (idle: boolean) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
