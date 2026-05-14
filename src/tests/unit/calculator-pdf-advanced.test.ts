import { afterEach, describe, test, expect, vi } from "vitest";
import { buildMetadataTable, type AdvancedPdfMetadata } from "$lib/export/pdf";

describe("buildMetadataTable", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("builds metadata table with density", () => {
    const metadata: AdvancedPdfMetadata = {
      particle: {
        name: "Proton",
        massNumber: 1,
        atomicNumber: 1,
      },
      material: {
        name: "Water (liquid)",
        density: 1.0,
        densityUnit: "g/cm³",
        phase: "liquid",
      },
      programs: [
        { name: "ICRU 90", type: "built-in" },
        { name: "PSTAR", type: "built-in" },
      ],
    };

    const html = buildMetadataTable(metadata);

    // Check PARTICLE section
    expect(html).toContain("PARTICLE");
    expect(html).toContain("Proton");
    expect(html).toContain("Z=1");
    expect(html).toContain("A=1");

    // Check MATERIAL section
    expect(html).toContain("MATERIAL");
    expect(html).toContain("Water (liquid)");
    expect(html).toContain("ρ = 1 g/cm³");

    // Check PROGRAMS section
    expect(html).toContain("PROGRAMS");
    expect(html).toContain("ICRU 90 (built-in)");
    expect(html).toContain("PSTAR (built-in)");

    // Check SYSTEM section
    expect(html).toContain("SYSTEM");
  });

  test("builds metadata table without density (gas material)", () => {
    const metadata: AdvancedPdfMetadata = {
      particle: {
        name: "Alpha",
        massNumber: 4,
        atomicNumber: 2,
      },
      material: {
        name: "Air",
        density: 0.0012,
        densityUnit: "g/cm³",
        phase: "gas",
      },
      programs: [{ name: "ASTAR", type: "built-in" }],
    };

    const html = buildMetadataTable(metadata);

    expect(html).toContain("Alpha");
    expect(html).toContain("Z=2");
    expect(html).toContain("A=4");
    expect(html).toContain("Air (gas)");
    expect(html).toContain("ρ = 0.0012 g/cm³");
  });

  test("includes SETTINGS section when advanced options provided", () => {
    const metadata: AdvancedPdfMetadata = {
      particle: { name: "Proton", massNumber: 1, atomicNumber: 1 },
      material: { name: "Water", density: 1.0 },
      programs: [{ name: "PSTAR", type: "built-in" }],
      advancedOptions: {
        interpolation: { method: "cubic", scale: "log" },
        aggregateState: "condensed",
      },
    };

    const html = buildMetadataTable(metadata);

    expect(html).toContain("SETTINGS");
    expect(html).toContain("Interpolation: cubic / log");
    expect(html).toContain("Aggregate state: condensed");
  });

  test("includes BUILD section when build info provided", () => {
    const metadata: AdvancedPdfMetadata = {
      particle: { name: "Proton", massNumber: 1, atomicNumber: 1 },
      material: { name: "Water", density: 1.0 },
      programs: [{ name: "PSTAR", type: "built-in" }],
      buildInfo: {
        commit: "a1b2c3d",
        date: "2026-04-13",
        branch: "main",
      },
    };

    const html = buildMetadataTable(metadata);

    expect(html).toContain("BUILD");
    expect(html).toContain("a1b2c3d");
    expect(html).toContain("2026-04-13");
    expect(html).toContain("main");
  });

  test("includes external program with URL", () => {
    const metadata: AdvancedPdfMetadata = {
      particle: { name: "Proton", massNumber: 1, atomicNumber: 1 },
      material: { name: "Water", density: 1.0 },
      programs: [
        { name: "ICRU 90", type: "built-in" },
        { name: "NIST", type: "external", url: "https://example.com/nist.webdedx" },
      ],
    };

    const html = buildMetadataTable(metadata);

    expect(html).toContain("ICRU 90 (built-in)");
    expect(html).toContain("NIST (external) https://example.com/nist.webdedx");
  });

  test("labels external program without URL as external", () => {
    const metadata: AdvancedPdfMetadata = {
      particle: { name: "Proton", massNumber: 1, atomicNumber: 1 },
      material: { name: "Water", density: 1.0 },
      programs: [{ name: "Uploaded table", type: "external" }],
    };

    const html = buildMetadataTable(metadata);

    expect(html).toContain("Uploaded table (external)");
    expect(html).not.toContain("Uploaded table (built-in)");
  });

  test("handles partial interpolation settings", () => {
    const metadata: AdvancedPdfMetadata = {
      particle: { name: "Proton", massNumber: 1, atomicNumber: 1 },
      material: { name: "Water", density: 1.0 },
      programs: [{ name: "PSTAR", type: "built-in" }],
      advancedOptions: {
        interpolation: { scale: "log" },
      },
    };

    const html = buildMetadataTable(metadata);

    expect(html).toContain("Interpolation: log");
  });

  test("detects Edge before Chrome and iOS before macOS", () => {
    vi.stubGlobal("navigator", {
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
        "(KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1 Edg/120.0",
    });
    const metadata: AdvancedPdfMetadata = {
      particle: { name: "Proton", massNumber: 1, atomicNumber: 1 },
      material: { name: "Water", density: 1.0 },
      programs: [{ name: "PSTAR", type: "built-in" }],
    };

    const html = buildMetadataTable(metadata);

    expect(html).toContain("Edge / iOS");
  });

  test("handles missing atomic number gracefully", () => {
    const metadata: AdvancedPdfMetadata = {
      particle: { name: "Custom Particle", massNumber: 12 },
      material: { name: "Custom Material", density: 2.5 },
      programs: [{ name: "Custom Program", type: "built-in" }],
    };

    const html = buildMetadataTable(metadata);

    expect(html).toContain("Custom Particle");
    expect(html).toContain("A=12");
    // Should not contain "Z=undefined"
    expect(html).not.toContain("Z=undefined");
  });
});
