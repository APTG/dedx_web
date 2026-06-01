import { describe, it, expect } from "vitest";
import { validateRootAttrs } from "$lib/external-data/validation.js";
import { ExternalDataError } from "$lib/external-data/errors.js";

function getValidRoot(): any {
  return {
    "webdedx.magic": "webdedx-extdata",
    "webdedx.formatVersion": 1,
    "webdedx.metadata": { name: "Valid Store" },
    "webdedx.units": { energy: "MeV", stoppingPower: "MeV·cm²/g" },
    "webdedx.energyGrid": [1, 2, 3],
    "webdedx.programs": [{ id: "prog1", name: "Test Program" }],
    "webdedx.particles": [
      { id: "part1", name: "Proton", symbol: "p", Z: 1, A: 1, atomicMass: 1.007 },
    ],
    "webdedx.materials": [{ id: "mat1", name: "Water" }],
  };
}

describe("external data validation.ts", () => {
  it("passes for a valid minimal object", () => {
    const valid = getValidRoot();
    const result = validateRootAttrs(valid, "label", "http://example.com");
    expect(result.name).toBe("Valid Store");
    expect(result.programs.length).toBe(1);
  });

  describe("handling of malformed or unexpected data structures", () => {
    it("fails if completely empty", () => {
      expect(() => validateRootAttrs({}, "l", "u")).toThrowError(ExternalDataError);
      expect(() => validateRootAttrs({}, "l", "u")).toThrow(/Invalid webdedx store/);
    });

    it("fails if magic is missing or wrong", () => {
      const root = getValidRoot();
      root["webdedx.magic"] = "wrong";
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/webdedx.magic must be/);
    });

    it("fails if arrays are replaced by objects or primitives", () => {
      const root = getValidRoot();
      root["webdedx.energyGrid"] = { "0": 1, "1": 2 };
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/energyGrid must be an array/);
    });
  });

  describe("edge cases: NaN, Infinity, negative values", () => {
    it("fails if energy grid contains NaN", () => {
      const root = getValidRoot();
      root["webdedx.energyGrid"] = [1, NaN, 3];
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/not a positive finite number/);
    });

    it("fails if energy grid contains Infinity", () => {
      const root = getValidRoot();
      root["webdedx.energyGrid"] = [1, Infinity];
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/not a positive finite number/);
    });

    it("fails if energy grid contains negative values", () => {
      const root = getValidRoot();
      root["webdedx.energyGrid"] = [-1, 2];
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/not a positive finite number/);
    });

    it("fails if energy grid is not strictly increasing", () => {
      const root = getValidRoot();
      root["webdedx.energyGrid"] = [1, 1, 2];
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/strictly increasing/);
    });

    it("fails if particle Z is negative", () => {
      const root = getValidRoot();
      root["webdedx.particles"][0].Z = -1;
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(
        /Z must be a non-negative integer/,
      );
    });

    it("fails if particle atomic mass is NaN or Infinity", () => {
      const root = getValidRoot();
      root["webdedx.particles"][0].atomicMass = NaN;
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(
        /atomicMass must be a positive number/,
      );

      root["webdedx.particles"][0].atomicMass = Infinity;
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(
        /atomicMass must be a positive number/,
      );
    });

    it("fails if material density is negative or Infinity", () => {
      const root = getValidRoot();
      root["webdedx.materials"][0].density = -1.5;
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(
        /density must be a positive finite/,
      );

      root["webdedx.materials"][0].density = Infinity;
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(
        /density must be a positive finite/,
      );
    });
  });

  describe("improperly typed fields", () => {
    it("fails if string is used instead of number", () => {
      const root = getValidRoot();
      root["webdedx.energyGrid"] = [1, "2", 3];
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/not a positive finite number/);
    });

    it("fails if version is a string instead of number", () => {
      const root = getValidRoot();
      root["webdedx.formatVersion"] = "1";
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(
        /formatVersion must be a positive integer/,
      );
    });

    it("fails if number used for id instead of string", () => {
      const root = getValidRoot();
      root["webdedx.programs"][0].id = 123;
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/id "123" is invalid/);
    });
  });

  describe("duplicates and bad ids", () => {
    it("fails on duplicate program ids", () => {
      const root = getValidRoot();
      root["webdedx.programs"].push({ id: "prog1", name: "Another" });
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/duplicate id "prog1"/);
    });

    it("fails on duplicate particle pdgCodes", () => {
      const root = getValidRoot();
      root["webdedx.particles"].push({
        id: "part2",
        name: "Proton2",
        symbol: "p2",
        Z: 1,
        A: 1,
        atomicMass: 1.007,
        pdgCode: 2212,
      });
      root["webdedx.particles"][0].pdgCode = 2212;
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/duplicate pdgCode 2212/);
    });

    it("fails on invalid local id characters", () => {
      const root = getValidRoot();
      root["webdedx.programs"][0].id = "invalid id with spaces";
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/invalid \(must match/);
    });
  });

  describe("invalid enums or bounds", () => {
    it("fails on bad phase for materials", () => {
      const root = getValidRoot();
      root["webdedx.materials"][0].phase = "plasma";
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/phase "plasma" is invalid/);
    });

    it("fails if material has both icruId and atomicNumber", () => {
      const root = getValidRoot();
      root["webdedx.materials"][0].icruId = 123;
      root["webdedx.materials"][0].atomicNumber = 6;
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(
        /cannot specify both icruId and atomicNumber/,
      );
    });

    it("fails on invalid energy units", () => {
      const root = getValidRoot();
      root["webdedx.units"].energy = "eV";
      expect(() => validateRootAttrs(root, "l", "u")).toThrowError(/energy "eV" is not supported/);
    });
  });
});
