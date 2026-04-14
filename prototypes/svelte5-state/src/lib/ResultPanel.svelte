<script lang="ts">
  import {
    selectedValue,
    computeParsedNumbers,
    computeResult,
    items,
  } from "./state/counter.svelte.ts";
  import { isAdvancedMode, computationCount } from "./state/ui.svelte.ts";

  // Component-level $derived — alternative to module-level $derived export.
  // Reactive because computeParsedNumbers() reads module-level $state.
  const parsedNumbers = $derived(computeParsedNumbers());
  const computedResult = $derived(computeResult(parsedNumbers));

  // Debounced $effect — simulates the Calculator page calculation effect.
  // Watches parsedNumbers and selectedValue; fires after 300ms quiet.
  $effect(() => {
    // Read reactive dependencies
    const nums = parsedNumbers;
    const sel = selectedValue.value;

    const timer = setTimeout(() => {
      if (import.meta.env.DEV) {
        console.log(
          `[debounced effect] Computing with ${nums.length} numbers, selected=${sel}`,
        );
      }
      computationCount.value += 1;
    }, 300);

    return () => clearTimeout(timer);
  });
</script>

<div style="border: 1px solid green; padding: 1rem; margin: 1rem;">
  <h2>ResultPanel (reader)</h2>

  <p>Selected value: <strong>{selectedValue.value}</strong></p>
  <p>Mode: <strong>{isAdvancedMode.value ? "Advanced" : "Basic"}</strong></p>
  <p>Debounced computation count: <strong>{computationCount.value}</strong></p>

  <h3>Parsed numbers ({parsedNumbers.length})</h3>
  <ul>
    {#each parsedNumbers as n}
      <li>{n}</li>
    {/each}
  </ul>

  <h3>Computed result (n × (selected + 1))</h3>
  <ul>
    {#each computedResult as r}
      <li>{r.toFixed(4)}</li>
    {/each}
  </ul>

  <h3>Items ({items.value.length})</h3>
  <ul>
    {#each items.value as item}
      <li>{item}</li>
    {/each}
  </ul>
</div>
