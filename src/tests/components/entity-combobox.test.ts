import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";
import EntityCombobox from "$lib/components/entity-combobox.svelte";

describe("EntityCombobox component - UX fixes", () => {
  const mockItems = [
    { type: "section" as const, label: "Test Section" },
    {
      entity: { id: 1, name: "Hydrogen" },
      available: true,
      label: "Hydrogen (H)",
      searchText: "H z=1 a=1",
    },
    {
      entity: { id: 2, name: "Helium" },
      available: true,
      label: "Helium (He)",
      searchText: "He z=2 a=4",
    },
    {
      entity: { id: 6, name: "Carbon" },
      available: true,
      label: "Carbon (C)",
      searchText: "C z=6 a=12",
    },
  ];

  test("§7.1: displays visible label above combobox", () => {
    const { container } = render(EntityCombobox, {
      props: {
        label: "Particle",
        items: mockItems,
        selectedId: null,
        onItemSelect: vi.fn(),
      },
    });

    const label = container.querySelector("label");
    expect(label).toBeInTheDocument();
    expect(label?.textContent?.trim()).toBe("Particle");
  });

  test("§7.1: label is associated with combobox trigger via id", () => {
    const { container } = render(EntityCombobox, {
      props: {
        label: "Particle",
        items: mockItems,
        selectedId: null,
        onItemSelect: vi.fn(),
      },
    });

    const label = container.querySelector("label") as HTMLLabelElement;
    const trigger = container.querySelector("[data-combobox-trigger]") as HTMLElement;

    expect(label).toBeInTheDocument();
    expect(trigger).toBeInTheDocument();

    const labelId = label.id;
    expect(labelId).toBeDefined();
    expect(trigger.getAttribute("aria-labelledby")).toContain(labelId);
  });

  test("§7.1: label text matches the label prop", () => {
    const { container } = render(EntityCombobox, {
      props: {
        label: "Target Material",
        items: mockItems,
        selectedId: null,
        onItemSelect: vi.fn(),
      },
    });

    const label = container.querySelector("label");
    expect(label?.textContent?.trim()).toBe("Target Material");
  });

  test("§7.3: Particle label has for='trigger-particle' and id='label-particle'", () => {
    const { container } = render(EntityCombobox, {
      props: {
        label: "Particle",
        items: mockItems,
        selectedId: null,
        onItemSelect: vi.fn(),
      },
    });
    
    const label = container.querySelector("label");
    expect(label?.getAttribute("for")).toBe("trigger-particle");
    expect(label?.getAttribute("id")).toBe("label-particle");
  });

  test("§7.3: Material label has for='trigger-material'", () => {
    const { container } = render(EntityCombobox, {
      props: {
        label: "Material",
        items: mockItems,
        selectedId: null,
        onItemSelect: vi.fn(),
      },
    });
    
    const label = container.querySelector("label");
    expect(label?.getAttribute("for")).toBe("trigger-material");
  });

  test("§7.4: match count hides when no search term", () => {
    const { container } = render(EntityCombobox, {
      props: {
        label: "Particle",
        items: mockItems,
        selectedId: null,
        onItemSelect: vi.fn(),
      },
    });

    const matchCount = container.querySelector("[data-match-count]");
    expect(matchCount).not.toBeInTheDocument();
  });
});
