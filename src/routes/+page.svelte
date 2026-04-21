<svelte:head>
  <meta http-equiv="refresh" content="0;url=/calculator" />
</svelte:head>

<script lang="ts">
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  $effect(() => {
    if (browser) {
      goto('/calculator', { replaceState: true });
    }
  });
</script>
