import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
// @ts-expect-error -- jsdom 29 ships no bundled type declarations.
import { JSDOM } from "jsdom";

// bits-ui's `isElement` references the global `Element` constructor in internal
// setTimeout callbacks that may fire after jsdom teardown. Provide a stable
// global reference so `instanceof Element` checks don't throw.
if (!(globalThis as any).Element || !(globalThis as any).SVGElement) {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  (globalThis as any).Element ??= dom.window.Element;
  (globalThis as any).SVGElement ??= dom.window.SVGElement;
}

if (typeof window !== "undefined") {
  vi.setConfig({ testTimeout: 10000 });
  // jsdom does not implement scrollIntoView; stub it so Bits UI keyboard navigation
  // (which calls scrollIntoView on highlighted items) doesn't throw uncaught errors.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  // jsdom does not implement the Web Animations API used by Svelte 5 transitions
  // (fly, fade, etc.). Stub element.animate so transition directives don't throw
  // AND complete immediately: Svelte 5 calls animation.onfinish() to remove
  // transitioning elements, so the stub must invoke it on the next microtask.
  if (!window.Element.prototype.animate) {
    window.Element.prototype.animate = vi.fn(() => {
      const anim = {
        finished: Promise.resolve(),
        cancel: vi.fn(),
        pause: vi.fn(),
        play: vi.fn(),
        reverse: vi.fn(),
        onfinish: null as (() => void) | null,
        oncancel: null as (() => void) | null,
      };
      // Call onfinish on the next microtask — mirrors instant WAAPI completion.
      Promise.resolve().then(() => {
        if (typeof anim.onfinish === "function") anim.onfinish();
      });
      return anim;
    }) as unknown as typeof window.Element.prototype.animate;
  }
}
