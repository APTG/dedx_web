<script lang="ts">
  export const prerender = true;
</script>

<svelte:head>
  <title>Documentation - webdedx</title>
</svelte:head>

<div class="space-y-6">
  <h1 class="text-3xl font-bold">Documentation</h1>

  <div class="grid gap-4 md:grid-cols-2">
    <a href="/docs/user-guide" class="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md">
      <h2 class="mb-2 text-xl font-semibold">User Guide</h2>
      <p class="text-muted-foreground">
        Learn how to use webdedx for stopping power calculations, plotting, and data export.
      </p>
    </a>

    <a href="/docs/technical" class="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md">
      <h2 class="mb-2 text-xl font-semibold">Technical Reference</h2>
      <p class="text-muted-foreground">
        Architecture, WASM API, and implementation details for developers.
      </p>
    </a>
  </div>

  <div class="rounded-lg border bg-muted p-6">
    <h2 class="mb-2 text-lg font-semibold">Project Status</h2>
    <p class="text-muted-foreground">
      This is a work in progress. Stage 4 (Project Scaffolding) is currently being implemented.
      See the
      <a
        href="https://github.com/APTG/dedx_web/blob/master/docs/00-redesign-plan.md"
        target="_blank"
        class="underline hover:no-underline"
      >
        redesign plan
      </a>
      for the full roadmap.
    </p>
  </div>
</div>
