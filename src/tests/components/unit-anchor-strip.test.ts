import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/svelte";
import UnitAnchorStrip from "$lib/components/results/unit-anchor-strip.svelte";

describe("UnitAnchorStrip", () => {
  const options = [
    { value: "mev", label: "MeV", tooltip: "Megaelectronvolts" },
    { value: "mev-nucl", label: "MeV/nucl", sub: "≈MeV" },
    { value: "mev-u", label: "MeV/u", sub: "≠MeV" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all options in a radiogroup with the selected value checked", () => {
    render(UnitAnchorStrip, {
      props: {
        options,
        selected: "mev-nucl",
        onSelect: vi.fn(),
      },
    });

    expect(screen.getByRole("radiogroup", { name: "Unit selection" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "MeV" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "MeV/nucl≈MeV" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "MeV/u≠MeV" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("calls onSelect when clicking a different option", async () => {
    const onSelect = vi.fn();
    render(UnitAnchorStrip, {
      props: {
        options,
        selected: "mev",
        onSelect,
      },
    });

    await fireEvent.click(screen.getByRole("radio", { name: "MeV/u≠MeV" }));

    expect(onSelect).toHaveBeenCalledWith("mev-u");
  });

  it("does not call onSelect when clicking the already-selected option", async () => {
    const onSelect = vi.fn();
    render(UnitAnchorStrip, {
      props: {
        options,
        selected: "mev",
        onSelect,
      },
    });

    await fireEvent.click(screen.getByRole("radio", { name: "MeV" }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("disables all radio buttons when disabled", async () => {
    const onSelect = vi.fn();
    render(UnitAnchorStrip, {
      props: {
        options,
        selected: "mev",
        onSelect,
        disabled: true,
      },
    });

    const selected = screen.getByRole("radio", { name: "MeV" });
    const alternate = screen.getByRole("radio", { name: "MeV/nucl≈MeV" });

    expect(selected).toBeDisabled();
    expect(alternate).toBeDisabled();

    await fireEvent.click(alternate);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
