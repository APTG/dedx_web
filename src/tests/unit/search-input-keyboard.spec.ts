import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import SearchInput from "$lib/components/entity-selection/search-input.svelte";

describe("SearchInput — keyboard event forwarding", () => {
  beforeEach(() => {
    cleanup();
  });

  test("pressing ArrowDown calls onArrow('down')", async () => {
    const user = userEvent.setup();
    const onArrow = vi.fn();
    render(SearchInput, { props: { value: "", onInput: vi.fn(), onArrow } });
    const input = screen.getByRole("searchbox");
    await user.click(input);
    await user.keyboard("{ArrowDown}");
    expect(onArrow).toHaveBeenCalledWith("down");
  });

  test("pressing ArrowUp calls onArrow('up')", async () => {
    const user = userEvent.setup();
    const onArrow = vi.fn();
    render(SearchInput, { props: { value: "", onInput: vi.fn(), onArrow } });
    const input = screen.getByRole("searchbox");
    await user.click(input);
    await user.keyboard("{ArrowUp}");
    expect(onArrow).toHaveBeenCalledWith("up");
  });

  test("pressing Enter calls onEnter", async () => {
    const user = userEvent.setup();
    const onEnter = vi.fn();
    render(SearchInput, { props: { value: "", onInput: vi.fn(), onEnter } });
    const input = screen.getByRole("searchbox");
    await user.click(input);
    await user.keyboard("{Enter}");
    expect(onEnter).toHaveBeenCalled();
  });

  test("pressing Enter does not call onEnter when prop is undefined", async () => {
    const user = userEvent.setup();
    render(SearchInput, { props: { value: "", onInput: vi.fn() } });
    const input = screen.getByRole("searchbox");
    // Should not throw
    await user.click(input);
    await user.keyboard("{Enter}");
  });

  test("pressing ArrowDown/Up does not call onArrow when prop is undefined", async () => {
    const user = userEvent.setup();
    render(SearchInput, { props: { value: "", onInput: vi.fn() } });
    const input = screen.getByRole("searchbox");
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowUp}");
    // No throw — just verifying no crash
  });

  test("focus calls onFocus", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    render(SearchInput, { props: { value: "", onInput: vi.fn(), onFocus } });
    const input = screen.getByRole("searchbox");
    await user.click(input);
    expect(onFocus).toHaveBeenCalled();
  });

  test("typing updates value via onInput", async () => {
    const user = userEvent.setup();
    const onInput = vi.fn();
    render(SearchInput, { props: { value: "", onInput } });
    const input = screen.getByRole("searchbox");
    await user.type(input, "pro");
    expect(onInput).toHaveBeenCalledWith(expect.stringMatching(/p/));
  });
});
