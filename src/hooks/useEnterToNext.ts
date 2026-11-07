import { useEffect, useCallback } from "react";

export interface UseEnterToNextOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  onSave?: () => void;
  onSaveAndAddNext?: () => void;
  onCancel?: () => void;
  isDirty?: boolean;
  enabled?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled]):not([readonly]):not([tabindex="-1"])',
  'select:not([disabled]):not([readonly]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([readonly]):not([tabindex="-1"])',
  'button[role="combobox"]:not([disabled]):not([tabindex="-1"])',
  '[data-enter-target="true"]:not([disabled]):not([tabindex="-1"])',
].join(", ");

export function useEnterToNext({
  containerRef,
  onSave,
  onSaveAndAddNext,
  onCancel,
  enabled = true,
}: UseEnterToNextOptions) {
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];
    const elements = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    );
    // Filter visible elements only
    return elements.filter((el) => {
      return (
        el.offsetParent !== null &&
        !el.hasAttribute("disabled") &&
        el.getAttribute("aria-hidden") !== "true" &&
        el.tabIndex !== -1
      );
    });
  }, [containerRef]);

  const focusFirstField = useCallback(() => {
    setTimeout(() => {
      const elements = getFocusableElements();
      if (elements.length > 0) {
        const first = elements[0];
        first.focus();
        if (first instanceof HTMLInputElement && first.type !== "file") {
          first.select();
        }
      }
    }, 50);
  }, [getFocusableElements]);

  const focusNextField = useCallback(
    (current: HTMLElement) => {
      const elements = getFocusableElements();
      const currentIndex = elements.indexOf(current);

      if (currentIndex >= 0 && currentIndex < elements.length - 1) {
        const next = elements[currentIndex + 1];
        next.focus();
        if (next instanceof HTMLInputElement && next.type !== "file") {
          next.select();
        }
        return true;
      } else {
        // At the last field, focus the primary save button
        if (containerRef.current) {
          const saveBtn = containerRef.current.querySelector<HTMLButtonElement>(
            '[data-save-button="true"], button[type="submit"]'
          );
          if (saveBtn) {
            saveBtn.focus();
            return true;
          }
        }
      }
      return false;
    },
    [containerRef, getFocusableElements]
  );

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // 1. Save shortcuts
      if (isCtrlOrCmd && e.shiftKey && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onSaveAndAddNext?.();
        return;
      }

      if (isCtrlOrCmd && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onSave?.();
        return;
      }

      // 2. Escape shortcut
      if (e.key === "Escape") {
        // If a select dropdown or child popover is open, let Radix handle closing it
        const hasOpenPopovers = Boolean(
          document.querySelector(
            '[data-radix-popper-content-wrapper], [data-radix-select-content], [role="dialog"][data-state="open"]:not(#root *)'
          )
        );
        if (hasOpenPopovers) {
          return;
        }
        e.preventDefault();
        onCancel?.();
        return;
      }

      // 3. Enter key navigation
      if (e.key === "Enter" && !e.altKey && !isCtrlOrCmd) {
        const target = e.target as HTMLElement | null;
        if (!target) return;

        // If in textarea: Shift+Enter allows new line, plain Enter moves to Save button
        if (target.tagName === "TEXTAREA") {
          if (e.shiftKey) {
            return; // Allow new line
          }
          e.preventDefault();
          const saveBtn = container.querySelector<HTMLButtonElement>(
            '[data-save-button="true"], button[type="submit"]'
          );
          saveBtn?.focus();
          return;
        }

        // If target is already a button:
        if (target.tagName === "BUTTON") {
          const isSaveBtn =
            target.getAttribute("data-save-button") === "true" ||
            target.getAttribute("type") === "submit";
          const isNextBtn = target.getAttribute("data-save-next") === "true";
          const isCancelBtn = target.getAttribute("data-cancel-button") === "true";

          if (isSaveBtn || isNextBtn || isCancelBtn) {
            // Let the button click handler do its job!
            return;
          }

          // If it's a Radix SelectTrigger or Combobox button
          const isCombobox =
            target.getAttribute("role") === "combobox" ||
            target.hasAttribute("data-radix-select-trigger");
          const isExpanded = target.getAttribute("aria-expanded") === "true";

          if (isCombobox && isExpanded) {
            // Dropdown list is open, let Radix or Combobox handle selection
            return;
          }
        }

        // Check if inside a Command or Combobox input that is currently displaying options
        if (target.getAttribute("cmdk-input") !== null) {
          // Inside search input for combobox: let Command select active item
          return;
        }

        // Standard input: prevent accidental form submit and move to next field
        e.preventDefault();
        focusNextField(target);
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [containerRef, enabled, onSave, onSaveAndAddNext, onCancel, focusNextField]);

  return {
    focusFirstField,
    focusNextField,
  };
}
