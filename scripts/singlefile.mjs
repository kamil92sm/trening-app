// Skleja output Vite (dist/) w jeden samodzielny plik HTML -> docs/index.html
// docs/ jest serwowane przez GitHub Pages (Settings -> Pages -> branch main, folder /docs).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
console.log(`OK -> docs/index.html (${(html.length / 1024).toFixed(0)} KB)`);
