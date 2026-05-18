export type SizeBucket = "tiny" | "medium" | "large";

/**
 * Classify an item count into a UI size bucket.
 * - tiny  (≤10):    no search, full inline list, no scroll container
 * - medium (11-150): search bar (not autofocused), bounded scroll ~8 rows
 * - large (151-500): search + bounded scroll + sub-tabs (Materials only)
 */
export function computeBucket(count: number): SizeBucket {
  if (count <= 10) return "tiny";
  if (count <= 150) return "medium";
  return "large";
}
