import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppProvider } from "./lib/store";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>
);

// Etap 3: prawdziwy offline. Tylko w buildzie produkcyjnym (import.meta.env.PROD) -
// na "npm run dev" nie ma docs/sw.js i tylko przeszkadzałby w podglądzie na żywo.
// Ścieżka względna ("./sw.js"), bo apka żyje pod GitHub Pages w podkatalogu
// (https://kamil92sm.github.io/trening-app/), nie w katalogu głównym domeny.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // Offline nadal działa z tego, co przeglądarka ma w swoim zwykłym cache'u HTTP -
      // brak SW nie jest błędem krytycznym, więc celowo bez UI/toastu.
    });
  });
}
