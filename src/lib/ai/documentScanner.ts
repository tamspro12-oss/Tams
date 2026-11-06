import { supabase } from "@/integrations/supabase/client";

export type DocType = "passport" | "cnic" | "invoice" | "ticket" | "auto";

export interface ScanResult {
  ok: boolean;
  docType: DocType;
  fields: Record<string, any>;
  records?: Record<string, any>[];
  mode?: "single" | "bulk";
  fileCount?: number;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(b64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
const MAX_PER_FILE = 8 * 1024 * 1024;
const MAX_TOTAL = 15 * 1024 * 1024;
const MAX_FILES = 5;

export async function scanDocument(
  input: File | File[],
  docType: DocType = "auto",
  mode: "single" | "bulk" = "single"
): Promise<ScanResult> {
  const files = Array.isArray(input) ? input : [input];
  if (files.length === 0) throw new Error("No files selected");
  if (files.length > MAX_FILES) throw new Error(`Max ${MAX_FILES} files per scan`);

  let total = 0;
  for (const f of files) {
    if (!ALLOWED.includes(f.type)) throw new Error(`Unsupported file: ${f.name}`);
    if (f.size > MAX_PER_FILE) throw new Error(`${f.name} too large (max 8 MB)`);
    total += f.size;
  }
  if (total > MAX_TOTAL) throw new Error("Total files too large (max 15 MB)");

  const payload = await Promise.all(
    files.map(async (f) => ({
      fileBase64: await fileToBase64(f),
      mimeType: f.type,
    }))
  );

  const { data, error } = await supabase.functions.invoke("ai-document-scan", {
    body: { files: payload, docType, mode },
  });

  if (error) throw new Error(error.message || "Scan failed");
  if (!data?.ok) throw new Error(data?.error || "Scan failed");
  return data as ScanResult;
}

export interface ParseTextResult {
  ok: boolean;
  fields: Record<string, any>;
}

export async function parseBookingText(text: string): Promise<ParseTextResult> {
  const { data, error } = await supabase.functions.invoke("ai-parse-booking-text", {
    body: { text },
  });
  if (error) throw new Error(error.message || "Parse failed");
  if (!data?.ok) throw new Error(data?.error || "Parse failed");
  return data as ParseTextResult;
}
