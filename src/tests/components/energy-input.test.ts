import { render } from "@testing-library/svelte";
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
