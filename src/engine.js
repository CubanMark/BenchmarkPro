/**
 * Rechenlogik v5: Punkte, Wochenstand, Zielbereiche, Snack-Vorschläge und Progression.
 * Reine Funktionen auf dem State, kein DOM.
 */
import { AREAS, SNACKS, nextWeight, areaName } from "./library.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/* ---------- Datum ---------- */
export function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseKey(key) {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12);
}
export function todayKey() {
  return dayKey(new Date());
}
export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}
export function mondayOf(key) {
  const d = parseKey(key);
  const iso = d.getDay() === 0 ? 7 : d.getDay();
  d.setDate(d.getDate() - (iso - 1));
  return dayKey(d);
}
export function daysBetween(fromKey, toKey) {
  return Math.round((parseKey(toKey) - parseKey(fromKey)) / DAY_MS);
}
export function isoWeek(key) {
  const d = parseKey(key);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - y0) / DAY_MS + 1) / 7);
}

/* ---------- Übungen ---------- */
export function exerciseById(state, id) {
  return state.exercises.find((e) => e.id === id) || null;
}
export function exerciseName(state, id) {
  return exerciseById(state, id)?.name || id;
}

/* ---------- Einheiten und Punkte ---------- */
export function isActive(state, w) {
  return state.meta?.activeWorkoutId === w.id;
}

/** Zählt eine Einheit (abgeschlossen und nicht leer)? */
export function counts(state, w) {
  if (isActive(state, w)) return false;
  if (w.type === "mobility") return (w.items || []).some((i) => i.done) || w.finished === true;
  return (w.items || []).some((i) => (i.sets || []).length > 0);
}

export const WORKOUT_MIN_SETS = 6;

export function rawPoints(state, w) {
  const p = state.settings.points;
  if (w.type === "mobility") return { k: 0, m: p.mobility };
  if (w.type === "snack") return { k: p.snack, m: 0 };
  // Kurze Einheiten (z.B. nur zwei Sätze Curls) zählen wie ein Snack, erst ab WORKOUT_MIN_SETS Sätzen als Workout
  const sets = (w.items || []).reduce((n, i) => n + (i.sets?.length || 0), 0);
  return { k: sets >= WORKOUT_MIN_SETS ? p.workout : p.snack, m: 0 };
}

/** Map dayKey -> { k, m, total, raw, workouts, sports } mit Tageslimit. */
export function buildDayMap(state) {
  const cap = state.settings.dailyCap;
  const map = new Map();
  const get = (key) => {
    if (!map.has(key)) map.set(key, { k: 0, m: 0, total: 0, rawK: 0, rawM: 0, workouts: [], sports: [], pai: null });
    return map.get(key);
  };
  for (const w of state.workouts) {
    if (!w.date || !counts(state, w)) continue;
    const d = get(w.date);
    const p = rawPoints(state, w);
    d.rawK += p.k;
    d.rawM += p.m;
    d.workouts.push(w);
  }
  for (const a of state.activities || []) {
    if (a.date) get(a.date).sports.push(a);
  }
  for (const [key, v] of Object.entries(state.pai || {})) {
    if (Number.isFinite(Number(v))) get(key).pai = Number(v);
  }
  for (const d of map.values()) {
    d.k = Math.min(d.rawK, cap);
    d.m = Math.min(d.rawM, cap - d.k);
    d.total = d.k + d.m;
  }
  return map;
}

export function weekSummary(state, dayMap, monday = mondayOf(todayKey())) {
  let k = 0, m = 0, pai = 0;
  const days = [];
  for (let i = 0; i < 7; i++) {
    const key = addDays(monday, i);
    const d = dayMap.get(key);
    k += d?.k || 0;
    m += d?.m || 0;
    pai += d?.pai || 0;
    days.push({ key, day: d || null });
  }
  const s = state.settings;
  const total = k + m;
  return { k, m, total, pai, days, goalMet: total >= s.weeklyGoal && k >= s.strengthMin };
}

/** Die letzten 7 Tage bis heute (rollierend, für Ringe und Vorschläge). */
export function last7Summary(state, dayMap, today = todayKey()) {
  return weekSummary(state, dayMap, addDays(today, -6));
}

/** Wie viele Wochen in Folge wurde das Ziel erreicht (aktuelle Woche zählt, sobald erreicht). */
export function goalStreak(state, dayMap) {
  let monday = mondayOf(todayKey());
  let streak = 0;
  if (weekSummary(state, dayMap, monday).goalMet) streak++;
  for (let i = 0; i < 104; i++) {
    monday = addDays(monday, -7);
    if (!weekSummary(state, dayMap, monday).goalMet) break;
    streak++;
  }
  return streak;
}

/* ---------- Zielbereiche ---------- */
/** Sätze pro Zielbereich im Zeitraum [fromKey, toKey]; Mobility zählt Einheiten. */
export function areaCounts(state, fromKey, toKey) {
  const out = Object.fromEntries(AREAS.map((a) => [a.id, 0]));
  for (const w of state.workouts) {
    if (!w.date || w.date < fromKey || w.date > toKey || !counts(state, w)) continue;
    if (w.type === "mobility") { out.mobility += 1; continue; }
    for (const item of w.items || []) {
      const area = exerciseById(state, item.exerciseId)?.area;
      if (area && area in out) out[area] += (item.sets || []).length;
    }
  }
  return out;
}

/** Tage seit der letzten Einheit mit Sätzen in diesem Bereich (null = noch nie). */
export function daysSinceArea(state, areaId, today = todayKey()) {
  let last = null;
  for (const w of state.workouts) {
    if (!counts(state, w) || !w.date || w.date > today) continue;
    const hit = areaId === "mobility"
      ? w.type === "mobility"
      : (w.items || []).some((i) => (i.sets || []).length && exerciseById(state, i.exerciseId)?.area === areaId);
    if (hit && (!last || w.date > last)) last = w.date;
  }
  return last ? daysBetween(last, today) : null;
}

/* ---------- Historie und Progression ---------- */
export function exerciseSessions(state, exerciseId, excludeId = null) {
  const out = [];
  for (const w of state.workouts) {
    if (w.id === excludeId || !counts(state, w)) continue;
    const item = (w.items || []).find((i) => i.exerciseId === exerciseId);
    if (item && item.sets?.length) out.push({ date: w.date, workoutId: w.id, sets: item.sets });
  }
  return out.sort((a, b) => (b.date || "").localeCompare(a.date || "") || String(b.workoutId).localeCompare(String(a.workoutId)));
}

const fmt = (n) => String(Math.round(Number(n) * 100) / 100).replace(".", ",");
export const fmtKg = (n) => `${fmt(n)} kg`;

function setsText(sets, kind) {
  const reps = sets.map((s) => s.reps);
  const same = reps.every((r) => r === reps[0]);
  const unit = kind === "time" ? " s" : "";
  return same ? `${sets.length} × ${reps[0]}${unit}` : reps.join(" / ") + unit;
}

/**
 * Vorbelegung für eine Übung: Zeilen mit Gewicht und Wiederholungen plus Hinweistext.
 * Alle Sätze geschafft -> nächste Stufe; sonst halten. easy (Tagesform platt) hält immer.
 */
export function prefill(state, ex, { sets = 3, reps = 10, easy = false } = {}, excludeId = null) {
  const kind = ex?.kind || "weight";
  const eq = ex?.eq || "free";
  const settings = state.settings;
  const last = exerciseSessions(state, ex.id, excludeId)[0];
  const baseWeight = eq === "kb" ? Number(settings.kbWeight) || 10 : Number(ex.defKg) || 0;
  const usesWeight = kind === "weight";

  if (!last) {
    return {
      rows: Array.from({ length: sets }, () => ({ weight: usesWeight ? baseWeight : null, reps, done: false })),
      hint: usesWeight ? "Erstes Mal. Das Startgewicht ist ein Vorschlag, passe es an." : "Erstes Mal. Passe die Wiederholungen an, wenn nötig.",
      hold: true,
    };
  }

  const lastWeights = last.sets.map((s) => Number(s.weight) || 0);
  const lastW = usesWeight ? Math.max(...lastWeights) : null;
  const allHit = last.sets.length >= sets && last.sets.every((s) => Number(s.reps) >= reps);
  const withKg = usesWeight && lastW > 0 ? ` mit ${fmtKg(lastW)}` : "";
  const lastTxt = `Letztes Mal ${setsText(last.sets, kind)}${withKg}.`;

  let weight = lastW;
  let targetReps = reps;
  let hint;
  let hold = true;

  if (easy) {
    hint = usesWeight && lastW > 0 ? `${lastTxt} Heute locker: Gewicht halten, ${sets} × ${reps}.` : `${lastTxt} Heute locker: ${sets} × ${reps}${kind === "time" ? " s" : ""}.`;
  } else if (allHit) {
    hold = false;
    if (usesWeight && eq !== "kb" && eq !== "none" && eq !== "band") {
      const nxt = eq === "free" ? lastW + 1.25 : nextWeight(eq, lastW, 1, settings);
      if (nxt > lastW && (nxt - lastW) / Math.max(lastW, 1) <= 0.3) {
        weight = nxt;
        hint = `${lastTxt} Alle Sätze geschafft, heute ${fmtKg(nxt)}.`;
      } else {
        targetReps = reps + 2;
        hint = `${lastTxt} Die nächste Gewichtsstufe wäre ein großer Sprung, deshalb heute ${targetReps} Wiederholungen.`;
      }
    } else {
      const step = kind === "time" ? 5 : kind === "weight" ? 2 : 1;
      const lastMax = Math.max(...last.sets.map((s) => Number(s.reps) || 0));
      targetReps = Math.max(reps, lastMax) + step;
      hint = `${lastTxt} Alle geschafft, heute ${targetReps}${kind === "time" ? " s" : " Wiederholungen"}.`;
    }
  } else {
    hint = usesWeight && lastW > 0 ? `${lastTxt} Gewicht halten, Ziel ${sets} × ${reps}.` : `${lastTxt} Ziel heute ${sets} × ${reps}${kind === "time" ? " s" : ""}.`;
  }

  return {
    rows: Array.from({ length: sets }, () => ({ weight: usesWeight ? weight : null, reps: targetReps, done: false })),
    hint,
    hold,
  };
}

/* ---------- Einheit anlegen ---------- */
function newId(date) {
  return `w_${date}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

export function snackById(id) {
  return SNACKS.find((s) => s.id === id) || null;
}

/** Baut eine neue Einheit aus einer Quelle: { kind: 'snack'|'plan'|'free'|'new', id, exerciseId } */
export function buildRun(state, source, { energy = null, place = "keller" } = {}) {
  const date = todayKey();
  const base = { id: newId(date), date, notes: "", energy, startedAt: new Date().toISOString(), items: [] };

  if (source.kind === "snack" || source.kind === "new") {
    const snack = source.kind === "snack" ? snackById(source.id) : newSnack(state, source.exerciseId);
    const w = { ...base, type: snack.type === "mobility" ? "mobility" : "snack", planId: null, snackId: snack.id, name: snack.name, minutes: snack.minutes };
    w.items = snack.items.map((it) => {
      const ex = exerciseById(state, it.exerciseId);
      if (!ex) return null;
      if (ex.kind === "task") return { exerciseId: ex.id, detail: it.detail || "", done: false, sets: [] };
      // Platt: einen Satz weniger und ohne Steigerung
      const easy = energy === 1;
      const sets = easy && it.sets > 2 ? it.sets - 1 : it.sets;
      const pf = prefill(state, ex, { sets, reps: it.reps, easy });
      // Außerhalb des Kellers gibt es keine Langhantel: ohne Gewicht (z.B. Glute Bridge)
      if (place !== "keller" && ex.kind === "weight" && pf.rows.some((r) => Number(r.weight) > 0)) {
        pf.rows = pf.rows.map((r) => ({ ...r, weight: 0 }));
        pf.hint = "Heute ohne Gewicht.";
      }
      return { exerciseId: ex.id, target: { sets, reps: it.reps }, rows: pf.rows, hint: pf.hint, hold: pf.hold, sets: [] };
    }).filter(Boolean);
    if (source.kind === "new") w.tryExerciseId = source.exerciseId;
    return w;
  }

  if (source.kind === "plan") {
    const plan = state.plans.find((p) => p.id === source.id);
    const w = { ...base, type: "workout", planId: plan?.id || null, snackId: null, name: plan?.name || "Workout", minutes: null };
    for (const exId of plan?.exerciseIds || []) {
      const item = planItem(state, exId);
      if (item) w.items.push(item);
    }
    return w;
  }

  return { ...base, type: "workout", planId: null, snackId: null, name: "Freie Einheit", minutes: null, items: [] };
}

/** Item für Workouts und freie Einheiten: Satzzahl und Wiederholungen aus der letzten Einheit. */
export function planItem(state, exId, excludeId = null) {
  const ex = exerciseById(state, exId);
  if (!ex) return null;
  if (ex.kind === "task") return { exerciseId: ex.id, detail: "", done: false, sets: [] };
  const last = exerciseSessions(state, exId, excludeId)[0];
  const sets = last ? Math.min(Math.max(last.sets.length, 2), 5) : 3;
  const reps = last ? Math.max(...last.sets.map((s) => Number(s.reps) || 0)) || 8 : ex.kind === "time" ? 30 : 8;
  const pf = prefill(state, ex, { sets, reps }, excludeId);
  return { exerciseId: ex.id, target: { sets, reps }, rows: pf.rows, hint: pf.hint, hold: pf.hold, sets: [] };
}

function newSnack(state, exerciseId) {
  const ex = exerciseById(state, exerciseId);
  if (ex.kind === "task") return { id: `new_${ex.id}`, name: `Neu: ${ex.name}`, area: ex.area, type: "mobility", minutes: 4, items: [{ exerciseId: ex.id, detail: "2 × 30 s" }] };
  return {
    id: `new_${ex.id}`, name: `Neu: ${ex.name}`, area: ex.area, type: "strength", minutes: 6,
    items: [{ exerciseId: ex.id, sets: 3, reps: ex.kind === "time" ? 30 : 10 }],
  };
}

/** Überträgt erledigte Zeilen in item.sets (nur die zählen für Statistik und Punkte). */
export function syncSets(item) {
  if (!item.rows) return;
  item.sets = item.rows.filter((r) => r.done && Number(r.reps) > 0)
    .map((r) => ({ reps: Number(r.reps), weight: r.weight == null ? 0 : Number(r.weight), note: "" }));
}

/* ---------- Rekorde ---------- */
export function findRecords(state, w) {
  const out = [];
  for (const item of w.items || []) {
    if (!item.sets?.length) continue;
    const ex = exerciseById(state, item.exerciseId);
    const prev = exerciseSessions(state, item.exerciseId, w.id).filter((s) => s.date <= w.date);
    if (!prev.length) continue;
    if (ex?.kind === "weight" && ex.eq !== "kb" && ex.eq !== "none") {
      const top = Math.max(...item.sets.map((s) => s.weight));
      const prevTop = Math.max(...prev.flatMap((s) => s.sets.map((x) => Number(x.weight) || 0)));
      if (top > prevTop) {
        const reps = Math.max(...item.sets.filter((s) => s.weight === top).map((s) => s.reps));
        out.push({ exerciseId: item.exerciseId, text: `${ex.name}: ${fmtKg(top)} × ${reps}, bisher ${fmtKg(prevTop)}` });
      }
    } else {
      const top = Math.max(...item.sets.map((s) => s.reps));
      const prevTop = Math.max(...prev.flatMap((s) => s.sets.map((x) => Number(x.reps) || 0)));
      if (top > prevTop) {
        const unit = ex?.kind === "time" ? " s" : " Wiederholungen";
        out.push({ exerciseId: item.exerciseId, text: `${ex?.name || item.exerciseId}: ${top}${unit}, bisher ${prevTop}${unit}` });
      }
    }
  }
  return out;
}

/* ---------- Vorschläge ---------- */
/** Ort: "keller" = alles, "home" = Wohnzimmer (ohne Hanteln, Bank und Klimmzugstange, Bänder gehen), "away" = ohne jedes Equipment. */
function placeOf(ctx) {
  return ctx.place || (ctx.away ? "away" : "keller");
}
function allowedEx(ex, place) {
  if (!ex) return false;
  if (place === "keller") return true;
  if (ex.loc !== "U") return false;
  if (ex.eq === "band") return place === "home";
  if (ex.kind === "task") return true;
  return !["kb", "kh1", "kh2"].includes(ex.eq);
}
function allowedSnack(state, snack, place) {
  if (place === "keller") return true;
  if (snack.loc !== "U") return false;
  return snack.items.every((it) => allowedEx(exerciseById(state, it.exerciseId), place));
}

function snackUsable(state, snack) {
  // Kein "Nein", und mindestens die Hälfte der Übungen kennt er schon
  const exs = snack.items.map((it) => exerciseById(state, it.exerciseId));
  if (exs.some((ex) => !ex || ex.rating === "no")) return false;
  if (snack.type === "mobility") return true;
  return exs.filter((ex) => ex.rating != null).length * 2 >= exs.length;
}

/**
 * Liefert sortierte Vorschläge: { kind, id, exerciseId?, title, area, type, minutes, points, reasons, score }.
 * ctx: { energy: 1|2|3, sportToday: bool, sportYesterday: bool, place: "keller"|"home"|"away", hour }
 * Die Tagesform entscheidet zuerst über Art und Länge, danach zählt, was in den letzten 7 Tagen fehlt.
 */
export function suggest(state, dayMap, ctx) {
  const today = todayKey();
  const week = last7Summary(state, dayMap, today);
  const counts7 = areaCounts(state, addDays(today, -6), today);
  const todayDay = dayMap.get(today);
  const trainedToday = new Set();
  for (const w of todayDay?.workouts || []) {
    for (const i of w.items || []) {
      const a = exerciseById(state, i.exerciseId)?.area;
      if (a && (i.sets?.length || i.done)) trainedToday.add(a);
    }
    if (w.type === "mobility") trainedToday.add("mobility");
  }
  const s = state.settings;
  const energyText = ["", "platt, also etwas Kurzes und Leichtes", "okay, also ein normaler Kraftsnack", "fit, also ein längerer Kraftsnack"][ctx.energy];
  const place = placeOf(ctx);
  const out = [];

  for (const snack of SNACKS) {
    if (!snack.energy.includes(ctx.energy) || !allowedSnack(state, snack, place) || !snackUsable(state, snack)) continue;
    if (snack.legs && ctx.sportToday) continue;
    const area = AREAS.find((a) => a.id === snack.area);
    const done = counts7[snack.area] || 0;
    const since = daysSinceArea(state, snack.area, today);
    const reasons = [];
    let score;

    if (snack.type === "mobility") {
      score = 0.3;
      if (done < area.target) { score += 0.3; reasons.push(["Mobility", `${done} von ${area.target} Einheiten in 7 Tagen`]); }
      if (ctx.energy === 1) { score += 1.6; reasons.push(["Tagesform", energyText]); }
      if (ctx.energy === 2) score -= 0.3;
      if (ctx.energy === 3) score -= 0.6;
      if (snack.id === "mob_sport" && ctx.sportToday) { score += 0.5; reasons.push(["Nach dem Sport", "Lockert Beine und Hüfte nach Padel, Tennis oder Fußball"]); }
      if (snack.id === "mob_morgen" && ctx.hour < 11) { score += 0.5; reasons.push(["Morgens", "Hilft gegen den steifen Rücken"]); }
      if (snack.id === "mob_buero" && place === "away") { score += 0.3; reasons.push(["Unterwegs", "Geht ohne Matte und Equipment"]); }
      if (snack.id === "mob_morgen" && ctx.hour >= 11 && !ctx.sportToday) score -= 0.1;
      if (snack.id === "mob_sport" && !ctx.sportToday && !ctx.sportYesterday) score -= 0.3;
    } else {
      const deficit = area.target ? Math.max(0, 1 - done / area.target) : 0.15;
      score = deficit;
      if (area.target) reasons.push([area.name, `${done} von ${area.target} Sätzen in 7 Tagen`]);
      if (since == null) { score += 0.3; reasons.push(["Zuletzt", "noch nie trainiert"]); }
      else { score += Math.min(since, 14) / 14 * 0.6; reasons.push(["Zuletzt", since === 0 ? "heute schon trainiert" : `vor ${since} ${since === 1 ? "Tag" : "Tagen"} trainiert`]); }
      if (week.k < s.strengthMin) score += 0.2;
      // Tagesform: platt = kurz und leicht, okay = normaler Snack, fit = längerer Snack mit Hanteln
      if (ctx.energy === 1) score += snack.minutes <= 6 ? 0.2 : -0.6;
      if (ctx.energy === 2) score += snack.minutes <= 5 ? -0.5 : 0.3;
      if (ctx.energy === 3) score += (snack.minutes >= 8 ? 0.6 : snack.minutes <= 5 ? -0.6 : 0) + (snack.loc === "K" ? 0.2 : 0) + (snack.energy.length === 1 ? 0.4 : 0);
      if (snack.legs && ctx.sportYesterday) score -= 0.6;
      reasons.push(["Tagesform", energyText]);
    }
    const loved = snack.items.filter((it) => exerciseById(state, it.exerciseId)?.rating === "love").length;
    score += 0.15 * loved / snack.items.length;
    if (trainedToday.has(snack.area)) score -= 0.6;

    out.push({
      kind: "snack", id: snack.id, title: snack.name, area: snack.area, type: snack.type, minutes: snack.minutes, loc: snack.loc,
      points: snack.type === "mobility" ? s.points.mobility : s.points.snack, reasons: reasons.slice(0, 3), score,
      exercises: snack.items.map((i) => exerciseName(state, i.exerciseId)),
    });
  }

  out.sort((a, b) => b.score - a.score);

  // Hauptvorschlag plus zwei Alternativen aus anderen Bereichen
  const picked = [];
  for (const c of out) {
    if (picked.length >= 3) break;
    if (picked.some((p) => p.area === c.area)) continue;
    picked.push(c);
  }
  for (const c of out) {
    if (picked.length >= 3) break;
    if (!picked.includes(c)) picked.push(c);
  }

  // Ab und zu (jeden zweiten Tag) eine unbekannte Übung zum Ausprobieren
  const doy = Math.floor(parseKey(today) / DAY_MS);
  if (ctx.energy >= 2 && doy % 2 === 0) {
    const neu = tryNewCandidate(state, counts7, ctx);
    if (neu) {
      if (picked.length >= 3) picked[2] = neu;
      else picked.push(neu);
    }
  }

  if (todayDay && todayDay.total >= s.dailyCap) {
    for (const p of picked) p.capped = true;
  }
  return picked;
}

function tryNewCandidate(state, counts7, ctx) {
  const unknown = state.exercises.filter((e) => e.rating == null && e.area && allowedEx(e, placeOf(ctx)) && e.eq !== "band");
  if (!unknown.length) return null;
  const deficit = (areaId) => {
    const a = AREAS.find((x) => x.id === areaId);
    return a?.target ? 1 - (counts7[areaId] || 0) / a.target : 0;
  };
  unknown.sort((a, b) => deficit(b.area) - deficit(a.area));
  const ex = unknown[0];
  return {
    kind: "new", id: `new_${ex.id}`, exerciseId: ex.id, title: `Neu: ${ex.name}`, area: ex.area,
    type: ex.kind === "task" ? "mobility" : "strength", minutes: ex.kind === "task" ? 4 : 6, loc: ex.loc,
    points: ex.kind === "task" ? state.settings.points.mobility : state.settings.points.snack,
    reasons: [["Neu ausprobieren", "Diese Übung kennst du noch nicht. Danach sagst du, ob sie bleibt."], ...(ex.hint ? [["So geht's", ex.hint]] : []), [areaName(ex.area), "Bereich, in dem in den letzten 7 Tagen etwas fehlt"]],
    score: 0, isNew: true, exercises: [ex.name],
  };
}

/* ---------- Kompass ---------- */
export const STRENGTH_DAY_SETS = 6;

function strengthSets(state, w) {
  if (w.type === "mobility") return 0;
  let n = 0;
  for (const i of w.items || []) {
    const ex = exerciseById(state, i.exerciseId);
    if (ex && ex.kind !== "task" && ex.area !== "mobility") n += i.sets?.length || 0;
  }
  return n;
}
const isFullWorkout = (w) => w.type !== "snack" && w.type !== "mobility"
  && (w.items || []).reduce((n, i) => n + (i.sets?.length || 0), 0) >= WORKOUT_MIN_SETS;

/**
 * Stand der letzten 7 Tage plus die heute passende Einheit.
 * Ziel: 2 Krafttage (je mindestens 6 Kraftsätze), davon 1 volles Workout.
 * Fehlt das Workout seit 4 Tagen oder länger, kommt zuerst ein Workout, der Snack als Alternative.
 */
export function compass(state, dayMap, { place = "keller", sportToday = false, sportYesterday = false } = {}) {
  const today = todayKey();
  const from = addDays(today, -6);
  let strengthDays = 0, fullWorkouts = 0;
  for (let i = 0; i < 7; i++) {
    const d = dayMap.get(addDays(from, i));
    const ws = d?.workouts || [];
    if (ws.reduce((n, w) => n + strengthSets(state, w), 0) >= STRENGTH_DAY_SETS) strengthDays++;
    fullWorkouts += ws.filter(isFullWorkout).length;
  }
  const lastFull = state.workouts.filter((w) => w.date && w.date <= today && counts(state, w) && isFullWorkout(w)).map((w) => w.date).sort().pop();
  const sinceFull = lastFull ? Math.round((parseKey(today) - parseKey(lastFull)) / DAY_MS) : Infinity;

  const cnt = areaCounts(state, from, today);
  const low = AREAS.filter((a) => a.target && a.id !== "mobility")
    .map((a) => ({ a, r: (cnt[a.id] || 0) / a.target })).filter((x) => x.r < 0.5).sort((x, y) => x.r - y.r)[0]?.a || null;

  const ctx = { sportToday, sportYesterday, place, hour: new Date().getHours() };
  const goalMet = strengthDays >= 2 && fullWorkouts >= 1;
  const list = suggest(state, dayMap, { ...ctx, energy: goalMet ? 1 : 2 }).filter((c) => c.kind === "snack");
  const snack = (goalMet ? list.find((c) => c.type === "mobility") : list.find((c) => c.area === low?.id)) || list[0] || null;
  // Ein Workout heißt Keller, egal wo der letzte Snack war
  const plan = pickPlan(state, sportToday || sportYesterday);
  const workoutFirst = !!plan && !goalMet && sinceFull >= 4 && fullWorkouts === 0;
  const main = workoutFirst ? plan : snack;
  const alt = workoutFirst ? snack : (!goalMet && fullWorkouts === 0 ? plan : null);
  return { strengthDays, fullWorkouts, sinceFull, low, goalMet, main, alt };
}

/** Der Plan, der am längsten nicht dran war. Nach Sport bevorzugt einer mit wenig Beinarbeit. */
function pickPlan(state, legsTired) {
  const plans = (state.plans || []).filter((p) => (p.exerciseIds || []).length >= 3);
  if (!plans.length) return null;
  const lastDone = (p) => state.workouts.filter((w) => w.planId === p.id && counts(state, w)).map((w) => w.date).sort().pop() || "";
  const legs = (p) => p.exerciseIds.filter((id) => ["beine", "huefte"].includes(exerciseById(state, id)?.area)).length;
  const best = plans.slice().sort((a, b) => (legsTired ? legs(a) - legs(b) : 0) || lastDone(a).localeCompare(lastDone(b)))[0];
  return {
    kind: "plan", id: best.id, title: best.name, type: "workout", minutes: Math.min(best.exerciseIds.length, 6) * 6, // Varianten wie Box Squat / Kniebeuge: nur eine wird gemacht
    points: state.settings.points.workout, exercises: best.exerciseIds.map((id) => exerciseName(state, id)),
  };
}
