<script lang="ts">
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>Error - webdedx</title>
</svelte:head>

<div class="flex min-h-[400px] flex-col items-center justify-center">
  <h1 class="text-2xl font-bold">
    {page.status === 404 ? 'Not found' : 'Something went wrong'}
  </h1>
  {#if page.error.message}
    <p class="mt-2 max-w-md text-center text-muted-foreground">{page.error.message}</p>
  {/if}
  <button onclick={() => history.back()} class="mt-4 px-4 py-2 rounded bg-primary text-primary-foreground">
    Go back
  </button>
</div>
