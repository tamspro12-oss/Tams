import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_ROOT = path.join(REPO_ROOT, "src");

const STUB_SUPABASE_URL = "virtual:supabase-client-stub";

function resolveWithTsExtensions(basePath) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return pathToFileURL(candidate).href;
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/integrations/supabase/client") {
    return { url: STUB_SUPABASE_URL, shortCircuit: true };
  }

  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    const resolvedUrl = resolveWithTsExtensions(path.join(SRC_ROOT, rel));
    if (resolvedUrl) {
      return { url: resolvedUrl, shortCircuit: true };
    }
  }

  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file://")
  ) {
    const parentPath = fileURLToPath(context.parentURL);
    const resolvedUrl = resolveWithTsExtensions(
      path.resolve(path.dirname(parentPath), specifier)
    );
    if (resolvedUrl) {
      return { url: resolvedUrl, shortCircuit: true };
    }
  }

  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === STUB_SUPABASE_URL) {
    return {
      format: "module",
      source: `
        export const supabase = {
          from: () => ({ select: () => ({ eq: async () => ({ data: [], error: null }) }) }),
          rpc: async () => ({ data: null, error: null }),
          auth: {
            getUser: async () => ({ data: { user: null }, error: null }),
            getSession: async () => ({ data: { session: null }, error: null }),
          },
        };
      `,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}

