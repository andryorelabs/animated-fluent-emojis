/**
 * Runs an async task, queueing it when the concurrency limit is reached.
 */
export type Limiter = <Result>(task: () => Promise<Result>) => Promise<Result>;

/**
 * Creates a limiter that runs at most `limit` tasks at the same time. Tasks
 * start in call order; a failing task releases its slot and rejects only its
 * own promise.
 * @param limit The maximum number of tasks in flight, at least 1.
 * @returns A function that runs a task under the limit.
 */
export function createLimiter(limit: number): Limiter {
  if (!Number.isSafeInteger(limit) || limit < 1) {
    throw new Error(`Invalid concurrency limit ${String(limit)}`);
  }
  let active = 0;
  const waiting: (() => void)[] = [];
  return async (task) => {
    if (active >= limit) {
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
      });
    } else {
      active += 1;
    }
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active -= 1;
    }
  };
}
