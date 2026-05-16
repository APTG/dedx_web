<script lang="ts">
  import { Dialog } from "bits-ui";
  import { Button } from "$lib/components/ui/button";
  import { externalDataService } from "$lib/external-data/service";
  import { ExternalDataError } from "$lib/external-data/errors";
  import type { ExternalSourceDescriptor } from "$lib/external-data/types";
  import type { ExternalStoreMetadata } from "$lib/external-data/schema";

  const RECENTS_KEY = "webdedx.externalRecents.v1";
  const MAX_RECENTS = 5;
  const LABEL_RE = /^[A-Za-z0-9_-]+$/;
  /** Matches https:// … .webdedx with optional trailing slash. */
  const HTTPS_URL_RE = /^https:\/\/.+\.webdedx\/?$/i;
  const LOCALHOST_HTTP_URL_RE =
    /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/.+\.webdedx\/?$/i;

  interface ExternalRecent {
    url: string;
    label: string;
    name: string;
    loadedAt: number;
  }

  interface Props {
    open: boolean;
    existingLabels: Set<string>;
    onLoad: (descriptor: ExternalSourceDescriptor, metadata: ExternalStoreMetadata) => void;
    onCancel: () => void;
  }

  let { open, existingLabels, onLoad, onCancel }: Props = $props();

  type Tab = "url" | "file";
  let activeTab = $state<Tab>("url");
  let loading = $state(false);

  // --- URL tab ---
  let urlValue = $state("");
  let labelValue = $state("");
  let urlError = $state<string | null>(null);
  let labelError = $state<string | null>(null);
  let loadError = $state<string | null>(null);
  let labelAutoFilled = $state(false);

  // --- File tab ---
  let dragOver = $state(false);
  let pendingHandle = $state<FileSystemDirectoryHandle | null>(null);
  let pendingFilename = $state<string>("");
  let fileLabel = $state("");
  let fileLabelError = $state<string | null>(null);
  let fileLoadError = $state<string | null>(null);
  let fsaSupported = $state(false);

  // --- Recents ---
  let recents = $state<ExternalRecent[]>([]);

  const headingId = `load-ext-heading-${Math.random().toString(36).slice(2)}`;

  $effect(() => {
    if (!open) return;
    // Detect File System Access API support
    fsaSupported = typeof FileSystemDirectoryHandle !== "undefined";
    // Reset all state when modal opens
    activeTab = "url";
    urlValue = "";
    labelValue = "";
    urlError = null;
    labelError = null;
    loadError = null;
    labelAutoFilled = false;
    dragOver = false;
    pendingHandle = null;
    pendingFilename = "";
    fileLabel = "";
    fileLabelError = null;
    fileLoadError = null;
    recents = loadRecents();
  });

  function loadRecents(): ExternalRecent[] {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      return raw ? (JSON.parse(raw) as ExternalRecent[]) : [];
    } catch {
      return [];
    }
  }

  function saveRecent(url: string, label: string, name: string) {
    if (typeof localStorage === "undefined") return;
    const entry: ExternalRecent = { url, label, name, loadedAt: Date.now() };
    const updated = [entry, ...loadRecents().filter((r) => r.url !== url)].slice(0, MAX_RECENTS);
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
    } catch {
      // Best-effort persistence only — don't block a successful source load.
    }
    recents = updated;
  }

  function labelFromUrl(url: string): string {
    try {
      const u = new URL(url);
      const stem = u.pathname.split("/").filter(Boolean).pop() ?? "";
      return sanitizeLabel(stem.replace(/\.webdedx$/i, ""));
    } catch {
      return "ext";
    }
  }

  function sanitizeLabel(raw: string): string {
    const clean = raw.replace(/[^A-Za-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    return clean.slice(0, 32) || "ext";
  }

  function validateLabelValue(value: string): string | null {
    if (!value.trim()) return "Label is required";
    if (!LABEL_RE.test(value)) return "Use only letters, digits, - and _";
    if (existingLabels.has(value)) return `"${value}" is already loaded`;
    return null;
  }

  // --- URL tab handlers ---

  function handleUrlInput(value: string) {
    urlValue = value;
    urlError = null;
    loadError = null;
    if (value && labelAutoFilled) {
      // Keep auto-filling while user hasn't manually edited the label
      labelValue = labelFromUrl(value);
    } else if (value && !labelValue) {
      labelValue = labelFromUrl(value);
      labelAutoFilled = true;
    }
  }

  function handleLabelInput(value: string) {
    labelValue = value;
    labelError = null;
    labelAutoFilled = false;
  }

  async function handleLoadUrl() {
    const url = urlValue.trim();
    const label = labelValue.trim();

    if (!url) {
      urlError = "URL is required";
      return;
    }
    if (!HTTPS_URL_RE.test(url) && !LOCALHOST_HTTP_URL_RE.test(url)) {
      urlError = "Must be https://… .webdedx (http://localhost allowed)";
      return;
    }
    const le = validateLabelValue(label);
    if (le) {
      labelError = le;
      return;
    }

    loading = true;
    loadError = null;
    try {
      const metadata = await externalDataService.loadFromUrl(url, label);
      saveRecent(url, label, metadata.name || label);
      onLoad({ label, url }, metadata);
    } catch (err) {
      loadError = err instanceof ExternalDataError ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function handleRecentClick(recent: ExternalRecent) {
    if (existingLabels.has(recent.label)) {
      urlValue = recent.url;
      // Generate a fresh label since the stored one is taken
      const base = recent.label;
      let candidate = base;
      for (let i = 2; i < 100; i++) {
        if (!existingLabels.has(candidate)) break;
        candidate = `${base}-${i}`;
      }
      labelValue = candidate;
    } else {
      urlValue = recent.url;
      labelValue = recent.label;
    }
    labelAutoFilled = false;
    urlError = null;
    labelError = null;
    loadError = null;
    activeTab = "url";
  }

  // --- File / directory tab handlers ---

  async function handlePickDirectory() {
    if (!fsaSupported) return;
    try {
      // @ts-expect-error — FileSystem Access API, not yet in lib.dom.d.ts everywhere
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({ mode: "read" });
      setPendingHandle(handle);
    } catch {
      // User cancelled — ignore
    }
  }

  function setPendingHandle(handle: FileSystemDirectoryHandle) {
    pendingHandle = handle;
    pendingFilename = handle.name;
    if (!fileLabel || fileLabelError) {
      fileLabel = sanitizeLabel(handle.name.replace(/\.webdedx$/i, ""));
      fileLabelError = null;
    }
    fileLoadError = null;
  }

  async function handleLoadDirectory() {
    if (!pendingHandle) {
      fileLoadError = "No directory selected";
      return;
    }
    const label = fileLabel.trim();
    const le = validateLabelValue(label);
    if (le) {
      fileLabelError = le;
      return;
    }

    loading = true;
    fileLoadError = null;
    try {
      const metadata = await externalDataService.loadFromDirectory(pendingHandle, label);
      onLoad({ label, url: "" }, metadata);
    } catch (err) {
      fileLoadError = err instanceof ExternalDataError ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  async function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;

    // Try to get a FileSystemDirectoryHandle via the File System Access API
    const items = Array.from(e.dataTransfer?.items ?? []);
    for (const item of items) {
      if (typeof item.getAsFileSystemHandle === "function") {
        try {
          const handle = await item.getAsFileSystemHandle();
          if (handle?.kind === "directory") {
            setPendingHandle(handle as FileSystemDirectoryHandle);
            activeTab = "file";
            return;
          }
        } catch {
          // getAsFileSystemHandle not available in this context
        }
      }
    }

    // Fallback: check for a dragged URL (e.g. link from browser address bar)
    const uriList = e.dataTransfer?.getData("text/uri-list");
    const text = e.dataTransfer?.getData("text/plain");
    const dropped = (uriList || text || "").trim().split("\n")[0]?.trim() ?? "";
    if (/^https?:\/\//i.test(dropped)) {
      activeTab = "url";
      handleUrlInput(dropped);
    } else {
      fileLoadError = "Drop a .webdedx directory or paste a URL";
      activeTab = "file";
    }
  }
</script>

<Dialog.Root {open} onOpenChange={(o) => !o && onCancel()}>
  <Dialog.Portal>
    <Dialog.Overlay
      class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <Dialog.Content
      data-testid="load-external-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      class="fixed left-[50%] top-[50%] z-50 w-full max-w-[480px] translate-x-[-50%] translate-y-[-50%] rounded-md border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
    >
      <Dialog.Title id={headingId} class="text-lg font-semibold">
        Load external data source
      </Dialog.Title>
      <Dialog.Description class="mt-1 text-sm text-muted-foreground">
        Load a <code class="font-mono text-xs">.webdedx</code> Zarr v3 store from a URL or a local
        directory.
      </Dialog.Description>

      <!-- Tabs -->
      <div class="mt-4 flex gap-1 rounded-md border p-0.5 text-sm" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === "url"}
          data-testid="load-ext-tab-url"
          class="flex-1 rounded px-3 py-1.5 font-medium transition-colors {activeTab === 'url'
            ? 'bg-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => (activeTab = "url")}
        >
          URL
        </button>
        <button
          role="tab"
          aria-selected={activeTab === "file"}
          data-testid="load-ext-tab-file"
          class="flex-1 rounded px-3 py-1.5 font-medium transition-colors {activeTab === 'file'
            ? 'bg-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground'}"
          onclick={() => (activeTab = "file")}
        >
          Local directory
        </button>
      </div>

      <!-- URL tab panel -->
      {#if activeTab === "url"}
        <div class="mt-4 grid gap-3" data-testid="load-ext-url-panel">
          <div class="grid gap-1.5">
            <label for="load-ext-url" class="text-sm font-medium">URL</label>
            <input
              id="load-ext-url"
              data-testid="load-ext-url-input"
              type="url"
              autocomplete="off"
              placeholder="https://example.com/dataset.webdedx"
              value={urlValue}
              oninput={(e) => handleUrlInput((e.currentTarget as HTMLInputElement).value)}
              class="w-full rounded border bg-background px-3 py-1.5 font-mono text-sm placeholder:font-sans placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring {urlError
                ? 'border-destructive'
                : ''}"
            />
            {#if urlError}
              <p class="text-xs text-destructive" role="alert">{urlError}</p>
            {/if}
          </div>

          <div class="grid gap-1.5">
            <label for="load-ext-label" class="text-sm font-medium">
              Label <span class="font-normal text-muted-foreground">(unique short name)</span>
            </label>
            <input
              id="load-ext-label"
              data-testid="load-ext-label-input"
              type="text"
              autocomplete="off"
              placeholder="e.g. srim"
              value={labelValue}
              oninput={(e) => handleLabelInput((e.currentTarget as HTMLInputElement).value)}
              class="w-full rounded border bg-background px-3 py-1.5 font-mono text-sm placeholder:font-sans placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring {labelError
                ? 'border-destructive'
                : ''}"
            />
            {#if labelError}
              <p class="text-xs text-destructive" role="alert">{labelError}</p>
            {:else}
              <p class="text-xs text-muted-foreground">
                Letters, digits, - and _ only. Used in entity IDs (<code class="font-mono"
                  >ext:{labelValue || "label"}:…</code
                >).
              </p>
            {/if}
          </div>

          {#if loadError}
            <div
              class="rounded border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
              data-testid="load-ext-error"
            >
              {loadError}
            </div>
          {/if}

          <Button
            data-testid="load-ext-url-submit"
            disabled={loading}
            onclick={handleLoadUrl}
            class="w-full"
          >
            {loading ? "Loading…" : "Load"}
          </Button>
        </div>
      {/if}

      <!-- File / directory tab panel -->
      {#if activeTab === "file"}
        <div class="mt-4 grid gap-3" data-testid="load-ext-file-panel">
          {#if !fsaSupported}
            <p class="rounded border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Local directory loading requires Chrome or Edge 86+. Use the URL tab to load from a
              hosted store.
            </p>
          {:else}
            <!-- Drop zone -->
            <div
              data-testid="load-ext-dropzone"
              role="button"
              tabindex="0"
              aria-label="Drop a .webdedx directory here or click to browse"
              class="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded border-2 border-dashed px-4 py-6 text-center transition-colors {dragOver
                ? 'border-ring bg-accent'
                : 'border-border hover:border-ring/60 hover:bg-accent/40'}"
              ondragover={handleDragOver}
              ondragleave={handleDragLeave}
              ondrop={handleDrop}
              onclick={handlePickDirectory}
              onkeydown={(e) => (e.key === "Enter" || e.key === " ") && handlePickDirectory()}
            >
              {#if pendingHandle}
                <span class="text-2xl">📁</span>
                <p class="text-sm font-medium">{pendingFilename}</p>
                <p class="text-xs text-muted-foreground">Click to choose a different directory</p>
              {:else}
                <span class="text-2xl">📂</span>
                <p class="text-sm font-medium">Drop a .webdedx directory here</p>
                <p class="text-xs text-muted-foreground">or click to browse</p>
              {/if}
            </div>

            {#if pendingHandle}
              <div class="grid gap-1.5">
                <label for="load-ext-file-label" class="text-sm font-medium">Label</label>
                <input
                  id="load-ext-file-label"
                  data-testid="load-ext-file-label-input"
                  type="text"
                  autocomplete="off"
                  placeholder="e.g. srim"
                  value={fileLabel}
                  oninput={(e) => {
                    fileLabel = (e.currentTarget as HTMLInputElement).value;
                    fileLabelError = null;
                  }}
                  class="w-full rounded border bg-background px-3 py-1.5 font-mono text-sm placeholder:font-sans placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring {fileLabelError
                    ? 'border-destructive'
                    : ''}"
                />
                {#if fileLabelError}
                  <p class="text-xs text-destructive" role="alert">{fileLabelError}</p>
                {/if}
              </div>
            {/if}

            {#if fileLoadError}
              <div
                class="rounded border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive"
                role="alert"
                data-testid="load-ext-file-error"
              >
                {fileLoadError}
              </div>
            {/if}

            {#if pendingHandle}
              <Button
                data-testid="load-ext-file-submit"
                disabled={loading}
                onclick={handleLoadDirectory}
                class="w-full"
              >
                {loading ? "Loading…" : "Load directory"}
              </Button>
            {/if}
          {/if}
        </div>
      {/if}

      <!-- Recents -->
      {#if recents.length > 0}
        <div class="mt-5 border-t pt-4">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent
          </p>
          <ul class="grid gap-1" data-testid="load-ext-recents">
            {#each recents as r (r.url)}
              <li>
                <button
                  type="button"
                  data-testid="load-ext-recent-item"
                  class="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  onclick={() => handleRecentClick(r)}
                  title={r.url}
                >
                  <span class="font-medium">{r.name || r.label}</span>
                  <span class="ml-1 text-xs text-muted-foreground">({r.label})</span>
                  <span class="block truncate font-mono text-xs text-muted-foreground">{r.url}</span
                  >
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- Close × button -->
      <Dialog.Close
        aria-label="Close modal"
        class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
