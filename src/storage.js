import { STORAGE_KEY } from "./version.js";
import { createEmptyState, touchUpdatedAt, assertLooksLikeState } from "./models.js";
import { migrateToLatest } from "./migrations.js";

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyState();
  try {
    const parsed = JSON.parse(raw);
    return migrateToLatest(parsed);
  } catch (e) {
    console.warn("Failed to load state. Falling back to empty state.", e);
    return createEmptyState();
  }
}

export function saveState(state) {
  touchUpdatedAt(state);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportState(state) {
  touchUpdatedAt(state);
  return JSON.stringify(state, null, 2);
}

export function importStateReplace(jsonText) {
  const parsed = JSON.parse(jsonText);
  assertLooksLikeState(parsed);
  const migrated = migrateToLatest(parsed);
  if (!migrated.meta) migrated.meta = {};
  if (!migrated.meta.createdAt) migrated.meta.createdAt = new Date().toISOString();
  migrated.meta.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
  return migrated;
}
