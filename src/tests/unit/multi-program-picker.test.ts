import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import MultiProgramPicker from "$lib/components/multi-program-picker.svelte";
import { createMultiProgramState } from "$lib/state/multi-program.svelte";
import type { ProgramEntity } from "$lib/wasm/types";
import type { EntityId } from "$lib/external-data/types";

const programs: ProgramEntity[] = [
  { id: 9, name: "DEDX", version: "1.0" },
  { id: 2, name: "PSTAR", version: "1.0" },
  { id: 7, name: "ICRU 49", version: "1.0" },
];

function makeState(selectedIds: number[], displayOrder?: number[]) {
  const state = createMultiProgramState();
  for (const id of selectedIds) state.addProgram(id);
  if (displayOrder) state.setProgramDisplayOrder(displayOrder);
  return state;
}

async function openDropdown() {
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: /Programs/i });
  await user.click(trigger);
  return user;
}

// ---------------------------------------------------------------------------
// Drag handle visibility
// ---------------------------------------------------------------------------

describe("MultiProgramPicker — drag handle visibility", () => {
  beforeEach(cleanup);

  it("shows drag handle for each selected non-default program", async () => {
    const state = makeState([9, 2, 7]);
    render(MultiProgramPicker, {
      props: { state, availablePrograms: programs, compatibleIds: new Set<EntityId>([9, 2, 7]) },
    });
    await openDropdown();

    expect(screen.getByRole("button", { name: /Drag to reorder PSTAR/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Drag to reorder ICRU 49/i })).toBeTruthy();
  });

  it("does not show a drag handle for the default program", async () => {
    const state = makeState([9, 2]);
    render(MultiProgramPicker, {
      props: { state, availablePrograms: programs, compatibleIds: new Set<EntityId>([9, 2]) },
    });
    await openDropdown();

    // DEDX (id=9) is the default — no handle
    expect(screen.queryByRole("button", { name: /Drag to reorder DEDX/i })).toBeNull();
  });

  it("does not show a drag handle for unselected programs", async () => {
    const state = makeState([9]); // only DEDX selected
    render(MultiProgramPicker, {
      props: { state, availablePrograms: programs, compatibleIds: new Set<EntityId>([9, 2, 7]) },
    });
    await openDropdown();

    expect(screen.queryByRole("button", { name: /Drag to reorder PSTAR/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Drag to reorder ICRU 49/i })).toBeNull();
  });

  it("drag handle appears after a program is selected", async () => {
    const state = makeState([9]);
    render(MultiProgramPicker, {
      props: { state, availablePrograms: programs, compatibleIds: new Set<EntityId>([9, 2, 7]) },
    });
    const user = await openDropdown();

    // Select PSTAR via its row button (role=option)
    const pstarOption = screen.getByRole("option", { name: /PSTAR/i });
    await user.click(pstarOption);

    expect(screen.getByRole("button", { name: /Drag to reorder PSTAR/i })).toBeTruthy();
  });

  it("drag handles are connected to the keyboard hint description", async () => {
    const state = makeState([9, 2, 7]);
    render(MultiProgramPicker, {
      props: { state, availablePrograms: programs, compatibleIds: new Set<EntityId>([9, 2, 7]) },
    });
    await openDropdown();

    const handle = screen.getByRole("button", { name: /Drag to reorder PSTAR/i });
    expect(handle.getAttribute("aria-describedby")).toBe("multi-picker-reorder-hint");
  });

  it("drag handle disappears after a program is deselected", async () => {
    const state = makeState([9, 2]);
    render(MultiProgramPicker, {
      props: { state, availablePrograms: programs, compatibleIds: new Set<EntityId>([9, 2]) },
    });
    const user = await openDropdown();

    expect(screen.getByRole("button", { name: /Drag to reorder PSTAR/i })).toBeTruthy();

    // Deselect PSTAR
    const pstarOption = screen.getByRole("option", { name: /PSTAR/i });
    await user.click(pstarOption);

    expect(screen.queryByRole("button", { name: /Drag to reorder PSTAR/i })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Keyboard reorder: Alt+ArrowUp / Alt+ArrowDown on drag handle
// ---------------------------------------------------------------------------

describe("MultiProgramPicker — keyboard reorder (Alt+Arrow)", () => {
  beforeEach(cleanup);

  async function setup() {
    const state = makeState([9, 2, 7], [9, 2, 7]);
    render(MultiProgramPicker, {
      props: { state, availablePrograms: programs, compatibleIds: new Set<EntityId>([9, 2, 7]) },
    });
    await openDropdown();
    return state;
  }

  it("Alt+ArrowDown moves a program one position down", async () => {
    const state = await setup();

    // PSTAR is at index 1 → move to index 2
    const handle = screen.getByRole("button", { name: /Drag to reorder PSTAR/i });
    await fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true });

    expect(state.programDisplayOrder).toEqual([9, 7, 2]);
  });

  it("Alt+ArrowUp moves a program one position up", async () => {
    const state = await setup();

    // ICRU 49 is at index 2 → move to index 1
    const handle = screen.getByRole("button", { name: /Drag to reorder ICRU 49/i });
    await fireEvent.keyDown(handle, { key: "ArrowUp", altKey: true });

    expect(state.programDisplayOrder).toEqual([9, 7, 2]);
  });

  it("Alt+ArrowUp does nothing when program is already at position 1 (just after default)", async () => {
    const state = await setup();

    // PSTAR is at index 1, cannot go higher without displacing the default
    const handle = screen.getByRole("button", { name: /Drag to reorder PSTAR/i });
    await fireEvent.keyDown(handle, { key: "ArrowUp", altKey: true });

    expect(state.programDisplayOrder).toEqual([9, 2, 7]);
  });

  it("Alt+ArrowDown does nothing when program is already at the last position", async () => {
    const state = await setup();

    // ICRU 49 is at index 2 (last), cannot go further down
    const handle = screen.getByRole("button", { name: /Drag to reorder ICRU 49/i });
    await fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true });

    expect(state.programDisplayOrder).toEqual([9, 2, 7]);
  });

  it("Arrow keys without Alt do not reorder", async () => {
    const state = await setup();

    const handle = screen.getByRole("button", { name: /Drag to reorder PSTAR/i });
    await fireEvent.keyDown(handle, { key: "ArrowDown" }); // no altKey
    await fireEvent.keyDown(handle, { key: "ArrowUp" }); // no altKey

    expect(state.programDisplayOrder).toEqual([9, 2, 7]);
  });

  it("multiple reorders accumulate correctly", async () => {
    const state = await setup(); // [9, 2, 7]

    const icruHandle = screen.getByRole("button", { name: /Drag to reorder ICRU 49/i });
    await fireEvent.keyDown(icruHandle, { key: "ArrowUp", altKey: true }); // → [9, 7, 2]

    // After reorder, PSTAR is now last; move it up
    const pstarHandle = screen.getByRole("button", { name: /Drag to reorder PSTAR/i });
    await fireEvent.keyDown(pstarHandle, { key: "ArrowUp", altKey: true }); // → [9, 2, 7]

    expect(state.programDisplayOrder).toEqual([9, 2, 7]);
  });
});

// ---------------------------------------------------------------------------
// Aria-live announcements
// ---------------------------------------------------------------------------

describe("MultiProgramPicker — aria-live announcements", () => {
  beforeEach(cleanup);

  it("aria-live region is present in the DOM even when dropdown is closed", () => {
    const state = makeState([9]);
    render(MultiProgramPicker, {
      props: { state, availablePrograms: programs, compatibleIds: new Set<EntityId>([9]) },
    });

    const pickerRoot = document.querySelector("[data-multi-program-picker]");
    const liveRegion = pickerRoot?.querySelector("[aria-live='polite']");
    expect(liveRegion).not.toBeNull();
  });

  it("announces the new position after Alt+ArrowUp", async () => {
    const state = makeState([9, 2, 7], [9, 2, 7]);
    render(MultiProgramPicker, {
      props: { state, availablePrograms: programs, compatibleIds: new Set<EntityId>([9, 2, 7]) },
    });
    await openDropdown();

    const handle = screen.getByRole("button", { name: /Drag to reorder ICRU 49/i });
    await fireEvent.keyDown(handle, { key: "ArrowUp", altKey: true }); // ICRU 49 → pos 2

    const liveRegion = document.querySelector("[aria-live='polite']");
    expect(liveRegion?.textContent).toContain("Moved ICRU 49");
    expect(liveRegion?.textContent).toContain("position 2 of 3");
  });

  it("announces the new position after Alt+ArrowDown", async () => {
    const state = makeState([9, 2, 7], [9, 2, 7]);
    render(MultiProgramPicker, {
      props: { state, availablePrograms: programs, compatibleIds: new Set<EntityId>([9, 2, 7]) },
    });
    await openDropdown();

    const handle = screen.getByRole("button", { name: /Drag to reorder PSTAR/i });
    await fireEvent.keyDown(handle, { key: "ArrowDown", altKey: true }); // PSTAR → pos 3

    const liveRegion = document.querySelector("[aria-live='polite']");
    expect(liveRegion?.textContent).toContain("Moved PSTAR");
    expect(liveRegion?.textContent).toContain("position 3 of 3");
  });

  it("announcement updates on each successive reorder", async () => {
    const state = makeState([9, 2, 7], [9, 2, 7]);
    render(MultiProgramPicker, {
      props: { state, availablePrograms: programs, compatibleIds: new Set<EntityId>([9, 2, 7]) },
    });
    await openDropdown();

    const icruHandle = screen.getByRole("button", { name: /Drag to reorder ICRU 49/i });
    await fireEvent.keyDown(icruHandle, { key: "ArrowUp", altKey: true }); // ICRU 49 → pos 2

    const liveRegion = document.querySelector("[aria-live='polite']");
    expect(liveRegion?.textContent).toContain("position 2 of 3");

    // Move it back down
    await fireEvent.keyDown(icruHandle, { key: "ArrowDown", altKey: true }); // ICRU 49 → pos 3
    expect(liveRegion?.textContent).toContain("position 3 of 3");
  });
});
