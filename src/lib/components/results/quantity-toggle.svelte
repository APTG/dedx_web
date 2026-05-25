<script lang="ts">
  interface Props {
    value: "stp" | "range";
    onChange: (v: "stp" | "range") => void;
    class?: string;
  }

  let { value, onChange, class: className }: Props = $props();

  const OPTIONS: Array<{ value: "stp" | "range"; label: string }> = [
    { value: "stp", label: "Stopping Power" },
    { value: "range", label: "CSDA Range" },
  ];

  let containerRef = $state<HTMLElement | null>(null);
  let focusedIndex = $state(0);

  $effect(() => {
    const idx = OPTIONS.findIndex((o) => o.value === value);
    focusedIndex = idx >= 0 ? idx : 0;
  });

  function focusButton(index: number) {
    const buttons = containerRef?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    const btn = buttons?.[index];
    if (btn) {
      btn.focus();
      focusedIndex = index;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (OPTIONS.length === 0) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusButton((focusedIndex + 1) % OPTIONS.length);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusButton((focusedIndex - 1 + OPTIONS.length) % OPTIONS.length);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const opt = OPTIONS[focusedIndex];
      if (opt) onChange(opt.value);
    }
  }
</script>

<div
  bind:this={containerRef}
  class={`inline-flex items-center rounded-md border bg-background p-1 ${className ?? ""}`}
  role="radiogroup"
  aria-label="Quantity"
  data-testid="quantity-toggle"
>
  {#each OPTIONS as opt, index (opt.value)}
    <button
      type="button"
      role="radio"
      aria-checked={value === opt.value}
      tabindex={focusedIndex === index ? 0 : -1}
      class="rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
      class:bg-accent={value === opt.value}
      onclick={() => onChange(opt.value)}
      onkeydown={handleKeyDown}
      data-testid={`quantity-toggle-${opt.value}`}
    >
      {opt.label}
    </button>
  {/each}
</div>
