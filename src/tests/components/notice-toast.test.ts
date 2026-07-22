import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import { flushSync } from "svelte";
import { describe, it, expect, vi, afterEach } from "vitest";
import NoticeToast from "$lib/components/notice-toast.svelte";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("NoticeToast (#812, #869)", () => {
  it("renders nothing when there is no feedback", () => {
    render(NoticeToast, { props: { feedback: null, onDismiss: () => {} } });
    expect(screen.queryByTestId("notice-toast")).toBeNull();
  });

  it("shows the feedback text in a polite live region", () => {
    render(NoticeToast, {
      props: { feedback: { text: "Added p in Water to the plot", token: 1 }, onDismiss: () => {} },
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Added p in Water to the plot");
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("auto-dismisses after the duration and calls onDismiss", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(NoticeToast, {
      props: { feedback: { text: "Added series", token: 1 }, onDismiss, durationMs: 3000 },
    });
    expect(screen.getByTestId("notice-toast")).toBeInTheDocument();

    vi.advanceTimersByTime(3000);
    flushSync();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("notice-toast")).toBeNull();
  });

  it("dismisses immediately on close click and cancels the pending auto-dismiss", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(NoticeToast, {
      props: { feedback: { text: "Added series", token: 1 }, onDismiss, durationMs: 3000 },
    });
    await fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("notice-toast")).toBeNull();

    // The auto-dismiss timer must have been cleared, so onDismiss stays at 1
    // even after the original duration elapses.
    vi.advanceTimersByTime(3000);
    flushSync();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("re-shows for a new token even when the text repeats", async () => {
    vi.useFakeTimers();
    const { rerender } = render(NoticeToast, {
      props: {
        feedback: { text: "Added series", token: 1 },
        onDismiss: () => {},
        durationMs: 3000,
      },
    });
    vi.advanceTimersByTime(3000);
    flushSync();
    expect(screen.queryByTestId("notice-toast")).toBeNull();

    await rerender({ feedback: { text: "Added series", token: 2 }, onDismiss: () => {} });
    flushSync();
    expect(screen.getByTestId("notice-toast")).toBeInTheDocument();
  });

  it("hides a visible toast when the parent clears feedback (no stuck toast)", async () => {
    const { rerender } = render(NoticeToast, {
      props: { feedback: { text: "Added series", token: 1 }, onDismiss: () => {} },
    });
    expect(screen.getByTestId("notice-toast")).toBeInTheDocument();

    // The parent hides the toast by nulling the signal (independent of our own
    // dismiss) — it must disappear rather than stay stuck on screen.
    await rerender({ feedback: null, onDismiss: () => {} });
    flushSync();
    expect(screen.queryByTestId("notice-toast")).toBeNull();
  });

  it("uses a custom testId when provided (e.g. the plot page's Add Series toast)", () => {
    render(NoticeToast, {
      props: {
        feedback: { text: "Added series", token: 1 },
        onDismiss: () => {},
        testId: "plot-toast",
      },
    });
    expect(screen.getByTestId("plot-toast")).toBeInTheDocument();
    expect(screen.queryByTestId("notice-toast")).toBeNull();
  });

  it('defaults to bottom placement, and moves to top when position="top" (#869)', () => {
    const { rerender } = render(NoticeToast, {
      props: { feedback: { text: "Added series", token: 1 }, onDismiss: () => {} },
    });
    expect(screen.getByTestId("notice-toast")).toHaveClass("bottom-4");

    rerender({
      feedback: { text: "Basic mode ignores the link's program", token: 2 },
      onDismiss: () => {},
      position: "top",
    });
    flushSync();
    expect(screen.getByTestId("notice-toast")).toHaveClass("top-4");
  });
});
