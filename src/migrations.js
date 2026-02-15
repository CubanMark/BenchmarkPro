import { DATA_VERSION } from "./version.js";
import { createEmptyState } from "./models.js";

/**
 * Phase 1: accept only v4 objects (dataVersion === DATA_VERSION).
 */
export function migrateToLatest(input) {
  if (!input) return createEmptyState();

  const dv = Number(input.dataVersion);
  if (!Number.isFinite(dv)) throw new Error("DataVersion is invalid");

  if (dv !== DATA_VERSION) {
    throw new Error(`DataVersion mismatch: got ${dv}, expected ${DATA_VERSION}.`);
  }
  return input;
}
