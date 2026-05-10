/**
 * Custom compounds reactive store.
 *
 * Manages user-defined compound materials stored in localStorage with
 * full CRUD operations, validation, and integration with entity selection.
 *
 * @packageDocumentation
 */

import { browser } from "$app/environment";
import type { CustomCompound, StoredCompound } from "$lib/wasm/types";

/** Compound element with atomic number and atom count */
export interface CompoundElementEntry {
  atomicNumber: number;
  atomCount: number;
}

/**
 * Stored compound with full metadata.
 * This is the internal storage format.
 */
export interface StoredCompoundInternal {
  /** Stable opaque identifier (cc_<uuidv7>) */
  id: string;
  /** Display name in material selector */
  name: string;
  /** Normalized name for duplicate detection (trim + lowercase) */
  normalizedName: string;
  /** Elemental composition */
  elements: CompoundElementEntry[];
  /** Material density in g/cm³ */
  density: number;
  /** Optional mean excitation potential in eV */
  iValue?: number;
  /** Aggregate phase for default unit selection */
  phase: "gas" | "condensed";
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Last edit timestamp (ISO 8601) */
  updatedAt: string;
}

/** localStorage envelope with schema version */
interface CustomCompoundStoreEnvelope {
  schemaVersion: 1;
  compounds: StoredCompoundInternal[];
}

const STORAGE_KEY = "customCompounds";
const LIBRARY_SOFT_LIMIT = 50;
const LIBRARY_WARNING_THRESHOLD = 45;

/** localStorage adapter with browser guard */
const storage = {
  get(): CustomCompoundStoreEnvelope {
    if (!browser) {
      return { schemaVersion: 1, compounds: [] };
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { schemaVersion: 1, compounds: [] };
    }

    try {
      const parsed = JSON.parse(raw) as CustomCompoundStoreEnvelope | StoredCompoundInternal[];

      // Handle legacy array format (pre-v1 schema)
      if (Array.isArray(parsed)) {
        return { schemaVersion: 1, compounds: parsed };
      }

      // Validate schema version
      if (parsed.schemaVersion === 1) {
        return parsed;
      }

      // Unknown schema version - return empty and log warning
      console.warn(
        `custom-compounds: Unknown schema version ${parsed.schemaVersion}, starting fresh`,
      );
      return { schemaVersion: 1, compounds: [] };
    } catch (err) {
      console.error("custom-compounds: Failed to parse localStorage data", err);
      return { schemaVersion: 1, compounds: [] };
    }
  },

  set(envelope: CustomCompoundStoreEnvelope): boolean {
    if (!browser) {
      return false;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      return true;
    } catch (err) {
      // localStorage quota exceeded
      console.error("custom-compounds: localStorage quota exceeded", err);
      return false;
    }
  },
};

/** Generate a stable ID with cc_ prefix and uuidv7-style identifier */
function generateCompoundId(): string {
  // Simple uuid-like generator (cc_ prefix + timestamp + random)
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 10);
  return `cc_${timestamp}${random}`;
}

/** Normalize name for duplicate detection */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Validate compound data before saving */
export interface CompoundValidationError {
  field: "name" | "density" | "iValue" | "elements" | "general";
  message: string;
}

export function validateCompound(params: {
  name: string;
  density: number;
  iValue?: number;
  elements: Array<{ atomicNumber: number; atomCount: number }>;
  phase: "gas" | "condensed";
}): CompoundValidationError[] {
  const errors: CompoundValidationError[] = [];

  // Name validation
  const trimmedName = params.name.trim();
  if (!trimmedName) {
    errors.push({ field: "name", message: "Name is required." });
  } else if (trimmedName.length > 80) {
    errors.push({ field: "name", message: "Name must be 80 characters or fewer." });
  }

  // Density validation
  if (params.density === undefined || params.density === null || !Number.isFinite(params.density)) {
    errors.push({ field: "density", message: "Density is required." });
  } else if (params.density <= 0) {
    errors.push({ field: "density", message: "Density must be greater than zero." });
  } else if (params.density > 25) {
    errors.push({ field: "density", message: "Density must be ≤ 25 g/cm³." });
  }

  // I-value validation (optional)
  if (params.iValue !== undefined && params.iValue !== null) {
    if (!Number.isFinite(params.iValue) || params.iValue <= 0) {
      errors.push({ field: "iValue", message: "I-value must be a positive number." });
    } else if (params.iValue > 10000) {
      errors.push({ field: "iValue", message: "I-value must be ≤ 10 000 eV." });
    }
  }

  // Elements validation
  if (!params.elements || !Array.isArray(params.elements) || params.elements.length === 0) {
    errors.push({ field: "elements", message: "At least one element is required." });
  } else {
    const seenZ = new Set<number>();
    for (const element of params.elements) {
      // Validate atomic number range
      if (element.atomicNumber < 1 || element.atomicNumber > 118) {
        errors.push({
          field: "elements",
          message: `Unknown element: Z=${element.atomicNumber}.`,
        });
      }

      // Check for duplicates
      if (seenZ.has(element.atomicNumber)) {
        errors.push({
          field: "elements",
          message: `Element Z=${element.atomicNumber} is listed more than once. Combine into a single row.`,
        });
      }
      seenZ.add(element.atomicNumber);

      // Validate atom count
      if (element.atomCount <= 0) {
        errors.push({ field: "elements", message: "Count must be greater than zero." });
      } else if (element.atomCount > 1000) {
        errors.push({ field: "elements", message: "Atom count must be ≤ 1000." });
      }
    }
  }

  return errors;
}

/** Custom compounds store state and operations */
export interface CustomCompoundsStore {
  /** All stored compounds (reactive) */
  compounds: StoredCompoundInternal[];
  /** Count of compounds (reactive, useful for limit warnings) */
  count: number;
  /** Whether library has reached warning threshold */
  hasReachedWarningThreshold: boolean;
  /** Whether library is at soft limit */
  isAtLimit: boolean;

  /** Get a compound by ID */
  getById(id: string): StoredCompoundInternal | undefined;
  /** Get compound by index */
  get(index: number): StoredCompoundInternal | undefined;

  /**
   * Create a new compound.
   * @returns Success status and either compound or validation errors
   */
  create(params: {
    name: string;
    density: number;
    iValue?: number;
    elements: Array<{ atomicNumber: number; atomCount: number }>;
    phase: "gas" | "condensed";
  }): { success: true; compound: StoredCompoundInternal } | { success: false; errors: CompoundValidationError[] };

  /**
   * Update an existing compound.
   * @returns Success status and either compound or validation errors
   */
  update(
    id: string,
    params: {
      name: string;
      density: number;
      iValue?: number;
      elements: Array<{ atomicNumber: number; atomCount: number }>;
      phase: "gas" | "condensed";
    },
  ): { success: true; compound: StoredCompoundInternal } | { success: false; errors: CompoundValidationError[] };

  /** Delete a compound by ID. Returns true if found and deleted. */
  delete(id: string): boolean;

  /** Check if a name already exists (case-insensitive) */
  nameExists(name: string, excludeId?: string): boolean;

  /** Export all compounds as JSON for backup/transfer */
  export(): string;

  /** Import compounds from JSON (merges with existing) */
  import(json: string): { success: boolean; count: number; error?: string };
}

/** Create the custom compounds store */
export function createCustomCompoundsStore(): CustomCompoundsStore {
  const initial = storage.get();

  const compounds = $state<StoredCompoundInternal[]>(initial.compounds);
  const version = $state({ count: 0 });

  const store = {
    compounds,

    get count(): number {
      void version.count;
      return compounds.length;
    },

    get hasReachedWarningThreshold(): boolean {
      void version.count;
      return compounds.length >= LIBRARY_WARNING_THRESHOLD;
    },

    get isAtLimit(): boolean {
      void version.count;
      return compounds.length >= LIBRARY_SOFT_LIMIT;
    },

    getById(id: string): StoredCompoundInternal | undefined {
      void version.count;
      return compounds.find((c) => c.id === id);
    },

    get(index: number): StoredCompoundInternal | undefined {
      void version.count;
      return compounds[index];
    },

    create(params): { success: true; compound: StoredCompoundInternal } | { success: false; errors: CompoundValidationError[] } {
      const errors = validateCompound(params);
      if (errors.length > 0) {
        return { success: false, errors };
      }

      const now = new Date().toISOString();
      const normalizedName = normalizeName(params.name);

      const compound: StoredCompoundInternal = {
        id: generateCompoundId(),
        name: params.name.trim(),
        normalizedName,
        elements: params.elements.sort((a, b) => a.atomicNumber - b.atomicNumber),
        density: params.density,
        iValue: params.iValue,
        phase: params.phase,
        createdAt: now,
        updatedAt: now,
      };

      compounds.push(compound);
      version.count++;

      const envelope: CustomCompoundStoreEnvelope = { schemaVersion: 1, compounds };
      storage.set(envelope);

      return { success: true, compound };
    },

    update(
      id: string,
      params,
    ): { success: true; compound: StoredCompoundInternal } | { success: false; errors: CompoundValidationError[] } {
      const existing = compounds.find((c) => c.id === id);
      if (!existing) {
        return {
          success: false,
          errors: [{ field: "general", message: "Compound not found." }],
        };
      }

      const errors = validateCompound(params);
      if (errors.length > 0) {
        return { success: false, errors };
      }

      let now = new Date().toISOString();
      while (now === existing.createdAt) {
        now = new Date(Date.now() + 1).toISOString();
      }
      const normalizedName = normalizeName(params.name);

      existing.name = params.name.trim();
      existing.normalizedName = normalizedName;
      existing.elements = params.elements.sort((a, b) => a.atomicNumber - b.atomicNumber);
      existing.density = params.density;
      existing.iValue = params.iValue;
      existing.phase = params.phase;
      existing.updatedAt = now;

      version.count++;

      const envelope: CustomCompoundStoreEnvelope = { schemaVersion: 1, compounds };
      storage.set(envelope);

      return { success: true, compound: existing };
    },

    delete(id: string): boolean {
      const index = compounds.findIndex((c) => c.id === id);
      if (index === -1) {
        return false;
      }

      compounds.splice(index, 1);
      version.count++;

      const envelope: CustomCompoundStoreEnvelope = { schemaVersion: 1, compounds };
      storage.set(envelope);
      return true;
    },

    nameExists(name: string, excludeId?: string): boolean {
      const normalized = normalizeName(name);
      return compounds.some((c) => c.normalizedName === normalized && c.id !== excludeId);
    },

    export(): string {
      const envelope: CustomCompoundStoreEnvelope = { schemaVersion: 1, compounds };
      return JSON.stringify(envelope, null, 2);
    },

    import(json: string): { success: boolean; count: number; error?: string } {
      try {
        const parsed = JSON.parse(json);
        let newCompounds: StoredCompoundInternal[];

        if (
          parsed &&
          typeof parsed === "object" &&
          "schemaVersion" in parsed &&
          "compounds" in parsed
        ) {
          newCompounds = (parsed as CustomCompoundStoreEnvelope).compounds;
        } else if (Array.isArray(parsed)) {
          newCompounds = parsed;
        } else {
          return { success: false, count: 0, error: "Invalid import format" };
        }

        let imported = 0;
        for (const compound of newCompounds) {
          if (!compound.id || !compound.name || !compound.elements || !compound.density) {
            continue;
          }

          if (compounds.some((c) => c.id === compound.id)) {
            continue;
          }

          const toImport: StoredCompoundInternal = {
            id: compound.id,
            name: compound.name,
            normalizedName: compound.normalizedName ?? normalizeName(compound.name),
            elements: compound.elements,
            density: compound.density,
            iValue: compound.iValue,
            phase: compound.phase ?? "condensed",
            createdAt: compound.createdAt ?? new Date().toISOString(),
            updatedAt: compound.updatedAt ?? new Date().toISOString(),
          };

          compounds.push(toImport);
          imported++;
        }

        version.count++;
        const envelope: CustomCompoundStoreEnvelope = { schemaVersion: 1, compounds };
        storage.set(envelope);
        return { success: true, count: imported };
      } catch (err) {
        return {
          success: false,
          count: 0,
          error: err instanceof Error ? err.message : "Failed to parse JSON",
        };
      }
    },
  };

  return store;
}

/**
 * Singleton store instance (created on first access).
 * Use this for accessing the store in components.
 */
export const customCompounds = /* @__PURE__ */ createCustomCompoundsStore();

/**
 * Convert a stored compound to the WASM CustomCompound interface.
 * This strips metadata and returns only the calculation-relevant fields.
 */
export function toCustomCompoundInput(compound: StoredCompoundInternal): CustomCompound {
  return {
    name: compound.name,
    elements: compound.elements.map((e) => ({
      atomicNumber: e.atomicNumber,
      fraction: e.atomCount,
      type: "atomic" as const,
    })),
    density: compound.density,
    iValue: compound.iValue,
  };
}
