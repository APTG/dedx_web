// src/tests/integration/wasm-calculate.test.ts
// Runs only when static/wasm/libdedx.mjs exists (skipped in standard CI).
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "fs";
import path from "path";

const wasmMjs = path.resolve("static/wasm/libdedx.mjs");
const skipIfNoWasm = existsSync(wasmMjs) ? describe : describe.skip;

skipIfNoWasm("LibdedxServiceImpl.calculate() — real WASM", () => {
  let service: import("$lib/wasm/libdedx").LibdedxServiceImpl;

  beforeAll(async () => {
    const { LibdedxServiceImpl } = await import("$lib/wasm/libdedx");
    // Load the real Emscripten module. The mjs file exports a default factory.
    const factory = (await import(/* @vite-ignore */ wasmMjs)).default;
    const module = await factory();
    service = new LibdedxServiceImpl(module);
    await service.init();
  });

  it("returns non-zero stopping power for 100 MeV proton in water (PSTAR)", () => {
    // PSTAR = program 2, proton = particle 1, Water liquid = material 276
    const result = service.calculate(2, 1, 276, [100]);
    expect(result.stoppingPowers[0]).toBeGreaterThan(0);
    // NIST PSTAR reference: ~7.3 MeV·cm²/g ± 10%
    expect(result.stoppingPowers[0]).toBeCloseTo(7.3, 0);
  });

  it("returns non-zero CSDA range for 100 MeV proton in water (PSTAR)", () => {
    const result = service.calculate(2, 1, 276, [100]);
    expect(result.csdaRanges[0]).toBeGreaterThan(0);
    // NIST PSTAR reference: ~7.718 cm ± 10%
    expect(result.csdaRanges[0]).toBeCloseTo(7.718, 0);
  });

  it("returns the correct number of results for multiple energies", () => {
    const result = service.calculate(2, 1, 276, [1, 10, 100]);
    expect(result.stoppingPowers).toHaveLength(3);
    expect(result.csdaRanges).toHaveLength(3);
    result.stoppingPowers.forEach((v) => expect(v).toBeGreaterThan(0));
    result.csdaRanges.forEach((v) => expect(v).toBeGreaterThan(0));
  });
});
