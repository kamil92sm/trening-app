// Smoke test zbudowanej apki — Chromium na `docs/index.html` (dokładnie tym
// pliku, który ląduje na GitHub Pages i na telefonie Kamila).
//
// Po co osobno od `npm test`: testy silnika liczą czystą logikę i NIGDY nie
// złapią rzeczy, które psują apkę w praktyce — błędu JS przy renderze, pola
// gubiącego przecinek, wiersza rozpychającego stronę poza ekran iPhone'a.
// Każda z tych trzech rzeczy realnie się w tym projekcie zdarzyła.
//
// Uruchamianie:
//   npm run build && npm run test:e2e
//   CHROMIUM_PATH=/sciezka/do/chrome npm run test:e2e   # gdy Playwright nie ma
//                                                        # własnej przeglądarki
//
// Świadomie `file://`, nie serwer HTTP: service worker nie rejestruje się na
// niezaufanym origin, więc kolejne uruchomienia nie zależą od tego, co
// zostało w cache'u po poprzednim.

import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildPath = resolve(root, "docs/index.html");
if (!existsSync(buildPath)) {
  console.error("Brak docs/index.html — uruchom najpierw `npm run build`.");
  process.exit(1);
}
const url = pathToFileURL(buildPath).href;

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log(`  OK  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`, extra ?? "");
  }
}

const TABS = ["Trening", "Progres", "Historia", "Plan", "Więcej"];
const WIDTHS = [320, 360, 390, 430];

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// Każdy nieobsłużony wyjątek i każdy `console.error` z apki to od razu porażka —
// w jednoplikowej PWA bez raportowania błędów nikt inny tego nie zobaczy.
const jsErrors = [];
page.on("pageerror", (e) => jsErrors.push(`pageerror: ${e}`));
page.on("console", (m) => {
  if (m.type() === "error") jsErrors.push(`console.error: ${m.text()}`);
});

const overflow = () =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

try {
  await page.goto(url);
  await page.waitForTimeout(600);

  // ── 1. Apka w ogóle wstaje ────────────────────────────────────────────────
  check("apka renderuje dolną nawigację", await page.getByText("Trening", { exact: true }).last().isVisible());

  // ── 2. Każda zakładka renderuje się i mieści w ekranie ────────────────────
  for (const tab of TABS) {
    await page.getByText(tab, { exact: true }).last().click();
    await page.waitForTimeout(350);
    check(`zakładka „${tab}" renderuje treść`, (await page.locator("body").innerText()).trim().length > 40);
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 844 });
      await page.waitForTimeout(120);
      const o = await overflow();
      check(`„${tab}" bez poziomego scrolla przy ${w} px`, o <= 0, `nadmiar ${o} px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
  }

  // ── 3. Logger: pola liczbowe (regresja z §27.1) ───────────────────────────
  await page.getByText("Trening", { exact: true }).last().click();
  await page.waitForTimeout(300);
  await page.getByText("Trening 1", { exact: false }).first().click();
  await page.waitForTimeout(500);

  const weight = page.locator('input[inputmode="decimal"]').first();
  const reps = page.locator('input[inputmode="numeric"]').first();
  check("logger otwiera się z polami serii", await weight.isVisible());

  await weight.click();
  await weight.fill("");
  await weight.type("36,25", { delay: 25 });
  check("pole ciężaru przyjmuje przecinek", (await weight.inputValue()) === "36,25", await weight.inputValue());

  await reps.click(); // blur
  await page.waitForTimeout(150);
  check("przecinek przeżywa opuszczenie pola", (await weight.inputValue()) === "36,25", await weight.inputValue());

  await weight.click();
  await weight.fill("");
  check("pole da się wyczyścić (nie wskakuje 0)", (await weight.inputValue()) === "", await weight.inputValue());

  await weight.type("40", { delay: 25 });
  await page.getByLabel("Zwiększ ciężar").first().click();
  await page.waitForTimeout(200);
  const afterPlus = await weight.inputValue();
  check("stepper + przestawia pole", afterPlus !== "40" && afterPlus !== "", afterPlus);

  await page.getByLabel("Zmniejsz ciężar").first().click();
  await page.waitForTimeout(200);
  check("stepper − wraca do poprzedniej wartości", (await weight.inputValue()) === "40", await weight.inputValue());

  // ── 4. Pełna ścieżka treningu aż do podsumowania ──────────────────────────
  const setCount = await page.getByLabel("Zalicz serię").count();
  check("trening ma zaplanowane serie", setCount > 0, setCount);
  // Zaliczona seria zmienia etykietę na „Odznacz serię", więc kolekcja kurczy
  // się w trakcie — zawsze klikamy PIERWSZĄ pozostałą, nie n-tą z listy sprzed.
  let guard = 0;
  while ((await page.getByLabel("Zalicz serię").count()) > 0 && guard++ < 80) {
    await page.getByLabel("Zalicz serię").first().click();
    await page.waitForTimeout(60);
  }
  check("wszystkie serie dają się zaliczyć", guard > 0 && guard < 80, guard);
  await page.waitForTimeout(300);
  for (const w of WIDTHS) {
    await page.setViewportSize({ width: w, height: 844 });
    await page.waitForTimeout(120);
    const o = await overflow();
    check(`logger z zaliczonymi seriami bez scrolla przy ${w} px`, o <= 0, `nadmiar ${o} px`);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole("button", { name: "Zakończ trening" }).click();
  await page.waitForTimeout(700);
  const summary = (await page.locator("body").innerText()).toLowerCase();
  check(
    "po zakończeniu pokazuje się podsumowanie treningu",
    summary.includes("podsumowanie") || summary.includes("trening zapisany") || summary.includes("serii"),
    summary.slice(0, 160)
  );

  // ── 5. Zero błędów JS na całej ścieżce ────────────────────────────────────
  check("zero błędów JS w całym przebiegu", jsErrors.length === 0, jsErrors);
} catch (e) {
  failures++;
  console.error("FAIL  smoke test przerwany wyjątkiem:", e);
} finally {
  await browser.close();
}

console.log(failures === 0 ? "\nSMOKE TEST OK" : `\n${failures} SPRAWDZEN PADLO`);
process.exit(failures === 0 ? 0 : 1);
