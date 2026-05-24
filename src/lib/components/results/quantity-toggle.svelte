<script lang="ts">
  interface Props {
    value: "stp" | "range";
    onChange: (v: "stp" | "range") => void;
    class?: string;
  }

  let { value, onChange, class: className }: Props = $props();
</script>

<div
  class={`inline-flex items-center rounded-md border bg-background p-1 ${className ?? ""}`}
  role="radiogroup"
  aria-label="Quantity"
  data-testid="quantity-toggle"
>
  <button
    type="button"
    role="radio"
    aria-checked={value === "stp"}
    class="rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
    class:bg-accent={value === "stp"}
    onclick={() => onChange("stp")}
    data-testid="quantity-toggle-stp"
  >
    Stopping Power
  </button>
  <button
    type="button"
    role="radio"
    aria-checked={value === "range"}
    class="rounded-sm px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
    class:bg-accent={value === "range"}
    onclick={() => onChange("range")}
    data-testid="quantity-toggle-range"
  >
    CSDA Range
  </button>
</div>
