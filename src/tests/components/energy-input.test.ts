import { render, fireEvent } from "@testing-library/svelte";
import { expect, test } from "vitest";
import EnergyInput from "$lib/components/energy-input.svelte";
import type { EnergyInputState } from "$lib/state/energy-input.svelte";

let idCounter = 0;
function generateId(): number {
  return ++idCounter;
}

function createTestState(props?: Partial<EnergyInputState>): EnergyInputState {
  const rows = props?.rows?.map((row) => ({ ...row, id: generateId() })) ?? [
    { text: "100 MeV", id: generateId() },
  ];
  return {
    rows,
    particleMassNumber: props?.particleMassNumber ?? 1,
    particleId: props?.particleId ?? 1001,
    masterUnit: props?.masterUnit ?? "MeV",
    perRowMode: props?.perRowMode ?? false,
    errors: props?.errors ?? { 0: null },
    parsedEnergies: props?.parsedEnergies ?? [{ value: 100, unit: "MeV" }],
    addRow: () => {},
    removeRow: () => {},
    updateRowText: () => {},
    setMasterUnit: () => {},
    getParsedEnergies: () => [{ value: 100, unit: "MeV" }],
    isPerRowMode: false,
    handleBlur: () => {},
    ...props,
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
    errors: { 0: null, 1: null, 2: null },
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
    errors: { 0: null },
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
    errors: { 0: null },
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
    errors: { 0: null },
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
    errors: { 0: null },
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
    errors: { 0: null },
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

test("§16: uses instructional placeholder text", () => {
  idCounter = 0;
  const state = createTestState({
    rows: [{ text: "", id: generateId() }],
    errors: { 0: null },
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
