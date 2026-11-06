import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { ThemeProvider } from "next-themes";
import { ViewModeProvider } from "./contexts/ViewModeContext";
import { initPwaInstall } from "./lib/pwaInstall";
import App from "./App.tsx";
import "./index.css";

// Initialize PWA features
initPwaInstall({
  onInstall: () => {
    console.log('[TAMS] App installed successfully');
  },
  onShowDesktopLayout: () => {
    console.log('[TAMS] Desktop PWA layout applied');
  }
});




// Hide splash immediately when React mounts (no double-RAF delay)
const hideSplash = () => {
  const splash = document.getElementById('tams-splash');
  if (splash) splash.remove();
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HelmetProvider>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <ViewModeProvider>
          <App />
        </ViewModeProvider>
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>
);

hideSplash();

