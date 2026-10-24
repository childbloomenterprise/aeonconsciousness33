import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { LincProvider } from "./state";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./styles.css";
import "./apple.css";
import "./motion.css";
import "./redesign.css";
import "./journey-feed.css";
import "./travel-theme.css";
import "./polish.css";
import "./mobile.css";
import "./special-effects.css";
try {
  document.documentElement.dataset.motionPaused = String(
    localStorage.getItem("linc-motion-paused") === "true",
  );
} catch {
  /* Motion also follows the OS preference when storage is unavailable. */
}
const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, refetchOnWindowFocus: false, retry: false },
  },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <LincProvider>
          <App />
        </LincProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
if (import.meta.env.PROD && "serviceWorker" in navigator)
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
