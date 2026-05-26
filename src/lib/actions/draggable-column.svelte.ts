import type { ActionReturn } from "svelte/action";

export interface DraggableColumnParams<T> {
  id: T;
  /** When true, the element is non-draggable and acts as a "lock" (e.g. default column). */
  disabled?: boolean;
  /** Currently dragging id (caller passes the reactive snapshot). */
  draggingId: T | null;
  /** Currently hovered drop-target id (caller passes the reactive snapshot). */
  dragOverId: T | null;
  onDragStart: (id: T, event: DragEvent) => void;
  onDragOver: (id: T, event: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (id: T, event: DragEvent) => void;
  onDragEnd: () => void;
  onKeyDown?: (id: T, event: KeyboardEvent) => void;
}

/**
 * Svelte 5 action that wires HTML native drag-and-drop event listeners for a
 * column reorder pattern. The element is set as `draggable` automatically
 * unless `disabled` is true. Caller owns the reactive state and provides
 * callbacks via the parameter object.
 */
export function draggableColumn<T>(
  node: HTMLElement,
  params: DraggableColumnParams<T>,
): ActionReturn<DraggableColumnParams<T>> {
  let current = params;

  const onDragStart = (event: DragEvent) => current.onDragStart(current.id, event);
  const onDragOver = (event: DragEvent) => current.onDragOver(current.id, event);
  const onDragLeave = () => current.onDragLeave();
  const onDrop = (event: DragEvent) => current.onDrop(current.id, event);
  const onDragEnd = () => current.onDragEnd();
  const onKeyDown = (event: KeyboardEvent) => current.onKeyDown?.(current.id, event);

  function applyAttrs(p: DraggableColumnParams<T>) {
    node.setAttribute("draggable", p.disabled ? "false" : "true");
    node.setAttribute("aria-disabled", p.disabled ? "true" : "false");
    if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "0");
  }

  applyAttrs(params);
  node.addEventListener("dragstart", onDragStart);
  node.addEventListener("dragover", onDragOver);
  node.addEventListener("dragleave", onDragLeave);
  node.addEventListener("drop", onDrop);
  node.addEventListener("dragend", onDragEnd);
  node.addEventListener("keydown", onKeyDown);

  return {
    update(next) {
      current = next;
      applyAttrs(next);
    },
    destroy() {
      node.removeEventListener("dragstart", onDragStart);
      node.removeEventListener("dragover", onDragOver);
      node.removeEventListener("dragleave", onDragLeave);
      node.removeEventListener("drop", onDrop);
      node.removeEventListener("dragend", onDragEnd);
      node.removeEventListener("keydown", onKeyDown);
    },
  };
}

export interface ColumnReorderConfig<T> {
  /** Current displayed order (reactive snapshot from caller). */
  getOrder: () => readonly T[];
  /** Id of the locked (non-draggable) column, e.g. the default program. */
  getLockedId: () => T | null;
  /** Apply a reorder: move `id` so it ends up at `targetIndex`. */
  reorder: (id: T, targetIndex: number) => void;
  /** Human-readable name lookup for live-region announcements. */
  getName: (id: T) => string;
}

/**
 * Creates a self-contained column reorder controller: reactive state +
 * pre-bound handlers compatible with {@link draggableColumn}. Use when a
 * column-reorder pattern needs to be reused across components.
 */
export function createColumnReorder<T>(config: ColumnReorderConfig<T>) {
  let draggingId = $state<T | null>(null);
  let dragOverId = $state<T | null>(null);
  let announcement = $state<string>("");

  function isLocked(id: T): boolean {
    return id === config.getLockedId();
  }

  function handleDragStart(id: T, event: DragEvent) {
    if (isLocked(id) || !event.dataTransfer) return;
    draggingId = id;
    event.dataTransfer.setData("text/plain", String(id));
    event.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(id: T, event: DragEvent) {
    if (!event.dataTransfer || isLocked(id) || draggingId === null || draggingId === id) return;
    event.preventDefault();
    dragOverId = id;
    event.dataTransfer.dropEffect = "move";
  }

  function handleDragLeave() {
    dragOverId = null;
  }

  function handleDrop(targetId: T, event: DragEvent) {
    event.preventDefault();
    dragOverId = null;
    const draggedId = draggingId;
    if (draggedId === null || draggedId === targetId || isLocked(targetId)) {
      draggingId = null;
      return;
    }
    const order = config.getOrder();
    const targetIndex = order.indexOf(targetId);
    const draggedIndex = order.indexOf(draggedId);
    if (targetIndex !== -1 && draggedIndex !== -1) {
      config.reorder(draggedId, targetIndex);
      const minIndex = config.getLockedId() === null ? 0 : 1;
      const announced = Math.min(Math.max(minIndex, targetIndex), order.length - 1) + 1;
      announcement = `${config.getName(draggedId)} moved to position ${announced} of ${order.length}.`;
    }
    draggingId = null;
  }

  function handleDragEnd() {
    draggingId = null;
    dragOverId = null;
  }

  function handleKeyDown(id: T, event: KeyboardEvent) {
    if (isLocked(id) || !event.altKey) return;
    const order = config.getOrder();
    const currentIndex = order.indexOf(id);
    const minIndex = config.getLockedId() === null ? 0 : 1;
    if (currentIndex === -1) return;

    if (event.key === "ArrowRight" && currentIndex < order.length - 1) {
      event.preventDefault();
      const newPos = currentIndex + 1;
      config.reorder(id, newPos);
      announcement = `${config.getName(id)} moved to position ${newPos + 1} of ${order.length}.`;
    } else if (event.key === "ArrowLeft" && currentIndex > minIndex) {
      event.preventDefault();
      const newPos = currentIndex - 1;
      config.reorder(id, newPos);
      announcement = `${config.getName(id)} moved to position ${newPos + 1} of ${order.length}.`;
    }
  }

  return {
    get draggingId() {
      return draggingId;
    },
    get dragOverId() {
      return dragOverId;
    },
    get announcement() {
      return announcement;
    },
    isLocked,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    handleKeyDown,
  };
}

export type ColumnReorderController<T> = ReturnType<typeof createColumnReorder<T>>;
