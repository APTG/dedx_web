import { describe, test, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import EntityPanel from "$lib/components/entity-panel.svelte";

describe("EntityPanel component - UX fixes", () => {
  const mockItems = [
    { entity: { id: 1, name: "Hydrogen" }, available: true, label: "Hydrogen (H)", description: "Z=1" },
    { entity: { id: 2, name: "Helium" }, available: true, label: "Helium (He)", description: "Z=2" },
    { entity: { id: 3, name: "Lithium" }, available: false, label: "Lithium (Li)", description: "Z=3" },
    { entity: { id: 4, name: "Beryllium" }, available: true, label: "Beryllium (Be)", description: "Z=4" },
    { entity: { id: 5, name: "Boron" }, available: true, label: "Boron (B)", description: "Z=5" },
    { entity: { id: 6, name: "Carbon" }, available: true, label: "Carbon (C)", description: "Z=6" },
  ];

  test("§7.11: available count updates when searching", async () => {
    const user = userEvent.setup();
    const { container } = render(EntityPanel, {
      props: {
        label: "Particle",
        items: mockItems,
        selectedId: null,
        onItemSelect: vi.fn(),
      },
    });

    const counter = container.querySelector(".text-xs.text-muted-foreground");
    expect(counter?.textContent?.trim()).toBe("5 of 6 available");

    const searchInput = container.querySelector("input[role='searchbox']") as HTMLInputElement;
    await user.type(searchInput, "Hydrogen");

    expect(counter?.textContent?.trim()).toBe("1 of 1 available");
  });

  test("§7.11: available count shows filtered results for multiple matches", async () => {
    const user = userEvent.setup();
    const { container } = render(EntityPanel, {
      props: {
        label: "Particle",
        items: mockItems,
        selectedId: null,
        onItemSelect: vi.fn(),
      },
    });

    const searchInput = container.querySelector("input[role='searchbox']") as HTMLInputElement;
    await user.type(searchInput, "on");

    const counter = container.querySelector(".text-xs.text-muted-foreground");
    expect(counter?.textContent?.trim()).toBe("2 of 2 available");
  });

  test("§7.11: available count resets when search is cleared", async () => {
    const user = userEvent.setup();
    const { container } = render(EntityPanel, {
      props: {
        label: "Particle",
        items: mockItems,
        selectedId: null,
        onItemSelect: vi.fn(),
      },
    });

    const searchInput = container.querySelector("input[role='searchbox']") as HTMLInputElement;
    
    await user.type(searchInput, "Hydrogen");
    let counter = container.querySelector(".text-xs.text-muted-foreground");
    expect(counter?.textContent?.trim()).toBe("1 of 1 available");

    await user.clear(searchInput);
    counter = container.querySelector(".text-xs.text-muted-foreground");
    expect(counter?.textContent?.trim()).toBe("5 of 6 available");
  });
});
