// Skleja output Vite (dist/) w jeden samodzielny plik HTML -> docs/index.html,
// oraz generuje docs/sw.js (Etap 3: offline) z wersją cache'u policzoną z hasha
// TREŚCI builda. docs/ jest serwowane przez GitHub Pages (Settings -> Pages ->
// branch main, folder /docs).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const dist = "dist";
let html = readFileSync(path.join(dist, "index.html"), "utf8");

html = html.replace(
  /<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g,
  (_, src) => {
    const js = readFileSync(path.join(dist, src.replace(/^\//, "")), "utf8")
      .replaceAll("</script>", "<\\/script>");
    return `<script type="module">${js}</script>`;
  }
);

html = html.replace(
  /<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g,
  (_, href) => {
    const css = readFileSync(path.join(dist, href.replace(/^\//, "")), "utf8");
    return `<style>${css}</style>`;
  }
);

mkdirSync("docs", { recursive: true });
writeFileSync(path.join("docs", "index.html"), html);

// Wersja cache'u = hash TREŚCI zbudowanego HTML, nie ręcznie wpisana stała, o
// której łatwo zapomnieć - każdy build z inną zawartością dostaje inną nazwę
// cache'u, więc SW sam wie, że trzeba pobrać nową wersję i skasować starą.
const cacheVersion = createHash("sha256").update(html).digest("hex").slice(0, 10);
const swTemplate = readFileSync(path.join("scripts", "sw-template.js"), "utf8");
const sw = swTemplate.replace("__CACHE_VERSION__", cacheVersion);
writeFileSync(path.join("docs", "sw.js"), sw);

console.log(`OK -> docs/index.html (${(html.length / 1024).toFixed(0)} KB), docs/sw.js (cache v${cacheVersion})`);
