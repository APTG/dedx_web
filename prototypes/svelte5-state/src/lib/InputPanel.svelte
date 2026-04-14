<script lang="ts">
  import { selectedValue, inputText, items } from "./state/counter.svelte.ts";
  import { isAdvancedMode } from "./state/ui.svelte.ts";

  function increment() {
    selectedValue.value += 1;
  }

  function decrement() {
    selectedValue.value -= 1;
  }

  function toggleMode() {
    isAdvancedMode.value = !isAdvancedMode.value;
  }

  function addItem() {
    items.value = [...items.value, `Item ${items.value.length + 1}`];
  }

  function replaceAllItems() {
    items.value = ["Replaced A", "Replaced B", "Replaced C"];
  }
</script>

<div style="border: 1px solid blue; padding: 1rem; margin: 1rem;">
  <h2>InputPanel (writer)</h2>

  <div>
    <button onclick={decrement}>-</button>
    <span>Selected: {selectedValue.value}</span>
    <button onclick={increment}>+</button>
  </div>

  <div>
    <label>
      Energy input (one number per line):
      <textarea
        value={inputText.value}
        oninput={(e) => { inputText.value = (e.target as HTMLTextAreaElement).value; }}
        rows="4"
        cols="30"
      ></textarea>
    </label>
  </div>

  <div>
    <button onclick={toggleMode}>
      Toggle mode (current: {isAdvancedMode.value ? "Advanced" : "Basic"})
    </button>
  </div>

  <div>
    <button onclick={addItem}>Add item</button>
    <button onclick={replaceAllItems}>Replace all items</button>
  </div>
</div>
