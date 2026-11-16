export interface KeyEventLike {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export interface KeyNavTargetContext {
  tagName: string;
  role?: string | null;
  isInsideOpenPopup?: boolean;
  isSkipEnterButton?: boolean;
  hasRepeatableRow?: boolean;
  hasSaveAndAddNext?: boolean;
}

export type KeyNavAction =
  | "native"
  | "passthrough"
  | "save"
  | "save_and_next"
  | "cancel"
  | "next"
  | "prev"
  | "next_or_save"
  | "add_passenger";

export interface KeyNavDecision {
  action: KeyNavAction;
  shouldPreventDefault: boolean;
}

/**
 * Pure keyboard-navigation decision engine shared across all forms.
 *
 * Guarantees:
 * - Tab and Shift+Tab ALWAYS return `action: "native"` with `shouldPreventDefault: false`
 *   so native forward/backward tabbing never breaks or gets trapped.
 * - Enter moves forward (next field), opening comboboxes/selects natively and adding newlines in textareas.
 * - Shift+Enter moves backward to the previous field across inputs, dropdowns, comboboxes, date/time fields, and textareas.
 * - Ctrl/Cmd+Enter inside a repeatable passenger row triggers Add Passenger; outside triggers Save (or next field from textarea).
 */
export function classifyFormKeyAction(
  event: KeyEventLike,
  ctx: KeyNavTargetContext
): KeyNavDecision {
  const keyLower = (event.key || "").toLowerCase();
  const isCtrlOrCmd = Boolean(event.ctrlKey || event.metaKey);
  const shift = Boolean(event.shiftKey);
  const alt = Boolean(event.altKey);
  const tag = (ctx.tagName || "").toUpperCase();
  const role = (ctx.role || "").toLowerCase();

  // 0. Never intercept or preventDefault on Tab or Shift+Tab
  if (event.key === "Tab") {
    return { action: "native", shouldPreventDefault: false };
  }

  // 1. Ctrl/Cmd + S -> Save
  if (isCtrlOrCmd && keyLower === "s" && !alt) {
    return { action: "save", shouldPreventDefault: true };
  }

  // 2. Ctrl/Cmd + Shift + Enter -> Save & Add Next (when callback provided)
  if (isCtrlOrCmd && shift && event.key === "Enter" && !alt && ctx.hasSaveAndAddNext) {
    return { action: "save_and_next", shouldPreventDefault: true };
  }

  // 3. Escape -> passthrough if popup is open, otherwise cancel
  if (event.key === "Escape") {
    if (ctx.isInsideOpenPopup) {
      return { action: "passthrough", shouldPreventDefault: false };
    }
    return { action: "cancel", shouldPreventDefault: true };
  }

  // Let open listbox / SearchableSelect popover handle its own navigation
  if (ctx.isInsideOpenPopup) {
    return { action: "passthrough", shouldPreventDefault: false };
  }

  // 4. Ctrl/Cmd + Enter
  if (isCtrlOrCmd && !shift && !alt && event.key === "Enter") {
    if (tag === "TEXTAREA") {
      return { action: "next_or_save", shouldPreventDefault: true };
    }
    if (ctx.hasRepeatableRow) {
      return { action: "add_passenger", shouldPreventDefault: true };
    }
    return { action: "save", shouldPreventDefault: true };
  }

  // Only Enter without Ctrl/Meta/Alt from here onward
  if (event.key !== "Enter" || isCtrlOrCmd || alt) {
    return { action: "passthrough", shouldPreventDefault: false };
  }

  // 5. Textarea: Enter inserts newline; Shift+Enter goes to previous field
  if (tag === "TEXTAREA") {
    if (shift) {
      return { action: "prev", shouldPreventDefault: true };
    }
    return { action: "passthrough", shouldPreventDefault: false };
  }

  // 6. Shift+Enter -> previous visual field from any input/select/combobox/button
  if (shift) {
    return { action: "prev", shouldPreventDefault: true };
  }

  // 7. Combobox / Select trigger: Enter opens dropdown natively
  if (role === "combobox") {
    return { action: "passthrough", shouldPreventDefault: false };
  }

  // 8. Action buttons (Save, Cancel, Add Passenger, Search, etc.): native click on Enter
  if (tag === "BUTTON" && ctx.isSkipEnterButton && !["switch", "checkbox", "radio"].includes(role)) {
    return { action: "passthrough", shouldPreventDefault: false };
  }

  // 9. Advance to next field
  return { action: "next", shouldPreventDefault: true };
}

export interface VisualRectSortable<T> {
  item: T;
  domIndex: number;
  top: number;
  left: number;
  navOrder?: number;
}

/**
 * Sorts controls top-to-bottom, left-to-right matching visual layout.
 */
export function sortVisualEntries<T>(entries: VisualRectSortable<T>[]): T[] {
  const copy = [...entries];
  copy.sort((a, b) => {
    const orderA = a.navOrder || 0;
    const orderB = b.navOrder || 0;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    const verticalDiff = a.top - b.top;
    if (Math.abs(verticalDiff) > 8) {
      return verticalDiff;
    }
    const leftDiff = a.left - b.left;
    if (Math.abs(leftDiff) > 4) {
      return leftDiff;
    }
    return a.domIndex - b.domIndex;
  });
  return copy.map((entry) => entry.item);
}

/**
 * Computes the next or previous index in visual order without trapping/wrapping.
 */
export function resolveAdjacentIndex(
  currentIndex: number,
  total: number,
  direction: "next" | "prev"
): number {
  if (total <= 0) return -1;
  if (direction === "next") {
    if (currentIndex === -1) return 0;
    return currentIndex < total - 1 ? currentIndex + 1 : -1;
  }
  // prev
  if (currentIndex > 0) return currentIndex - 1;
  return -1;
}

