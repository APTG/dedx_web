import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { describe, it, expect, vi, afterEach } from "vitest";
import PlotToast from "$lib/components/plot-toast.svelte";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("PlotToast (#812)", () => {
  it("renders nothing when there is no feedback", () => {
    render(PlotToast, { props: { feedback: null, onDismiss: () => {} } });
    expect(screen.queryByTestId("plot-toast")).toBeNull();
  });

  it("shows the feedback text in a polite live region", () => {
    render(PlotToast, {
      props: { feedback: { text: "Added p in Water to the plot", token: 1 }, onDismiss: () => {} },
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Added p in Water to the plot");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("auto-dismisses after the duration and calls onDismiss", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(PlotToast, {
      props: { feedback: { text: "Added series", token: 1 }, onDismiss, durationMs: 3000 },
    });
    expect(screen.getByTestId("plot-toast")).toBeInTheDocument();

    vi.advanceTimersByTime(3000);
    flushSync();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("plot-toast")).toBeNull();
  });

  it("dismisses immediately on close click and cancels the pending auto-dismiss", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(PlotToast, {
      props: { feedback: { text: "Added series", token: 1 }, onDismiss, durationMs: 3000 },
    });
    await fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("plot-toast")).toBeNull();

    // The auto-dismiss timer must have been cleared, so onDismiss stays at 1
    // even after the original duration elapses.
    vi.advanceTimersByTime(3000);
    flushSync();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("re-shows for a new token even when the text repeats", async () => {
    vi.useFakeTimers();
    const { rerender } = render(PlotToast, {
      props: {
        feedback: { text: "Added series", token: 1 },
        onDismiss: () => {},
        durationMs: 3000,
      },
    });
    vi.advanceTimersByTime(3000);
    flushSync();
    expect(screen.queryByTestId("plot-toast")).toBeNull();

    await rerender({ feedback: { text: "Added series", token: 2 }, onDismiss: () => {} });
    flushSync();
    expect(screen.getByTestId("plot-toast")).toBeInTheDocument();
  });

  it("hides a visible toast when the parent clears feedback (no stuck toast)", async () => {
    const { rerender } = render(PlotToast, {
      props: { feedback: { text: "Added series", token: 1 }, onDismiss: () => {} },
    });
    expect(screen.getByTestId("plot-toast")).toBeInTheDocument();

    // The parent hides the toast by nulling the signal (independent of our own
    // dismiss) — it must disappear rather than stay stuck on screen.
    await rerender({ feedback: null, onDismiss: () => {} });
    flushSync();
    expect(screen.queryByTestId("plot-toast")).toBeNull();
  });
});
