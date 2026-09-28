import { APP_VERSION } from "./version.js";
import { loadState, saveState, exportState, parseImportFile, applyImportedState, createBackup } from "./storage.js";
import { getDefaultExercises, getDefaultPlans } from "./models.js";
import { runMigrations, ensureLibrary } from "./migrations.js";
import { ensureDefaults, createPlan, deletePlan } from "./plans.js";
import { deleteWorkout } from "./workouts.js";
import { registerServiceWorker } from "./pwa.js";
import { nextWeight, weightSteps, guessArea } from "./library.js";
import {
  todayKey, addDays, buildDayMap, buildRun, planItem, syncSets, suggest, findRecords, exerciseById, counts,
} from "./engine.js";
import * as V from "./views.js";
import { isDue, syncReminderState, enableReminder, disableReminder } from "./reminder.js";
import { toast } from "./ui.js";

/* ---------- State ---------- */
let state = loadState();
const mig = runMigrations(state);
state = mig.state;
const defaults = { exercises: getDefaultExercises(), plans: getDefaultPlans() };
ensureDefaults(state, defaults);
ensureLibrary(state);
state.meta = state.meta || {};
state.meta.lastMigration = { ran: mig.ran, from: mig.from, to: mig.to, at: new Date().toISOString() };
state.meta.activeWorkoutId = state.meta.activeWorkoutId || null;

const ui = {
  tab: "home", view: "home", ctx: {}, energy: null, suggestions: [], pick: null,
  area: null, previewId: null, q: "", timer: null, selDay: todayKey(), bodyRange: "w", chartEx: null,
  doneId: null, gain: 0, records: [], editEx: null, importPreview: null, sportOpen: false, sportForm: null,
  confirmDel: null, reminderDue: false, importResult: null, paiDay: null,
};

let dayMap = buildDayMap(state);

function persist() {
  saveState(state);
  dayMap = buildDayMap(state);
  const last = [...dayMap.entries()].filter(([, d]) => d.workouts.length).map(([k]) => k).sort().pop() || null;
  syncReminderState(state.settings, last);
}

/* ---------- Rendering ---------- */
const $screen = document.getElementById("screen");
const $nav = document.getElementById("nav");
const $overlay = document.getElementById("overlay");

const VIEWS = {
  home: V.home, energy: V.energy, suggest: V.suggestView, areas: V.areasView, preview: V.previewView,
  workouts: V.workoutsView, run: V.runView, picker: V.pickerView, done: V.doneView, history: V.historyView,
  progress: V.progressView, more: V.moreView, exercises: V.exercisesView, plans: V.plansView, snacks: V.snacksView,
};
const TAB_OF = { history: "history", progress: "progress", more: "more", exercises: "more", plans: "more", snacks: "more" };

function render({ keepScroll = false } = {}) {
  const top = $screen.scrollTop;
  ui.reminderDue = isDue(state.settings, !!dayMap.get(todayKey())?.total);
  $screen.innerHTML = VIEWS[ui.view]({ state, ui, dayMap });
  ui.tab = TAB_OF[ui.view] || "home";
  for (const b of $nav.querySelectorAll("button")) b.setAttribute("aria-current", b.dataset.tab === ui.tab ? "page" : "false");
  $overlay.innerHTML = ui.sportOpen ? V.sportSheet(ui) : "";
  $overlay.hidden = !ui.sportOpen;
  if (ui.view === "progress") wireChart();
  $screen.scrollTop = keepScroll ? top : 0;
}

function go(view) {
  ui.view = view;
  ui.confirmDel = null;
  render();
}

/* ---------- Einheiten ---------- */
function activeWorkout() {
  return state.workouts.find((w) => w.id === state.meta.activeWorkoutId) || null;
}

function startRun(kind, id) {
  const cur = activeWorkout();
  if (cur && !cur.items.some((i) => i.sets?.length || i.done)) {
    state.workouts = state.workouts.filter((w) => w !== cur);
  } else if (cur) {
    toast("Es läuft noch eine Einheit. Schließ sie erst ab.");
    ui.view = "run";
    render();
    return;
  }
  const source = kind === "new" ? { kind, exerciseId: id } : { kind, id };
  const place = ui.energy ? ui.ctx.place || state.meta.lastPlace || "keller" : "keller";
  const w = buildRun(state, source, { energy: ui.energy, place });
  state.workouts.push(w);
  state.meta.activeWorkoutId = w.id;
  stopTimer();
  persist();
  go("run");
}

/** Öffnet eine bestehende Einheit zum Bearbeiten (auch alte v4-Workouts ohne Zeilen). */
function openWorkout(id) {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) return;
  const cur = activeWorkout();
  if (cur && cur !== w) {
    toast("Schließ zuerst die laufende Einheit ab.");
    return;
  }
  for (const item of w.items) {
    const ex = exerciseById(state, item.exerciseId);
    if (ex?.kind === "task") continue;
    if (!item.rows) item.rows = (item.sets || []).map((s) => ({ weight: ex?.kind === "weight" ? Number(s.weight) || 0 : null, reps: Number(s.reps) || 0, done: true }));
  }
  if (!w.name) w.name = w.planId ? (state.plans.find((p) => p.id === w.planId)?.name || "Workout") : "Freies Training";
  w.finished = true;
  state.meta.activeWorkoutId = w.id;
  persist();
  go("run");
}

function finishRun() {
  const w = activeWorkout();
  if (!w) return;
  const before = dayMap.get(w.date)?.total || 0;
  const rawBefore = dayMap.get(w.date) ? dayMap.get(w.date).rawK + dayMap.get(w.date).rawM : 0;
  const wasFinished = !!w.finished;
  for (const item of w.items) syncSets(item);
  w.finished = true;
  w.finishedAt = w.finishedAt || new Date().toISOString();
  state.meta.activeWorkoutId = null;
  stopTimer();
  persist();
  if (wasFinished) {
    toast("Gespeichert");
    ui.selDay = w.date;
    go("history");
    return;
  }
  const after = dayMap.get(w.date);
  ui.gain = (after?.total || 0) - before;
  ui.capped = ui.gain === 0 && (after ? after.rawK + after.rawM : 0) > rawBefore;
  ui.records = findRecords(state, w);
  ui.doneId = w.id;
  go("done");
}

function cancelRun() {
  const w = activeWorkout();
  if (!w) return go("home");
  if (w.finished) {
    for (const item of w.items) syncSets(item);
    state.meta.activeWorkoutId = null;
    persist();
    ui.selDay = w.date;
    return go("history");
  }
  const anyDone = w.items.some((i) => i.sets?.length || i.done);
  if (anyDone && !window.confirm("Einheit verwerfen? Abgehakte Sätze gehen verloren.")) return;
  state.workouts = state.workouts.filter((x) => x !== w);
  state.meta.activeWorkoutId = null;
  stopTimer();
  persist();
  go("home");
}

/* ---------- Pausenuhr ---------- */
let timerInt = null;
function startTimer() {
  clearInterval(timerInt);
  ui.timer = state.settings.restSeconds || 90;
  timerInt = setInterval(() => {
    ui.timer -= 1;
    if (ui.timer <= 0) {
      stopTimer();
      if (navigator.vibrate) navigator.vibrate([120, 80, 120]);
      if (ui.view === "run") render({ keepScroll: true });
      return;
    }
    const el = document.getElementById("tval");
    if (el) el.textContent = `${Math.floor(ui.timer / 60)}:${String(ui.timer % 60).padStart(2, "0")}`;
  }, 1000);
}
function stopTimer() {
  clearInterval(timerInt);
  ui.timer = null;
}

/* ---------- Kraftkurve Tooltip ---------- */
function wireChart() {
  const c = document.getElementById("chart");
  const geo = ui._chart;
  if (!c || !geo) return;
  const svg = c.querySelector("svg");
  const tip = c.querySelector("#tip");
  const xh = svg.querySelector(".xh");
  const move = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * geo.W;
    let best = geo.pts[0];
    for (const p of geo.pts) if (Math.abs(p.x - px) < Math.abs(best.x - px)) best = p;
    xh.setAttribute("x1", best.x); xh.setAttribute("x2", best.x); xh.setAttribute("opacity", "1");
    const [y, m, d] = best.date.split("-");
    tip.hidden = false;
    tip.textContent = `${Number(d)}.${Number(m)}.${y.slice(2)}: ${String(best.v).replace(".", ",")}${ui._chartUnit}`;
    tip.style.left = `${(best.x / geo.W) * r.width}px`;
    tip.style.top = `${(best.y / geo.H) * r.height}px`;
  };
  svg.addEventListener("pointermove", move);
  svg.addEventListener("pointerdown", move);
  svg.addEventListener("pointerleave", () => { tip.hidden = true; xh.setAttribute("opacity", "0"); });
}

/* ---------- PAI und Backup ---------- */
function savePai() {
  const key = document.getElementById("paiDate")?.value;
  const raw = document.getElementById("paiVal")?.value ?? "";
  if (!key || key > todayKey()) return toast("Bitte wähle einen Tag bis heute.");
  const v = raw.trim() === "" ? null : Math.round(Number(raw));
  if (v != null && !(v >= 0 && v <= 300)) return toast("Der Tages-PAI liegt zwischen 0 und 300.");
  state.pai = state.pai || {};
  if (v == null) delete state.pai[key];
  else state.pai[key] = v;
  persist();
  toast(v == null ? "PAI-Eintrag entfernt" : `PAI ${v} gespeichert`);
  render({ keepScroll: true });
}

function markBackup() {
  state.meta.lastBackupAt = new Date().toISOString();
  state.meta.lastBackupDay = todayKey();
  persist();
}

/* ---------- Klicks ---------- */
/** Fügt Daten aus einem Import hinzu, ohne Vorhandenes zu ändern. Liefert die Zahl neuer Einheiten. */
function mergeState(target, src) {
  const lower = (x) => String(x || "").trim().toLowerCase();
  const namesOf = (e) => [e.name, ...(e.aliases || [])].map(lower).filter(Boolean);
  const idMap = new Map();
  for (const ex of src.exercises) {
    const names = namesOf(ex);
    let hit = target.exercises.find((e) => e.id === ex.id)
      || target.exercises.find((e) => namesOf(e).some((n) => names.includes(n)));
    if (!hit) {
      hit = structuredClone(ex);
      let id = ex.id, i = 2;
      while (target.exercises.some((e) => e.id === id)) id = `${ex.id}_${i++}`;
      hit.id = id;
      target.exercises.push(hit);
    }
    idMap.set(ex.id, hit.id);
  }
  const planMap = new Map();
  for (const pl of src.plans || []) {
    const ids = pl.exerciseIds.map((id) => idMap.get(id) || id);
    let hit = target.plans.find((x) => lower(x.name) === lower(pl.name));
    if (!hit) {
      hit = { ...structuredClone(pl), exerciseIds: ids };
      let id = pl.id, i = 2;
      while (target.plans.some((x) => x.id === id)) id = `${pl.id}_${i++}`;
      hit.id = id;
      target.plans.push(hit);
    }
    planMap.set(pl.id, hit.id);
  }
  const sig = (w) => `${w.date}|${(w.items || []).map((i) => `${i.exerciseId}:${(i.sets || []).map((st) => `${st.weight}x${st.reps}`).join(",")}`).sort().join(";")}`;
  const have = new Set(target.workouts.map(sig));
  let added = 0;
  for (const w of src.workouts) {
    const copy = structuredClone(w);
    copy.items = (copy.items || []).map((i) => ({ ...i, exerciseId: idMap.get(i.exerciseId) || i.exerciseId }));
    copy.planId = copy.planId ? planMap.get(copy.planId) || null : null;
    if (have.has(sig(copy))) continue;
    let id = copy.id, i = 2;
    while (target.workouts.some((x) => x.id === id)) id = `${w.id}_${i++}`;
    copy.id = id;
    target.workouts.push(copy);
    have.add(sig(copy));
    added++;
  }
  const actIds = new Set((target.activities || []).map((a) => a.id));
  for (const a of src.activities || []) if (!actIds.has(a.id)) target.activities.push(structuredClone(a));
  target.pai = target.pai || {};
  for (const [key, v] of Object.entries(src.pai || {})) if (!(key in target.pai)) target.pai[key] = v;
  target.workouts.sort((a, b) => a.date.localeCompare(b.date));
  return added;
}

const actions = {
  tab: (d) => { ui.area = null; ui.energy = null; go({ home: "home", history: "history", progress: "progress", more: "more" }[d.tab] || "home"); },
  go: (d) => { if (d.view === "areas") ui.area = null; go(d.view); },
  resume: () => go("run"),

  energy: (d) => {
    ui.energy = Number(d.energy);
    const sportToday = (state.activities || []).some((a) => a.date === todayKey());
    // Gestern Sport oder viel Bewegung laut Uhr: Beinsnacks rücken nach hinten
    const y = dayMap.get(addDays(todayKey(), -1));
    const sportYesterday = !!(y?.sports.length || (y?.pai ?? 0) >= 30);
    ui.suggestions = suggest(state, dayMap, {
      energy: ui.energy, sportToday: ui.ctx.sport ?? sportToday, sportYesterday, place: ui.ctx.place || state.meta.lastPlace || "keller", hour: new Date().getHours(),
    });
    ui.pick = null;
    go("suggest");
  },
  place: (d) => {
    ui.ctx.place = d.place;
    state.meta.lastPlace = d.place;
    persist();
    render({ keepScroll: true });
  },
  ctx: (d, b) => {
    const cur = b.getAttribute("aria-pressed") === "true";
    ui.ctx[d.key] = !cur;
    b.setAttribute("aria-pressed", String(!cur));
  },
  pick: (d) => { ui.pick = d.id; render(); },
  area: (d) => { ui.area = d.area || null; go("areas"); },
  preview: (d) => { ui.previewId = d.id; go("preview"); },
  "preview-any": (d) => { ui.previewId = d.id; ui.area = null; go("preview"); },
  start: (d) => startRun(d.kind, d.id),

  adj: (d) => {
    const w = activeWorkout();
    const [xi, si] = d.id.split("-").map(Number);
    const item = w.items[xi];
    const ex = exerciseById(state, item.exerciseId);
    const row = item.rows[si];
    const dir = Number(d.dir);
    if (d.field === "weight") {
      row.weight = ex.eq === "free" || !ex.eq ? Math.max(0, Math.round(((Number(row.weight) || 0) + dir * 1.25) * 100) / 100) : nextWeight(ex.eq, row.weight, dir, state.settings);
    } else {
      const step = ex.kind === "time" ? 5 : 1;
      row.reps = Math.max(ex.kind === "time" ? 5 : 1, (Number(row.reps) || 0) + dir * step);
    }
    // folgende, noch offene Sätze übernehmen die Änderung
    for (let i = si + 1; i < item.rows.length; i++) {
      if (!item.rows[i].done) item.rows[i][d.field] = row[d.field];
    }
    syncSets(item);
    persist();
    render({ keepScroll: true });
  },
  set: (d) => {
    const w = activeWorkout();
    const [xi, si] = d.id.split("-").map(Number);
    const item = w.items[xi];
    const row = item.rows[si];
    row.done = !row.done;
    syncSets(item);
    persist();
    if (row.done && !w.finished) startTimer();
    render({ keepScroll: true });
  },
  task: (d) => {
    const item = activeWorkout().items[Number(d.x)];
    item.done = !item.done;
    persist();
    render({ keepScroll: true });
  },
  "add-set": (d) => {
    const item = activeWorkout().items[Number(d.x)];
    const last = item.rows[item.rows.length - 1] || { weight: exerciseById(state, item.exerciseId)?.defKg ?? null, reps: 10 };
    item.rows.push({ weight: last.weight, reps: last.reps, done: false });
    persist();
    render({ keepScroll: true });
  },
  "rm-set": (d) => {
    const item = activeWorkout().items[Number(d.x)];
    if (!item.rows || item.rows.length <= 1) return;
    // Zuerst einen offenen Satz entfernen, abgehakte bleiben so lange wie möglich
    let i = item.rows.map((r) => r.done).lastIndexOf(false);
    if (i < 0) i = item.rows.length - 1;
    item.rows.splice(i, 1);
    syncSets(item);
    persist();
    render({ keepScroll: true });
  },
  "remove-ex": (d) => {
    const w = activeWorkout();
    const item = w.items[Number(d.x)];
    if ((item.sets?.length || item.done) && !window.confirm("Übung mit abgehakten Sätzen entfernen?")) return;
    w.items.splice(Number(d.x), 1);
    persist();
    render({ keepScroll: true });
  },
  "add-ex": (d) => {
    const w = activeWorkout();
    if (w.items.some((i) => i.exerciseId === d.id)) return;
    const item = planItem(state, d.id, w.id);
    if (item) w.items.push(item);
    ui.q = "";
    persist();
    go("run");
    $screen.scrollTop = $screen.scrollHeight;
  },
  "create-ex": () => {
    const name = document.getElementById("newExName").value.trim();
    if (!name) return toast("Bitte gib der Übung einen Namen.");
    if (state.exercises.some((e) => e.name.toLowerCase() === name.toLowerCase())) return toast("Diese Übung gibt es schon.");
    const eq = document.getElementById("newExEq").value;
    let id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "uebung";
    let n = 2; const base = id;
    while (state.exercises.some((e) => e.id === id)) id = `${base}_${n++}`;
    state.exercises.push({
      id, name, aliases: [], area: document.getElementById("newExArea").value || guessArea(name), eq,
      loc: ["lh", "kh2", "kh1"].includes(eq) ? "K" : "U", kind: ["band", "none"].includes(eq) ? "reps" : "weight",
      defKg: weightSteps(eq, state.settings)[eq === "kh2" || eq === "kh1" ? 1 : 0] || 0, rating: "ok", hint: "",
    });
    actions["add-ex"]({ id });
  },
  finish: () => finishRun(),
  cancel: () => cancelRun(),
  "skip-timer": () => { stopTimer(); render({ keepScroll: true }); },

  rate: (d) => {
    const ex = exerciseById(state, d.id);
    if (!ex) return;
    ex.rating = ex.rating === d.v && ui.view === "exercises" ? null : d.v;
    persist();
    if (ui.view === "done") toast(d.v === "no" ? "Wird nicht mehr vorgeschlagen." : "Danke, gespeichert.");
    render({ keepScroll: true });
  },

  day: (d) => { ui.selDay = d.day; ui.confirmDel = null; ui.view = "history"; render({ keepScroll: true }); },
  "open-w": (d) => openWorkout(d.id),
  "del-w": (d) => { ui.confirmDel = { type: "w", id: d.id }; render({ keepScroll: true }); },
  "del-a": (d) => { ui.confirmDel = { type: "a", id: d.id }; render({ keepScroll: true }); },
  "cancel-del": () => { ui.confirmDel = null; render({ keepScroll: true }); },
  "confirm-del": () => {
    const c = ui.confirmDel;
    if (c?.type === "w") deleteWorkout(state, c.id);
    if (c?.type === "a") state.activities = state.activities.filter((a) => a.id !== c.id);
    ui.confirmDel = null;
    persist();
    toast("Gelöscht");
    render({ keepScroll: true });
  },

  range: (d) => { ui.bodyRange = d.range; render({ keepScroll: true }); },
  "chart-ex": (d) => { ui.chartEx = d.id; render({ keepScroll: true }); },

  sport: () => {
    ui.sportForm = { kind: "Padel", minutes: 90, intensity: "Mittel", date: todayKey() };
    ui.sportOpen = true;
    render({ keepScroll: true });
  },
  "sport-opt": (d) => { ui.sportForm[d.grp] = d.grp === "minutes" ? Number(d.v) : d.v; render({ keepScroll: true }); },
  "sport-close": () => { ui.sportOpen = false; render({ keepScroll: true }); },
  "sport-save": () => {
    const date = document.getElementById("sportDate")?.value || todayKey();
    const f = ui.sportForm;
    state.activities.push({ id: `a_${date}_${Date.now().toString(36)}`, date, kind: f.kind, minutes: f.minutes, intensity: f.intensity });
    if (date === todayKey()) ui.ctx.sport = true;
    ui.sportOpen = false;
    persist();
    toast(`${f.kind} eingetragen.${date === todayKey() ? " Heute keine schweren Beinübungen im Vorschlag." : ""}`);
    render({ keepScroll: true });
  },

  setting: (d) => {
    const s = state.settings;
    s[d.key] = Math.min(Number(d.max), Math.max(Number(d.min), s[d.key] + Number(d.dir) * (Number(d.step) || 1)));
    if (s.strengthMin > s.weeklyGoal) s.strengthMin = s.weeklyGoal;
    persist();
    render({ keepScroll: true });
  },
  kb: (d) => {
    const steps = [4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32];
    const cur = state.settings.kbWeight;
    state.settings.kbWeight = Number(d.dir) > 0 ? (steps.find((x) => x > cur) ?? cur) : ([...steps].reverse().find((x) => x < cur) ?? cur);
    persist();
    render({ keepScroll: true });
  },
  "reminder-toggle": async () => {
    const r = state.settings.reminder;
    r.enabled = !r.enabled;
    persist();
    render({ keepScroll: true });
    if (r.enabled) toast(await enableReminder(), { duration: 4000 });
    else { await disableReminder(); toast("Erinnerung ist aus."); }
    render({ keepScroll: true });
  },

  "pai-day": (d) => { ui.paiDay = d.day; render({ keepScroll: true }); },
  "pai-save": () => savePai(),

  backup: async () => {
    // Android teilt nur bestimmte Dateitypen, JSON gehört nicht dazu. Als .txt geht es, der Import liest beides.
    const file = new File([exportState(state)], `benchmarkpro_backup_${todayKey()}.txt`, { type: "text/plain" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "BenchMark Pro Backup" });
        markBackup();
        toast("Backup übergeben. Prüfe in Drive, ob die Datei angekommen ist.", { duration: 4000 });
      } catch (e) {
        if (e?.name !== "AbortError") toast("Teilen hat nicht geklappt. Nutze „Als Datei herunterladen“.", { duration: 4000 });
      }
      render({ keepScroll: true });
      return;
    }
    actions.export();
  },
  export: () => {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `benchmarkpro_backup_${todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    markBackup();
    toast("Download gestartet. Prüfe, ob die Datei gespeichert wurde.", { duration: 4000 });
    render({ keepScroll: true });
  },
  "import-cancel": () => { ui.importPreview = null; render({ keepScroll: true }); },
  "import-apply": () => {
    const p = ui.importPreview;
    if (!p || !p.validation?.ok) return;
    if (!(p.state.workouts || []).length && state.workouts.length) {
      toast("Die Datei enthält keine Einheiten. Ersetzen würde alles löschen, deshalb wurde nichts geändert.", { duration: 5000 });
      return;
    }
    createBackup(state);
    state = applyImportedState(p.state);
    const m = runMigrations(state);
    state = m.state;
    ensureDefaults(state, defaults);
    ensureLibrary(state);
    state.meta = state.meta || {};
    state.meta.activeWorkoutId = null;
    state.meta.lastMigration = { ran: m.ran, from: m.from, to: m.to, at: new Date().toISOString() };
    ui.importPreview = null;
    persist();
    toast("Import angewendet. Das vorherige Backup liegt im Browser.");
    render({ keepScroll: true });
  },

  "import-merge": () => {
    const p = ui.importPreview;
    if (!p || !p.validation?.ok) return;
    createBackup(state);
    let imp = applyImportedState(structuredClone(p.state));
    imp = runMigrations(imp).state;
    ensureLibrary(imp);
    const before = state.workouts.length;
    const added = mergeState(state, imp);
    ensureLibrary(state);
    ui.importResult = { text: `${p.fileName || "Datei"}: ${imp.workouts.length} Einheiten in der Datei, ${added} neu hinzugefügt. Vorher ${before}, jetzt ${state.workouts.length} Einheiten.` };
    ui.importPreview = null;
    persist();
    toast(added ? `${added} ${added === 1 ? "Einheit" : "Einheiten"} hinzugefügt. Deine bisherigen Daten sind unverändert.` : "Nichts Neues gefunden, alles war schon da.");
    render({ keepScroll: true });
  },

  "force-update": async () => {
    toast("App wird neu geladen …");
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== "benchmark-pro-meta").map((k) => caches.delete(k)));
      const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
      await Promise.all(regs.map((r) => r.unregister()));
    } catch (e) { console.warn(e); }
    location.reload();
  },

  "edit-ex": (d) => { ui.editEx = d.id || null; render({ keepScroll: true }); },
  "save-ex": (d) => {
    const ex = exerciseById(state, d.id);
    const name = document.getElementById("exName").value.trim();
    if (name) ex.name = name;
    ex.area = document.getElementById("exArea").value;
    ex.loc = document.getElementById("exLoc").value;
    ex.eq = document.getElementById("exEq").value;
    ex.kind = document.getElementById("exKind").value;
    ui.editEx = null;
    persist();
    toast("Übung gespeichert");
    render({ keepScroll: true });
  },

  "plan-new": () => { createPlan(state); persist(); render(); },
  "plan-del": (d) => {
    if (!window.confirm("Plan löschen?")) return;
    deletePlan(state, d.id);
    persist();
    render({ keepScroll: true });
  },
  "plan-add": (d) => {
    const sel = document.getElementById(`planAdd_${d.id}`);
    const p = state.plans.find((x) => x.id === d.id);
    if (!sel?.value || !p || p.exerciseIds.includes(sel.value)) return;
    p.exerciseIds.push(sel.value);
    persist();
    render({ keepScroll: true });
  },
  "plan-rm": (d) => {
    const p = state.plans.find((x) => x.id === d.id);
    p.exerciseIds.splice(Number(d.i), 1);
    persist();
    render({ keepScroll: true });
  },
  "plan-move": (d) => {
    const p = state.plans.find((x) => x.id === d.id);
    const i = Number(d.i);
    if (i <= 0) return;
    [p.exerciseIds[i - 1], p.exerciseIds[i]] = [p.exerciseIds[i], p.exerciseIds[i - 1]];
    persist();
    render({ keepScroll: true });
  },
};

document.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-action]");
  if (!b || b.disabled || b.getAttribute("aria-disabled") === "true") return;
  const fn = actions[b.dataset.action];
  if (!fn) return;
  ev.preventDefault();
  fn(b.dataset, b);
});

/* ---------- Eingaben ---------- */
let notesTimer = null;
document.addEventListener("input", (ev) => {
  const t = ev.target;
  const act = t.dataset?.actionInput;
  if (act === "search") {
    ui.q = t.value;
    const pos = t.selectionStart;
    render({ keepScroll: true });
    const n = document.getElementById("q");
    n.focus();
    n.setSelectionRange(pos, pos);
  } else if (act === "notes") {
    const w = activeWorkout();
    if (!w) return;
    w.notes = t.value;
    clearTimeout(notesTimer);
    notesTimer = setTimeout(persist, 400);
  } else if (act === "plan-name") {
    const p = state.plans.find((x) => x.id === t.dataset.id);
    if (p) { p.name = t.value || p.name; clearTimeout(notesTimer); notesTimer = setTimeout(persist, 400); }
  }
});
document.addEventListener("change", async (ev) => {
  const t = ev.target;
  if (t.id === "paiDate") {
    if (!t.value || t.value > todayKey()) return;
    if (ui.view === "history") ui.selDay = t.value;
    else ui.paiDay = t.value;
    render({ keepScroll: true });
  } else if (t.id === "remTime") {
    state.settings.reminder.time = t.value || "18:30";
    persist();
    render({ keepScroll: true });
  } else if (t.id === "fileImport") {
    const file = t.files?.[0];
    if (!file) return;
    try {
      const res = parseImportFile(await file.text());
      res.fileName = file.name;
      res.fileSize = file.size;
      ui.importPreview = res;
      ui.importResult = null;
    } catch (e) {
      ui.importPreview = null;
      ui.importResult = { error: true, text: `${file.name}: ${String(e?.message || e)}` };
      toast(String(e?.message || e), { duration: 4000 });
    }
    t.value = "";
    render({ keepScroll: true });
  }
});

document.addEventListener("submit", (ev) => {
  ev.preventDefault();
  if (ev.target.id === "paiForm") savePai();
});

/* ---------- Start ---------- */
function boot() {
  persist();
  if (activeWorkout()) ui.view = "home";
  render();
  registerServiceWorker();
  // Bittet den Browser, die Daten nicht bei Speichermangel zu löschen
  navigator.storage?.persist?.().catch(() => {});
  document.getElementById("appVersion").textContent = APP_VERSION;
  // Tageswechsel oder Rückkehr in die App: neu rechnen
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      dayMap = buildDayMap(state);
      if (!["run", "picker"].includes(ui.view) && !ui.sportOpen) render({ keepScroll: true });
    }
  });
}

boot();

// Für Tests und Diagnose
window.__bmp = { get state() { return state; }, ui, counts };
