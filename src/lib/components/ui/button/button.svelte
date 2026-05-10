<script lang="ts" module>
  import { cn } from "$lib/utils.js";
  import {
    buttonVariants as _buttonVariants,
    type ButtonProps as _ButtonProps,
  } from "./button.variants.js";

  export const buttonVariants = _buttonVariants;
  export type ButtonProps = _ButtonProps;
  export type { ButtonSize, ButtonVariant } from "./button.variants.js";
</script>

<script lang="ts">
  let {
    class: className,
    variant = "default",
    size = "default",
    ref = $bindable(null),
    href = undefined,
    type = "button",
    disabled,
    children,
    onclick,
    onmousedown,
    onmouseup,
    onkeydown,
    onkeyup,
    onfocus,
    onblur,
    ...restProps
  }: ButtonProps = $props();
</script>

{#if href}
  <a
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    href={disabled ? undefined : href}
    aria-disabled={disabled}
    role={disabled ? "link" : undefined}
    tabindex={disabled ? -1 : undefined}
    {onclick}
    {onmousedown}
    {onmouseup}
    {onkeydown}
    {onkeyup}
    {onfocus}
    {onblur}
    {...restProps}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    {type}
    {disabled}
    {onmousedown}
    {onmouseup}
    {onkeydown}
    {onkeyup}
    {onfocus}
    {onblur}
    {onclick}
    {...restProps}
  >
    {@render children?.()}
  </button>
{/if}
