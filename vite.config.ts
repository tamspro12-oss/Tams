import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

function readPackageVersion(): string {
  try {
    const pkgPath = path.resolve(__dirname, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    return typeof pkg.version === "string" && pkg.version ? pkg.version : "3.7.0";
  } catch {
    return "3.7.0";
  }
}

function tamsVersionManifestPlugin(appVersion: string, buildId: string): Plugin {
  const payload = JSON.stringify(
    {
      version: appVersion,
      buildId,
      builtAt: new Date().toISOString(),
    },
    null,
    2
  );

  return {
    name: "tams-version-manifest",
    configureServer(server) {
      server.middlewares.use("/version.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.end(payload);
      });
    },
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      if (fs.existsSync(outDir)) {
        fs.writeFileSync(path.join(outDir, "version.json"), payload, "utf-8");
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const appVersion = readPackageVersion();
  const buildId = mode === "production" ? `${appVersion}-${Date.now()}` : "dev";

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), tamsVersionManifestPlugin(appVersion, buildId)],
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __APP_BUILD_ID__: JSON.stringify(buildId),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      modulePreload: {
        resolveDependencies: (_filename, deps) =>
          deps.filter(
            (dep) =>
              !dep.includes("vendor-pdf") &&
              !dep.includes("vendor-charts") &&
              !dep.includes("xlsx") &&
              !dep.includes("html2canvas")
          ),
      },
      // Enable minification for smaller bundles
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production', // Remove console.logs in production
          drop_debugger: true,
        },
      },
      // Code splitting for better caching and faster initial loads
      rollupOptions: {
        output: {
          // Cache-busting with hashes
          entryFileNames: 'assets/[name].[hash].js',
          chunkFileNames: 'assets/[name].[hash].js',
          assetFileNames: 'assets/[name].[hash].[ext]',
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-dropdown-menu',
            ],
            'vendor-charts': ['recharts'],
            'vendor-pdf': ['jspdf', 'jspdf-autotable'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-supabase': ['@supabase/supabase-js'],
          },
        },
      },
      // Source maps for production debugging (disable if not needed)
      sourcemap: false,
      // Target modern browsers for smaller bundle
      target: 'es2020',
      // Increase chunk size warning limit
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
  };
});
