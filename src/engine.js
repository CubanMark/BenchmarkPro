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

export function rawPoints(state, w) {
  const p = state.settings.points;
  if (w.type === "mobility") return { k: 0, m: p.mobility };
  if (w.type === "snack") return { k: p.snack, m: 0 };
  return { k: p.workout, m: 0 };
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
 * Alle Sätze geschafft -> nächste Stufe; sonst halten.
 */
export function prefill(state, ex, { sets = 3, reps = 10 } = {}, excludeId = null) {
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

  if (allHit) {
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
export function buildRun(state, source, { energy = null } = {}) {
  const date = todayKey();
  const base = { id: newId(date), date, notes: "", energy, startedAt: new Date().toISOString(), items: [] };

  if (source.kind === "snack" || source.kind === "new") {
    const snack = source.kind === "snack" ? snackById(source.id) : newSnack(state, source.exerciseId);
    const w = { ...base, type: snack.type === "mobility" ? "mobility" : "snack", planId: null, snackId: snack.id, name: snack.name, minutes: snack.minutes };
    w.items = snack.items.map((it) => {
      const ex = exerciseById(state, it.exerciseId);
      if (!ex) return null;
      if (ex.kind === "task") return { exerciseId: ex.id, detail: it.detail || "", done: false, sets: [] };
      const pf = prefill(state, ex, { sets: it.sets, reps: it.reps });
      return { exerciseId: ex.id, target: { sets: it.sets, reps: it.reps }, rows: pf.rows, hint: pf.hint, hold: pf.hold, sets: [] };
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
function allowedLoc(loc, away) {
  return away ? loc === "U" : true;
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
 * ctx: { energy: 1|2|3, sportToday: bool, sportYesterday: bool, away: bool, hour }
 */
export function suggest(state, dayMap, ctx) {
  const today = todayKey();
  const monday = mondayOf(today);
  const week = weekSummary(state, dayMap, monday);
  const counts7 = areaCounts(state, monday, today);
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
  const energyText = ["", "platt, also etwas Kurzes und Leichtes", "okay, also ein kurzer Kraftsnack", "fit, gerne auch mehr"][ctx.energy];
  const out = [];

  for (const snack of SNACKS) {
    if (!snack.energy.includes(ctx.energy) || !allowedLoc(snack.loc, ctx.away) || !snackUsable(state, snack)) continue;
    if (snack.legs && ctx.sportToday) continue;
    const area = AREAS.find((a) => a.id === snack.area);
    const done = counts7[snack.area] || 0;
    const since = daysSinceArea(state, snack.area, today);
    const reasons = [];
    let score;

    if (snack.type === "mobility") {
      score = 0.3;
      if (done < area.target) { score += 0.3; reasons.push(["Mobility", `${done} von ${area.target} Einheiten diese Woche`]); }
      if (ctx.energy === 1) { score += 0.5; reasons.push(["Tagesform", energyText]); }
      if (snack.id === "mob_sport" && ctx.sportToday) { score += 0.5; reasons.push(["Nach dem Sport", "Lockert Beine und Hüfte nach Padel, Tennis oder Fußball"]); }
      if (snack.id === "mob_morgen" && ctx.hour < 11) { score += 0.5; reasons.push(["Morgens", "Hilft gegen den steifen Rücken"]); }
      if (snack.id === "mob_buero" && ctx.away) { score += 0.3; reasons.push(["Unterwegs", "Geht ohne Matte und Equipment"]); }
      if (snack.id === "mob_morgen" && ctx.hour >= 11 && !ctx.sportToday) score -= 0.1;
    } else {
      const deficit = area.target ? Math.max(0, 1 - done / area.target) : 0.15;
      score = deficit;
      if (area.target) reasons.push([area.name, `${done} von ${area.target} Sätzen diese Woche`]);
      if (since == null) { score += 0.3; reasons.push(["Zuletzt", "noch nie trainiert"]); }
      else { score += Math.min(since, 14) / 14 * 0.6; reasons.push(["Zuletzt", since === 0 ? "heute schon trainiert" : `vor ${since} ${since === 1 ? "Tag" : "Tagen"} trainiert`]); }
      if (week.k < s.strengthMin) score += 0.2;
      if (ctx.energy === 1 && snack.minutes > 6) score -= 0.3;
      if (snack.legs && ctx.sportYesterday) score -= 0.6;
      if (ctx.energy === 3 && snack.minutes >= 8) score += 0.1;
      if (snack.loc === "K" && ctx.energy === 1) score -= 0.2;
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

  // Ganzes Workout bei guter Tagesform
  if (ctx.energy === 3 && !ctx.away && state.plans.length) {
    const lastByPlan = state.plans.map((p) => {
      const ws = state.workouts.filter((w) => w.planId === p.id && counts(state, w)).map((w) => w.date).sort();
      return { plan: p, last: ws[ws.length - 1] || null };
    }).filter((x) => x.plan.exerciseIds.length)
      .sort((a, b) => (a.last || "").localeCompare(b.last || ""));
    const pick = lastByPlan[0];
    if (pick) {
      const remaining = s.weeklyGoal - week.total;
      const since = pick.last ? daysBetween(pick.last, today) : null;
      const reasons = [];
      let score = 0.8;
      if (remaining > 0) { score += remaining >= s.points.workout ? 0.4 : 0.2; reasons.push(["Wochenziel", remaining <= s.points.workout ? `Mit ${s.points.workout} Punkten schaffst du heute dein Wochenziel` : `Bringt dich ${s.points.workout} Punkte näher ans Wochenziel`]); }
      reasons.push([pick.plan.name, since == null ? "hast du noch nie gemacht" : `ist dein ältestes Workout, zuletzt vor ${since} Tagen`]);
      reasons.push(["Tagesform", energyText]);
      if (trainedToday.size) score -= 0.4;
      out.push({
        kind: "plan", id: pick.plan.id, title: pick.plan.name, area: "ganzkoerper", type: "workout", minutes: 35, loc: "K",
        points: s.points.workout, reasons, score,
        exercises: pick.plan.exerciseIds.map((id) => exerciseName(state, id)),
      });
    }
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
  const unknown = state.exercises.filter((e) => e.rating == null && e.area && allowedLoc(e.loc, ctx.away) && e.eq !== "band");
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
    reasons: [["Neu ausprobieren", "Diese Übung kennst du noch nicht. Danach sagst du, ob sie bleibt."], ...(ex.hint ? [["So geht's", ex.hint]] : []), [areaName(ex.area), "Bereich, in dem diese Woche noch etwas fehlt"]],
    score: 0, isNew: true, exercises: [ex.name],
  };
}
