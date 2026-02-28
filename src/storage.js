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

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}

/** -------------------------
 *  Export
 *  ------------------------- */
export function exportState(state) {
  return JSON.stringify(state, null, 2);
}

/** -------------------------
 *  Validation (v4 state)
 *  ------------------------- */
const BACKUP_KEY_PREFIX = "benchmarkpro_v4_backup_";

/**
 * Validates state for v4 schema. No throw.
 * @returns {{ ok: true } | { ok: false, errors: string[] }}
 */
export function validateStateV4(state) {
  const errors = [];
  if (!state || typeof state !== "object") {
    return { ok: false, errors: ["state ist kein Objekt"] };
  }
  if (state.dataVersion !== 4) {
    errors.push(`dataVersion muss 4 sein (ist: ${state.dataVersion})`);
  }
  if (!Array.isArray(state.plans)) {
    errors.push("plans muss ein Array sein");
  }
  if (!Array.isArray(state.exercises)) {
    errors.push("exercises muss ein Array sein");
  }
  if (!Array.isArray(state.workouts)) {
    errors.push("workouts muss ein Array sein");
  }
  if (errors.length) return { ok: false, errors };

  const workouts = state.workouts;
  for (let i = 0; i < workouts.length; i++) {
    const w = workouts[i];
    const prefix = `Workout[${i}]`;
    if (typeof w.id !== "string" || !w.id) {
      errors.push(`${prefix}: id muss nicht-leerer String sein`);
    }
    if (typeof w.date !== "string") {
      errors.push(`${prefix}: date muss String sein`);
    }
    if (!Array.isArray(w.items)) {
      errors.push(`${prefix}: items muss ein Array sein`);
    } else {
      for (let j = 0; j < w.items.length; j++) {
        const item = w.items[j];
        const itemPrefix = `${prefix}.items[${j}]`;
        if (typeof item.exerciseId !== "string") {
          errors.push(`${itemPrefix}: exerciseId muss String sein`);
        }
        if (!Array.isArray(item.sets)) {
          errors.push(`${itemPrefix}: sets muss ein Array sein`);
        } else {
          for (let k = 0; k < item.sets.length; k++) {
            const s = item.sets[k];
            const setPrefix = `${itemPrefix}.sets[${k}]`;
            const reps = s?.reps;
            const weight = s?.weight;
            if (reps != null && !Number.isFinite(Number(reps))) {
              errors.push(`${setPrefix}: reps muss endliche Zahl oder null sein`);
            }
            if (weight != null && !Number.isFinite(Number(weight))) {
              errors.push(`${setPrefix}: weight muss endliche Zahl oder null sein`);
            }
          }
        }
      }
    }
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true };
}

/**
 * Saves current state as backup to localStorage.
 * Key: benchmarkpro_v4_backup_<YYYYMMDD_HHMMSS>
 * @returns {string} backup key
 */
export function createBackup(state) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const sec = String(now.getSeconds()).padStart(2, "0");
  const key = `${BACKUP_KEY_PREFIX}${y}${m}${d}_${h}${min}${sec}`;
  localStorage.setItem(key, JSON.stringify(state));
  return key;
}

/** -------------------------
 *  Import (Preview + Apply)
 *  ------------------------- */

function toSlugId(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "exercise";
}

function parseDateToYMD(value) {
  if (!value) return null;
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  // Try ISO timestamp
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  return null;
}

function previewFromState(state) {
  return {
    kind: "v4",
    appVersion: state.appVersion || "?",
    dataVersion: state.dataVersion ?? "?",
    counts: {
      exercises: state.exercises?.length || 0,
      plans: state.plans?.length || 0,
      workouts: state.workouts?.length || 0
    }
  };
}

/**
 * Best-effort conversion from various v3-ish exports.
 * This is intentionally permissive; normalization/alias-cleanup comes later (v4.2).
 */
function convertLegacyToV4(legacy) {
  const state = createEmptyState();

  // Collect workouts list from common shapes
  const legacyWorkouts =
    legacy?.workouts ||
    legacy?.trainings ||
    legacy?.sessions ||
    legacy?.data?.workouts ||
    legacy?.data?.trainings ||
    [];

  // Collect plans from common shapes
  const legacyPlans =
    legacy?.plans ||
    legacy?.data?.plans ||
    null;

  // Helper: map exercise name -> id (create if missing)
  const nameToId = new Map();
  function upsertExerciseByName(name) {
    const clean = String(name || "").trim();
    if (!clean) return null;
    const key = clean.toLowerCase();
    if (nameToId.has(key)) return nameToId.get(key);

    // Try match existing defaults by name or alias (case-insensitive)
    const existing = state.exercises.find(e =>
      e.name.toLowerCase() === key || (e.aliases || []).some(a => String(a).toLowerCase() === key)
    );
    if (existing) {
      nameToId.set(key, existing.id);
      // keep alias if not already present
      if (existing.name !== clean && !(existing.aliases || []).includes(clean)) {
        existing.aliases = existing.aliases || [];
        existing.aliases.push(clean);
      }
      return existing.id;
    }

    // Create new
    let base = toSlugId(clean);
    let id = base;
    let i = 2;
    while (state.exercises.some(e => e.id === id)) {
      id = `${base}_${i++}`;
    }
    state.exercises.push({ id, name: clean, aliases: [] });
    nameToId.set(key, id);
    return id;
  }

  // Ensure we start with defaults if they are embedded in the exported legacy payload
  // (In app.js we also call ensureDefaults, so having extra exercises here is OK.)
  // If legacy has an exercises list, seed aliases
  const legacyExercises =
    legacy?.exercises ||
    legacy?.data?.exercises ||
    [];
  if (Array.isArray(legacyExercises)) {
    legacyExercises.forEach(x => {
      const n = x?.name || x;
      if (n) upsertExerciseByName(n);
    });
  }

  // Convert plans (A/B/C or list)
  if (legacyPlans) {
    if (Array.isArray(legacyPlans)) {
      legacyPlans.forEach(p => {
        const pname = p?.name || "Plan";
        const exNames = p?.exercises || p?.exerciseNames || p?.items || [];
        const exerciseIds = (exNames || []).map(upsertExerciseByName).filter(Boolean);
        state.plans.push({
          id: toSlugId(p?.id || pname),
          name: pname,
          exerciseIds
        });
      });
    } else if (typeof legacyPlans === "object") {
      // Object with keys A/B/C -> arrays
      const keys = Object.keys(legacyPlans);
      keys.forEach(k => {
        const list = legacyPlans[k];
        if (!Array.isArray(list)) return;
        const name = (k === "A" || k === "B" || k === "C") ? `Home Gym ${k}` : String(k);
        const id = (k === "A") ? "homegym_a" : (k === "B") ? "homegym_b" : (k === "C") ? "homegym_c" : toSlugId(name);
        const exerciseIds = list.map(upsertExerciseByName).filter(Boolean);
        state.plans.push({ id, name, exerciseIds });
      });
    }
  }

  // Convert workouts
  if (Array.isArray(legacyWorkouts)) {
    legacyWorkouts.forEach((w, idx) => {
      const ymd = parseDateToYMD(w?.date || w?.workoutDate || w?.createdAt || w?.timestamp) || "1970-01-01";
      const planKey = w?.plan || w?.planId || w?.selectedPlan || w?.template || null;
      let planId = null;
      if (typeof planKey === "string") {
        const key = planKey.trim();
        if (/^home\s*gym\s*a$/i.test(key) || /^a$/i.test(key)) planId = "homegym_a";
        else if (/^home\s*gym\s*b$/i.test(key) || /^b$/i.test(key)) planId = "homegym_b";
        else if (/^home\s*gym\s*c$/i.test(key) || /^c$/i.test(key)) planId = "homegym_c";
        else planId = toSlugId(key);
      }

      const itemsRaw =
        w?.items ||
        w?.exercises ||
        w?.exerciseEntries ||
        w?.data ||
        [];

      const items = [];
      if (Array.isArray(itemsRaw)) {
        itemsRaw.forEach(it => {
          const name = it?.name || it?.exercise || it?.exerciseName || it?.title;
          const exerciseId = upsertExerciseByName(name);
          if (!exerciseId) return;
          const setsRaw = it?.sets || it?.entries || it?.series || [];
          const sets = [];
          if (Array.isArray(setsRaw)) {
            setsRaw.forEach(s => {
              const reps = Number(s?.reps ?? s?.r ?? s?.repetitions ?? s?.wiederholungen ?? 0);
              const weight = Number(s?.weight ?? s?.kg ?? s?.gewicht ?? 0);
              if (!reps && !weight) return;
              sets.push({ reps, weight, note: String(s?.note || "").trim() });
            });
          }
          items.push({ exerciseId, sets });
        });
      }

      const wid = w?.id ? String(w.id) : `w_${ymd}_${String(idx + 1).padStart(3, "0")}`;

      state.workouts.push({
        id: wid,
        date: ymd,
        planId,
        notes: String(w?.notes || w?.note || "").trim(),
        items
      });
    });
  }

  // If legacy had no plans, keep empty; ensureDefaults in app.js will add A/B/C.
  return state;
}

export function parseImportFile(fileText) {
  let parsed;
  try {
    parsed = JSON.parse(fileText);
  } catch {
    throw new Error("Import abgelehnt: Datei ist kein gültiges JSON.");
  }

  // v4 native
  if (isLikelyState(parsed)) {
    const state = parsed;
    const preview = previewFromState(state);
    const validation = validateStateV4(state);
    return { kind: "v4", preview, state, validation };
  }

  // legacy best-effort
  if (parsed && typeof parsed === "object") {
    const converted = convertLegacyToV4(parsed);
    const validation = validateStateV4(converted);
    const preview = {
      kind: "legacy",
      appVersion: parsed?.appVersion || parsed?.version || "v3(?)",
      dataVersion: parsed?.dataVersion ?? "?",
      counts: {
        exercises: converted.exercises.length,
        plans: converted.plans.length,
        workouts: converted.workouts.length
      },
      note: "Legacy-Import: Übungsnamen werden als neue Exercises/Aliases übernommen. Normalisierung folgt in v4.2."
    };
    return { kind: "legacy", preview, state: converted, validation };
  }

  throw new Error("Import abgelehnt: Unbekanntes Format.");
}

export function applyImportedState(state) {
  // Normalize minimal metadata
  state.appVersion = APP_VERSION;
  state.dataVersion = DATA_VERSION;
  state.meta = state.meta || { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  return state;
}
