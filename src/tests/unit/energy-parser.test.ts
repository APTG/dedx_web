import { describe, test, expect } from "vitest";
import { parseEnergyInput } from "$lib/utils/energy-parser";

describe("parseEnergyInput", () => {
  test("parses plain number without unit - inherits master unit", () => {
    const result = parseEnergyInput("1");
    expect(result).toEqual({ value: 1, unit: null });
  });

  test("parses number with space and unit", () => {
    const result = parseEnergyInput("1.5 MeV");
    expect(result).toEqual({ value: 1.5, unit: "MeV" });
  });

  test("parses number without space before unit", () => {
    const result = parseEnergyInput("100keV");
    expect(result).toEqual({ value: 100, unit: "keV" });
  });

  test("parses per-nucleon unit MeV/u", () => {
    const result = parseEnergyInput("1 MeV/u");
    expect(result).toEqual({ value: 1, unit: "MeV/u" });
  });

  test("parses per-nucleon unit MeV/nucl", () => {
    const result = parseEnergyInput("1 MeV/nucl");
    expect(result).toEqual({ value: 1, unit: "MeV/nucl" });
  });

  test("parses scientific notation", () => {
    const result = parseEnergyInput("1e3 MeV");
    expect(result).toEqual({ value: 1000, unit: "MeV" });
  });

  test("case-sensitive unit parsing - lowercase 'mev' is rejected (could be milli-eV)", () => {
    const result = parseEnergyInput("1.5mev");
    expect(result).toEqual({ error: "unknown unit: mev — did you mean MeV?" });
  });

  test("case-sensitive unit parsing - canonical 'MeV' is accepted", () => {
    const result = parseEnergyInput("1.5MeV");
    expect(result).toEqual({ value: 1.5, unit: "MeV" });
  });

  test("case-sensitive unit parsing - 'meV' (milli-eV) is rejected, not silently treated as MeV", () => {
    // 10⁹ ratio between meV (milli) and MeV (mega) — must NOT collapse.
    const result = parseEnergyInput("1.5 meV");
    expect(result).toEqual({ error: "unknown unit: meV — did you mean MeV?" });
  });

  test("case-sensitive unit parsing - 'EV' (all caps) is rejected", () => {
    const result = parseEnergyInput("1.5 EV");
    expect(result).toEqual({ error: "unknown unit: EV" });
  });

  test("case-sensitive unit parsing - 'KeV' is rejected (canonical is keV)", () => {
    const result = parseEnergyInput("100 KeV");
    expect(result).toEqual({ error: "unknown unit: KeV — did you mean keV?" });
  });

  test("case-sensitive unit parsing - 'MeV/Nucl' is rejected (canonical is MeV/nucl)", () => {
    const result = parseEnergyInput("1 MeV/Nucl");
    expect(result).toEqual({ error: "unknown unit: MeV/Nucl — did you mean MeV/nucl?" });
  });

  test("empty string returns empty marker", () => {
    const result = parseEnergyInput("");
    expect(result).toEqual({ empty: true });
  });

  test("whitespace-only returns empty marker", () => {
    const result = parseEnergyInput("  ");
    expect(result).toEqual({ empty: true });
  });

  test("non-numeric text returns error", () => {
    const result = parseEnergyInput("abc");
    expect(result).toEqual({ error: "invalid number" });
  });

  test("negative number returns error", () => {
    const result = parseEnergyInput("-5");
    expect(result).toEqual({ error: "must be positive" });
  });

  test("zero returns error", () => {
    const result = parseEnergyInput("0");
    expect(result).toEqual({ error: "must be positive" });
  });

  test("zero with unit returns error", () => {
    const result = parseEnergyInput("0 MeV");
    expect(result).toEqual({ error: "must be positive" });
  });

  test("unknown unit returns error", () => {
    const result = parseEnergyInput("1.5 kg");
    expect(result).toEqual({ error: "unknown unit: kg" });
  });

  test("GeV unit is recognized", () => {
    const result = parseEnergyInput("1 GeV");
    expect(result).toEqual({ value: 1, unit: "GeV" });
  });

  test("eV unit is recognized", () => {
    const result = parseEnergyInput("1000 eV");
    expect(result).toEqual({ value: 1000, unit: "eV" });
  });

  test("keV/nucl unit is recognized", () => {
    const result = parseEnergyInput("500 keV/nucl");
    expect(result).toEqual({ value: 500, unit: "keV/nucl" });
  });

  test("GeV/nucl unit is recognized", () => {
    const result = parseEnergyInput("1 GeV/nucl");
    expect(result).toEqual({ value: 1, unit: "GeV/nucl" });
  });

  test("keV/u unit is recognized", () => {
    const result = parseEnergyInput("500 keV/u");
    expect(result).toEqual({ value: 500, unit: "keV/u" });
  });

  test("GeV/u unit is recognized", () => {
    const result = parseEnergyInput("1 GeV/u");
    expect(result).toEqual({ value: 1, unit: "GeV/u" });
  });

  test("leading and trailing whitespace trimmed", () => {
    const result = parseEnergyInput("  1.5 MeV  ");
    expect(result).toEqual({ value: 1.5, unit: "MeV" });
  });

  test("multiple spaces between number and unit", () => {
    const result = parseEnergyInput("1.5   MeV");
    expect(result).toEqual({ value: 1.5, unit: "MeV" });
  });

  test("decimal with no integer part", () => {
    const result = parseEnergyInput(".5 MeV");
    expect(result).toEqual({ value: 0.5, unit: "MeV" });
  });

  test("scientific notation with negative exponent", () => {
    const result = parseEnergyInput("1.5e-2 MeV");
    expect(result).toEqual({ value: 0.015, unit: "MeV" });
  });

  test("scientific notation uppercase E", () => {
    const result = parseEnergyInput("1.5E2 MeV");
    expect(result).toEqual({ value: 150, unit: "MeV" });
  });

  describe("TeV range", () => {
    test("parses TeV unit", () => {
      const result = parseEnergyInput("1 TeV");
      expect(result).toEqual({ value: 1, unit: "TeV" });
    });

    test("parses TeV/nucl unit", () => {
      const result = parseEnergyInput("0.5 TeV/nucl");
      expect(result).toEqual({ value: 0.5, unit: "TeV/nucl" });
    });

    test("parses TeV/u unit", () => {
      const result = parseEnergyInput("2 TeV/u");
      expect(result).toEqual({ value: 2, unit: "TeV/u" });
    });

    test("10 TeV is accepted (not rejected as unknown unit)", () => {
      const result = parseEnergyInput("10 TeV");
      expect(result).toEqual({ value: 10, unit: "TeV" });
    });
  });

  describe("typo suggestions", () => {
    test("meV suggests MeV", () => {
      const result = parseEnergyInput("100 meV");
      expect(result).toEqual({ error: "unknown unit: meV — did you mean MeV?" });
    });

    test("mev suggests MeV", () => {
      const result = parseEnergyInput("100 mev");
      expect(result).toEqual({ error: "unknown unit: mev — did you mean MeV?" });
    });

    test("MEV suggests MeV", () => {
      const result = parseEnergyInput("100 MEV");
      expect(result).toEqual({ error: "unknown unit: MEV — did you mean MeV?" });
    });

    test("KeV suggests keV", () => {
      const result = parseEnergyInput("100 KeV");
      expect(result).toEqual({ error: "unknown unit: KeV — did you mean keV?" });
    });

    test("MeV/Nucl suggests MeV/nucl", () => {
      const result = parseEnergyInput("100 MeV/Nucl");
      expect(result).toEqual({ error: "unknown unit: MeV/Nucl — did you mean MeV/nucl?" });
    });

    test("MeV/NUCL suggests MeV/nucl", () => {
      const result = parseEnergyInput("100 MeV/NUCL");
      expect(result).toEqual({ error: "unknown unit: MeV/NUCL — did you mean MeV/nucl?" });
    });

    test("GeV/Nucl suggests GeV/nucl", () => {
      const result = parseEnergyInput("100 GeV/Nucl");
      expect(result).toEqual({ error: "unknown unit: GeV/Nucl — did you mean GeV/nucl?" });
    });

    test("TeV/Nucl suggests TeV/nucl", () => {
      const result = parseEnergyInput("100 TeV/Nucl");
      expect(result).toEqual({ error: "unknown unit: TeV/Nucl — did you mean TeV/nucl?" });
    });

    test("MeV/U suggests MeV/u", () => {
      const result = parseEnergyInput("100 MeV/U");
      expect(result).toEqual({ error: "unknown unit: MeV/U — did you mean MeV/u?" });
    });

    test("GeV/U suggests GeV/u", () => {
      const result = parseEnergyInput("100 GeV/U");
      expect(result).toEqual({ error: "unknown unit: GeV/U — did you mean GeV/u?" });
    });

    test("TeV/U suggests TeV/u", () => {
      const result = parseEnergyInput("100 TeV/U");
      expect(result).toEqual({ error: "unknown unit: TeV/U — did you mean TeV/u?" });
    });

    test("bebok has no suggestion (no case-fold match)", () => {
      const result = parseEnergyInput("100 bebok");
      expect(result).toEqual({ error: "unknown unit: bebok" });
    });

    test("EV has no suggestion (eV excluded to avoid confusion)", () => {
      const result = parseEnergyInput("100 EV");
      expect(result).toEqual({ error: "unknown unit: EV" });
    });
  });
});
