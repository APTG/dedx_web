/**
 * Canonical SI-prefix conversion factors to MeV.
 * Every energy parser and converter MUST import from here — single source of truth.
 * Adding a new SI prefix here is sufficient; no other file needs to be edited.
 */
export const SI_PREFIX_TABLE = {
  eV: 1e-6,
  keV: 0.001,
  MeV: 1,
  GeV: 1000,
  TeV: 1e6,
} as const;

export type SiPrefix = keyof typeof SI_PREFIX_TABLE;
