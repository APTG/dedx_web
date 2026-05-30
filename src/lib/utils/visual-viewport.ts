/**
 * Virtual-keyboard offset handling for full-screen mobile sheets.
 *
 * Modern browsers that honour `interactive-widget=resizes-content` (set in
 * `app.html`) shrink the layout viewport when the on-screen keyboard opens, so
 * a `100dvh` sheet with a sticky footer keeps the footer above the keyboard
 * for free. Older engines (notably iOS Safari < 17) instead overlay the
 * keyboard on top of an unchanged layout viewport; there we read
 * `window.visualViewport` and expose the keyboard height as a `--vkb-offset`
 * CSS variable the sheet can subtract from its height.
 */

/** Minimal shape of `window.visualViewport` we depend on. */
export interface ViewportLike {
  height: number;
  offsetTop: number;
}

/**
 * Keyboard height in CSS pixels, derived from the visual viewport relative to
 * the layout viewport. `height + offsetTop` is the bottom edge of the visible
 * region; the gap to `layoutHeight` is whatever the keyboard (or other inset
 * widget) is covering. Clamped to ≥ 0 and rounded to whole pixels.
 */
export function keyboardOffset(vv: ViewportLike, layoutHeight: number): number {
  return Math.max(0, Math.round(layoutHeight - (vv.height + vv.offsetTop)));
}

/**
 * Subscribe to visual-viewport changes and forward the current keyboard offset
 * to `setOffset`. Returns a cleanup function that detaches the listeners. A
 * no-op (returning a no-op cleanup) when `visualViewport` is unavailable, which
 * keeps it safe to call unconditionally from an `$effect`.
 */
export function useVisualViewport(setOffset: (px: number) => void): () => void {
  if (typeof window === "undefined" || !window.visualViewport) {
    return () => {};
  }
  const vv = window.visualViewport;
  const update = () => setOffset(keyboardOffset(vv, window.innerHeight));
  update();
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  return () => {
    vv.removeEventListener("resize", update);
    vv.removeEventListener("scroll", update);
  };
}
