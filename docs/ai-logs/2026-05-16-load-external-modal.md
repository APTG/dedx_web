# 2026-05-16 — Load-external modal (issue #510)

## Session Narrative

### Prompt 1: Build load-external-modal + wire disabled button

User asked to build `src/lib/components/entity-selection/load-external-modal.svelte` with:

- URL paste validator (`https?://…/*.webdedx` regex)
- Drag-drop file/directory zone
- `webdedx.externalRecents.v1` localStorage recents (5 most recent URL loads)
- Wire to `ExternalDataService.loadFromUrl(...)` / `loadFromDirectory(...)`
- Enable the disabled `picker-load-external` button

**AI response**:

Created branch `feat/issue-510-load-external-modal` and implemented:

1. **`src/lib/external-data/fsdh-store.ts`** — `FileSystemDirectoryHandleStore`, a zarrita-compatible
   readable store backed by the browser File System Access API
   (`FileSystemDirectoryHandle`). Enables Chrome/Edge 86+ to load a local `.webdedx` directory
   without serving it over HTTP.

2. **`src/lib/external-data/loader.ts`** — added `loadStoreMetadataFromStore(store, descriptor)`
   and made the store parameter optional on `loadStpSlice` / `loadCsdaSlice` (5th arg
   `storeOverride?: AnyStore`). The existing `loadStoreMetadata(descriptor)` remains unchanged
   as the primary entry point for HTTP sources.

3. **`src/lib/external-data/service.ts`** — added:
   - `_stores: Map<string, any>` — retains FSDH store instances per label for slice loads
   - `loadFromUrl(url, label)` — thin wrapper around `loadSource()`
   - `loadFromDirectory(handle, label)` — creates `FileSystemDirectoryHandleStore`, loads
     metadata via `loadStoreMetadataFromStore`, caches store and metadata
   - `evict()` and `clear()` now also clear `_stores`
   - `getStp()` / `getCsda()` pass `_stores.get(label)` as store override

4. **`src/lib/external-data/url.ts`** — `externalDataQuerySegments` now filters out sources whose
   URL is not `http(s)://`, silently excluding FSDH-loaded sources (blob/empty URLs) from the
   shareable URL.

5. **`src/lib/components/entity-selection/load-external-modal.svelte`** — two-tab modal (URL | Local directory):
   - **URL tab**: URL input with regex validation, auto-filled label derived from URL stem, label
     uniqueness check against `existingLabels` prop. Calls `externalDataService.loadFromUrl()`.
   - **File tab**: drag-drop zone using File System Access API (`showDirectoryPicker` / `getAsFileSystemHandle`).
     Graceful degradation message for unsupported browsers. Calls `externalDataService.loadFromDirectory()`.
   - **Recents** section: last 5 successful URL loads from `webdedx.externalRecents.v1`; clicking
     a recent pre-fills the URL tab (auto-deduplicating labels if already loaded).
   - Uses `bits-ui` `Dialog.Root` pattern matching `CsvExportModal.svelte`.

6. **`src/lib/components/entity-selection/entity-selection.svelte`** — added `onLoadExternal?: () => void`
   prop, passed through to `AdvancedToolbar`. The toolbar button was already wired; passing a
   non-undefined callback enables it.

7. **`src/routes/calculator/+page.svelte`** — added:
   - `compatibilityMatrix: CompatibilityMatrix | null` state, set once during WASM init
   - `showLoadExternalModal: boolean` state
   - `handleModalLoad(descriptor, metadata)`: appends new source to `loadedExternalSources`,
     rebuilds `ExternalCompatibilityContext` and calls `entityState.setExternalContext()`
   - `handleRemoveExternalSource` now also rebuilds the context after removal
   - `onLoadExternal={() => (showLoadExternalModal = true)}` prop on `<EntitySelection>`
   - `<LoadExternalModal>` rendered in template next to `<ExternalSourcesPanel>`

**Decisions**:

- FSDH store does full file reads (no streaming Range support) via `File.arrayBuffer()`. The
  `getRange` override slices in-memory — acceptable given typical `.webdedx` shard sizes.
- File-based sources get `url: ""` in their descriptor; `externalDataQuerySegments` filters
  them out, so they never appear in the shareable URL.
- Recents only track URL-based loads (file loads are ephemeral and non-reproducible).
- Label auto-fill is derived from the URL path stem; user can override before loading.

## Tasks

### load-external-modal + service wiring

- **Status**: completed
- **Stage**: entity-selection (issue #510)
- **Files changed**:
  - `src/lib/external-data/fsdh-store.ts` (new)
  - `src/lib/external-data/loader.ts`
  - `src/lib/external-data/service.ts`
  - `src/lib/external-data/url.ts`
  - `src/lib/components/entity-selection/load-external-modal.svelte` (new)
  - `src/lib/components/entity-selection/entity-selection.svelte`
  - `src/routes/calculator/+page.svelte`
  - `src/tests/unit/external-data-service.test.ts` (test updated for new 5-arg signature)
- **Decision**: Used `FileSystemDirectoryHandleStore` + zarrita generic `root(store)` rather than
  serving files via an object URL, because Zarr v3 stores are directories, not single files.
- **Issue**: Local directory loading is Chrome/Edge only (Firefox lacks `FileSystemDirectoryHandle`).
  A fallback message is shown. No URL sync for file-based sources by design.
