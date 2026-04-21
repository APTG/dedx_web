import { test, expect } from "vitest";
import { parseEnergyInput } from "$lib/units/energy";

test("energy parser handles valid input", () => {
  const input = "1.0\n2.5\n10.0";
  const energies = parseEnergyInput(input);

  expect(energies).toEqual([1.0, 2.5, 10.0]);
});

test("energy parser skips invalid lines", () => {
  const input = "1.0\ninvalid\n2.5\n-1.0\n10.0";
  const energies = parseEnergyInput(input);

  expect(energies).toEqual([1.0, 2.5, 10.0]);
});

test("energy parser handles empty input", () => {
  const input = "";
  const energies = parseEnergyInput(input);

  expect(energies).toEqual([]);
});
