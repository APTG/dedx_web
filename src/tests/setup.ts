import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { JSDOM } from 'jsdom';

// bits-ui's `isElement` references the global `Element` constructor in internal
// setTimeout callbacks that may fire after jsdom teardown. Provide a stable
// global reference so `instanceof Element` checks don't throw.
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
(globalThis as any).Element ??= dom.window.Element;
(globalThis as any).SVGElement ??= dom.window.SVGElement;

if (typeof window !== 'undefined') {
  vi.setConfig({ testTimeout: 10000 });
  // jsdom does not implement scrollIntoView; stub it so Bits UI keyboard navigation
  // (which calls scrollIntoView on highlighted items) doesn't throw uncaught errors.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}
