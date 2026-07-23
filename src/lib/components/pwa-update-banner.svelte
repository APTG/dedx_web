<script lang="ts">
  import { Button } from "$lib/components/ui/button";

  // Persistent (not auto-dismissing) banner — unlike NoticeToast, this must
  // stay on screen until the user acts, since silently swapping cached
  // assets mid-session could serve stale WASM (#881).
  let { visible, onReload }: { visible: boolean; onReload: () => void } = $props();
</script>

{#if visible}
  <div
    role="status"
    aria-live="polite"
    data-testid="pwa-update-banner"
    class="border-b border-primary/30 bg-primary/10 px-4 py-2"
  >
    <div class="container mx-auto flex flex-wrap items-center justify-between gap-2 text-sm">
      <span>A new version of webdedx is available.</span>
      <Button size="sm" data-testid="pwa-update-reload-btn" onclick={onReload}>
        Reload to update
      </Button>
    </div>
  </div>
{/if}
