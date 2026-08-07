// Wygenerowane przez scripts/singlefile.mjs przy KAŻDYM "npm run build" - NIE
// edytuj docs/sw.js ręcznie, zmiany nadpisze kolejny build. Źródło: ten plik.
//
// Cel (Etap 3, P6-7): apka ma wystartować bez internetu po jednym poprawnym
// uruchomieniu online - na siłowni przy słabym LTE Safari czasem po prostu nie
// wczyta strony. docs/index.html jest jednym samodzielnym plikiem (JS/CSS
// wklejone inline), więc "app shell" to dosłownie ten jeden zasób.
const CACHE_NAME = "trening-shell-6e7fb6ae42";
const SHELL_URL = "./index.html";

self.addEventListener("install", (event) => {
  // skipWaiting: nowa wersja przejmuje kontrolę od razu po instalacji, bez
  // czekania na zamknięcie wszystkich kart - to jest "bez ręcznego czyszczenia
  // danych Safari" z wymagań.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(SHELL_URL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // Tylko GET nawigacje (wczytanie/reload strony) TEGO originu - świadomie NIE
  // dotykamy zapytań do api.github.com (backup do Gista) ani żadnych innych
  // zapytań spoza originu/metody GET. localStorage i draft treningu żyją poza
  // Service Workerem, więc to nie ma wpływu na dane użytkownika.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode !== "navigate") return;

  // Cache-first: natychmiastowa odpowiedź offline/na słabym LTE. Sieć w tle
  // odświeża cache pod kolejne wejście (stale-while-revalidate) - kolejny
  // build i tak dostanie nową nazwę CACHE_NAME, więc to tylko dodatkowa
  // świeżość w ramach TEJ SAMEJ wersji.
  event.respondWith(
    caches.match(SHELL_URL).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
