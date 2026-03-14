import { APP_VERSION, DATA_VERSION, STORAGE_KEY } from "./version.js";
import { loadState, saveState, exportState, parseImportFile, applyImportedState, resetState, createBackup } from "./storage.js";
import { getDefaultExercises, getDefaultPlans } from "./models.js";
import { runMigrations } from "./migrations.js";
import { ensureDefaults, createPlan, deletePlan, updatePlanFromTextarea } from "./plans.js";
import { upsertExercise } from "./exercises.js";
import { createWorkout, getWorkout, addSetToWorkout, deleteSetFromWorkout, removeExerciseFromWorkout, ensureExerciseItem, sortWorkoutsNewestFirst, humanWorkoutTitle, deleteWorkout, setWorkoutNotes } from "./workouts.js";
import { $, $all, setActiveTab, toast } from "./ui.js";

/**
 * Bindet einen Event-Listener, wenn das Element existiert. Sonst console.warn (kein throw).
 */
function on(selector, event, handler) {
  const el = $(selector);
  if (!el) {
    console.warn("[BenchMarkPro] Fehlendes Element:", selector);
    return;
  }
  el.addEventListener(event, handler);
}

let state = loadState();

// Run migrations (v4->v4). Legacy imports are handled separately.
const mig = runMigrations(state);
state = mig.state;


const defaults = {
  exercises: getDefaultExercises(),
  plans: getDefaultPlans()
};

ensureDefaults(state, defaults);

// ensure meta
state.meta = state.meta || {};
state.meta.lastMigration = { ran: mig.ran, from: mig.from, to: mig.to, at: new Date().toISOString() };

state.meta.activeWorkoutId = state.meta.activeWorkoutId || null;

function persist(){
  saveState(state);
  renderDiagnostics();
  renderStateSummary();
}

function renderHeader(){
  $("#versionBadge").textContent = APP_VERSION;
}

function renderStateSummary(){
  $("#stateSummary").textContent = JSON.stringify({
    plans: state.plans.length,
    workouts: state.workouts.length,
    exercises: state.exercises.length
  });
}

function renderDiagnostics(){
  $("#diagAppVersion").textContent = state.appVersion || APP_VERSION;
  $("#diagDataVersion").textContent = String(state.dataVersion ?? DATA_VERSION);
  $("#diagStorageKey").textContent = STORAGE_KEY;
  $("#diagLastSaved").textContent = state.meta?.updatedAt || "—";
  const lm = state.meta?.lastMigration;
  if (lm && typeof lm === "object") {
    const tag = lm.ran ? `ran ${lm.from}→${lm.to}` : `noop ${lm.from}→${lm.to}`;
    $("#diagLastMigration").textContent = tag;
  } else {
    $("#diagLastMigration").textContent = "—";
  }
}

function renderExercises(){
  const el = $("#exerciseList");
  if (!el) return;
  el.innerHTML = "";
  const sorted = [...state.exercises].sort((a,b)=>a.name.localeCompare(b.name,"de"));
  for (const ex of sorted) {
    const div = document.createElement("div");
    div.className = "pill";
    const alias = (ex.aliases && ex.aliases.length) ? ` · aliases: ${ex.aliases.join(", ")}` : "";
    div.innerHTML = `<div><div class="name">${ex.name}</div><div class="muted small mono">${ex.id}${alias}</div></div>`;
    el.appendChild(div);
  }
}

function planToTextarea(plan){
  return plan.exerciseIds
    .map(id => state.exercises.find(e=>e.id===id)?.name || id)
    .join("\n");
}

function renderPlans(){
  const root = $("#plansList");
  if (!root) {
    console.warn("[BenchMarkPro] Fehlendes Element: #plansList");
    return;
  }
  root.innerHTML = "";

  for (const plan of state.plans) {
    const card = document.createElement("div");
    card.className = "card";

    const protectedInfo = plan.isDefault ? `<span class="badge mono">default</span>` : "";

    card.innerHTML = `
      <div class="row space">
        <div class="row" style="gap:10px">
          <div class="label">Plan</div>
          ${protectedInfo}
        </div>
        <div class="row" style="gap:8px; flex-wrap: wrap">
          <button class="btn btn-ghost" data-action="save" data-id="${plan.id}">Speichern</button>
          <button class="btn btn-danger" data-action="delete" data-id="${plan.id}" ${plan.isDefault ? "disabled" : ""}>Löschen</button>
        </div>
      </div>

      <div class="mt">
        <div class="label">Name</div>
        <input class="input mt small" data-field="name" data-id="${plan.id}" value="${String(plan.name).replaceAll('"',"&quot;")}" />
      </div>

      <div class="mt">
        <div class="label">Übungen (eine pro Zeile)</div>
        <textarea class="mt" data-field="exercises" data-id="${plan.id}">${planToTextarea(plan)}</textarea>
        <div class="muted small mt">Tipp: Frei tippen. Unbekannte Übungen werden automatisch als neue Exercise angelegt.</div>
      </div>
    `;

    root.appendChild(card);
  }
}

function fillExerciseSelect(sel, { includePlaceholder = false } = {}){
  sel.innerHTML = "";
  if (includePlaceholder) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Übung wählen…";
    sel.appendChild(opt);
  }
  const sorted = [...state.exercises].sort((a,b)=>a.name.localeCompare(b.name,"de"));
  for (const ex of sorted) {
    const opt = document.createElement("option");
    opt.value = ex.id;
    opt.textContent = ex.name;
    sel.appendChild(opt);
  }
}

function fillPlanSelect(sel){
  sel.innerHTML = "";
  for (const p of state.plans) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  }
}

function renderNewWorkoutControls(){
  const modeSel = $("#newWorkoutMode");
  const planSel = $("#newWorkoutPlan");
  const dateInp = $("#newWorkoutDate");
  if (!modeSel || !planSel || !dateInp) {
    if (!modeSel) console.warn("[BenchMarkPro] Fehlendes Element: #newWorkoutMode");
    if (!planSel) console.warn("[BenchMarkPro] Fehlendes Element: #newWorkoutPlan");
    if (!dateInp) console.warn("[BenchMarkPro] Fehlendes Element: #newWorkoutDate");
    return;
  }

  if (!dateInp.value) {
    const d = new Date();
    dateInp.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  fillPlanSelect(planSel);

  const refreshVisibility = () => {
    const mode = modeSel.value;
    planSel.style.display = (mode === "plan") ? "" : "none";
  };
  refreshVisibility();
  modeSel.onchange = refreshVisibility;
}

function exerciseNameById(exId){
  return state.exercises.find(e=>e.id===exId)?.name || exId;
}

/** Liefert Hinweistext zum letzten Training: Abstand des letzten Workout-Datums zu heute (nur aus Daten berechnet). */
function getLastWorkoutHint() {
  const r = getLastWorkoutRecency();
  if (r === null) return "";
  if (r.days === 0) return "Heute schon trainiert.";
  if (r.days === 1) return "Letztes Training: gestern";
  const dayWord = r.days === 1 ? "Tag" : "Tage";
  return `Letztes Training: vor ${r.days} ${dayWord}`;
}

/** Liefert Recency für Dashboard: { days, display, tier } mit tier green/yellow/red (Ampel). */
function getLastWorkoutRecency() {
  const sorted = sortWorkoutsNewestFirst(state.workouts);
  if (!sorted.length) return null;
  const lastDateStr = sorted[0].date;
  if (!lastDateStr) return null;
  const last = new Date(lastDateStr + "T12:00:00");
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  last.setHours(12, 0, 0, 0);
  let days = Math.floor((today - last) / (24 * 60 * 60 * 1000));
  if (days < 0) days = 0;
  const display = days === 0 ? "Heute" : String(days);
  let tier = "red";
  if (days < 3) tier = "green";
  else if (days <= 6) tier = "yellow";
  return { days, display, tier };
}

/** ISO-Woche (Mo–So): Liefert den Montag der Woche von dateStr als "YYYY-MM-DD" (lokal, nicht toISOString). */
function getISOWeekKey(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const d = new Date(dateStr + "T12:00:00");
  if (isNaN(d.getTime())) return null;
  const isoWeekday = d.getDay() === 0 ? 7 : d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (isoWeekday - 1));
  const y = monday.getFullYear();
  const m = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Wochentraining: Unique Tage in aktueller ISO-Woche, Status Perfect/Gut/Akzeptabel/Problematisch. */
function getWeeklyConsistency() {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayKey = getISOWeekKey(todayStr);
  if (!todayKey) return { count: 0, label: "Problematisch" };
  const uniqueDates = new Set();
  for (const w of state.workouts || []) {
    const key = getISOWeekKey(w.date);
    if (key === todayKey && w.date) uniqueDates.add(w.date);
  }
  const count = uniqueDates.size;
  let label = "Problematisch";
  if (count >= 3) label = "Stark";
  else if (count === 2) label = "Gut";
  else if (count === 1) label = "Dranbleiben";
  return { count, label };
}

/**
 * Berechnet pro exerciseId das maximale Gewicht (nur finite, >0) aus allen Workouts.
 * excludeWorkoutId: optional – dieses Workout wird aus der Berechnung ausgeschlossen (für laufendes Max im aktuellen Workout).
 */
function getMaxWeightByExerciseId(excludeWorkoutId = null) {
  const maxByEx = Object.create(null);
  for (const w of state.workouts) {
    if (excludeWorkoutId != null && w.id === excludeWorkoutId) continue;
    for (const item of w.items || []) {
      const exId = item.exerciseId;
      for (const s of item.sets || []) {
        const weight = Number(s?.weight);
        if (Number.isFinite(weight) && weight > 0) {
          if (!(exId in maxByEx) || weight > maxByEx[exId]) maxByEx[exId] = weight;
        }
      }
    }
  }
  return maxByEx;
}

/** Zählt PR-Sets in einem Workout (gleiche Logik wie beim Anzeigen der 🔥 PR-Badges). */
function countPrsInWorkout(workout) {
  const maxBeforeThisWorkout = getMaxWeightByExerciseId(workout.id);
  let count = 0;
  for (const item of workout.items || []) {
    let runningMax = maxBeforeThisWorkout[item.exerciseId] ?? 0;
    for (const s of item.sets || []) {
      const weightNum = Number(s?.weight);
      if (Number.isFinite(weightNum) && weightNum > 0 && weightNum > runningMax) {
        count++;
        runningMax = weightNum;
      }
    }
  }
  return count;
}

/**
 * Liefert alle Sets der letzten Einheit für eine Übung (aus state.workouts, excludeWorkoutId ausgeschlossen).
 * Rückgabe: [{ weight, reps }, ...] oder null.
 */
function getLastPerformanceSetsForExercise(state, exerciseId, excludeWorkoutId) {
  const sorted = sortWorkoutsNewestFirst(state.workouts);
  for (const w of sorted) {
    if (excludeWorkoutId != null && w.id === excludeWorkoutId) continue;
    const item = (w.items || []).find((i) => i.exerciseId === exerciseId);
    if (!item || !(item.sets && item.sets.length)) continue;
    return item.sets.map((s) => ({
      weight: Number(s?.weight),
      reps: Number(s?.reps),
    }));
  }
  return null;
}

function renderWorkoutItems(workout){
  const root = $("#workoutItems");
  if (!root) {
    console.warn("[BenchMarkPro] Fehlendes Element: #workoutItems");
    return;
  }
  root.innerHTML = "";

  const maxBeforeThisWorkout = getMaxWeightByExerciseId(workout.id);

  for (const item of workout.items) {
    const exName = exerciseNameById(item.exerciseId);
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.exerciseId = item.exerciseId;

    const lastSets = getLastPerformanceSetsForExercise(state, item.exerciseId, workout.id);
    const lastSet = lastSets && lastSets.length ? lastSets[lastSets.length - 1] : null;
    const weightPlaceholder = lastSet && Number.isFinite(lastSet.weight) ? String(lastSet.weight) : "kg";
    const repsPlaceholder = lastSet && Number.isFinite(lastSet.reps) ? String(lastSet.reps) : "reps";

    const lastMalPills = lastSets
      ? lastSets.slice(0, 5).map((s) => {
          const w = Number.isFinite(s.weight) ? s.weight : "—";
          const r = Number.isFinite(s.reps) ? s.reps : "—";
          return `<span class="last-time-pill">${w} × ${r}</span>`;
        }).join("")
      : "";
    const lastMalBlock = lastMalPills
      ? `<div class="mt"><div class="muted small">Letztes Mal:</div><div class="last-time-pills">${lastMalPills}</div></div>`
      : "";

    let runningMax = maxBeforeThisWorkout[item.exerciseId] ?? 0;
    const setsHtml = item.sets.map((s, idx) => {
      const w = Number.isFinite(s.weight) ? s.weight : "";
      const r = Number.isFinite(s.reps) ? s.reps : "";
      const weightNum = Number(s?.weight);
      const isPr = Number.isFinite(weightNum) && weightNum > 0 && weightNum > runningMax;
      if (isPr) runningMax = weightNum;
      const prLabel = isPr ? " 🔥 PR" : "";
      return `<div class="row space set-row">
        <div class="mono">${idx+1}.</div>
        <div class="mono">${w} kg × ${r}${prLabel}</div>
        <button class="btn btn-danger btn-xs" data-action="del-set" data-idx="${idx}" title="Set löschen">x</button>
      </div>`;
    }).join("");

    card.innerHTML = `
      <div class="row space">
        <div>
          <div class="label">${exName}</div>
          <div class="muted small mono">${item.exerciseId}</div>
        </div>
        <div class="row" style="gap:8px; flex-wrap: wrap">
          <button class="btn btn-ghost btn-xs" data-action="remove-ex" title="Übung entfernen">Entfernen</button>
        </div>
      </div>
      ${lastMalBlock}

      <div class="mt">
        <div class="row" style="gap:8px; flex-wrap: wrap">
          <input class="input small w70" data-field="weight" inputmode="decimal" placeholder="${weightPlaceholder}" />
          <input class="input small w70" data-field="reps" inputmode="numeric" placeholder="${repsPlaceholder}" />
          <button class="btn btn-xs" data-action="add-set">+ Set</button>
        </div>
        <div class="muted small mt">Tipp: kg und reps ausfüllen → + Set.</div>
      </div>

      <div class="mt sets">
        ${setsHtml || `<div class="muted small">Noch keine Sets.</div>`}
      </div>
    `;
    root.appendChild(card);
  }

  if (!workout.items.length) {
    root.innerHTML = `<div class="muted">Keine Übungen im Workout. Oben hinzufügen.</div>`;
  }
}

function renderActiveWorkout(){
  const card = $("#activeWorkoutCard");
  const newCard = $("#newWorkoutCard");
  if (!card || !newCard) {
    if (!card) console.warn("[BenchMarkPro] Fehlendes Element: #activeWorkoutCard");
    if (!newCard) console.warn("[BenchMarkPro] Fehlendes Element: #newWorkoutCard");
    return;
  }
  const workoutId = state.meta.activeWorkoutId;
  if (!workoutId) {
    card.style.display = "none";
    newCard.style.display = "";
    return;
  }

  const workout = getWorkout(state, workoutId);
  if (!workout) {
    state.meta.activeWorkoutId = null;
    persist();
    card.style.display = "none";
    newCard.style.display = "";
    return;
  }

  newCard.style.display = "none";
  card.style.display = "";

  $("#activeWorkoutTitle").textContent = humanWorkoutTitle(state, workout);
  $("#activeWorkoutNotes").value = workout.notes || "";

  const prCountEl = $("#activeWorkoutPrCount");
  if (prCountEl) {
    const n = countPrsInWorkout(workout);
    if (n === 0) {
      prCountEl.textContent = "";
      prCountEl.className = "muted small";
    } else {
      prCountEl.className = "active-workout-pr";
      prCountEl.textContent = n === 1 ? "🔥 1 PR in diesem Training" : `🔥 ${n} PRs in diesem Training`;
    }
  }

  fillExerciseSelect($("#addExerciseSelect"), { includePlaceholder: true });
  renderWorkoutItems(workout);
}

function renderHistory(){
  const root = $("#historyList");
  if (!root) return;
  root.innerHTML = "";
  const workouts = sortWorkoutsNewestFirst(state.workouts);

  if (!workouts.length) {
    root.innerHTML = `<div class="card"><div class="muted">Noch keine Workouts gespeichert.</div></div>`;
    return;
  }

  for (const w of workouts) {
    const row = document.createElement("div");
    row.className = "card";
    row.innerHTML = `
      <div class="row space">
        <div>
          <div class="label">${humanWorkoutTitle(state, w)}</div>
          <div class="muted small mono">${w.id}</div>
        </div>
        <div class="row" style="gap:8px; flex-wrap: wrap">
          <button class="btn btn-ghost btn-xs" data-action="open" data-id="${w.id}">Öffnen</button>
          <button class="btn btn-danger btn-xs" data-action="delete" data-id="${w.id}">Löschen</button>
        </div>
      </div>
    `;
    root.appendChild(row);
  }
}

function rerenderAll(){
  renderHeader();
  renderStateSummary();
  renderDiagnostics();
  renderDashboardTiles();
  renderPlans();
  renderExercises();
  renderNewWorkoutControls();
  renderActiveWorkout();
  renderHistory();
}

function renderDashboardTiles(){
  const recencyTile = $("#recencyTile");
  const recencyValue = $("#recencyValue");
  const recencySub = $("#recencySub");
  const consistencyValue = $("#consistencyValue");
  const consistencyBadge = $("#consistencyBadge");
  if (!recencyTile || !recencyValue || !consistencyValue) return;

  const rec = getLastWorkoutRecency();
  if (rec !== null) {
    recencyValue.textContent = rec.display;
    recencySub.textContent = rec.days === 0 ? "trainiert" : rec.days === 1 ? "Tag Pause" : "Tage Pause";
    recencyTile.classList.remove("recency-green", "recency-yellow", "recency-red");
    recencyTile.classList.add("recency-" + rec.tier);
  } else {
    recencyValue.textContent = "—";
    recencySub.textContent = "Noch kein Training";
    recencyTile.classList.remove("recency-green", "recency-yellow", "recency-red");
  }

  const { count, label } = getWeeklyConsistency();
  consistencyValue.textContent = String(count);
  if (consistencyBadge) {
    consistencyBadge.textContent = label;
    consistencyBadge.className = "dashboard-tile-badge consistency-badge-" + (count >= 3 ? "stark" : count === 2 ? "gut" : count === 1 ? "dranbleiben" : "problematisch");
  }
}

function setupTabs(){
  $all(".tab").forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
}

function startWorkout(){
  const mode = $("#newWorkoutMode").value;
  const date = $("#newWorkoutDate").value;
  const planId = (mode === "plan") ? $("#newWorkoutPlan").value : null;
  const w = createWorkout(state, { planId, date });
  state.meta.activeWorkoutId = w.id;
  persist();
  rerenderAll();
  toast("Workout gestartet ✅");
}

function setupActions(){
  on("#btnSaveState", "click", () => {
    persist();
    rerenderAll();
    toast("State gespeichert ✅");
  });

  on("#btnResetDev", "click", () => {
    if (!confirm("Reset (dev): State komplett löschen?")) return;
    resetState();
    state = loadState();
    ensureDefaults(state, defaults);
    state.meta = state.meta || {};

    state.meta.activeWorkoutId = null;
    persist();
    rerenderAll();
  });

  on("#btnAddPlan", "click", () => {
    createPlan(state);
    persist();
    rerenderAll();
    toast("Neuer Plan angelegt ✅");
  });

  on("#btnAddExercise", "click", (ev) => {
    // prevent <details> toggle when clicking button in summary
    ev.preventDefault();
    ev.stopPropagation();

    const name = prompt("Neue Übung (Name):");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    upsertExercise(state, trimmed);
    persist();
    rerenderAll();
    toast("Übung angelegt ✅");
  });

  on("#plansList", "click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const planId = btn.dataset.id;

    if (action === "delete") {
      if (!confirm("Plan löschen?")) return;
      const ok = deletePlan(state, planId);
      if (!ok) return toast("Default-Pläne können nicht gelöscht werden.");
      persist();
      rerenderAll();
      return;
    }

    if (action === "save") {
      const nameEl = document.querySelector(`input[data-field="name"][data-id="${planId}"]`);
      const txtEl = document.querySelector(`textarea[data-field="exercises"][data-id="${planId}"]`);
      updatePlanFromTextarea(state, planId, nameEl?.value, txtEl?.value);
      persist();
      rerenderAll();
      toast("Plan gespeichert ✅");
      return;
    }
  });

  // Training controls
  on("#btnStartWorkout", "click", startWorkout);
  on("#btnNewWorkout", "click", () => {
    if (state.meta.activeWorkoutId) {
      toast("Es läuft schon ein aktives Workout.");
      return;
    }
    $("#newWorkoutCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  on("#btnEndWorkout", "click", () => {
    state.meta.activeWorkoutId = null;
    persist();
    rerenderAll();
    toast("Workout geschlossen ✅");
  });

  on("#btnDeleteWorkout", "click", () => {
    const id = state.meta.activeWorkoutId;
    if (!id) return;
    if (!confirm("Workout wirklich löschen?")) return;
    deleteWorkout(state, id);
    state.meta.activeWorkoutId = null;
    persist();
    rerenderAll();
    toast("Workout gelöscht ✅");
  });

  on("#activeWorkoutNotes", "input", (ev) => {
    const id = state.meta.activeWorkoutId;
    const w = id ? getWorkout(state, id) : null;
    if (!w) return;
    setWorkoutNotes(w, ev.target.value);
    persist();
    renderDiagnostics();
  });

  on("#btnAddExerciseToWorkout", "click", () => {
    const id = state.meta.activeWorkoutId;
    const w = id ? getWorkout(state, id) : null;
    if (!w) return;
    const exId = $("#addExerciseSelect").value;
    if (!exId) return;
    ensureExerciseItem(w, exId);
    persist();
    renderActiveWorkout();
  });

  on("#workoutItems", "click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const itemCard = ev.target.closest(".card[data-exercise-id]");
    if (!itemCard) return;

    const exId = itemCard.dataset.exerciseId;
    const wid = state.meta.activeWorkoutId;
    const w = wid ? getWorkout(state, wid) : null;
    if (!w) return;

    if (action === "remove-ex") {
      if (!confirm("Übung aus dem Workout entfernen?")) return;
      removeExerciseFromWorkout(w, exId);
      persist();
      renderActiveWorkout();
      return;
    }

    if (action === "add-set") {
      const weightEl = itemCard.querySelector('input[data-field="weight"]');
      const repsEl = itemCard.querySelector('input[data-field="reps"]');
      const weight = Number(String(weightEl.value).replace(",", "."));
      const reps = Number(String(repsEl.value).replace(",", "."));

      if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0) {
        toast("Bitte gültige kg und reps eingeben.");
        return;
      }
      addSetToWorkout(w, exId, { reps, weight });
      weightEl.value = "";
      repsEl.value = "";
      persist();
      renderActiveWorkout();
      return;
    }

    if (action === "del-set") {
      const idx = Number(btn.dataset.idx);
      deleteSetFromWorkout(w, exId, idx);
      persist();
      renderActiveWorkout();
      return;
    }
  });

  // History actions
  on("#historyList", "click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "open") {
      state.meta.activeWorkoutId = id;
      persist();
      rerenderAll();
      setActiveTab("training");
      return;
    }

    if (action === "delete") {
      if (!confirm("Workout löschen?")) return;
      deleteWorkout(state, id);
      if (state.meta.activeWorkoutId === id) state.meta.activeWorkoutId = null;
      persist();
      rerenderAll();
      toast("Workout gelöscht ✅");
      return;
    }
  });

  on("#btnExport", "click", () => {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `benchmarkpro_v4_${APP_VERSION}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Export erfolgreich ✅");
  });

  let pendingImport = null;

function hideImportPreview(){
  pendingImport = null;
  const box = $("#importPreview");
  box.style.display = "none";
  $("#importKind").textContent = "—";
  $("#importWorkouts").textContent = "—";
  $("#importPlans").textContent = "—";
  $("#importExercises").textContent = "—";
  $("#importNote").textContent = "";
}

function showImportPreview(preview, validation){
  const box = $("#importPreview");
  box.style.display = "block";
  $("#importKind").textContent = preview.kind;
  $("#importWorkouts").textContent = String(preview.counts?.workouts ?? 0);
  $("#importPlans").textContent = String(preview.counts?.plans ?? 0);
  $("#importExercises").textContent = String(preview.counts?.exercises ?? 0);
  if (validation && !validation.ok && validation.errors && validation.errors.length) {
    $("#importNote").textContent = "Validierung fehlgeschlagen:\n" + validation.errors.join("\n");
    $("#importNote").style.color = "var(--danger)";
  } else {
    $("#importNote").style.color = "";
    $("#importNote").textContent = preview.note || "";
  }
}

on("#fileImport", "change", async (ev) => {
  const file = ev.target.files?.[0];
  if (!file) return;
  const text = await file.text();
  try {
    const { preview, state: imported, validation } = parseImportFile(text);
    pendingImport = { state: imported, validation };
    showImportPreview(preview, validation);
    toast(validation && !validation.ok ? "Import-Vorschau (ungültige Daten)" : "Import-Vorschau bereit ✅");
  } catch (e) {
    hideImportPreview();
    toast(String(e?.message || e));
  } finally {
    ev.target.value = "";
  }
});

on("#btnCancelImport", "click", () => {
  hideImportPreview();
  toast("Import abgebrochen");
});

on("#btnApplyImport", "click", () => {
  if (!pendingImport) return;
  if (!pendingImport.validation || !pendingImport.validation.ok) {
    toast("Import abgebrochen: Ungültige Daten. Bitte Validierungsfehler beheben.");
    return;
  }
  try {
    const backupKey = createBackup(state);
    toast("Backup angelegt: " + backupKey);
    state = applyImportedState(pendingImport.state);
    // Ensure defaults exist (and keep imported custom exercises/plans/workouts)
    ensureDefaults(state, defaults);
    state.meta = state.meta || {};
    state.meta.activeWorkoutId = null; // avoid dangling ids after replace
    // run migrations for imported v4 state
    const mig2 = runMigrations(state);
    state = mig2.state;
    state.meta.lastMigration = { ran: mig2.ran, from: mig2.from, to: mig2.to, at: new Date().toISOString() };
    persist();
    rerenderAll();
    hideImportPreview();
    toast("Import angewendet ✅");
  } catch (e) {
    toast(String(e?.message || e));
  }
});
}

function boot(){
  // persist defaults once
  persist();
  rerenderAll();
  setupTabs();
  setupActions();
  setActiveTab("training");
}

boot();
