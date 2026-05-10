<script lang="ts">
  import { Dialog } from "bits-ui";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import type { StoredCompoundInternal, CompoundElementEntry } from "$lib/state/custom-compounds.svelte";
  import { ELEMENTS, resolveElement } from "$lib/utils/element-data";
  import { cn } from "$lib/utils";

  interface CompoundEditorFormData {
    name: string;
    density: string;
    iValue: string;
    phase: "gas" | "condensed";
    elements: CompoundElementEntry[];
  }

  interface Props {
    open: boolean;
    compound: StoredCompoundInternal | null;
    onOpenChange: (open: boolean) => void;
    onSave: (data: Omit<CompoundEditorFormData, "iValue"> & { iValue?: number }) => void;
    onDelete: () => void;
  }

  let { open, compound, onOpenChange, onSave, onDelete }: Props = $props();

  const initialData: CompoundEditorFormData = {
    name: "",
    density: "",
    iValue: "",
    phase: "condensed",
    elements: [{ atomicNumber: 1, atomCount: 1 }],
  };

  let formData = $state<CompoundEditorFormData>({ ...initialData });
  let errors = $state<Record<string, string>>({});
  let mode = $state<"formula" | "weight">("formula");
  let showDeleteConfirm = $state(false);

  $effect(() => {
    if (open && compound) {
      formData.name = compound.name;
      formData.density = String(compound.density);
      formData.iValue = compound.iValue ? String(compound.iValue) : "";
      formData.phase = compound.phase;
      formData.elements = compound.elements.map((e) => ({ ...e }));
      mode = "formula";
      errors = {};
    } else if (open && !compound) {
      formData = { ...initialData };
      errors = {};
      mode = "formula";
    }
  });

  function getElementSymbol(z: number): string {
    return ELEMENTS.find((e) => e.atomicNumber === z)?.symbol ?? "";
  }

  function getElementName(z: number): string {
    return ELEMENTS.find((e) => e.atomicNumber === z)?.name ?? "";
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Name is required.";
    } else if (formData.name.trim().length > 80) {
      newErrors.name = "Name must be 80 characters or fewer.";
    }

    const density = parseFloat(formData.density);
    if (!formData.density || isNaN(density)) {
      newErrors.density = "Density is required.";
    } else if (density <= 0) {
      newErrors.density = "Density must be greater than zero.";
    } else if (density > 25) {
      newErrors.density = "Density must be ≤ 25 g/cm³.";
    }

    if (formData.iValue) {
      const iVal = parseFloat(formData.iValue);
      if (isNaN(iVal) || iVal <= 0) {
        newErrors.iValue = "I-value must be a positive number.";
      } else if (iVal > 10000) {
        newErrors.iValue = "I-value must be ≤ 10 000 eV.";
      }
    }

    if (!formData.elements || formData.elements.length === 0) {
      newErrors.elements = "At least one element is required.";
    } else {
      const seenZ = new Set<number>();
      for (const elem of formData.elements) {
        if (elem.atomicNumber < 1 || elem.atomicNumber > 118) {
          newErrors.elements = `Unknown element: Z=${elem.atomicNumber}.`;
          break;
        }
        if (seenZ.has(elem.atomicNumber)) {
          newErrors.elements = `Element Z=${elem.atomicNumber} is listed more than once. Combine into a single row.`;
          break;
        }
        seenZ.add(elem.atomicNumber);
        if (elem.atomCount <= 0) {
          newErrors.elements = "Atom count must be greater than zero.";
          break;
        } else if (elem.atomCount > 1000) {
          newErrors.elements = "Atom count must be ≤ 1000.";
          break;
        }
      }
    }

    errors = newErrors;
    return Object.keys(errors).length === 0;
  }

  function handleSave() {
    const valid = validate();
    if (valid) {
      const data = {
        name: formData.name,
        density: parseFloat(formData.density),
        iValue: formData.iValue ? parseFloat(formData.iValue) : undefined,
        phase: formData.phase,
        elements: formData.elements,
      };
      onSave(data);
    }
  }

  function handleAddElement() {
    formData.elements.push({ atomicNumber: 1, atomCount: 1 });
  }

  function handleRemoveElement(index: number) {
    if (formData.elements.length > 1) {
      formData.elements.splice(index, 1);
    }
  }

  function handleElementChange(index: number, input: string) {
    const element = resolveElement(input);
    if (element) {
      formData.elements[index].atomicNumber = element.atomicNumber;
    }
  }

  function handleAtomCountChange(index: number, count: string) {
    const num = parseInt(count, 10);
    if (!isNaN(num) && num > 0) {
      formData.elements[index].atomCount = num;
    }
  }
</script>

<Dialog.Root open={open} onOpenChange={(newOpen) => {
      if (!newOpen && showDeleteConfirm) {
        showDeleteConfirm = false;
      }
      onOpenChange(newOpen);
    }}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        <Dialog.Content
          class="fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-md border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:max-w-[500px]"
        >
          <form
            onsubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
          <Dialog.Title class="text-lg font-semibold">
            {#if showDeleteConfirm}Delete Compound{:else}{compound ? "Edit Compound" : "Compound Editor"}{/if}
          </Dialog.Title>
          {#if showDeleteConfirm}
            <p class="mt-1 text-sm text-muted-foreground">
              Are you sure you want to delete "{compound?.name}"? This action cannot be undone.
            </p>
          {:else}
            <Dialog.Description class="mt-1 text-sm text-muted-foreground">
              {compound ? "Update compound properties" : "Define a new compound material"}
            </Dialog.Description>
          {/if}

          {#if !showDeleteConfirm}
            <div class="mt-4 grid gap-4">
              <div class="grid gap-2">
                <Label for="compound-name">Name</Label>
                <Input
                  id="compound-name"
                  bind:value={formData.name}
                  placeholder="e.g., LiF Pellet"
                  class={cn(errors.name && "border-destructive")}
                  onkeydown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      (e.currentTarget as HTMLInputElement).blur();
                    }
                  }}
                />
                {#if errors.name}
                  <p class="text-sm text-destructive">{errors.name}</p>
                {/if}
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div class="grid gap-2">
                  <Label for="compound-density">Density (g/cm³)</Label>
                  <Input
                    id="compound-density"
                    type="number"
                    step="0.01"
                    min="0"
                    max="25"
                    bind:value={formData.density}
                    class={cn(errors.density && "border-destructive")}
                  />
                  {#if errors.density}
                    <p class="text-sm text-destructive">{errors.density}</p>
                  {/if}
                </div>

                <div class="grid gap-2">
                  <Label for="compound-ivalue">I-value (eV, optional)</Label>
                  <Input
                    id="compound-ivalue"
                    type="number"
                    step="1"
                    min="0"
                    max="10000"
                    bind:value={formData.iValue}
                    class={cn(errors.iValue && "border-destructive")}
                  />
                  {#if errors.iValue}
                    <p class="text-sm text-destructive">{errors.iValue}</p>
                  {/if}
                </div>
              </div>

              <div class="grid gap-2">
                <Label>Phase</Label>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2">
                    <input
                      type="radio"
                      name="phase"
                      value="condensed"
                      checked={formData.phase === "condensed"}
                      onchange={() => (formData.phase = "condensed")}
                    />
                    <span class="text-sm">Condensed</span>
                  </label>
                  <label class="flex items-center gap-2">
                    <input
                      type="radio"
                      name="phase"
                      value="gas"
                      checked={formData.phase === "gas"}
                      onchange={() => (formData.phase = "gas")}
                    />
                    <span class="text-sm">Gas</span>
                  </label>
                </div>
              </div>

              <div class="grid gap-2">
                <div class="flex items-center justify-between">
                  <Label>Elements</Label>
                  <div role="tablist" class="flex gap-2">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "formula"}
                      aria-controls="elements-panel"
                      id="formula-tab"
                      aria-label="Formula mode"
                      class={cn(
                        "text-xs font-medium transition-colors hover:text-foreground",
                        mode === "formula" ? "text-foreground" : "text-muted-foreground"
                      )}
                      onclick={() => (mode = "formula")}
                    >
                      Formula
                    </button>
                    <span class="text-muted-foreground">|</span>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "weight"}
                      aria-controls="elements-panel"
                      id="weight-tab"
                      aria-label="Weight fraction mode"
                      class={cn(
                        "text-xs font-medium transition-colors hover:text-foreground",
                        mode === "weight" ? "text-foreground" : "text-muted-foreground"
                      )}
                      onclick={() => (mode = "weight")}
                    >
                      Weight fraction
                    </button>
                  </div>
                </div>

                {#if errors.elements}
                  <p class="text-sm text-destructive">{errors.elements}</p>
                {/if}

                <div class="grid gap-2">
                  {#each formData.elements as element, index (index)}
                    <div class="flex items-center gap-2">
                      <div class="relative flex-1">
                        <Input
                          type="text"
                          placeholder="Symbol or Z"
                          value={getElementSymbol(element.atomicNumber)}
                          oninput={(e) => handleElementChange(index, (e.currentTarget as HTMLInputElement).value)}
                          class="pr-12"
                        />
                        <span class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          Z={element.atomicNumber}
                        </span>
                      </div>
                      {#if mode === "formula"}
                        <Input
                          type="number"
                          min="1"
                          max="1000"
                          placeholder="Count"
                          value={String(element.atomCount)}
                          oninput={(e) => handleAtomCountChange(index, (e.currentTarget as HTMLInputElement).value)}
                          class="w-20"
                        />
                      {:else}
                        <span class="w-20 text-right text-sm text-muted-foreground">
                          {((element.atomCount * (ELEMENTS.find(e => e.atomicNumber === element.atomicNumber)?.atomicWeight ?? 0)) / 
                            formData.elements.reduce((sum, e) => sum + (e.atomCount * (ELEMENTS.find(el => el.atomicNumber === e.atomicNumber)?.atomicWeight ?? 0)), 0) * 100).toFixed(1)}%
                        </span>
                      {/if}
                      <button
                        type="button"
                        class="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onclick={() => handleRemoveElement(index)}
                        aria-label="Remove element"
                        disabled={formData.elements.length === 1}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  {/each}
                </div>

                <button
                  type="button"
                  class="text-sm font-medium text-primary hover:underline"
                  onclick={handleAddElement}
                >
                  + Add element
                </button>
              </div>
            </div>

            <div class="mt-6 flex justify-between">
              {#if compound}
                <Button type="button" variant="destructive" onclick={() => (showDeleteConfirm = true)}>
                  Delete
                </Button>
              {:else}
                <div></div>
              {/if}
              <div class="flex gap-2">
                <Button type="button" variant="outline" onclick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" onclick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
          {:else}
            <div class="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onclick={() => (showDeleteConfirm = false)}>
                Cancel
              </Button>
              <Button type="button" variant="destructive" onclick={() => { onDelete(); showDeleteConfirm = false; }}>
                Delete
              </Button>
            </div>
          {/if}
          </form>

          <Dialog.Close class="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground" />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
