import { DATA_VERSION } from "./version.js";
import { LIBRARY, DEFAULT_SETTINGS, guessArea } from "./library.js";

/**
 * Migrations runner.
 * - state.dataVersion is the schema version of the persisted data.
 * - DATA_VERSION is the current schema version supported by the app.
 *
 * Keep migrations small, pure, and idempotent.
 */
const migrations = {
  // v4 -> v5: Snacks, Sport-Aktivitäten, Einstellungen, Workout-Typ
  4: (state) => {
    state.activities = Array.isArray(state.activities) ? state.activities : [];
    for (const w of state.workouts || []) {
      if (!w.type) w.type = "workout";
    }
    state.dataVersion = 5;
    return state;
  },
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

  // Ensure dataVersion is at least current schema once it is a v4+ state
  if (state && typeof state === "object" && state.workouts && state.plans && state.exercises) {
    state.dataVersion = DATA_VERSION;
    if (!Array.isArray(state.activities)) state.activities = [];
  }

  return { state, ran, from, to: DATA_VERSION };
}

/**
 * Gleicht Übungen und Einstellungen mit der kuratierten Bibliothek ab. Idempotent, läuft bei jedem Start.
 * Überschreibt keine Nutzeränderungen: fehlende Felder werden ergänzt, fehlende Bibliotheksübungen angelegt.
 */
/**
 * Eigene Übungen, die nur unter einem Zweitnamen einer Bibliotheksübung existieren (z.B. "Bizepscurls" neben
 * "KH-Curls"), werden in die Bibliotheksübung überführt, damit Verlauf und Kraftkurve nicht zerfallen.
 */
function mergeDuplicates(state, lower) {
  const libIds = new Set(LIBRARY.map((l) => l.id));
  const byName = new Map();
  for (const lib of LIBRARY) {
    if (!state.exercises.some((e) => e.id === lib.id)) continue;
    for (const n of [lib.name, ...(lib.aliases || [])]) byName.set(lower(n), lib.id);
  }
  for (const dup of [...state.exercises]) {
    if (libIds.has(dup.id)) continue;
    const target = byName.get(lower(dup.name));
    if (!target || target === dup.id) continue;
    const t = state.exercises.find((e) => e.id === target);
    for (const w of state.workouts || []) for (const it of w.items || []) if (it.exerciseId === dup.id) it.exerciseId = target;
    for (const p of state.plans || []) p.exerciseIds = [...new Set(p.exerciseIds.map((id) => (id === dup.id ? target : id)))];
    if (t.rating == null && dup.rating != null) t.rating = dup.rating;
    for (const a of [dup.name, ...(dup.aliases || [])]) if (!t.aliases.map(lower).includes(lower(a)) && lower(a) !== lower(t.name)) t.aliases.push(a);
    state.exercises = state.exercises.filter((e) => e !== dup);
  }
}

const OLD_HINTS = { hipflex: "Kniender Ausfallschritt, Hüfte nach vorne schieben." };

export function ensureLibrary(state) {
  const lower = (s) => String(s || "").trim().toLowerCase();
  // Was schon trainiert wurde, ist bekannt. Mit Gewicht trainiert heißt: bleibt eine Gewichtsübung.
  const used = new Set(), weighted = new Set();
  for (const w of state.workouts || []) for (const it of w.items || []) {
    if (!(it.sets || []).length) continue;
    used.add(it.exerciseId);
    if (it.sets.some((st) => Number(st.weight) > 0)) weighted.add(it.exerciseId);
  }

  for (const lib of LIBRARY) {
    const names = [lib.name, ...(lib.aliases || [])].map(lower);
    let ex = state.exercises.find((e) => e.id === lib.id)
      || state.exercises.find((e) => names.includes(lower(e.name)));

    if (!ex) {
      const { aliases, ...rest } = lib;
      state.exercises.push({ ...rest, aliases: [...(aliases || [])] });
      continue;
    }

    // Englische v4-Standardnamen auf Deutsch umstellen, alten Namen als Alias behalten
    if (ex.name !== lib.name && (lib.aliases || []).map(lower).includes(lower(ex.name)) && !ex.renamed) {
      ex.aliases = Array.isArray(ex.aliases) ? ex.aliases : [];
      if (!ex.aliases.includes(ex.name)) ex.aliases.push(ex.name);
      ex.name = lib.name;
      ex.renamed = true;
    }
    if (ex.kind === undefined && weighted.has(ex.id) && lib.kind !== "weight") {
      ex.kind = "weight";
      ex.eq = "free";
      ex.loc = "K";
    }
    // Überarbeitete Anleitungen übernehmen, solange noch der alte Standardtext drinsteht
    if (OLD_HINTS[ex.id] && ex.hint === OLD_HINTS[ex.id]) ex.hint = lib.hint;
    for (const key of ["area", "eq", "loc", "kind", "defKg", "hint"]) {
      if (ex[key] === undefined) ex[key] = lib[key];
    }
    if (!("rating" in ex)) ex.rating = lib.rating ?? (used.has(ex.id) ? "ok" : null);
    // Neue Zweitnamen aus der Bibliothek auch bei bestehenden Übungen ergänzen
    ex.aliases = Array.isArray(ex.aliases) ? ex.aliases : [];
    for (const a of lib.aliases || []) if (!ex.aliases.map(lower).includes(lower(a))) ex.aliases.push(a);
  }

  mergeDuplicates(state, lower);

  for (const ex of state.exercises) {
    if (!Array.isArray(ex.aliases)) ex.aliases = [];
    if (ex.area === undefined) ex.area = guessArea(ex.name);
    if (ex.eq === undefined) ex.eq = "free";
    if (ex.loc === undefined) ex.loc = "K";
    if (ex.kind === undefined) ex.kind = used.has(ex.id) && !weighted.has(ex.id) ? "reps" : "weight";
    if (ex.defKg === undefined) ex.defKg = 0;
    if (!("rating" in ex)) ex.rating = "ok";
  }

  const s = state.settings && typeof state.settings === "object" ? state.settings : {};
  state.settings = {
    ...structuredClone(DEFAULT_SETTINGS),
    ...s,
    points: { ...DEFAULT_SETTINGS.points, ...(s.points || {}) },
    reminder: { ...DEFAULT_SETTINGS.reminder, ...(s.reminder || {}) },
  };
  if (!Array.isArray(state.activities)) state.activities = [];
  if (!state.pai || typeof state.pai !== "object" || Array.isArray(state.pai)) state.pai = {};
  for (const w of state.workouts) {
    if (!w.type) w.type = "workout";
  }
  return state;
}
