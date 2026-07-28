import type { AppState, Settings } from "./types";

const GIST_FILENAME = "trening-backup.json";
const API = "https://api.github.com/gists";

/** Ustawienia, które NIGDY nie mogą trafić do backupu (poza to urządzenie) — dziś tylko
 * token, ale przyszłe sekrety w Settings powinny trafiać na tę listę, nie bezpośrednio
 * do JSON.stringify(state). Jedyne miejsce, gdzie backup jest serializowany: serializeBackup(). */
const SECRET_SETTINGS_KEYS: (keyof Settings)[] = ["gistToken"];

/**
 * Jedyne źródło prawdy dla serializacji backupu (Gist i eksport plikowy) — usuwa sekrety
 * z `settings`. Nie mutuje przekazanego `state`.
 */
export function serializeBackup(state: AppState, pretty = false): string {
  const settings: Partial<Settings> = { ...state.settings };
  for (const key of SECRET_SETTINGS_KEYS) delete settings[key];
  const safeState = { ...state, settings: settings as Settings };
  return pretty ? JSON.stringify(safeState, null, 2) : JSON.stringify(safeState);
}

interface GistFile {
  filename: string;
  content: string;
  truncated?: boolean;
  raw_url?: string;
}

interface GistResponse {
  id: string;
  files: Record<string, GistFile>;
  message?: string;
}

/** Typowany błąd Gist API — `status` pozwala wywołującym rozpoznać 401 (token odrzucony)
 * i zareagować (wyczyścić token, wyłączyć auto-backup) bez parsowania tekstu komunikatu. */
export class GistApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GistApiError";
    this.status = status;
  }
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token.trim()}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
  };
}

function apiError(data: GistResponse, status: number): GistApiError {
  if (status === 401) {
    return new GistApiError(
      "Token odrzucony przez GitHub (wygasł, został odwołany, lub stracił uprawnienie „Gists: Read and write”). Wygeneruj nowy fine-grained token i wklej go ponownie.",
      status
    );
  }
  return new GistApiError(data.message ?? `Gist API error (${status})`, status);
}

/**
 * Wysyła stan aplikacji do prywatnego gista. Tworzy nowy gist przy pierwszym
 * backupie (brak gistId), potem aktualizuje ten sam (PATCH).
 */
export async function gistBackup(
  token: string,
  state: AppState,
  gistId?: string
): Promise<{ gistId: string }> {
  const body = {
    description: "Trening — backup",
    public: false,
    files: { [GIST_FILENAME]: { content: serializeBackup(state) } },
  };

  const res = await fetch(gistId ? `${API}/${gistId}` : API, {
    method: gistId ? "PATCH" : "POST",
    headers: headers(token),
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as GistResponse;
  if (!res.ok) {
    throw apiError(data, res.status);
  }
  return { gistId: data.id };
}

/**
 * Pobiera backup z gista i zwraca surową zawartość JSON (jako string) —
 * wywołujący przepuszcza to przez store.importJson().
 */
export async function gistRestore(token: string, gistId: string): Promise<string> {
  const res = await fetch(`${API}/${gistId}`, { headers: headers(token) });
  const data = (await res.json()) as GistResponse;
  if (!res.ok) {
    throw apiError(data, res.status);
  }
  const file = data.files[GIST_FILENAME];
  if (!file) throw new Error("Gist nie zawiera pliku trening-backup.json");
  if (file.truncated && file.raw_url) {
    const rawRes = await fetch(file.raw_url);
    if (!rawRes.ok) throw new Error(`Nie udało się pobrać pełnej treści (${rawRes.status})`);
    return rawRes.text();
  }
  return file.content;
}
