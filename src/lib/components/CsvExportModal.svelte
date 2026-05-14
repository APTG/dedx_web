<script lang="ts">
  import { Dialog } from "bits-ui";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import type { CsvOptions } from "$lib/export/csv";

  interface Props {
    open: boolean;
    defaultFilename: string;
    onConfirm: (options: CsvOptions, filename: string) => void;
    onCancel: () => void;
  }

  let { open, defaultFilename, onConfirm, onCancel }: Props = $props();

  // Local state for form fields
  let separator = $state<"comma" | "semicolon" | "tab">("comma");
  let lineEndings = $state<"crlf" | "lf">("crlf");
  let filename = $state<string>("");
  const headingId = `csv-export-heading-${Math.random().toString(36).slice(2)}`;

  // Initialize form state when modal opens
  $effect(() => {
    if (open) {
      filename = defaultFilename;
      
      // Load saved preferences from localStorage on mount
      if (typeof localStorage !== "undefined") {
        const savedSeparator = localStorage.getItem("csvExportSeparator") as "comma" | "semicolon" | "tab" | null;
        const savedLineEndings = localStorage.getItem("csvExportLineEndings") as "crlf" | "lf" | null;

        // Only apply if valid values
        if (savedSeparator && ["comma", "semicolon", "tab"].includes(savedSeparator)) {
          separator = savedSeparator;
        }
        if (savedLineEndings && ["crlf", "lf"].includes(savedLineEndings)) {
          lineEndings = savedLineEndings;
        }
      }
    }
  });

  function handleConfirm() {
    // Append .csv extension if user omitted it
    const finalFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;

    // Save preferences to localStorage
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("csvExportSeparator", separator);
      localStorage.setItem("csvExportLineEndings", lineEndings);
    }

    onConfirm({ separator, lineEndings }, finalFilename);
  }

  function handleCancel() {
    onCancel();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      handleCancel();
    }
  }
</script>

<Dialog.Root open={open} onOpenChange={(newOpen) => !newOpen && handleCancel()}>
    <Dialog.Portal>
      <Dialog.Overlay
        class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
      />
      <Dialog.Content
        data-testid="csv-export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onkeydown={handleKeyDown}
        class="fixed left-[50%] top-[50%] z-50 w-full max-w-[400px] translate-x-[-50%] translate-y-[-50%] rounded-md border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
      >
        <Dialog.Title id={headingId} class="text-lg font-semibold">
          Export CSV
        </Dialog.Title>
        <Dialog.Description class="mt-1 text-sm text-muted-foreground">
          Choose your preferred CSV format options
        </Dialog.Description>

        <div class="mt-4 grid gap-4">
          <!-- Separator radio group -->
          <div class="grid gap-2">
            <Label>Separator</Label>
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2">
                <input
                  data-testid="csv-separator-comma"
                  type="radio"
                  name="separator"
                  value="comma"
                  checked={separator === "comma"}
                  onchange={() => (separator = "comma")}
                />
                <span class="text-sm">Comma (,)</span>
              </label>
              <label class="flex items-center gap-2">
                <input
                  data-testid="csv-separator-semicolon"
                  type="radio"
                  name="separator"
                  value="semicolon"
                  checked={separator === "semicolon"}
                  onchange={() => (separator = "semicolon")}
                />
                <span class="text-sm">Semicolon (;)</span>
              </label>
              <label class="flex items-center gap-2">
                <input
                  data-testid="csv-separator-tab"
                  type="radio"
                  name="separator"
                  value="tab"
                  checked={separator === "tab"}
                  onchange={() => (separator = "tab")}
                />
                <span class="text-sm">Tab</span>
              </label>
            </div>
          </div>

          <!-- Line endings radio group -->
          <div class="grid gap-2">
            <Label>Line Endings</Label>
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2">
                <input
                  data-testid="csv-line-endings-crlf"
                  type="radio"
                  name="lineEndings"
                  value="crlf"
                  checked={lineEndings === "crlf"}
                  onchange={() => (lineEndings = "crlf")}
                />
                <span class="text-sm">CRLF</span>
              </label>
              <label class="flex items-center gap-2">
                <input
                  data-testid="csv-line-endings-lf"
                  type="radio"
                  name="lineEndings"
                  value="lf"
                  checked={lineEndings === "lf"}
                  onchange={() => (lineEndings = "lf")}
                />
                <span class="text-sm">LF</span>
              </label>
            </div>
          </div>

          <!-- Filename input -->
          <div class="grid gap-2">
            <Label for="csv-filename">Filename</Label>
            <Input
              id="csv-filename"
              data-testid="csv-filename-input"
              type="text"
              bind:value={filename}
              placeholder="e.g., data.csv"
            />
            <p class="text-xs text-muted-foreground">
              The .csv extension will be added automatically if omitted
            </p>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-2">
          <Button
            data-testid="csv-export-cancel"
            type="button"
            variant="outline"
            onclick={handleCancel}
          >
            Cancel
          </Button>
          <Button
            data-testid="csv-export-confirm"
            type="button"
            onclick={handleConfirm}
          >
            Download CSV
          </Button>
        </div>

        <Dialog.Close
          aria-label="Close modal"
          class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
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
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
