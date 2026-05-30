import { describe, it, expect, vi, afterEach } from "vitest";
import { keyboardOffset, useVisualViewport } from "$lib/utils/visual-viewport";

describe("keyboardOffset", () => {
  it("returns the gap between the layout and visual viewport bottoms", () => {
    // 844px layout, keyboard shrinks visual viewport to 500px, no scroll offset.
    expect(keyboardOffset({ height: 500, offsetTop: 0 }, 844)).toBe(344);
  });

  it("accounts for offsetTop (page scrolled under the keyboard)", () => {
    expect(keyboardOffset({ height: 500, offsetTop: 20 }, 844)).toBe(324);
  });

  it("clamps to zero when the keyboard is closed", () => {
    expect(keyboardOffset({ height: 844, offsetTop: 0 }, 844)).toBe(0);
    // Over-tall visual viewport (rounding / browser quirk) never goes negative.
    expect(keyboardOffset({ height: 900, offsetTop: 0 }, 844)).toBe(0);
  });

  it("rounds to whole pixels", () => {
    expect(keyboardOffset({ height: 500.4, offsetTop: 0 }, 844)).toBe(344);
  });
});

describe("useVisualViewport", () => {
  const original = Object.getOwnPropertyDescriptor(window, "visualViewport");
  const originalInner = window.innerHeight;

  afterEach(() => {
    if (original) {
      Object.defineProperty(window, "visualViewport", original);
    } else {
      // @ts-expect-error — restore the absent property for other tests.
      delete window.visualViewport;
    }
    Object.defineProperty(window, "innerHeight", {
      value: originalInner,
      configurable: true,
    });
  });

  function stubViewport(vv: {
    height: number;
    offsetTop: number;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  }) {
    Object.defineProperty(window, "visualViewport", {
      value: vv,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", { value: 844, configurable: true });
  }

  it("writes the current offset immediately and on resize", () => {
    const listeners: Record<string, () => void> = {};
    const add = vi.fn((type: string, cb: () => void) => (listeners[type] = cb));
    const remove = vi.fn();
    const vv = { height: 500, offsetTop: 0, addEventListener: add, removeEventListener: remove };
    stubViewport(vv);

    const setOffset = vi.fn();
    const cleanup = useVisualViewport(setOffset);

    // Initial sync write.
    expect(setOffset).toHaveBeenLastCalledWith(344);
    expect(add).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(add).toHaveBeenCalledWith("scroll", expect.any(Function));

    // Keyboard closes → resize fires → offset recomputed.
    vv.height = 844;
    listeners.resize!();
    expect(setOffset).toHaveBeenLastCalledWith(0);

    cleanup();
    expect(remove).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });

  it("is a no-op when visualViewport is unavailable", () => {
    // @ts-expect-error — simulate an engine without the API.
    delete window.visualViewport;
    const setOffset = vi.fn();
    const cleanup = useVisualViewport(setOffset);
    expect(setOffset).not.toHaveBeenCalled();
    expect(() => cleanup()).not.toThrow();
  });
});
