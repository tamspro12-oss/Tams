/**
 * TAMS PRO Design Enhancer
 * Dynamically ensures:
 * 1. Save buttons get data-save-button="true" (dark teal styling)
 * 2. Customer & search boxes get data-customer-box="true" (yellow styling)
 * 3. Receivable/Payable amounts get data-amount-type="receivable" / "payable" (red with white text)
 * 4. Paid/Balance amounts get data-amount-type="paid" / "balance" (light green)
 */

export function initDesignEnhancer(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const enhanceElement = (el: Element) => {
    // 1. Tag Save buttons
    if (el instanceof HTMLButtonElement) {
      const text = (el.innerText || el.textContent || "").trim().toLowerCase();
      const isSubmit = el.type === "submit";
      if (
        isSubmit ||
        text.startsWith("save") ||
        text.includes("save changes") ||
        text.includes("save invoice") ||
        text.includes("save voucher") ||
        text.includes("save booking") ||
        text.includes("save expense") ||
        text.includes("save record") ||
        text.includes("save & print")
      ) {
        if (!el.classList.contains("bg-destructive")) {
          el.setAttribute("data-save-button", "true");
        }
      }
    }

    // 2. Tag Customer & Search boxes
    if (el instanceof HTMLInputElement) {
      const placeholder = (el.placeholder || "").toLowerCase();
      const name = (el.name || "").toLowerCase();
      const type = (el.type || "").toLowerCase();

      if (
        type === "search" ||
        placeholder.includes("search") ||
        placeholder.includes("customer") ||
        placeholder.includes("client") ||
        placeholder.includes("party") ||
        name.includes("search") ||
        name.includes("customer") ||
        name.includes("client")
      ) {
        el.setAttribute("data-search-box", "true");
        el.setAttribute("data-customer-box", "true");
      }
    }

    // 3. Tag Combobox triggers for Customer/Client
    if (el.getAttribute("role") === "combobox") {
      const ariaLabel = (el.getAttribute("aria-label") || "").toLowerCase();
      const text = (el.textContent || "").toLowerCase();
      if (
        ariaLabel.includes("client") ||
        ariaLabel.includes("customer") ||
        ariaLabel.includes("party") ||
        text.includes("select client") ||
        text.includes("select customer") ||
        text.includes("search client") ||
        text.includes("search customer")
      ) {
        el.setAttribute("data-customer-box", "true");
      }
    }

    // 4. Tag Receivable / Payable amounts
    const textContent = (el.textContent || "").trim().toLowerCase();
    const isShortLabel = textContent.length < 50;

    if (
      isShortLabel &&
      (el.classList.contains("badge") ||
        el.getAttribute("role") === "status" ||
        el.tagName === "TD" ||
        el.tagName === "SPAN" ||
        el.tagName === "DIV")
    ) {
      // Receivable
      if (
        textContent.includes("receivable") ||
        textContent.includes("client due") ||
        textContent.includes("total receivables")
      ) {
        if (!el.hasAttribute("data-amount-type")) {
          el.setAttribute("data-amount-type", "receivable");
        }
      }
      // Payable
      else if (
        textContent.includes("payable") ||
        textContent.includes("vendor due") ||
        textContent.includes("total payables")
      ) {
        if (!el.hasAttribute("data-amount-type")) {
          el.setAttribute("data-amount-type", "payable");
        }
      }
      // Paid
      else if (
        textContent === "paid" ||
        textContent.startsWith("paid:") ||
        textContent.includes("fully paid") ||
        textContent.includes("total paid")
      ) {
        if (!el.hasAttribute("data-amount-type")) {
          el.setAttribute("data-amount-type", "paid");
        }
      }
      // Balance
      else if (
        textContent === "balance" ||
        textContent.startsWith("balance:") ||
        textContent.includes("closing balance") ||
        textContent.includes("net balance")
      ) {
        if (!el.hasAttribute("data-amount-type")) {
          el.setAttribute("data-amount-type", "balance");
        }
      }
    }
  };

  const scanTree = (root: Element | Document = document) => {
    try {
      const candidates = root.querySelectorAll("button, input, [role='combobox'], .badge, td, [data-status]");
      candidates.forEach(enhanceElement);
    } catch (e) {
      // Silent catch
    }
  };

  // Initial scan
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => scanTree());
  } else {
    scanTree();
  }

  // MutationObserver for SPA navigation and modals/popups
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            enhanceElement(node);
            scanTree(node);
          }
        });
      } else if (mutation.type === "characterData" || mutation.type === "attributes") {
        if (mutation.target instanceof Element) {
          enhanceElement(mutation.target);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["class", "role", "type", "placeholder", "data-status"],
  });
}
