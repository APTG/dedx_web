/**
 * Categorise a built-in program ID into TAB (tabulated data), FN (analytical
 * model / formula), or — for external programs — EXT.
 *
 * Mirrors the v7 grouping logic in `entity-selection-comboboxes.svelte`:
 * built-in programs with `id <= 90` are tabulated (ICRU/ASTAR/PSTAR/MSTAR
 * families), `id > 90` (currently 100/101) are analytical (Bethe variants).
 * External programs use string IDs and are always EXT.
 *
 * See `docs/04-feature-specs/entity-selection.md § v8 Program tab`.
 */

export type ProgramKind = "TAB" | "FN" | "EXT";

export interface ProgramKindMeta {
  kind: ProgramKind;
  /** Single-char glyph rendered in the pill badge. */
  glyph: string;
  /** Short badge text rendered in the UI. */
  badge: string;
  /** Full description shown on hover / long-press tooltip. */
  description: string;
}

const META: Record<ProgramKind, ProgramKindMeta> = {
  TAB: {
    kind: "TAB",
    glyph: "▦",
    badge: "DATA",
    description: "Tabulated data — interpolated from libdedx tables",
  },
  FN: {
    kind: "FN",
    glyph: "∫",
    badge: "FN",
    description: "Analytical model — computed from a formula",
  },
  EXT: {
    kind: "EXT",
    glyph: "🔗",
    badge: "EXT",
    description: "External — loaded from a .webdedx file",
  },
};

/**
 * @param programId  Built-in numeric program ID, or external string ExtRef.
 */
export function programKind(programId: number | string): ProgramKind {
  if (typeof programId === "string") return "EXT";
  return programId > 90 ? "FN" : "TAB";
}

export function programKindMeta(programId: number | string): ProgramKindMeta {
  return META[programKind(programId)];
}

export function getProgramKindMeta(kind: ProgramKind): ProgramKindMeta {
  return META[kind];
}
