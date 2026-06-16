import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { runDebouncedSnapshot } from "$lib/utils/debounced-snapshot";

describe("runDebouncedSnapshot", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("invokes the callback after the delay with the input snapshot", async () => {
    const fn = vi.fn();
    const input = { programId: 1, energies: [10, 20] };

    runDebouncedSnapshot(input, fn, 10);
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0]![0]).toBe(input);
    expect(typeof fn.mock.calls[0]![1]).toBe("function");
  });

  test("defaults to a 300ms debounce", async () => {
    const fn = vi.fn();
    runDebouncedSnapshot(null, fn);

    await vi.advanceTimersByTimeAsync(299);
    expect(fn).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("cleanup before the delay cancels the pending run", async () => {
    const fn = vi.fn();
    const cancel = runDebouncedSnapshot("input", fn, 10);

    cancel();
    await vi.advanceTimersByTimeAsync(10);
    expect(fn).not.toHaveBeenCalled();
  });

  test("latest input wins: a superseded run never executes", async () => {
    const runs: string[] = [];
    const start = (input: string) =>
      runDebouncedSnapshot(
        input,
        (i) => {
          runs.push(i);
        },
        10,
      );

    const cancelA = start("A");
    cancelA(); // effect re-ran with fresh inputs before "A" fired
    const cancelB = start("B");

    await vi.advanceTimersByTimeAsync(10);
    expect(runs).toEqual(["B"]);
    cancelB();
  });

  test("isCancelled() reports true after cleanup so stale async results are dropped", async () => {
    let releaseService!: () => void;
    const serviceReady = new Promise<void>((resolve) => (releaseService = resolve));
    const published: string[] = [];

    const cancel = runDebouncedSnapshot(
      "stale",
      async (input, isCancelled) => {
        await serviceReady; // mimic `await getService()`
        if (isCancelled()) return;
        published.push(input);
      },
      10,
    );

    await vi.advanceTimersByTimeAsync(10); // timer fires; callback now awaits the service
    cancel(); // a newer input arrived while the async work was in flight
    releaseService();
    await vi.advanceTimersByTimeAsync(0); // flush the awaited continuation

    expect(published).toEqual([]);
  });

  test("publishes results when never cancelled", async () => {
    const published: string[] = [];
    runDebouncedSnapshot(
      "fresh",
      async (input, isCancelled) => {
        await Promise.resolve();
        if (isCancelled()) return;
        published.push(input);
      },
      10,
    );

    await vi.advanceTimersByTimeAsync(10);
    expect(published).toEqual(["fresh"]);
  });
});
