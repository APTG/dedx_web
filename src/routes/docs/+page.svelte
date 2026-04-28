<script lang="ts">
  import { base } from "$app/paths";
</script>

<svelte:head>
  <title>Documentation - webdedx</title>
</svelte:head>

<div class="space-y-6">
  <h1 class="text-3xl font-bold">Documentation</h1>

  <div class="grid gap-4 md:grid-cols-2">
    <a
      href={`${base}/docs/user-guide`}
      class="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md"
    >
      <h2 class="mb-2 text-xl font-semibold">User Guide</h2>
      <p class="text-muted-foreground">
        Learn how to use webdedx for stopping power calculations, plotting, and data export.
      </p>
    </a>

    <a
      href={`${base}/docs/technical`}
      class="rounded-lg border bg-card p-6 transition-shadow hover:shadow-md"
    >
      <h2 class="mb-2 text-xl font-semibold">Technical Reference</h2>
      <p class="text-muted-foreground">
        Architecture, WASM API, and implementation details for developers.
      </p>
    </a>
  </div>

  <div class="rounded-lg border bg-muted p-6">
    <h2 class="mb-2 text-lg font-semibold">Project Status</h2>
    <p class="text-muted-foreground">
      Stage 5 (Core shared components) is <strong>complete</strong> as of 28 April 2026 —
      entity selection, energy input, unit selector, unified result table, and the
      JSROOT plot wrapper all shipped. Stage 6 (Feature pages — multi-program mode,
      Share URL, CSV/PDF export) is next. See the
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
