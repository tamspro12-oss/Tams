import type { jsPDF } from "jspdf";

const BLOB_REVOKE_DELAY_MS = 15 * 60 * 1000; // Keep blob URL alive for 15 minutes for viewing, printing & downloading in new tab

function sanitizePdfTitle(filename?: string): string {
  const raw = (filename || "Document.pdf").trim();
  return raw || "Document.pdf";
}

/**
 * Optionally pre-opens a new browser tab synchronously during a user click gesture
 * before an async operation (like saving a record to Supabase) completes.
 */
export function preOpenPdfTab(title = "Preparing PDF..."): Window | null {
  if (typeof window === "undefined" || typeof window.open !== "function") {
    return null;
  }
  try {
    const tab = window.open("about:blank", "_blank");
    if (tab && tab.document) {
      try {
        tab.document.title = title;
        tab.document.body.innerHTML =
          '<div style="font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#334155;background:#f8fafc;font-size:14px;">Preparing PDF document...</div>';
      } catch {
        // Ignore cross-origin or document write errors
      }
    }
    return tab;
  } catch {
    return null;
  }
}

/**
 * Safely closes a pre-opened tab if an async save or validation failed before the PDF was built.
 */
export function closePreOpenedPdfTab(tab?: Window | null): void {
  if (!tab) return;
  try {
    if (!tab.closed) {
      tab.close();
    }
  } catch {
    // Ignore window close errors
  }
}

/**
 * Schedule delayed cleanup of a PDF object URL so the new tab can view, print, and save it freely.
 */
export function schedulePdfBlobCleanup(blobUrl: string): void {
  if (!blobUrl || typeof URL === "undefined" || typeof URL.revokeObjectURL !== "function") {
    return;
  }
  const timer = setTimeout(() => {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {
      // Ignore revoke errors
    }
  }, BLOB_REVOKE_DELAY_MS);

  if (typeof (timer as any)?.unref === "function") {
    (timer as any).unref();
  }
}

/**
 * Opens any generated jsPDF document, PDF Blob, or PDF blob URL in a new browser tab
 * while keeping the current application tab on the exact same page, dialog, and selected option.
 */
export function openPdfInNewTab(
  source: jsPDF | Blob | string,
  filename?: string,
  preOpenedTab?: Window | null
): string {
  const safeFilename = sanitizePdfTitle(filename);

  if (
    source &&
    typeof source === "object" &&
    "setProperties" in source &&
    typeof source.setProperties === "function"
  ) {
    try {
      source.setProperties({
        title: safeFilename,
      });
    } catch {
      // Ignore metadata setting failure
    }
  }

  // Headless / Node test environment guard
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "";
  }

  let blobUrl = "";
  if (typeof source === "string") {
    blobUrl = source;
  } else if (typeof Blob !== "undefined" && source instanceof Blob) {
    const pdfBlob =
      source.type === "application/pdf"
        ? source
        : new Blob([source], { type: "application/pdf" });
    blobUrl =
      typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
        ? URL.createObjectURL(pdfBlob)
        : "";
  } else if (source && typeof source === "object" && "output" in source) {
    try {
      const arrayBuf = source.output("arraybuffer");
      const pdfBlob = new Blob([arrayBuf], { type: "application/pdf" });
      blobUrl =
        typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(pdfBlob)
          : "";
    } catch {
      try {
        const fallbackBlob = source.output("blob");
        blobUrl =
          typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
            ? URL.createObjectURL(fallbackBlob)
            : "";
      } catch {
        blobUrl = "";
      }
    }
  }

  if (!blobUrl) {
    closePreOpenedPdfTab(preOpenedTab);
    if (
      source &&
      typeof source === "object" &&
      "save" in source &&
      typeof source.save === "function"
    ) {
      source.save(safeFilename);
    }
    return "";
  }

  schedulePdfBlobCleanup(blobUrl);

  // 1. If a tab was pre-opened synchronously before an async operation, navigate it to the blob URL
  if (preOpenedTab && !preOpenedTab.closed) {
    try {
      preOpenedTab.location.replace(blobUrl);
      preOpenedTab.focus?.();
      return blobUrl;
    } catch {
      try {
        preOpenedTab.location.href = blobUrl;
        preOpenedTab.focus?.();
        return blobUrl;
      } catch {
        // Fall through to window.open / anchor click
      }
    }
  }

  // 2. Open directly in a new tab using window.open (without noreferrer so blob: origin is preserved)
  try {
    if (typeof window.open === "function") {
      const opened = window.open(blobUrl, "_blank");
      if (opened) {
        try {
          opened.opener = null;
          opened.focus?.();
        } catch {
          // Ignore focus/opener errors
        }
        return blobUrl;
      }
    }
  } catch {
    // Fall through to anchor click fallback
  }

  // 3. Fallback: synthetic anchor click with target="_blank" (never navigates current tab)
  try {
    const link = document.createElement("a");
    link.href = blobUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch {
    // Final fallback if synthetic anchor fails
    if (
      source &&
      typeof source === "object" &&
      "save" in source &&
      typeof source.save === "function"
    ) {
      source.save(safeFilename);
    }
  }

  return blobUrl;
}

