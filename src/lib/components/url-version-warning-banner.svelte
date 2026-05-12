<script lang="ts">
  interface Props {
    version: number;
    onLoadDefaults: () => void;
    onTryMigration?: (() => void) | undefined;
  }
  const { version, onLoadDefaults, onTryMigration }: Props = $props();
</script>

<div
  data-testid="url-version-warning"
  role="alert"
  class="flex flex-wrap items-center gap-3 rounded-md border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-900"
>
  <span>
    This link was created with a newer version of the app (<strong>{version}</strong>). Some
    settings may not load correctly.
  </span>
  <button
    data-testid="url-version-warning-load-defaults"
    onclick={onLoadDefaults}
    class="rounded bg-yellow-200 px-3 py-1 font-medium hover:bg-yellow-300"
  >
    Load defaults
  </button>
  {#if onTryMigration}
    <button
      data-testid="url-version-warning-try-migration"
      onclick={onTryMigration}
      class="rounded bg-yellow-100 px-3 py-1 font-medium hover:bg-yellow-200"
    >
      Try migration
    </button>
  {/if}
</div>
