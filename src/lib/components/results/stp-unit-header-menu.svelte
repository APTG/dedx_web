<script lang="ts">
  import { browser } from "$app/environment";
  import { STP_UNITS } from "$lib/utils/stp-unit-codec";
  import type { StpUnit } from "$lib/wasm/types";

  interface Props {
    /** Currently active stopping-power output unit. */
    selected: StpUnit;
    /** Called when the user picks a unit. */
    onSelect: (unit: StpUnit) => void;
    /** Quantity name shown before the unit (e.g. "STP" or "Stopping Power"). */
    label?: string;
    /** Test id prefix for the trigger / menu. */
    testid?: string;
  }

  let { selected, onSelect, label = "STP", testid = "stp-unit" }: Props = $props();

  const DESCRIPTORS: Record<StpUnit, string> = {
    "keV/µm": "Linear — energy loss per micron",
    "MeV/cm": "Linear — energy loss per centimetre",
    "MeV·cm²/g": "Mass — density-independent",
  };

  let open = $state(false);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);
  // Fixed-position coordinates for the desktop popover, anchored to the
  // trigger. Using `fixed` (not `absolute`) escapes the result table's
  // `overflow-x-auto` scroll container, which would otherwise clip the menu.
  let menuPos = $state<{ top: number; left: number }>({ top: 0, left: 0 });

  // Detect a phone-sized viewport so the menu renders as a bottom sheet.
  // Guarded for jsdom / SSR where matchMedia is absent.
  let isMobile = $state(false);
  $effect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 640px)");
    isMobile = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (isMobile = e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  });

  function toggle() {
    if (!open && triggerEl && !isMobile) {
      const r = triggerEl.getBoundingClientRect();
      menuPos = { top: r.bottom + 4, left: r.left };
    }
    open = !open;
  }

  function choose(unit: StpUnit) {
    onSelect(unit);
    open = false;
    triggerEl?.focus();
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      open = false;
      triggerEl?.focus();
    }
  }

  // Desktop popover: close on outside click. The bottom sheet uses its own
  // backdrop, so this only matters when !isMobile.
  $effect(() => {
    if (!open || !browser || isMobile) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerEl?.contains(t) || menuEl?.contains(t)) return;
      open = false;
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  });
</script>

<svelte:window onkeydown={onKeydown} />

<button
  bind:this={triggerEl}
  type="button"
  onclick={toggle}
  aria-haspopup="menu"
  aria-expanded={open}
  data-testid={`${testid}-trigger`}
  class="inline-flex min-h-[44px] items-center gap-1 font-medium decoration-dotted underline-offset-4
         hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
  title="Change stopping-power unit"
>
  <span style="text-decoration: underline dotted;">{label} ({selected})</span>
  <span aria-hidden="true" class="text-xs">▾</span>
</button>

{#if open}
  {#if isMobile}
    <!-- Mobile bottom sheet -->
    <div
      role="presentation"
      class="fixed inset-0 z-50 bg-black/40"
      data-testid={`${testid}-backdrop`}
      onclick={() => (open = false)}
    ></div>
    <div
      role="menu"
      aria-label="Stopping-power unit"
      data-testid={`${testid}-sheet`}
      class="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t bg-popover text-popover-foreground
             pb-[env(safe-area-inset-bottom)] shadow-lg"
    >
      <div class="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-muted-foreground/30"></div>
      <div class="px-4 py-2 text-sm font-medium text-muted-foreground">Stopping-power unit</div>
      {#each STP_UNITS as unit (unit)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={unit === selected}
          data-testid={`${testid}-option-${unit}`}
          onclick={() => choose(unit)}
          class="flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left hover:bg-accent"
        >
          <span class="w-4 text-primary">{unit === selected ? "✓" : ""}</span>
          <span class="flex flex-col">
            <span class="font-medium">{unit}</span>
            <span class="text-xs text-muted-foreground">{DESCRIPTORS[unit]}</span>
          </span>
        </button>
      {/each}
    </div>
  {:else}
    <!-- Desktop popover (fixed, anchored to the trigger to escape the table's
         overflow-x-auto clip) -->
    <div
      bind:this={menuEl}
      role="menu"
      aria-label="Stopping-power unit"
      data-testid={`${testid}-menu`}
      style={`top: ${menuPos.top}px; left: ${menuPos.left}px;`}
      class="fixed z-50 min-w-[16rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    >
      {#each STP_UNITS as unit (unit)}
        <button
          type="button"
          role="menuitemradio"
          aria-checked={unit === selected}
          data-testid={`${testid}-option-${unit}`}
          onclick={() => choose(unit)}
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-accent"
        >
          <span class="w-4 text-primary">{unit === selected ? "✓" : ""}</span>
          <span class="flex flex-col">
            <span class="font-medium">{unit}</span>
            <span class="text-xs text-muted-foreground">{DESCRIPTORS[unit]}</span>
          </span>
        </button>
      {/each}
    </div>
  {/if}
{/if}
