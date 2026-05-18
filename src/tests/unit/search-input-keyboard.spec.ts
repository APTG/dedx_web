import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import SearchInput from "$lib/components/entity-selection/search-input.svelte";

describe("SearchInput — keyboard event forwarding", () => {
  beforeEach(() => {
    cleanup();
  });

  test("pressing ArrowDown calls onArrow('down')", async () => {
    const onArrow = vi.fn();
    render(SearchInput, { props: { value: "", onInput: vi.fn(), onArrow } });
    const input = screen.getByRole("searchbox");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}");
    expect(onArrow).toHaveBeenCalledWith("down");
  });

  test("pressing ArrowUp calls onArrow('up')", async () => {
    const onArrow = vi.fn();
    render(SearchInput, { props: { value: "", onInput: vi.fn(), onArrow } });
    const input = screen.getByRole("searchbox");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowUp}");
    expect(onArrow).toHaveBeenCalledWith("up");
  });

  test("pressing Enter calls onEnter", async () => {
    const onEnter = vi.fn();
    render(SearchInput, { props: { value: "", onInput: vi.fn(), onEnter } });
    const input = screen.getByRole("searchbox");
    await userEvent.click(input);
    await userEvent.keyboard("{Enter}");
    expect(onEnter).toHaveBeenCalled();
  });

  test("pressing Enter does not call onEnter when prop is undefined", async () => {
    render(SearchInput, { props: { value: "", onInput: vi.fn() } });
    const input = screen.getByRole("searchbox");
    // Should not throw
    await userEvent.click(input);
    await userEvent.keyboard("{Enter}");
  });

  test("pressing ArrowDown/Up does not call onArrow when prop is undefined", async () => {
    render(SearchInput, { props: { value: "", onInput: vi.fn() } });
    const input = screen.getByRole("searchbox");
    await userEvent.click(input);
    await userEvent.keyboard("{ArrowDown}{ArrowUp}");
    // No throw — just verifying no crash
  });

  test("focus calls onFocus", async () => {
    const onFocus = vi.fn();
    render(SearchInput, { props: { value: "", onInput: vi.fn(), onFocus } });
    const input = screen.getByRole("searchbox");
    await userEvent.click(input);
    expect(onFocus).toHaveBeenCalled();
  });

  test("typing updates value via onInput", async () => {
    const onInput = vi.fn();
    render(SearchInput, { props: { value: "", onInput } });
    const input = screen.getByRole("searchbox");
    await userEvent.type(input, "pro");
    expect(onInput).toHaveBeenCalledWith(expect.stringMatching(/p/));
  });
});
