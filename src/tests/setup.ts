import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  vi.setConfig({ testTimeout: 10000 });
  // jsdom does not implement scrollIntoView; stub it so Bits UI keyboard navigation
  // (which calls scrollIntoView on highlighted items) doesn't throw uncaught errors.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}
