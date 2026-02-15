import { APP_VERSION, DATA_VERSION } from "./version.js";

/**
 * v4 State (single object) - Phase 1
 */
export function createEmptyState() {
  const nowIso = new Date().toISOString();
  return {
    appVersion: APP_VERSION,
    dataVersion: DATA_VERSION,
    meta: { createdAt: nowIso, updatedAt: nowIso },
    exercises: [],
    plans: [],
    workouts: []
  };
}

export function touchUpdatedAt(state) {
  const nowIso = new Date().toISOString();
  state.meta = state.meta || {};
  state.meta.updatedAt = nowIso;
  if (!state.meta.createdAt) state.meta.createdAt = nowIso;
}

export function assertLooksLikeState(obj) {
  if (!obj || typeof obj !== "object") throw new Error("Import: not an object");
  if (!("dataVersion" in obj)) throw new Error("Import: missing dataVersion");
  if (!Array.isArray(obj.exercises) || !Array.isArray(obj.plans) || !Array.isArray(obj.workouts)) {
    throw new Error("Import: exercises/plans/workouts must be arrays");
  }
}
