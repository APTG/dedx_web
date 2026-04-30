// src/tests/integration/wasm-calculate.test.ts
// Runs only when static/wasm/libdedx.mjs exists (skipped in standard CI).
import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "fs";
import path from "path";
import { pathToFileURL } from "url";

const wasmMjs = path.resolve("static/wasm/libdedx.mjs");
const wasmBin = path.resolve("static/wasm/libdedx.wasm");
const wasmMjsUrl = pathToFileURL(wasmMjs).href;
const skipIfNoWasm = existsSync(wasmMjs) ? describe : describe.skip;

skipIfNoWasm("LibdedxServiceImpl.calculate() — real WASM", () => {
  let service: import("$lib/wasm/libdedx").LibdedxServiceImpl;

  beforeAll(async () => {
    const { LibdedxServiceImpl } = await import("$lib/wasm/libdedx");
    // Load the real Emscripten module. The mjs file exports a default factory.
    // Use a `file://` URL so Node ESM accepts the absolute path on every
    // platform (Windows path separators otherwise break dynamic import).
    const factory = (await import(/* @vite-ignore */ wasmMjsUrl)).default;
    // Override `locateFile` so the module resolves `libdedx.wasm` against
    // the local `static/wasm/` directory rather than the default browser
    // base URL (`http://localhost:3000/wasm/...`) which doesn't exist in
    // the Node test environment.
    const module = await factory({ locateFile: (file: string) => (file.endsWith(".wasm") ? wasmBin : file) });
    service = new LibdedxServiceImpl(module);
    await service.init();
  });

  it("returns non-zero stopping power for 100 MeV proton in water (PSTAR)", () => {
    // PSTAR = program 2, proton = particle 1, Water liquid = material 276
    const result = service.calculate(2, 1, 276, [100]);
    const stp = result.stoppingPowers[0]!;
    expect(stp).toBeGreaterThan(0);
    // NIST PSTAR reference: ~7.3 MeV·cm²/g, accept ±10% across libdedx builds.
    expect(Math.abs(stp - 7.3) / 7.3).toBeLessThan(0.1);
  });

  it("returns non-zero CSDA range for 100 MeV proton in water (PSTAR)", () => {
    const result = service.calculate(2, 1, 276, [100]);
    const range = result.csdaRanges[0]!;
    expect(range).toBeGreaterThan(0);
    // NIST PSTAR reference: ~7.718 cm, accept ±10% across libdedx builds.
    expect(Math.abs(range - 7.718) / 7.718).toBeLessThan(0.1);
  });

  it("returns the correct number of results for multiple energies", () => {
    const result = service.calculate(2, 1, 276, [1, 10, 100]);
    expect(result.stoppingPowers).toHaveLength(3);
    expect(result.csdaRanges).toHaveLength(3);
    result.stoppingPowers.forEach((v) => expect(v).toBeGreaterThan(0));
    result.csdaRanges.forEach((v) => expect(v).toBeGreaterThan(0));
  });
});
