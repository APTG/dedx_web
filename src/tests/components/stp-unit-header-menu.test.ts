import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/svelte";
import StpUnitHeaderMenu from "$lib/components/results/stp-unit-header-menu.svelte";
import type { StpUnit } from "$lib/wasm/types";

describe("StpUnitHeaderMenu", () => {
  beforeEach(() => cleanup());

  it("renders the quantity label and active unit on the trigger", () => {
    render(StpUnitHeaderMenu, {
      props: { selected: "keV/µm" as StpUnit, onSelect: () => {}, label: "STP" },
    });
    expect(screen.getByTestId("stp-unit-trigger").textContent).toContain("STP (keV/µm)");
  });

  it("opens the menu and offers the three units in order", async () => {
    render(StpUnitHeaderMenu, {
      props: { selected: "keV/µm" as StpUnit, onSelect: () => {} },
    });
    await fireEvent.click(screen.getByTestId("stp-unit-trigger"));
    expect(screen.getByTestId("stp-unit-option-keV/µm")).toBeInTheDocument();
    expect(screen.getByTestId("stp-unit-option-MeV/cm")).toBeInTheDocument();
    expect(screen.getByTestId("stp-unit-option-MeV·cm²/g")).toBeInTheDocument();
  });

  it("marks the active unit as checked", async () => {
    render(StpUnitHeaderMenu, {
      props: { selected: "MeV/cm" as StpUnit, onSelect: () => {} },
    });
    await fireEvent.click(screen.getByTestId("stp-unit-trigger"));
    expect(screen.getByTestId("stp-unit-option-MeV/cm").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("stp-unit-option-keV/µm").getAttribute("aria-checked")).toBe("false");
  });

  it("calls onSelect with the chosen unit and closes", async () => {
    const onSelect = vi.fn();
    render(StpUnitHeaderMenu, {
      props: { selected: "keV/µm" as StpUnit, onSelect },
    });
    await fireEvent.click(screen.getByTestId("stp-unit-trigger"));
    await fireEvent.click(screen.getByTestId("stp-unit-option-MeV·cm²/g"));
    expect(onSelect).toHaveBeenCalledWith("MeV·cm²/g");
    expect(screen.queryByTestId("stp-unit-menu")).not.toBeInTheDocument();
  });
});
