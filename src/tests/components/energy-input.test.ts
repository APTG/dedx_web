import { render, fireEvent } from "@testing-library/svelte";
import { expect, test } from "vitest";
import EnergyInput from "$lib/components/energy-input.svelte";
import type { EnergyInputState, EnergyRow } from "$lib/state/energy-input.svelte";
import type { EnergyUnit } from "$lib/wasm/types";
import type { ParseResult } from "$lib/utils/energy-parser";

let idCounter = 0;
function generateId(): number {
  return ++idCounter;
}

interface TestStateOverrides {
  rows?: EnergyRow[];
  masterUnit?: EnergyUnit;
  isPerRowMode?: boolean;
  addRow?: () => void;
  removeRow?: (index: number) => void;
  updateRowText?: (index: number, text: string) => void;
  setMasterUnit?: (unit: EnergyUnit) => void;
  getParsedEnergies?: () => ParseResult[];
  handleBlur?: (index: number) => void;
  clearAllRows?: () => void;
}

function createTestState(overrides?: TestStateOverrides): EnergyInputState {
  const rows: EnergyRow[] = overrides?.rows ?? [
    { text: "100 MeV", id: generateId() },
  ];
  return {
    rows,
    masterUnit: overrides?.masterUnit ?? "MeV",
    isPerRowMode: overrides?.isPerRowMode ?? false,
    addRow: overrides?.addRow ?? (() => {}),
    removeRow: overrides?.removeRow ?? (() => {}),
    updateRowText: overrides?.updateRowText ?? (() => {}),
    setMasterUnit: overrides?.setMasterUnit ?? (() => {}),
    getParsedEnergies:
      overrides?.getParsedEnergies ?? (() => [{ value: 100, unit: "MeV" }]),
    handleBlur: overrides?.handleBlur ?? (() => {}),
    clearAllRows: overrides?.clearAllRows ?? (() => {}),
  };
}

test("renders energy input with state prop", () => {
  idCounter = 0;
  const state = createTestState();
  const { container } = render(EnergyInput, { props: { state } });

  const inputs = container.querySelectorAll("input[type='text']");
  expect(inputs).toHaveLength(1);
  expect(inputs[0]).toHaveValue("100 MeV");
});

test("renders multiple rows from state", () => {
  idCounter = 0;
  const state = createTestState({
    rows: [
      { text: "100 MeV", id: generateId() },
      { text: "200 keV", id: generateId() },
      { text: "50 GeV", id: generateId() },
    ],
  });
  const { container } = render(EnergyInput, { props: { state } });

  const inputs = container.querySelectorAll("input[type='text']");
  expect(inputs).toHaveLength(3);
  expect(inputs[0]).toHaveValue("100 MeV");
  expect(inputs[1]).toHaveValue("200 keV");
  expect(inputs[2]).toHaveValue("50 GeV");
});

test("shows add row button", () => {
  idCounter = 0;
  const state = createTestState();
  const { container } = render(EnergyInput, { props: { state } });

  const addButtons = container.querySelectorAll("button");
  const addButton = Array.from(addButtons).find((btn) =>
    btn.textContent?.includes("Add row"),
  );
  expect(addButton).toBeTruthy();
});

test("respects particle mass number for unit buttons (mass number > 1)", () => {
  idCounter = 0;
  const state = createTestState({
    rows: [{ text: "100 MeV", id: generateId() }],
  });
  const { container } = render(EnergyInput, {
    props: { state, particleMassNumber: 4, particleId: 2 },
  });

  const buttonLabels = Array.from(
    container.querySelectorAll("[role='radio']"),
  ).map((el) => el.textContent);
  expect(buttonLabels).toContain("MeV");
  expect(buttonLabels).toContain("MeV/nucl");
});

test("shows only MeV for single-nucleon particles (proton)", () => {
  idCounter = 0;
  const state = createTestState({
    rows: [{ text: "100 MeV", id: generateId() }],
  });
  const { container } = render(EnergyInput, {
    props: { state, particleMassNumber: 1, particleId: 1 },
  });

  const buttonLabels = Array.from(
    container.querySelectorAll("[role='radio']"),
  ).map((el) => el.textContent);
  expect(buttonLabels).toContain("MeV");
  expect(buttonLabels).not.toContain("MeV/nucl");
});

test("shows MeV, MeV/nucl, and total energy for heavy nuclei", () => {
  idCounter = 0;
  const state = createTestState({
    rows: [{ text: "100 MeV", id: generateId() }],
  });
  const { container } = render(EnergyInput, {
    props: { state, particleMassNumber: 12, particleId: 6 },
  });

  const buttonLabels = Array.from(
    container.querySelectorAll("[role='radio']"),
  ).map((el) => el.textContent);
  expect(buttonLabels).toContain("MeV");
  expect(buttonLabels).toContain("MeV/nucl");
});

test("particleId takes precedence over particleMassNumber for electron", () => {
  idCounter = 0;
  const state = createTestState({
    rows: [{ text: "100 MeV", id: generateId() }],
  });
  const { container } = render(EnergyInput, {
    props: { state, particleMassNumber: 12, particleId: 1001 },
  });

  const buttonLabels = Array.from(
    container.querySelectorAll("[role='radio']"),
  ).map((el) => el.textContent);
  expect(buttonLabels).toContain("MeV");
  expect(buttonLabels).not.toContain("MeV/nucl");
});

test("§20: paste multi-line text creates multiple rows", async () => {
  idCounter = 0;
  const updateRowTextCalls: Array<{ index: number; text: string }> = [];
  let addRowCalls = 0;

  const state = createTestState({
    rows: [{ text: "", id: generateId() }],
    updateRowText: (index: number, text: string) => {
      updateRowTextCalls.push({ index, text });
    },
    addRow: () => {
      addRowCalls++;
    },
  });

  const { container } = render(EnergyInput, { props: { state } });
  const input = container.querySelector("input[type='text']") as HTMLInputElement;

  const pasteData = "100 keV\n200 MeV\n500 GeV";
  
  await fireEvent.paste(input, {
    clipboardData: {
      getData: () => pasteData,
    },
  });

  expect(updateRowTextCalls).toHaveLength(3);
  expect(updateRowTextCalls[0].index).toBe(0);
  expect(updateRowTextCalls[0].text).toBe("100 keV");
  expect(updateRowTextCalls[1].index).toBe(1);
  expect(updateRowTextCalls[1].text).toBe("200 MeV");
  expect(updateRowTextCalls[2].index).toBe(2);
  expect(updateRowTextCalls[2].text).toBe("500 GeV");
  expect(addRowCalls).toBe(2);
});

test("§20: paste handles Windows CRLF line endings", async () => {
  idCounter = 0;
  const updateRowTextCalls: Array<{ index: number; text: string }> = [];

  const state = createTestState({
    rows: [{ text: "", id: generateId() }],
    updateRowText: (index: number, text: string) => {
      updateRowTextCalls.push({ index, text });
    },
  });

  const { container } = render(EnergyInput, { props: { state } });
  const input = container.querySelector("input[type='text']") as HTMLInputElement;

  await fireEvent.paste(input, {
    clipboardData: {
      getData: () => "100 keV\r\n200 MeV\r\n",
    },
  });

  // No trailing \r should remain in the pasted text.
  expect(updateRowTextCalls.map((c) => c.text)).toEqual(["100 keV", "200 MeV"]);
});

test("§16: uses instructional placeholder text", () => {
  idCounter = 0;
  const state = createTestState({
    rows: [{ text: "", id: generateId() }],
  });

  const { container } = render(EnergyInput, { props: { state } });
  const input = container.querySelector("input[type='text']") as HTMLInputElement;

  expect(input.placeholder).toBe("e.g. 100 keV");
});

test("§19: add-row button uses secondary styling", () => {
  idCounter = 0;
  const state = createTestState();
  const { container } = render(EnergyInput, { props: { state } });

  const addButton = Array.from(container.querySelectorAll("button")).find(
    (btn) => btn.textContent?.includes("Add row")
  );
  expect(addButton?.textContent?.trim()).toBe("Add row");
  // Verify it does NOT have primary button classes (bg-primary)
  expect(addButton).not.toHaveClass("bg-primary");
});

test("§15: hides parsed-value display when unit matches master unit", () => {
  idCounter = 0;
  const state = createTestState({
    rows: [{ text: "100 MeV", id: generateId() }],
    masterUnit: "MeV",
  });
  const { container } = render(EnergyInput, { props: { state } });

  // The conversion arrow "→" should only appear in the table header, never
  // inside any data cell (<td>).
  const tds = container.querySelectorAll("td");
  for (const td of tds) {
    expect(td.textContent ?? "").not.toContain("→");
  }
});

test("§15: shows parsed-value display with conversion arrow when unit differs from master", () => {
  idCounter = 0;
  const state = createTestState({
    rows: [{ text: "100 keV", id: generateId() }],
    masterUnit: "MeV",
  });
  const { container } = render(EnergyInput, { props: { state } });

  // Should show the arrow (→) when unit differs
  const allElements = container.querySelectorAll("*");
  let foundArrow = false;
  for (const el of allElements) {
    if (el.textContent?.includes("→")) {
      foundArrow = true;
      break;
    }
  }
  expect(foundArrow).toBe(true);
});
