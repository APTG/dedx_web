import { parseEnergyInput, type ParseResult } from "$lib/utils/energy-parser";
import type { EnergyUnit } from "$lib/wasm/types";

export interface EnergyRow {
  id: number;
  text: string;
  error?: string;
}

export interface EnergyInputState {
  rows: EnergyRow[];
  masterUnit: EnergyUnit;
  isPerRowMode: boolean;
  hasLargeInput: boolean;
  addRow(): void;
  removeRow(index: number): void;
  moveRow(index: number, direction: "up" | "down"): void;
  updateRowText(index: number, text: string, autoAdd?: boolean): void;
  handleBlur(index: number): void;
  setMasterUnit(unit: EnergyUnit): void;
  getParsedEnergies(): ParseResult[];
  clearAllRows(): void;
  resetRows(initial: { text: string }[]): void;
}

let rowIdCounter = 0;

const DEFAULT_ROWS: string[] = ["100"];
const DEFAULT_UNIT: EnergyUnit = "MeV";

export function createEnergyInputState(): EnergyInputState {
  let rows = $state<EnergyRow[]>(DEFAULT_ROWS.map((text) => ({ id: rowIdCounter++, text })));

  let masterUnit = $state<EnergyUnit>(DEFAULT_UNIT);

  function computeIsPerRowMode(): boolean {
    return rows.some((row) => {
      const parsed = parseEnergyInput(row.text);
      return "value" in parsed && parsed.unit !== null;
    });
  }

  function addRow(): void {
    rows = [...rows, { id: rowIdCounter++, text: "" }];
  }

  function removeRow(index: number): void {
    if (rows.length <= 1) return;
    rows = rows.filter((_, i) => i !== index);
  }

  function moveRow(index: number, direction: "up" | "down"): void {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target]!, next[index]!];
    rows = next;
  }

  function updateRowText(index: number, text: string, autoAdd = true): void {
    const parsed = parseEnergyInput(text);
    const error = "error" in parsed ? parsed.error : undefined;

    rows = rows.map((row, i) => {
      if (i !== index) return row;
      // exactOptionalPropertyTypes: only set `error` when defined; otherwise
      // clone-and-`delete` so we don't write `error: undefined` onto a
      // property typed `error?: string`. Avoid destructure-rest patterns —
      // they introduce an unused binding under noUnusedLocals.
      if (error !== undefined) return { ...row, text, error };
      const rowWithoutError = { ...row, text };
      delete rowWithoutError.error;
      return rowWithoutError;
    });

    if (autoAdd && index === rows.length - 1 && text.trim() !== "") {
      addRow();
    }
  }

  function handleBlur(index: number): void {
    const row = rows[index];
    if (row && row.text.trim() === "" && rows.length > 1) {
      removeRow(index);
    }
  }

  function setMasterUnit(unit: EnergyUnit): void {
    masterUnit = unit;
  }

  function getParsedEnergies(): ParseResult[] {
    return rows.map((row) => parseEnergyInput(row.text));
  }

  function clearAllRows(): void {
    rowIdCounter = 0;
    rows = DEFAULT_ROWS.map((text) => ({ id: rowIdCounter++, text }));
  }

  function resetRows(initial: { text: string }[]): void {
    rowIdCounter = 0;
    rows = initial.map((item) => ({ id: rowIdCounter++, text: item.text }));
    masterUnit = DEFAULT_UNIT;
  }

  const filledRowCount = $derived(rows.filter((r) => r.text.trim() !== "").length);
  const hasLargeInput = $derived(filledRowCount > 200);

  return {
    get rows() {
      return rows;
    },
    get masterUnit() {
      return masterUnit;
    },
    get isPerRowMode() {
      return computeIsPerRowMode();
    },
    get hasLargeInput() {
      return hasLargeInput;
    },
    addRow,
    removeRow,
    moveRow,
    updateRowText,
    handleBlur,
    setMasterUnit,
    getParsedEnergies,
    clearAllRows,
    resetRows,
  };
}
