// P1-11: walidacja pliku backupu PRZED nadpisaniem stanu. Celowo płytka —
// chodzi o odsianie "to nie jest backup tej aplikacji", nie o pełny schemat.

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function hasStringId(v: unknown): v is { id: string; name: string } {
  return isPlainObject(v) && typeof v.id === "string" && typeof v.name === "string";
}

/** `null` = wygląda na poprawny backup. Inaczej komunikat po polsku, wskazujący konkretny brak. */
export function validateBackup(parsed: unknown): string | null {
  if (!isPlainObject(parsed)) return "To nie wygląda na backup tej aplikacji (plik nie jest obiektem JSON).";

  if (typeof parsed.version !== "number") return "Brak numeru wersji schematu (\"version\").";

  if (!Array.isArray(parsed.exercises) || !parsed.exercises.every(hasStringId)) {
    return "Nieprawidłowa lista ćwiczeń (\"exercises\") — brakuje id/name w którymś wpisie.";
  }

  if (!Array.isArray(parsed.days) || !parsed.days.every(hasStringId)) {
    return "Nieprawidłowa lista dni treningowych (\"days\") — brakuje id/name w którymś wpisie.";
  }

  if (!isPlainObject(parsed.targets)) return "Brak obiektu celów (\"targets\").";

  if (
    !Array.isArray(parsed.sessions) ||
    !parsed.sessions.every(
      (s) =>
        isPlainObject(s) &&
        typeof s.id === "string" &&
        typeof s.dayId === "string" &&
        typeof s.date === "string" &&
        Array.isArray(s.entries)
    )
  ) {
    return "Nieprawidłowa historia sesji (\"sessions\") — brakuje id/dayId/date/entries w którejś sesji.";
  }

  if (!Array.isArray(parsed.body)) return "Brak listy wpisów wagi ciała (\"body\").";
  if (!Array.isArray(parsed.squash)) return "Brak listy sesji squasha (\"squash\").";
  if (!isPlainObject(parsed.settings)) return "Brak obiektu ustawień (\"settings\").";

  return null;
}
