<script lang="ts">
  import { goto } from "$app/navigation";
  import { base } from "$app/paths";
  import { browser } from "$app/environment";

  $effect(() => {
    if (browser) {
      goto(`${base}/calculator`, { replaceState: true });
    }
  });
</script>

<svelte:head>
  <meta http-equiv="refresh" content={`0;url=${base}/calculator`} />
</svelte:head>
