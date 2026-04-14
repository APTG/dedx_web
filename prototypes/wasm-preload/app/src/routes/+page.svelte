<script lang="ts">
  import { base } from "$app/paths";

  let status = $state("Loading...");
  let programs = $state<string[]>([]);
  let wasmFileSize = $state("");

  $effect(() => {
    loadWasm();
  });

  async function loadWasm() {
    try {
      const factory = await import(`${base}/wasm/libdedx.mjs`);
      const module = await factory.default({
        locateFile: (f: string) => `${base}/wasm/${f}`,
      });

      // Call dedx_fill_program_list to verify the data files loaded
      const bufSize = 20;
      const ptr = module._malloc(bufSize * 4);
      module.ccall(
        "dedx_fill_program_list",
        null,
        ["number"],
        [ptr],
      );

      // Read program IDs until -1 terminator
      const heap = new Int32Array(module.HEAP32.buffer, ptr, bufSize);
      const ids: number[] = [];
      for (let i = 0; i < bufSize; i++) {
        if (heap[i] === -1) break;
        ids.push(heap[i]!);
      }
      module._free(ptr);

      // Get program names
      const names: string[] = [];
      for (const id of ids) {
        const namePtr = module.ccall(
          "dedx_get_program_name",
          "number",
          ["number"],
          [id],
        );
        names.push(module.UTF8ToString(namePtr));
      }

      programs = names;
      status = `OK — ${names.length} programs loaded`;

      // Report file sizes
      const wasmResp = await fetch(`${base}/wasm/libdedx.wasm`);
      const wasmBytes = (await wasmResp.blob()).size;
      wasmFileSize = `WASM: ${(wasmBytes / 1024).toFixed(0)} KB`;
    } catch (e) {
      status = `FAIL: ${e instanceof Error ? e.message : String(e)}`;
      console.error("WASM load error:", e);
    }
  }
</script>

<h1>WASM Preload Spike</h1>
<p>Status: <strong>{status}</strong></p>
<p>{wasmFileSize}</p>
{#if programs.length > 0}
  <h2>Programs from libdedx:</h2>
  <ul>
    {#each programs as p}
      <li>{p}</li>
    {/each}
  </ul>
{/if}
