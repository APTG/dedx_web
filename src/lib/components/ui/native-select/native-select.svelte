<script lang="ts">
  import { cn } from "$lib/utils.js";
  import type { HTMLAttributes } from "svelte/elements";

  interface Props extends HTMLAttributes<HTMLSelectElement> {
    value?: string;
    onValueChange?: (value: string) => void;
    options: { value: string; label: string; disabled?: boolean }[];
    placeholder?: string;
    class?: string;
  }

  let {
    value,
    onValueChange,
    options,
    placeholder,
    class: className,
    ...restProps
  }: Props = $props();

  function handleChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    if (onValueChange) {
      onValueChange(select.value);
    }
  }
</script>

<select
  class={cn(
    "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )}
  {value}
  onchange={handleChange}
  {...restProps}
>
  {#if placeholder}
    <option value="" disabled>{placeholder}</option>
  {/if}
  {#each options as option (option.value)}
    <option value={option.value} disabled={option.disabled}>
      {option.label}
    </option>
  {/each}
</select>
