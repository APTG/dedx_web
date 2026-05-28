/**
 * Map an atomic number to its (row, column) cell in the standard 18-column
 * periodic table. Lanthanides (57-71) and actinides (89-103) live on rows
 * 9 / 10 below the main table; row 8 is an intentional gap.
 */
export function periodicPosition(z: number): { row: number; col: number } | null {
  if (z === 1) return { row: 1, col: 1 };
  if (z === 2) return { row: 1, col: 18 };
  if (z >= 3 && z <= 4) return { row: 2, col: z - 2 };
  if (z >= 5 && z <= 10) return { row: 2, col: z + 8 };
  if (z >= 11 && z <= 12) return { row: 3, col: z - 10 };
  if (z >= 13 && z <= 18) return { row: 3, col: z };
  if (z >= 19 && z <= 36) return { row: 4, col: z - 18 };
  if (z >= 37 && z <= 54) return { row: 5, col: z - 36 };
  if (z === 55) return { row: 6, col: 1 };
  if (z === 56) return { row: 6, col: 2 };
  if (z >= 57 && z <= 71) return { row: 9, col: z - 53 };
  if (z >= 72 && z <= 86) return { row: 6, col: z - 68 };
  if (z === 87) return { row: 7, col: 1 };
  if (z === 88) return { row: 7, col: 2 };
  if (z >= 89 && z <= 103) return { row: 10, col: z - 85 };
  if (z >= 104 && z <= 118) return { row: 7, col: z - 100 };
  return null;
}
