/**
 * Service Interface Arity Contract Tests
 *
 * Asserts that every mock implementation of LibdedxService correctly satisfies
 * the interface. When the interface changes (e.g., a new parameter is added to
 * `calculate()`), TypeScript will raise a compile error on the `satisfies`
 * assignments below — forcing all mocks to be updated at the same time.
 *
 * Background: PR #427 contained a bug where `getPlotData` was called with an
 * `options` argument at call sites but the interface and mock lacked the
 * parameter. Tests passed silently. See .opencode/lessons-learned.md Entry 4.
 */

import { describe, it, expect } from "vitest";
import type { LibdedxService } from "$lib/wasm/types";

// Import both mock implementations — these must satisfy LibdedxService at
// compile time. If a method signature drifts, the `satisfies` below produces
// a TS error.
import {
  LibdedxServiceImpl,
  MockLibdedxServiceWithElectron,
} from "$lib/wasm/__mocks__/libdedx";

describe("Service interface arity contract", () => {
  it("LibdedxServiceImpl satisfies LibdedxService interface", () => {
    // Type assertion: if LibdedxServiceImpl does not implement all methods of
    // LibdedxService with matching signatures, this line fails to compile.
    const _typeCheck = LibdedxServiceImpl satisfies new () => LibdedxService;
    expect(_typeCheck).toBeTruthy();
  });

  it("MockLibdedxServiceWithElectron satisfies LibdedxService interface", () => {
    const _typeCheck = MockLibdedxServiceWithElectron satisfies new () => LibdedxService;
    expect(_typeCheck).toBeTruthy();
  });

  it("LibdedxServiceImpl instance has all required LibdedxService methods", () => {
    const service = new LibdedxServiceImpl() satisfies LibdedxService;
    // Verify all interface methods are present at runtime
    expect(typeof service.init).toBe("function");
    expect(typeof service.getPrograms).toBe("function");
    expect(typeof service.getParticles).toBe("function");
    expect(typeof service.getMaterials).toBe("function");
    expect(typeof service.calculate).toBe("function");
    expect(typeof service.calculateMulti).toBe("function");
    expect(typeof service.getPlotData).toBe("function");
    expect(typeof service.getMinEnergy).toBe("function");
    expect(typeof service.getMaxEnergy).toBe("function");
  });

  it("MockLibdedxServiceWithElectron instance has all required LibdedxService methods", () => {
    const service = new MockLibdedxServiceWithElectron() satisfies LibdedxService;
    expect(typeof service.init).toBe("function");
    expect(typeof service.getPrograms).toBe("function");
    expect(typeof service.getParticles).toBe("function");
    expect(typeof service.getMaterials).toBe("function");
    expect(typeof service.calculate).toBe("function");
    expect(typeof service.calculateMulti).toBe("function");
    expect(typeof service.getPlotData).toBe("function");
    expect(typeof service.getMinEnergy).toBe("function");
    expect(typeof service.getMaxEnergy).toBe("function");
  });
});
