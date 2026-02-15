import { DATA_VERSION } from "./version.js";

/**
 * Migrations runner.
 * - state.dataVersion is the schema version of the persisted data.
 * - DATA_VERSION is the current schema version supported by the app.
 * 
 * Keep migrations small, pure, and idempotent.
 */
const migrations = {
  // Example:
  // 3: (state) => { ...; state.dataVersion = 4; return state; },
};

export function runMigrations(state) {
  const from = Number(state?.dataVersion || 0);
  let ran = false;
  let current = from;

  // If state has no dataVersion, treat it as 0 (no migrations here; legacy import is handled separately).
  while (current && current < DATA_VERSION) {
    const fn = migrations[current];
    if (!fn) break;
    state = fn(state);
    ran = true;
    current = Number(state.dataVersion || current + 1);
  }

  // Ensure dataVersion is at least current schema once it is a v4 state
  if (state && typeof state === "object" && state.workouts && state.plans && state.exercises) {
    state.dataVersion = DATA_VERSION;
  }

  return { state, ran, from, to: DATA_VERSION };
}
