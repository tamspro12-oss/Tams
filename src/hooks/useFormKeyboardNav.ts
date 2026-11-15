import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";

export interface UseFormKeyboardNavOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
  isDirty?: boolean;
  dirtyConfirmMessage?: string;
  autoFocusFirst?: boolean;
  onSave?: () => void;
  onSaveAndAddNext?: () => void;
  onCancel?: () => void;
  /** Return error message string to block advancing, or null/undefined to allow */
  validateField?: (element: HTMLElement) => string | null | undefined;
  /**
   * Optional callback when Enter is pressed on a control with [data-add-passenger-btn="true"]
   * or custom passenger handling. Usually not needed if [data-add-passenger-btn="true"] is a button.
   */
  onBeforeAdvance?: (element: HTMLElement) => boolean | void;
}

const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  'button[role="combobox"]:not([disabled])',
  'button[role="switch"]:not([disabled])',
  'button[role="checkbox"]:not([disabled])',
  'button[role="radio"]:not([disabled])',
  'button[data-enter-target="true"]:not([disabled])',
  'button[data-save-button="true"]:not([disabled])',
  'button[type="submit"]:not([disabled])',
  '[data-enter-target="true"]:not([disabled])',
].join(", ");

const SKIP_ENTER_ON_BUTTON_SELECTOR =
  'button:not([role="combobox"]):not([role="switch"]):not([role="checkbox"]):not([role="radio"]):not([data-enter-target="true"])';

function isElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  // Ignore temporary `data-aria-hidden` applied to background nodes by Radix overlays during close transitions
  if (el.closest('[hidden], .hidden, [aria-hidden="true"]:not([data-aria-hidden])')) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isEditableOrNavigable(el: HTMLElement): boolean {
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") {
    return false;
  }
  if (el.getAttribute("tabindex") === "-1") {
    return false;
  }
  if (el.dataset.lockedDate === "true" || el.closest('[data-locked-date="true"]')) {
    return false;
  }
  if (el.dataset.navSkip === "true" || el.closest('[data-nav-skip="true"]')) {
    return false;
  }
  if (el.dataset.quickAddBtn === "true") {
    return false;
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.readOnly || el.getAttribute("aria-readonly") === "true") {
      return false;
    }
  }

  return isElementVisible(el);
}

/**
 * Returns form fields in visual top-to-bottom, left-to-right order.
 */
export function getVisualFocusableFields(
  container: HTMLElement,
  options?: { excludeButtonsForInitialFocus?: boolean }
): HTMLElement[] {
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));

  const filtered = candidates.filter((el) => {
    if (!isEditableOrNavigable(el)) return false;
    if (
      options?.excludeButtonsForInitialFocus &&
      el.tagName === "BUTTON" &&
      el.getAttribute("role") !== "combobox" &&
      el.getAttribute("role") !== "switch" &&
      el.getAttribute("role") !== "radio"
    ) {
      return false;
    }
    return true;
  });

  const withRects = filtered.map((el, domIndex) => ({
    el,
    domIndex,
    rect: el.getBoundingClientRect(),
  }));

  withRects.sort((a, b) => {
    const orderA = Number(
      a.el.closest("[data-nav-order]")?.getAttribute("data-nav-order") || "0"
    );
    const orderB = Number(
      b.el.closest("[data-nav-order]")?.getAttribute("data-nav-order") || "0"
    );
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    const verticalDiff = a.rect.top - b.rect.top;
    if (Math.abs(verticalDiff) > 8) {
      return verticalDiff;
    }
    const leftDiff = a.rect.left - b.rect.left;
    if (Math.abs(leftDiff) > 4) {
      return leftDiff;
    }
    return a.domIndex - b.domIndex;
  });

  return withRects.map((item) => item.el);
}

function focusControl(el: HTMLElement) {
  el.focus({ preventScroll: false });
  if (
    el instanceof HTMLInputElement &&
    !["date", "time", "datetime-local", "month", "week", "checkbox", "radio", "color", "file"].includes(
      el.type
    )
  ) {
    try {
      el.select();
    } catch {
      // Ignore selection failures on unsupported input types
    }
  }
}

function checkDefaultRequired(el: HTMLElement): string | null {
  const isReq =
    (el instanceof HTMLInputElement && el.required) ||
    (el instanceof HTMLTextAreaElement && el.required) ||
    (el instanceof HTMLSelectElement && el.required) ||
    el.getAttribute("aria-required") === "true" ||
    el.dataset.required === "true";

  if (!isReq) return null;

  const customMsg = el.dataset.requiredMessage;

  if (el instanceof HTMLInputElement) {
    if (el.type === "checkbox" || el.type === "radio") {
      return el.checked ? null : customMsg || "Please select this required option";
    }
    const raw = el.value?.trim() || "";
    if (!raw) {
      return customMsg || "This required field cannot be empty";
    }
    if (el.dataset.requiredPositive === "true" && (Number(raw) || 0) <= 0) {
      return customMsg || "Please enter a value greater than 0";
    }
  } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    if (!(el.value?.trim())) {
      return customMsg || "This required field cannot be empty";
    }
  } else if (el.dataset.empty === "true") {
    return customMsg || "Please select a required value";
  }

  return null;
}

function isHighestDialog(container: HTMLElement): boolean {
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
  if (dialogs.length === 0) return true;
  const myDialog = container.closest('[role="dialog"]');
  if (!myDialog) return true;
  return dialogs[dialogs.length - 1] === myDialog;
}

function hasOpenPopup(): boolean {
  return Boolean(
    document.querySelector(
      '[data-radix-popper-content-wrapper], [role="listbox"][data-state="open"], [data-searchable-select-content="true"]'
    )
  );
}

/**
 * Shared keyboard-driven form navigation hook:
 * - Visual order navigation (top-to-bottom, left-to-right) skipping locked/readOnly/disabled/hidden fields
 * - Auto-focuses first editable field when form opens
 * - Enter moves to next field (Save button on last field; Save button Enter submits)
 * - Shift+Enter & Shift+Tab move backward
 * - Textareas: Enter adds newline, Tab leaves, Ctrl/Cmd+Enter advances or saves
 * - Select / SearchableSelect: Enter opens, Enter selects & auto-advances via tams:field-advance event
 * - Esc closes modal with unsaved-changes confirmation when dirty (unless a dropdown/popover is open)
 * - Ctrl/Cmd+S saves immediately
 */
export function useFormKeyboardNav({
  containerRef,
  enabled = true,
  isDirty = false,
  dirtyConfirmMessage = "You have unsaved changes. Discard and close?",
  autoFocusFirst = true,
  onSave,
  onSaveAndAddNext,
  onCancel,
  validateField,
  onBeforeAdvance,
}: UseFormKeyboardNavOptions) {
  const onSaveRef = useRef(onSave);
  const onSaveAndAddNextRef = useRef(onSaveAndAddNext);
  const onCancelRef = useRef(onCancel);
  const isDirtyRef = useRef(isDirty);
  const dirtyMsgRef = useRef(dirtyConfirmMessage);
  const validateFieldRef = useRef(validateField);
  const onBeforeAdvanceRef = useRef(onBeforeAdvance);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onSaveAndAddNextRef.current = onSaveAndAddNext;
  }, [onSaveAndAddNext]);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    dirtyMsgRef.current = dirtyConfirmMessage;
  }, [dirtyConfirmMessage]);

  useEffect(() => {
    validateFieldRef.current = validateField;
  }, [validateField]);

  useEffect(() => {
    onBeforeAdvanceRef.current = onBeforeAdvance;
  }, [onBeforeAdvance]);

  const focusFirstField = useCallback(() => {
    const container = containerRef.current;
    if (!container) return false;
    const fields = getVisualFocusableFields(container, {
      excludeButtonsForInitialFocus: true,
    });
    if (fields.length > 0) {
      focusControl(fields[0]);
      return true;
    }
    return false;
  }, [containerRef]);

  const focusNextField = useCallback(
    (fromEl?: HTMLElement | null) => {
      const container = containerRef.current;
      if (!container) return false;
      const fields = getVisualFocusableFields(container);
      if (fields.length === 0) return false;

      const source = fromEl || (document.activeElement as HTMLElement | null);
      const currentIdx = source ? fields.indexOf(source) : -1;
      if (currentIdx !== -1 && currentIdx < fields.length - 1) {
        focusControl(fields[currentIdx + 1]);
        return true;
      }

      if (currentIdx === -1) {
        focusControl(fields[0]);
        return true;
      }

      return false;
    },
    [containerRef]
  );

  const focusPrevField = useCallback(
    (fromEl?: HTMLElement | null) => {
      const container = containerRef.current;
      if (!container) return false;
      const fields = getVisualFocusableFields(container);
      if (fields.length === 0) return false;

      const source = fromEl || (document.activeElement as HTMLElement | null);
      const currentIdx = source ? fields.indexOf(source) : -1;
      if (currentIdx > 0) {
        focusControl(fields[currentIdx - 1]);
        return true;
      }
      return false;
    },
    [containerRef]
  );

  const initializedContainerRef = useRef<HTMLElement | null>(null);
  const lastFocusedElRef = useRef<HTMLElement | null>(null);

  // Track last focused control inside container so returning from nested dialogs restores focus instead of jumping to #1
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const container = containerRef.current;
      const target = e.target as HTMLElement | null;
      if (!container || !target || !container.contains(target)) return;
      if (enabled && isHighestDialog(container)) {
        lastFocusedElRef.current = target;
      }
    };
    document.addEventListener("focusin", handleFocusIn, true);
    return () => document.removeEventListener("focusin", handleFocusIn, true);
  }, [enabled, containerRef]);

  // Auto-focus first editable field on open (retries briefly for Portal mount timing; never resets on sub-modal close)
  useEffect(() => {
    if (!enabled) {
      const checkTimer = window.setTimeout(() => {
        const cur = containerRef.current;
        if (!cur || !cur.isConnected || cur.getBoundingClientRect().width === 0) {
          initializedContainerRef.current = null;
          lastFocusedElRef.current = null;
        }
      }, 60);
      return () => window.clearTimeout(checkTimer);
    }

    if (!autoFocusFirst) return;

    let cancelled = false;
    let attempts = 0;
    let timer = window.setTimeout(() => {
      const tryFocus = () => {
        if (cancelled) return;
        const container = containerRef.current;
        if (container && isHighestDialog(container)) {
          const active = document.activeElement as HTMLElement | null;
          if (active && active !== document.body && container.contains(active)) {
            initializedContainerRef.current = container;
            return;
          }

          // Returning from a nested child dialog (e.g. Quick Add): keep focus where user was instead of jumping to field #1
          if (initializedContainerRef.current === container) {
            const prev = lastFocusedElRef.current;
            if (prev && container.contains(prev) && isElementVisible(prev)) {
              focusControl(prev);
            }
            return;
          }

          if (focusFirstField()) {
            const after = document.activeElement as HTMLElement | null;
            if (after && container.contains(after)) {
              initializedContainerRef.current = container;
              return;
            }
          }
        }
        attempts += 1;
        if (attempts < 8) {
          timer = window.setTimeout(tryFocus, 60);
        }
      };
      tryFocus();
    }, 65);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, autoFocusFirst, containerRef, focusFirstField]);

  // Listen on document for auto-advance events so Portal dialogs never miss attachment timing
  useEffect(() => {
    if (!enabled) return;

    const handleFieldAdvance = (e: Event) => {
      const container = containerRef.current;
      if (!container || !isHighestDialog(container)) return;
      const customEvent = e as CustomEvent<{ sourceEl?: HTMLElement }>;
      const sourceEl = customEvent.detail?.sourceEl || (e.target as HTMLElement | null);
      if (!sourceEl || !container.contains(sourceEl)) return;

      // Wait one macrotask so dynamic fields triggered by onValueChange commit before ordering
      window.setTimeout(() => {
        if (containerRef.current && isHighestDialog(containerRef.current)) {
          focusNextField(sourceEl);
        }
      }, 0);
    };

    document.addEventListener("tams:field-advance", handleFieldAdvance);
    return () => {
      document.removeEventListener("tams:field-advance", handleFieldAdvance);
    };
  }, [enabled, containerRef, focusNextField]);

  // Capture-phase keyboard handler for predictable Escape/Ctrl+S/Enter/Shift+Enter/Shift+Tab handling
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current;
      if (!container || !isHighestDialog(container)) return;

      const target = e.target as HTMLElement | null;

      // 1. Ctrl+S / Cmd+S -> Save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        if (!target || container.contains(target) || document.activeElement === document.body || myDialogContains(container, target)) {
          e.preventDefault();
          e.stopPropagation();
          onSaveRef.current?.();
        }
        return;
      }

      // 2. Ctrl/Cmd+Shift+Enter -> Save & Add Next (if provided)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") {
        if (onSaveAndAddNextRef.current && target && container.contains(target)) {
          e.preventDefault();
          e.stopPropagation();
          onSaveAndAddNextRef.current();
        }
        return;
      }

      // 3. Escape -> close popup first if one is open; otherwise confirm discard if dirty and close modal
      if (e.key === "Escape") {
        if (hasOpenPopup()) {
          // Let Radix Select/Popover/SearchableSelect handle Escape to close only itself
          return;
        }
        if (onCancelRef.current) {
          e.preventDefault();
          e.stopPropagation();
          if (isDirtyRef.current) {
            const discard = window.confirm(dirtyMsgRef.current);
            if (!discard) return;
          }
          onCancelRef.current();
        }
        return;
      }

      // Remaining shortcuts only handle active elements inside this form container
      if (!target || !container.contains(target)) return;

      // Ignore if inside an open listbox / popper inside container
      if (target.closest('[data-searchable-select-content="true"], [role="listbox"]')) {
        return;
      }

      // 4. Ctrl/Cmd + Enter:
      //    - Inside TEXTAREA: move focus to next control (e.g. Save button), or save if no next control
      //    - Inside a repeatable row ([data-pax-row] / [data-repeatable-row]): add a new row and focus its first field
      //    - Elsewhere: trigger Save
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (target.tagName === "TEXTAREA") {
          const fields = getVisualFocusableFields(container);
          const idx = fields.indexOf(target);
          const next = idx !== -1 && idx < fields.length - 1 ? fields[idx + 1] : null;
          if (next) {
            focusControl(next);
          } else {
            onSaveRef.current?.();
          }
          return;
        }

        const repeatableRow = target.closest('[data-pax-row], [data-repeatable-row]') as HTMLElement | null;
        if (repeatableRow) {
          const group = (repeatableRow.closest('[data-repeatable-group]') as HTMLElement | null) || container;
          const addBtn = group.querySelector<HTMLButtonElement>(
            'button[data-add-row-btn="true"]:not([disabled]), button[data-add-passenger-btn="true"]:not([disabled])'
          );
          if (addBtn) {
            const prevCount = group.querySelectorAll<HTMLElement>('[data-pax-row], [data-repeatable-row]').length;
            const focusNewAddedRow = () => {
              const rows = group.querySelectorAll<HTMLElement>('[data-pax-row], [data-repeatable-row]');
              if (rows.length <= prevCount) return false;
              const lastRow = rows[rows.length - 1];
              const active = document.activeElement as HTMLElement | null;
              if (active && lastRow.contains(active)) return true;
              const rowFields = getVisualFocusableFields(lastRow);
              if (rowFields.length > 0) {
                focusControl(rowFields[0]);
                return true;
              }
              return false;
            };

            let settled = false;
            let fallbackTimer: number | null = null;
            const observer = new MutationObserver(() => {
              if (settled) return;
              const rows = group.querySelectorAll<HTMLElement>('[data-pax-row], [data-repeatable-row]');
              if (rows.length > prevCount) {
                settled = true;
                observer.disconnect();
                if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
                window.setTimeout(() => {
                  focusNewAddedRow();
                }, 0);
              }
            });
            observer.observe(group, { childList: true, subtree: true });
            fallbackTimer = window.setTimeout(() => {
              observer.disconnect();
              if (!settled) {
                settled = true;
                focusNewAddedRow();
              }
            }, 600);

            addBtn.click();
            return;
          }
        }

        onSaveRef.current?.();
        return;
      }

      // 4b. Shift + Tab navigates backward in visual order (mirroring Shift + Enter, e.g. Purchasing Cost -> last passenger)
      if (e.key === "Tab" && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const fields = getVisualFocusableFields(container);
        const currentIdx = fields.indexOf(target);
        if (currentIdx > 0) {
          e.preventDefault();
          e.stopPropagation();
          focusControl(fields[currentIdx - 1]);
        }
        return;
      }

      if (e.key !== "Enter" || e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // 5. Textarea plain Enter adds newline natively; Shift+Enter goes back
      if (target.tagName === "TEXTAREA") {
        if (e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          focusPrevField(target);
        }
        return;
      }

      // 6. Shift + Enter goes back to previous field (on any control including comboboxes/buttons)
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        focusPrevField(target);
        return;
      }

      // 7. Closed Select / Combobox trigger: let component open on Enter (do not jump ahead)
      const isCombobox = target.getAttribute("role") === "combobox";
      if (isCombobox) {
        return;
      }

      // 8. Non-combobox buttons
      if (target.tagName === "BUTTON") {
        if (target.matches(SKIP_ENTER_ON_BUTTON_SELECTOR)) {
          // Buttons like Save / Add Passenger / Cancel perform their native click on Enter
          return;
        }
        // Role switch / checkbox / radio buttons toggle on Space cleanly, Enter advances
        const role = target.getAttribute("role");
        if (role === "switch" || role === "checkbox" || role === "radio") {
          e.preventDefault();
          e.stopPropagation();
          focusNextField(target);
          return;
        }
      }

      // 9. Optional beforeAdvance hook (e.g., Search inputs triggering invoice lookup)
      if (onBeforeAdvanceRef.current) {
        const handled = onBeforeAdvanceRef.current(target);
        if (handled === false) {
          e.preventDefault();
          return;
        }
      }

      // 10. Required-field validation gate: do not jump ahead if required field is empty
      const customErr = validateFieldRef.current?.(target);
      const errMsg = customErr || checkDefaultRequired(target);
      if (errMsg) {
        e.preventDefault();
        e.stopPropagation();
        target.setAttribute("aria-invalid", "true");
        target.dataset.fieldError = "true";
        toast.error(errMsg, { id: "tams-field-required" });
        focusControl(target);
        return;
      }

      if (target.hasAttribute("data-field-error")) {
        target.removeAttribute("data-field-error");
        target.removeAttribute("aria-invalid");
      }

      // 11. Move to next visual field (which includes Save button at end)
      e.preventDefault();
      e.stopPropagation();
      focusNextField(target);
    };

    document.addEventListener("keydown", handleKeyDown, true);
    const clearFieldError = (e: Event) => {
      const container = containerRef.current;
      const target = e.target as HTMLElement | null;
      if (target && container?.contains(target) && target.hasAttribute("data-field-error")) {
        target.removeAttribute("data-field-error");
        target.removeAttribute("aria-invalid");
      }
    };
    document.addEventListener("input", clearFieldError, true);
    document.addEventListener("change", clearFieldError, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("input", clearFieldError, true);
      document.removeEventListener("change", clearFieldError, true);
    };
  }, [enabled, containerRef, focusFirstField, focusNextField, focusPrevField]);

  return {
    focusFirstField,
    focusNextField,
    focusPrevField,
  };
}

function myDialogContains(container: HTMLElement, target: HTMLElement): boolean {
  const myDialog = container.closest('[role="dialog"]');
  return myDialog ? myDialog.contains(target) : false;
}
