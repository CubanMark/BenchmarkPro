import { STORAGE_KEY, APP_VERSION, DATA_VERSION } from "./version.js";
import { createEmptyState, isLikelyState } from "./models.js";

/** -------------------------
 *  Load / Save
 *  ------------------------- */
export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw);
    if (!isLikelyState(parsed)) return createEmptyState();
    parsed.appVersion = APP_VERSION;
    if (!parsed.meta) parsed.meta = { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    return parsed;
  } catch {
    return createEmptyState();
  }
}

export function saveState(state) {
  const now = new Date().toISOString();
  state.appVersion = APP_VERSION;
  state.dataVersion = DATA_VERSION;
  state.meta = state.meta || { createdAt: now, updatedAt: now };
  state.meta.updatedAt = now;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  return now;
}

/**
 * Importieren der Datei und Überprüfung der Struktur.
 */
export function parseImportFile(fileText) {
  let parsed;
  try {
    // Versuch, die Datei als JSON zu parsen
    parsed = JSON.parse(fileText);

    // Validierung: Prüfen, ob die Struktur den Erwartungen entspricht
    if (!parsed.plans || !Array.isArray(parsed.plans)) {
      throw new Error("Ungültige Datenstruktur: Plans fehlen oder sind falsch formatiert.");
    }

    if (!parsed.exercises || !Array.isArray(parsed.exercises)) {
      throw new Error("Ungültige Datenstruktur: Exercises fehlen oder sind falsch formatiert.");
    }

  } catch (error) {
    // Fehlerbehandlung: Toast-Meldung bei ungültigem Import
    toast(`Import fehlgeschlagen: ${error.message}`, "error");
    return null;  // Rückgabe null, wenn das Parsen fehlschlägt
  }

  return parsed;
}

/**
 * Anwenden des importierten Zustands auf die App
 */
export function applyImportedState(state) {
  // Überprüfung, ob die importierten Daten gültig sind
  if (!state || !state.plans || !Array.isArray(state.plans)) {
    toast("Fehler: Ungültige Pläne beim Import.", "error");
    return;  // Abbruch der Anwendung bei ungültigen Daten
  }

  if (!state.exercises || !Array.isArray(state.exercises)) {
    toast("Fehler: Ungültige Übungen beim Import.", "error");
    return;  // Abbruch der Anwendung bei ungültigen Daten
  }

  // Normalisieren der Metadaten
  state.appVersion = APP_VERSION;
  state.dataVersion = DATA_VERSION;
  state.meta = state.meta || { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  // Erfolgreicher Import: Bestätigung
  toast("Import erfolgreich abgeschlossen!", "success");

  // Zustand anwenden
  saveState(state);  // Speichern des neuen Zustands
}
