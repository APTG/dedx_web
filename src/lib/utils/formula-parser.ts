/**
 * Chemical formula parser utilities.
 */

import { resolveElement, getElementSymbol } from "./element-data";

export interface ParsedElement {
  atomicNumber: number;
  atomCount: number;
}

export interface ParseFormulaResult {
  elements?: ParsedElement[];
  error?: string;
}

export function parseFormula(formula: string): ParseFormulaResult {
  const trimmed = formula.trim();
  if (!trimmed) {
    return { error: "Formula is empty" };
  }
  try {
    const elements = parseFormulaInternal(trimmed);
    return { elements };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid formula" };
  }
}

function parseFormulaInternal(formula: string): ParsedElement[] {
  const result = new Map<number, number>();
  
  // Split by dot for hydrate notation (e.g., "CuSO4.5H2O")
  // But NOT for fractional counts (e.g., "H2.5O" should NOT be split)
  // Hydrate notation: dot followed by digit then element (e.g., ".5H2O" or ".H2O")
  // Fractional count: digit(s), dot, digit(s) with no element after dot immediately
  const parts = splitHydrateParts(formula);
  
  for (let partIdx = 0; partIdx < parts.length; partIdx++) {
    let part = parts[partIdx]!;
    if (!part) continue;
    
    // Check for leading multiplier (hydrate notation like "5H2O")
    let multiplier = 1;
    const multMatch = part.match(/^(\d+)/);
    if (multMatch) {
      multiplier = parseInt(multMatch[1]!, 10);
      part = part.slice(multMatch[0]!.length);
    }
    if (!part) continue;
    
    // Parse this part
    const partElements = parsePart(part);
    
    // Add to result with multiplier
    for (const elem of partElements) {
      const existing = result.get(elem.atomicNumber) || 0;
      result.set(elem.atomicNumber, existing + elem.atomCount * multiplier);
    }
  }

  if (result.size === 0) {
    throw new Error("No valid elements found in formula");
  }

  return Array.from(result.entries())
    .map(([atomicNumber, atomCount]) => ({ atomicNumber, atomCount }))
    .sort((a, b) => a.atomicNumber - b.atomicNumber);
}

function splitHydrateParts(formula: string): string[] {
  const parts: string[] = [];
  let current = "";
  let i = 0;
  
  while (i < formula.length) {
    const char = formula[i]!;
    
    if (char === ".") {
      // Look ahead to determine if this is hydrate or fractional notation
      const afterDot = formula.slice(i + 1);
      
      // Hydrate pattern: digits + element + more formula (e.g., "5H2O" in "CuSO4.5H2O")
      // Fractional pattern: digits + element only (e.g., "5O" in "H2.5O")
      const hydrateMatch = afterDot.match(/^(\d+)([A-Z][a-z]?)(.*)$/);
      
      if (hydrateMatch) {
        const [, _digits, _elementSymbol, rest] = hydrateMatch;
        void _digits;
        void _elementSymbol;
        // If there's more after the element (like "2O" in "5H2O"), it's hydrate
        // If it's just digits+element (like "5O"), it's fractional
        if (rest && rest.length > 0) {
          // Hydrate notation: split here
          parts.push(current);
          current = "";
          i++;
          continue;
        }
      }
      
      // Fractional or other: include dot in current part
      current += char;
      i++;
    } else {
      current += char;
      i++;
    }
  }
  
  if (current) {
    parts.push(current);
  }
  
  return parts;
}

function parsePart(formula: string): ParsedElement[] {
  const result = new Map<number, number>();
  let i = 0;
  
  while (i < formula.length) {
    const char = formula[i]!;
    
    if (char === "(") {
      // Find matching closing paren
      let depth = 1;
      const start = i + 1;
      i++;
      while (i < formula.length && depth > 0) {
        if (formula[i] === "(") depth++;
        else if (formula[i] === ")") depth--;
        i++;
      }
      const inner = formula.slice(start, i - 1);
      
      // Get multiplier after closing paren
      let mult = 1;
      const multMatch = formula.slice(i).match(/^(\d+)/);
      if (multMatch) {
        mult = parseInt(multMatch[1]!, 10);
        i += multMatch[0]!.length;
      }
      
      // Recursively parse inner formula
      const innerElements = parsePart(inner);
      for (const elem of innerElements) {
        const existing = result.get(elem.atomicNumber) || 0;
        result.set(elem.atomicNumber, existing + elem.atomCount * mult);
      }
    } else if (/[A-Z]/.test(char!)) {
      // Parse element symbol
      let symbol = char;
      i++;
      // Check for lowercase continuation
      if (i < formula.length && /[a-z]/.test(formula[i]!)) {
        symbol += formula[i]!;
        i++;
      }
      
      // Get atomic number
      const elementData = resolveElement(symbol);
      if (!elementData) {
        throw new Error(`Unknown element: '${symbol}'`);
      }
      
      // Get count (can be fractional, e.g., "H2.5O" → 2.5)
      let count = 1;
      const countMatch = formula.slice(i).match(/^(\d+(?:\.\d+)?)/);
      if (countMatch) {
        count = parseFloat(countMatch[1]!);
        i += countMatch[0]!.length;
      }
      
      const existing = result.get(elementData.atomicNumber) || 0;
      result.set(elementData.atomicNumber, existing + count);
    } else {
      i++;
    }
  }
  
  return Array.from(result.entries())
    .map(([atomicNumber, atomCount]) => ({ atomicNumber, atomCount }))
    .sort((a, b) => a.atomicNumber - b.atomicNumber);
}

export function formulaFromElements(
  elements: Array<{ atomicNumber: number; atomCount: number }>,
  formatIntegers: boolean = true,
): string {
  if (elements.length === 0) return "";

  const sorted = [...elements].sort((a, b) => a.atomicNumber - b.atomicNumber);

  const parts: string[] = [];
  for (const { atomicNumber, atomCount } of sorted) {
    const symbol = getElementSymbol(atomicNumber);
    if (!symbol) continue;

    const countStr = formatIntegers && Number.isInteger(atomCount)
      ? atomCount.toString()
      : atomCount.toFixed(4).replace(/\.?0+$/, "");

    parts.push(`${symbol}${Math.abs(atomCount - 1) > 1e-12 ? countStr : ""}`);
  }

  return parts.join("");
}

export function isValidFormula(formula: string): boolean {
  const result = parseFormula(formula);
  return result.elements !== undefined;
}

export function extractElementSymbols(formula: string): string[] {
  const result = parseFormula(formula);
  if (!result.elements) return [];

  return result.elements
    .map((e) => getElementSymbol(e.atomicNumber))
    .filter((s): s is string => s !== undefined);
}

export function formulaContainsElement(formula: string, atomicNumber: number): boolean {
  const result = parseFormula(formula);
  if (!result.elements) return false;

  return result.elements.some((e) => e.atomicNumber === atomicNumber);
}

export function countTotalAtoms(formula: string): number {
  const result = parseFormula(formula);
  if (!result.elements) return 0;

  return result.elements.reduce((sum, e) => sum + e.atomCount, 0);
}

export function getElementCount(formula: string, atomicNumber: number): number {
  const result = parseFormula(formula);
  if (!result.elements) return 0;

  const found = result.elements.find((e) => e.atomicNumber === atomicNumber);
  return found?.atomCount ?? 0;
}
