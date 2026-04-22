import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

if (typeof window !== 'undefined') {
  vi.setConfig({ testTimeout: 10000 });
}
