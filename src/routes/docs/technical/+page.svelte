<script lang="ts"></script>

<svelte:head>
  <title>Technical Reference - webdedx</title>
</svelte:head>

<div class="space-y-6">
  <h1 class="text-3xl font-bold">Technical Reference</h1>

  <div class="prose max-w-none">
    <p class="text-muted-foreground">
      Technical documentation is under construction. It will cover:
    </p>
    <ul class="mt-4 list-disc pl-6 space-y-2 text-muted-foreground">
      <li>Architecture overview and component tree</li>
      <li>WASM module build pipeline</li>
      <li>TypeScript API contract</li>
      <li>State management with Svelte 5 runes</li>
      <li>URL synchronization</li>
      <li>JSROOT integration</li>
      <li>Testing strategy</li>
    </ul>
  </div>

  <div class="mt-6 rounded-lg border bg-muted p-4">
    <p class="text-sm text-muted-foreground">
      For now, see the design documents in the
      <a
        href="https://github.com/APTG/dedx_web/tree/master/docs"
        target="_blank"
        class="underline hover:no-underline"
      >
        docs/
      </a>
      directory.
    </p>
  </div>
</div>
