import { describe, test, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/svelte";
import EnergyUnitSelector from "$lib/components/energy-unit-selector.svelte";

describe("EnergyUnitSelector component", () => {
  test("renders only the buttons listed in availableUnits", () => {
    const { container } = render(EnergyUnitSelector, {
      props: {
        value: "MeV",
        availableUnits: ["MeV", "MeV/nucl"],
        onValueChange: vi.fn(),
      },
    });

    const buttons = container.querySelectorAll('button[type="button"]');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent?.trim()).toBe("MeV");
    expect(buttons[1].textContent?.trim()).toBe("MeV/nucl");
  });

  test("the button matching value has aria-checked=true", () => {
    const { container } = render(EnergyUnitSelector, {
      props: {
        value: "MeV/nucl",
        availableUnits: ["MeV", "MeV/nucl"],
        onValueChange: vi.fn(),
      },
    });

    const buttons = container.querySelectorAll('button[type="button"]');
    expect(buttons[0].getAttribute("aria-checked")).toBe("false");
    expect(buttons[1].getAttribute("aria-checked")).toBe("true");
  });

  test("clicking a non-selected button calls onValueChange with correct EnergyUnit", async () => {
    const onValueChange = vi.fn();
    const { container } = render(EnergyUnitSelector, {
      props: {
        value: "MeV",
        availableUnits: ["MeV", "MeV/nucl"],
        onValueChange,
      },
    });

    const buttons = container.querySelectorAll('button[type="button"]');
    await fireEvent.click(buttons[1]);

    expect(onValueChange).toHaveBeenCalledWith("MeV/nucl");
  });

  test("clicking the already-selected button does NOT call onValueChange again", async () => {
    const onValueChange = vi.fn();
    const { container } = render(EnergyUnitSelector, {
      props: {
        value: "MeV",
        availableUnits: ["MeV", "MeV/nucl"],
        onValueChange,
      },
    });

    const buttons = container.querySelectorAll('button[type="button"]');
    await fireEvent.click(buttons[0]);

    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("when disabled=true, all buttons have disabled attribute", () => {
    const { container } = render(EnergyUnitSelector, {
      props: {
        value: "MeV",
        availableUnits: ["MeV", "MeV/nucl"],
        onValueChange: vi.fn(),
        disabled: true,
      },
    });

    const buttons = container.querySelectorAll('button[type="button"]');
    buttons.forEach((btn) => {
      expect(btn.getAttribute("disabled")).not.toBeNull();
    });
  });

  test("when disabled=true, onValueChange is never called on click", async () => {
    const onValueChange = vi.fn();
    const { container } = render(EnergyUnitSelector, {
      props: {
        value: "MeV",
        availableUnits: ["MeV", "MeV/nucl"],
        onValueChange,
        disabled: true,
      },
    });

    const buttons = container.querySelectorAll('button[type="button"]');
    await fireEvent.click(buttons[1]);

    expect(onValueChange).not.toHaveBeenCalled();
  });

  test('passing availableUnits=["MeV"] renders exactly one button', () => {
    const { container } = render(EnergyUnitSelector, {
      props: {
        value: "MeV",
        availableUnits: ["MeV"],
        onValueChange: vi.fn(),
      },
    });

    const buttons = container.querySelectorAll('button[type="button"]');
    expect(buttons).toHaveLength(1);
  });

  test('passing availableUnits=["MeV", "MeV/nucl"] renders exactly two buttons', () => {
    const { container } = render(EnergyUnitSelector, {
      props: {
        value: "MeV",
        availableUnits: ["MeV", "MeV/nucl"],
        onValueChange: vi.fn(),
      },
    });

    const buttons = container.querySelectorAll('button[type="button"]');
    expect(buttons).toHaveLength(2);
  });

  // Keyboard navigation tests are omitted - they rely on focus management
  // that doesn't work reliably in jsdom test environment. The component
  // implements keyboard support (arrow keys, Enter, Space) but testing
  // requires a real browser environment (E2E tests).
});
