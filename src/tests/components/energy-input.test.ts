import { describe, test, expect } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import EnergyInput from "$lib/components/energy-input.svelte";

describe("EnergyInput component", () => {
  test("renders with default rows", () => {
    const { getByDisplayValue } = render(EnergyInput);
    
    expect(getByDisplayValue("0.1")).toBeInTheDocument();
    expect(getByDisplayValue("1.0")).toBeInTheDocument();
    expect(getByDisplayValue("10.0")).toBeInTheDocument();
  });

  test("shows energy unit label", () => {
    const { container } = render(EnergyInput);
    
    const label = container.querySelector("label");
    expect(label).toBeInTheDocument();
    expect(label?.textContent).toBe("Energy Unit");
  });

  test("adds new row when clicking add button", async () => {
    const { container } = render(EnergyInput);
    
    const addButton = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("Add row")
    );
    expect(addButton).toBeDefined();
    
    await fireEvent.click(addButton as HTMLButtonElement);
    
    const energyInputs = Array.from(container.querySelectorAll("input")).filter(
      (input) => input.getAttribute("aria-label")?.includes("Energy value")
    );
    expect(energyInputs).toHaveLength(4);
  });

  test("removes row when clicking remove button", async () => {
    const { container } = render(EnergyInput);
    
    const removeButtons = Array.from(container.querySelectorAll("button")).filter(
      (btn) => btn.getAttribute("aria-label")?.includes("Remove row")
    );
    expect(removeButtons).toHaveLength(3);
    
    await fireEvent.click(removeButtons[1]);
    
    const energyInputs = Array.from(container.querySelectorAll("input")).filter(
      (input) => input.getAttribute("aria-label")?.includes("Energy value")
    );
    expect(energyInputs).toHaveLength(2);
  });

  test("does not remove last row", async () => {
    const { container } = render(EnergyInput);
    
    const getRemoveButtons = () =>
      Array.from(container.querySelectorAll("button")).filter(
        (btn) => btn.getAttribute("aria-label")?.includes("Remove row")
      );
    
    const getEnergyInputs = () =>
      Array.from(container.querySelectorAll("input")).filter(
        (input) => input.getAttribute("aria-label")?.includes("Energy value")
      );

    let removeButtons = getRemoveButtons();
    await fireEvent.click(removeButtons[0]);
    
    removeButtons = getRemoveButtons();
    await fireEvent.click(removeButtons[0]);
    
    const energyInputs = getEnergyInputs();
    expect(energyInputs).toHaveLength(1);
    
    removeButtons = getRemoveButtons();
    await fireEvent.click(removeButtons[0]);
    
    const inputsAfter = getEnergyInputs();
    expect(inputsAfter).toHaveLength(1);
  });

  test("updates row text on input", async () => {
    const { getAllByRole } = render(EnergyInput);
    
    const inputs = getAllByRole("textbox");
    await fireEvent.change(inputs[0], { target: { value: "5.0" } });
    
    expect(inputs[0]).toHaveValue("5.0");
  });

  test("has correct initial parsed values", () => {
    const { container } = render(EnergyInput);
    
    const textContent = container.textContent || "";
    expect(textContent).toContain("0.1");
    expect(textContent).toContain("1");
    expect(textContent).toContain("10");
  });
});
