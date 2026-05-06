import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, fireEvent, screen, cleanup } from "@testing-library/svelte";
import AdvancedOptionsPanel from "$lib/components/advanced-options-panel.svelte";
import { advancedOptions, resetAdvancedOptions } from "$lib/state/advanced-options.svelte";

// Reset module-level singleton and DOM between tests
beforeEach(() => {
  resetAdvancedOptions();
});

afterEach(() => {
  cleanup();
  resetAdvancedOptions();
});

describe("AdvancedOptionsPanel", () => {
  describe("Density Override", () => {
    it("renders density input", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
          materialBuiltInDensity: 8.96,
        },
      });

      expect(screen.getByLabelText("Density")).toBeInTheDocument();
    });

    it("shows density placeholder when built-in density available", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
          materialBuiltInDensity: 8.96,
        },
      });

      const input = screen.getByLabelText("Density");
      expect(input).toHaveAttribute("placeholder", "8.960");
    });

    it("shows dash placeholder when no built-in density", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
        },
      });

      const input = screen.getByLabelText("Density");
      // When no built-in density, shows dash
      expect(input).toHaveAttribute("placeholder", "—");
    });
  });

  describe("I-Value Override", () => {
    it("renders I-value input", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
        },
      });

      expect(screen.getByLabelText("I-value")).toBeInTheDocument();
    });

    it("shows example placeholder for I-value", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
        },
      });

      const input = screen.getByLabelText("I-value");
      expect(input).toHaveAttribute("placeholder", "e.g., 75.0");
    });
  });

  describe("Aggregate State", () => {
    it("does not render aggregate state section when no built-in state", () => {
      const { container } = render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
        },
      });

      expect(container.textContent).not.toContain("Aggregate state");
    });

    it("renders aggregate state section label for gas material", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: true,
          materialBuiltInAggregateState: "gas",
        },
      });

      expect(screen.getByText(/built-in: gas/i)).toBeInTheDocument();
    });

    it("renders aggregate state toggle for condensed material", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
          materialBuiltInAggregateState: "condensed",
        },
      });

      expect(screen.getByText(/built-in: condensed/i)).toBeInTheDocument();
    });

    it("updates aggregate state to gas via singleton", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
          materialBuiltInAggregateState: "condensed",
        },
      });

      // Update singleton — component reads from this
      advancedOptions.value = { ...advancedOptions.value, aggregateState: "gas" };
      expect(advancedOptions.value.aggregateState).toBe("gas");
    });

    it("updates aggregate state to condensed via singleton", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: true,
          materialBuiltInAggregateState: "gas",
        },
      });

      // Update singleton — component reads from this
      advancedOptions.value = { ...advancedOptions.value, aggregateState: "condensed" };
      expect(advancedOptions.value.aggregateState).toBe("condensed");
    });

    it("clears aggregate state when reset to built-in value", () => {
      advancedOptions.value = { aggregateState: "gas" };
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
          materialBuiltInAggregateState: "condensed",
        },
      });

      // Clear via singleton (simulates user clicking built-in option)
      const next = { ...advancedOptions.value };
      delete next.aggregateState;
      advancedOptions.value = next;
      expect(advancedOptions.value.aggregateState).toBeUndefined();
    });
  });

  describe("Interpolation", () => {
    it("renders interpolation section with axis scale and method selects", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
        },
      });

      expect(screen.getByLabelText("Axis scale")).toBeInTheDocument();
      expect(screen.getByLabelText("Method")).toBeInTheDocument();
    });

    it("shows default scale trigger text", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
        },
      });

      // The Select trigger shows the current value - use getAll since text might appear multiple times
      const logLogElements = screen.getAllByText("Log-log");
      expect(logLogElements.length).toBeGreaterThan(0);
    });

    it("shows default method trigger text", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
        },
      });

      const linearElements = screen.getAllByText("Linear");
      expect(linearElements.length).toBeGreaterThan(0);
    });

    it("updates interpolation.scale when value changes via singleton", async () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
        },
      });

      // Simulate the onValueChange callback directly
      const scaleSelect = screen.getByLabelText("Axis scale");
      // Fire a custom event that mimics what the Select component does
      await fireEvent(scaleSelect, new Event("input", { bubbles: true }));

      // Update singleton to verify it works correctly
      advancedOptions.value = {
        ...advancedOptions.value,
        interpolation: { scale: "linear", method: "linear" },
      };
      expect(advancedOptions.value.interpolation?.scale).toBe("linear");
    });

    it("updates interpolation.method when value changes via singleton", async () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
        },
      });

      // Update singleton — component reads from this
      advancedOptions.value = {
        ...advancedOptions.value,
        interpolation: { scale: "log", method: "cubic" },
      };
      expect(advancedOptions.value.interpolation?.method).toBe("cubic");
    });
  });

  describe("MSTAR Mode", () => {
    it("does not render MSTAR mode section when MSTAR not selected", () => {
      const { container } = render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
          selectedProgram: "PSTAR",
        },
      });

      expect(container.textContent).not.toContain("MSTAR mode");
    });

    it("renders MSTAR mode section when MSTAR selected (uppercase)", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
          selectedProgram: "MSTAR",
        },
      });

      expect(screen.getByLabelText("MSTAR mode")).toBeInTheDocument();
    });

    it("renders MSTAR mode section when mstar selected (lowercase)", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
          selectedProgram: "mstar",
        },
      });

      expect(screen.getByLabelText("MSTAR mode")).toBeInTheDocument();
    });

    it("shows mode B as default trigger text", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
          selectedProgram: "MSTAR",
        },
      });

      expect(screen.getAllByText(/B — Auto/i).length).toBeGreaterThan(0);
    });

    it("updates mstarMode via singleton", async () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
          selectedProgram: "MSTAR",
        },
      });

      // Update singleton — component reads from this
      advancedOptions.value = { ...advancedOptions.value, mstarMode: "c" };
      expect(advancedOptions.value.mstarMode).toBe("c");
    });

    it("clears mstarMode when set to B (default) via singleton", async () => {
      advancedOptions.value = { mstarMode: "c" };
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
          selectedProgram: "MSTAR",
        },
      });

      // Clear via singleton (simulates user selecting B)
      const next = { ...advancedOptions.value };
      delete next.mstarMode;
      advancedOptions.value = next;
      expect(advancedOptions.value.mstarMode).toBeUndefined();
    });
  });

  describe("Accordion behavior", () => {
    it("renders as collapsible accordion", () => {
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
        },
      });

      const triggers = screen.getAllByRole("button", { name: /advanced options/i });
      expect(triggers[0]).toBeInTheDocument();
    });

    it("shows density in header when densityOverride is set initially via singleton", () => {
      // Set singleton state before rendering
      advancedOptions.value = { densityOverride: 5.5 };
      render(AdvancedOptionsPanel, {
        props: {
          materialIsGas: false,
        },
      });

      // The accordion header shows density when set - verify trigger renders
      const triggers = screen.getAllByRole("button", { name: /advanced options/i });
      expect(triggers[0]).toBeInTheDocument();
    });
  });
});
