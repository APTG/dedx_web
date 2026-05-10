import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  createCustomCompoundsStore,
  validateCompound,
  toCustomCompoundInput,
  type StoredCompoundInternal,
} from "$lib/state/custom-compounds.svelte";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      const { [key]: removed, ...rest } = store;
      void removed;
      store = rest;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// Mock browser environment
vi.mock("$app/environment", () => ({
  browser: true,
}));

describe("custom-compounds", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("validateCompound", () => {
    test("validates valid compound successfully", () => {
      const errors = validateCompound({
        name: "PMMA",
        density: 1.19,
        elements: [
          { atomicNumber: 6, atomCount: 5 },
          { atomicNumber: 1, atomCount: 8 },
          { atomicNumber: 8, atomCount: 2 },
        ],
        phase: "condensed",
      });
      expect(errors).toHaveLength(0);
    });

    test("rejects empty name", () => {
      const errors = validateCompound({
        name: "",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 2 }],
        phase: "condensed",
      });
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe("name");
      expect(errors[0].message).toBe("Name is required.");
    });

    test("rejects name > 80 characters", () => {
      const errors = validateCompound({
        name: "This is a very long compound name that exceeds the maximum allowed length of eighty characters",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 2 }],
        phase: "condensed",
      });
      expect(errors.some((e) => e.field === "name")).toBe(true);
      expect(errors.some((e) => e.message.includes("80"))).toBe(true);
    });

    test("rejects density <= 0", () => {
      const errors = validateCompound({
        name: "Test",
        density: 0,
        elements: [{ atomicNumber: 1, atomCount: 2 }],
        phase: "condensed",
      });
      expect(errors.some((e) => e.field === "density")).toBe(true);
      expect(errors.some((e) => e.message.includes("greater than zero"))).toBe(true);
    });

    test("rejects density > 25 g/cm³", () => {
      const errors = validateCompound({
        name: "Test",
        density: 30,
        elements: [{ atomicNumber: 1, atomCount: 2 }],
        phase: "condensed",
      });
      expect(errors.some((e) => e.field === "density")).toBe(true);
      expect(errors.some((e) => e.message.includes("≤ 25"))).toBe(true);
    });

    test("rejects iValue <= 0 when provided", () => {
      const errors = validateCompound({
        name: "Test",
        density: 1.0,
        iValue: -10,
        elements: [{ atomicNumber: 1, atomCount: 2 }],
        phase: "condensed",
      });
      expect(errors.some((e) => e.field === "iValue")).toBe(true);
    });

    test("rejects iValue > 10000 eV when provided", () => {
      const errors = validateCompound({
        name: "Test",
        density: 1.0,
        iValue: 15000,
        elements: [{ atomicNumber: 1, atomCount: 2 }],
        phase: "condensed",
      });
      expect(errors.some((e) => e.field === "iValue")).toBe(true);
      expect(errors.some((e) => e.message.includes("10 000"))).toBe(true);
    });

    test("accepts optional iValue (undefined)", () => {
      const errors = validateCompound({
        name: "Test",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 2 }],
        phase: "condensed",
      });
      expect(errors).toHaveLength(0);
    });

    test("rejects empty elements array", () => {
      const errors = validateCompound({
        name: "Test",
        density: 1.0,
        elements: [],
        phase: "condensed",
      });
      expect(errors.some((e) => e.field === "elements")).toBe(true);
      expect(errors.some((e) => e.message.toLowerCase().includes("at least one"))).toBe(true);
    });

    test("rejects element with Z outside [1, 118]", () => {
      const errors = validateCompound({
        name: "Test",
        density: 1.0,
        elements: [{ atomicNumber: 999, atomCount: 1 }],
        phase: "condensed",
      });
      expect(errors.some((e) => e.field === "elements")).toBe(true);
      expect(errors.some((e) => e.message.includes("Unknown element"))).toBe(true);
    });

    test("rejects duplicate atomic numbers", () => {
      const errors = validateCompound({
        name: "Test",
        density: 1.0,
        elements: [
          { atomicNumber: 1, atomCount: 2 },
          { atomicNumber: 1, atomCount: 1 },
        ],
        phase: "condensed",
      });
      expect(errors.some((e) => e.message.includes("more than once"))).toBe(true);
    });

    test("rejects atom count <= 0", () => {
      const errors = validateCompound({
        name: "Test",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 0 }],
        phase: "condensed",
      });
      expect(errors.some((e) => e.message.includes("greater than zero"))).toBe(true);
    });

    test("rejects atom count > 1000", () => {
      const errors = validateCompound({
        name: "Test",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 1001 }],
        phase: "condensed",
      });
      expect(errors.some((e) => e.message.includes("≤ 1000"))).toBe(true);
    });

    test("trims whitespace from name", () => {
      const errors = validateCompound({
        name: "  Test  ",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 2 }],
        phase: "condensed",
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe("createCustomCompoundsStore", () => {
    test("starts with empty compounds array", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();
      expect(store.compounds).toEqual([]);
      expect(store.count).toBe(0);
    });

    test("creates a valid compound", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      const result = store.create({
        name: "PMMA",
        density: 1.19,
        elements: [
          { atomicNumber: 6, atomCount: 5 },
          { atomicNumber: 1, atomCount: 8 },
          { atomicNumber: 8, atomCount: 2 },
        ],
        phase: "condensed",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.compound.name).toBe("PMMA");
        expect(result.compound.density).toBe(1.19);
        expect(result.compound.normalizedName).toBe("pmma");
        expect(result.compound.id).toMatch(/^cc_/);
        expect(result.compound.elements.length).toBe(3);
        expect(result.compound.phase).toBe("condensed");
        expect(localStorageMock.setItem).toHaveBeenCalled();
      }
    });

    test("returns validation errors for invalid compound", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      const result = store.create({
        name: "",
        density: 0,
        elements: [],
        phase: "condensed",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    test("sorts elements by atomic number on save", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      const result = store.create({
        name: "H2O",
        density: 1.0,
        elements: [
          { atomicNumber: 8, atomCount: 1 },
          { atomicNumber: 1, atomCount: 2 },
        ],
        phase: "condensed",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.compound.elements[0].atomicNumber).toBe(1);
        expect(result.compound.elements[1].atomicNumber).toBe(8);
      }
    });

    test("updates an existing compound", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      const createResult = store.create({
        name: "PMMA",
        density: 1.19,
        elements: [{ atomicNumber: 6, atomCount: 5 }],
        phase: "condensed",
      });

      expect(createResult.success).toBe(true);
      if (createResult.success) {
        const updateResult = store.update(createResult.compound.id, {
          name: "PMMA Updated",
          density: 1.2,
          elements: [{ atomicNumber: 6, atomCount: 6 }],
          phase: "condensed",
        });

        expect(updateResult.success).toBe(true);
        if (updateResult.success) {
          expect(updateResult.compound.name).toBe("PMMA Updated");
          expect(updateResult.compound.density).toBe(1.2);
          expect(updateResult.compound.updatedAt).not.toBe(updateResult.compound.createdAt);
        }
      }
    });

    test("fails to update non-existent compound", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      const result = store.update("cc_nonexistent", {
        name: "Test",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 1 }],
        phase: "condensed",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some((e) => e.message.includes("not found"))).toBe(true);
      }
    });

    test("deletes a compound", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      const createResult = store.create({
        name: "Test",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 1 }],
        phase: "condensed",
      });

      expect(createResult.success).toBe(true);
      if (createResult.success) {
        const deleted = store.delete(createResult.compound.id);
        expect(deleted).toBe(true);
        expect(store.count).toBe(0);
      }
    });

    test("returns false when deleting non-existent compound", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      const deleted = store.delete("cc_nonexistent");
      expect(deleted).toBe(false);
    });

    test("nameExists checks case-insensitively", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      store.create({
        name: "PMMA",
        density: 1.19,
        elements: [{ atomicNumber: 6, atomCount: 5 }],
        phase: "condensed",
      });

      expect(store.nameExists("pmma")).toBe(true);
      expect(store.nameExists("PMMA")).toBe(true);
      expect(store.nameExists("Pmma")).toBe(true);
      expect(store.nameExists("Other")).toBe(false);
    });

    test("nameExists excludes specified ID", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      const result = store.create({
        name: "PMMA",
        density: 1.19,
        elements: [{ atomicNumber: 6, atomCount: 5 }],
        phase: "condensed",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should return false when checking against itself
        expect(store.nameExists("PMMA", result.compound.id)).toBe(false);
      }
    });

    test("tracks count reactively", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      expect(store.count).toBe(0);

      store.create({
        name: "Test1",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 1 }],
        phase: "condensed",
      });
      expect(store.count).toBe(1);

      store.create({
        name: "Test2",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 1 }],
        phase: "condensed",
      });
      expect(store.count).toBe(2);

      const first = store.compounds[0];
      if (first) {
        store.delete(first.id);
        expect(store.count).toBe(1);
      }
    });

    test("hasReachedWarningThreshold at 45+ compounds", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      expect(store.hasReachedWarningThreshold).toBe(false);

      // Create 45 compounds
      for (let i = 0; i < 45; i++) {
        store.create({
          name: `Compound${i}`,
          density: 1.0,
          elements: [{ atomicNumber: 1, atomCount: 1 }],
          phase: "condensed",
        });
      }

      expect(store.hasReachedWarningThreshold).toBe(true);
    });

    test("exports compounds as JSON", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      store.create({
        name: "Test",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 1 }],
        phase: "condensed",
      });

      const exported = store.export();
      const parsed = JSON.parse(exported);
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.compounds.length).toBe(1);
    });

    test("imports compounds from JSON", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      const importJson = JSON.stringify({
        schemaVersion: 1,
        compounds: [
          {
            id: "cc_imported",
            name: "Imported",
            normalizedName: "imported",
            elements: [{ atomicNumber: 1, atomCount: 1 }],
            density: 1.0,
            phase: "condensed" as const,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ],
      });

      const result = store.import(importJson);
      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(store.count).toBe(1);
    });

    test("import merges with existing compounds", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      store.create({
        name: "Existing",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 1 }],
        phase: "condensed",
      });

      const importJson = JSON.stringify({
        schemaVersion: 1,
        compounds: [
          {
            id: "cc_imported",
            name: "Imported",
            normalizedName: "imported",
            elements: [{ atomicNumber: 6, atomCount: 1 }],
            density: 2.0,
            phase: "condensed" as const,
            createdAt: "2026-01-01T00:00:00Z",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ],
      });

      store.import(importJson);
      expect(store.count).toBe(2);
    });

    test("import skips duplicate IDs", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      const createResult = store.create({
        name: "Existing",
        density: 1.0,
        elements: [{ atomicNumber: 1, atomCount: 1 }],
        phase: "condensed",
      });

      expect(createResult.success).toBe(true);
      if (createResult.success) {
        const importJson = JSON.stringify({
          schemaVersion: 1,
          compounds: [
            {
              id: createResult.compound.id,
              name: "Duplicate",
              normalizedName: "duplicate",
              elements: [{ atomicNumber: 6, atomCount: 1 }],
              density: 2.0,
              phase: "condensed" as const,
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
            },
          ],
        });

        const result = store.import(importJson);
        expect(result.success).toBe(true);
        expect(result.count).toBe(0); // Skipped the duplicate
        expect(store.count).toBe(1); // Still only the original
      }
    });

    test("import handles invalid JSON gracefully", () => {
      Object.defineProperty(global, "localStorage", { value: localStorageMock });
      const store = createCustomCompoundsStore();

      const result = store.import("not valid json");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("toCustomCompoundInput", () => {
    test("converts stored compound to WASM input format", () => {
      const stored: StoredCompoundInternal = {
        id: "cc_test",
        name: "Test Compound",
        normalizedName: "test compound",
        elements: [
          { atomicNumber: 1, atomCount: 2 },
          { atomicNumber: 8, atomCount: 1 },
        ],
        density: 1.0,
        phase: "condensed",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };

      const input = toCustomCompoundInput(stored);
      expect(input.name).toBe("Test Compound");
      expect(input.density).toBe(1.0);
      expect(input.elements.length).toBe(2);
      expect(input.elements[0].atomicNumber).toBe(1);
      expect(input.elements[0].fraction).toBe(2);
      expect(input.elements[0].type).toBe("atomic");
      expect(input.iValue).toBeUndefined();
    });

    test("includes iValue when present", () => {
      const stored: StoredCompoundInternal = {
        id: "cc_test",
        name: "Test",
        normalizedName: "test",
        elements: [{ atomicNumber: 1, atomCount: 1 }],
        density: 1.0,
        iValue: 74.0,
        phase: "condensed",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      };

      const input = toCustomCompoundInput(stored);
      expect(input.iValue).toBe(74.0);
    });
  });
});
