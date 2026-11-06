import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { ViewModeProvider } from "./contexts/ViewModeContext";
import { initPwaInstall } from "./lib/pwaInstall";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App.tsx";
import "./index.css";

// Initialize PWA features safely
try {
  initPwaInstall({
    onInstall: () => {
      console.log('[TAMS] App installed successfully');
    },
    onShowDesktopLayout: () => {
      console.log('[TAMS] Desktop PWA layout applied');
    }
  });
} catch (e) {
  console.warn('[TAMS] PWA initialization error:', e);
}

// Hide splash smoothly
const hideSplash = () => {
  try {
    const splash = document.getElementById('tams-splash');
    if (splash) {
      splash.style.transition = 'opacity 0.25s ease';
      splash.style.opacity = '0';
      setTimeout(() => {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 250);
    }
  } catch (err) {
    console.error('[TAMS] Error hiding splash:', err);
  }
};

const rootElement = document.getElementById("root");
if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <HelmetProvider>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
              <ViewModeProvider>
                <App />
              </ViewModeProvider>
            </ThemeProvider>
          </HelmetProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (renderError) {
    console.error('[TAMS] Root rendering error:', renderError);
  } finally {
    // Ensure splash is dismissed even if render throws
    hideSplash();
  }
} else {
  hideSplash();
}


