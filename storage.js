import { APP_VERSION, DATA_VERSION, STORAGE_KEY } from "./version.js";
import { toast } from "./ui.js";

// Reset the state (clear all saved data)
export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  toast("State zurückgesetzt ✅");
}

// Load state from localStorage
export function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const state = saved ? JSON.parse(saved) : {};
  state.appVersion = APP_VERSION;
  state.dataVersion = DATA_VERSION;
  state.meta = state.meta || {};
  state.meta.updatedAt = new Date().toISOString();
  return state;
}

// Save the state to localStorage
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    state.meta.updatedAt = new Date().toISOString();
    toast("State gespeichert ✅");
  } catch (e) {
    toast("Fehler beim Speichern des States.");
  }
}

// Export state as JSON
export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

// Parse an import file and return the preview and state
export function parseImportFile(fileText) {
  let parsed;
  try {
    parsed = JSON.parse(fileText);
  } catch (e) {
    throw new Error("Ungültige JSON-Datei.");
  }

  const preview = {
    kind: parsed.kind || "Unbekannt",
    counts: {
      workouts: parsed.workouts?.length || 0,
      plans: parsed.plans?.length || 0,
      exercises: parsed.exercises?.length || 0
    },
    note: parsed.note || ""
  };

  return { preview, state: parsed };
}

// Apply the imported state
export function applyImportedState(importedState) {
  const newState = { ...importedState, appVersion: APP_VERSION, dataVersion: DATA_VERSION };
  return newState;
}

// Add new plan or exercise if not exists
export function ensureDefaults(state, defaults) {
  const { exercises, plans } = defaults;

  // Ensure exercises exist
  exercises.forEach(exercise => {
    if (!state.exercises.some(e => e.id === exercise.id)) {
      state.exercises.push(exercise);
    }
  });

  // Ensure plans exist
  plans.forEach(plan => {
    if (!state.plans.some(p => p.id === plan.id)) {
      state.plans.push(plan);
    }
  });
}

// Function to apply migration
export function runMigrations(state) {
  const lastVersion = state.meta?.lastMigration?.to || 0;
  const migrations = {
    0: migrateV0toV1,
    1: migrateV1toV2,
    2: migrateV2toV3,
    3: migrateV3toV4
  };

  let migState = state;

  for (let i = lastVersion + 1; i <= 4; i++) {
    if (migrations[i]) {
      migState = migrations[i](migState);
    }
  }

  return { state: migState, ran: true, from: lastVersion, to: 4 };
}

// Example migration function
function migrateV3toV4(state) {
  // Migration logic for V3 -> V4
  return state; // Return the modified state
}