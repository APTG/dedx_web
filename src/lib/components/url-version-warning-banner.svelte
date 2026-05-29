<script lang="ts">
  import { CURRENT_URL_MAJOR } from "$lib/utils/url-version";

  interface Props {
    version: number | string;
    onLoadDefaults: () => void;
    onTryMigration?: (() => void) | undefined;
  }
  const { version, onLoadDefaults, onTryMigration }: Props = $props();

  // An older numeric major (e.g. v1) is no longer supported; anything else
  // (a newer major, or a malformed token) is reported as newer/unrecognized.
  const isOlder = $derived(typeof version === "number" && version < CURRENT_URL_MAJOR);
</script>

<div
  data-testid="url-version-warning"
  role="alert"
  class="flex flex-wrap items-center gap-3 rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-900"
>
  {#if isOlder}
    <span>
      This link uses an older URL format (v<strong>{version}</strong>) that is no longer supported.
      Load the defaults to continue.
    </span>
  {:else}
    <span>
      This link was created with a newer version of the app (<strong>{version}</strong>). Some
      settings may not load correctly.
    </span>
  {/if}
  <button
    type="button"
    data-testid="url-version-warning-load-defaults"
    onclick={onLoadDefaults}
    class="rounded bg-yellow-200 px-3 py-1 font-medium hover:bg-yellow-300"
  >
    Load defaults
  </button>
  {#if onTryMigration}
    <button
      type="button"
      data-testid="url-version-warning-try-migration"
      onclick={onTryMigration}
      class="rounded bg-yellow-100 px-3 py-1 font-medium hover:bg-yellow-200"
    >
      Try migration
    </button>
  {/if}
</div>
