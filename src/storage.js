import { STORAGE_KEY, APP_VERSION, DATA_VERSION } from "./version.js";
import { createEmptyState, isLikelyState } from "./models.js";

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

export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

export function importStateReplace(fileText) {
  const parsed = JSON.parse(fileText);
  if (!isLikelyState(parsed)) {
    throw new Error("Import abgelehnt: JSON sieht nicht wie BenchMark-State aus.");
  }
  return parsed;
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}
