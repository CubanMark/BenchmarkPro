import { APP_VERSION, DATA_VERSION, STORAGE_KEY } from "./version.js";
import { loadState, saveState, exportState, parseImportFile, applyImportedState, resetState, createBackup } from "./storage.js";
import { getDefaultExercises, getDefaultPlans } from "./models.js";
import { runMigrations } from "./migrations.js";
import { ensureDefaults, createPlan, deletePlan, updatePlanFromTextarea } from "./plans.js";
import { upsertExercise } from "./exercises.js";
import { createWorkout, getWorkout, addSetToWorkout, deleteSetFromWorkout, removeExerciseFromWorkout, ensureExerciseItem, sortWorkoutsNewestFirst, humanWorkoutTitle, deleteWorkout, setWorkoutNotes } from "./workouts.js";
import { registerServiceWorker } from "./pwa.js";
import { $, $all, clearElement, createNode, setActiveTab, toast } from "./ui.js";

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

let notesSaveTimer = null;

function persistWorkoutNotesSoon() {
  window.clearTimeout(notesSaveTimer);
  notesSaveTimer = window.setTimeout(() => {
    persist();
  }, 350);
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
  const banner = $("#buildVersionBanner");
  if (banner) banner.textContent = APP_VERSION;
  const footer = $("#buildVersionFooter");
  if (footer) footer.textContent = APP_VERSION;
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
  $("#diagLastSaved").textContent = state.meta?.updatedAt || "â€”";
  const lm = state.meta?.lastMigration;
  if (lm && typeof lm === "object") {
    const tag = lm.ran ? `ran ${lm.from}â†’${lm.to}` : `noop ${lm.from}â†’${lm.to}`;
    $("#diagLastMigration").textContent = tag;
  } else {
    $("#diagLastMigration").textContent = "â€”";
  }
}

function renderExercises(){
  const el = $("#exerciseList");
  if (!el) return;
  clearElement(el);
  const sorted = [...state.exercises].sort((a,b)=>a.name.localeCompare(b.name,"de"));
  for (const ex of sorted) {
    const div = createNode("div", { className: "pill" });
    const content = createNode("div");
    const alias = (ex.aliases && ex.aliases.length) ? ` Â· aliases: ${ex.aliases.join(", ")}` : "";
    content.appendChild(createNode("div", { className: "name", text: ex.name }));
    content.appendChild(createNode("div", { className: "muted small mono", text: ex.id + alias }));
    div.appendChild(content);
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
  clearElement(root);

  for (const plan of state.plans) {
    const card = createNode("div", { className: "card" });
    const topRow = createNode("div", { className: "row space" });
    const titleRow = createNode("div", { className: "row" });
    titleRow.style.gap = "10px";
    titleRow.appendChild(createNode("div", { className: "label", text: "Plan" }));
    if (plan.isDefault) {
      titleRow.appendChild(createNode("span", { className: "badge mono", text: "default" }));
    }

    const actions = createNode("div", { className: "row" });
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";
    const saveBtn = createNode("button", { className: "btn btn-ghost", text: "Speichern" });
    saveBtn.dataset.action = "save";
    saveBtn.dataset.id = plan.id;
    const deleteBtn = createNode("button", { className: "btn btn-danger", text: "Löschen" });
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = plan.id;
    deleteBtn.disabled = Boolean(plan.isDefault);
    actions.append(saveBtn, deleteBtn);
    topRow.append(titleRow, actions);

    const nameWrap = createNode("div", { className: "mt" });
    nameWrap.appendChild(createNode("div", { className: "label", text: "Name" }));
    const nameInput = createNode("input", { className: "input mt small" });
    nameInput.dataset.field = "name";
    nameInput.dataset.id = plan.id;
    nameInput.value = plan.name;
    nameWrap.appendChild(nameInput);

    const exercisesWrap = createNode("div", { className: "mt" });
    exercisesWrap.appendChild(createNode("div", { className: "label", text: "Übungen (eine pro Zeile)" }));
    const exercisesInput = createNode("textarea", { className: "mt" });
    exercisesInput.dataset.field = "exercises";
    exercisesInput.dataset.id = plan.id;
    exercisesInput.value = planToTextarea(plan);
    exercisesWrap.appendChild(exercisesInput);
    exercisesWrap.appendChild(createNode("div", {
      className: "muted small mt",
      text: "Tipp: Frei tippen. Unbekannte Übungen werden automatisch als neue Exercise angelegt."
    }));

    card.append(topRow, nameWrap, exercisesWrap);
    root.appendChild(card);
  }
}

function fillExerciseSelect(sel, { includePlaceholder = false } = {}){
  clearElement(sel);
  if (includePlaceholder) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Ãœbung wÃ¤hlenâ€¦";
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
  clearElement(sel);
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

/** Liefert Recency fÃ¼r Dashboard: { days, display, tier } mit tier green/yellow/red (Ampel). */
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

/** ISO-Woche (Moâ€“So): Liefert den Montag der Woche von dateStr als "YYYY-MM-DD" (lokal, nicht toISOString). */
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
 * excludeWorkoutId: optional â€“ dieses Workout wird aus der Berechnung ausgeschlossen (fÃ¼r laufendes Max im aktuellen Workout).
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

/** ZÃ¤hlt PR-Sets in einem Workout (gleiche Logik wie beim Anzeigen der ðŸ”¥ PR-Badges). */
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
 * Liefert alle Sets der letzten Einheit fÃ¼r eine Ãœbung (aus state.workouts, excludeWorkoutId ausgeschlossen).
 * RÃ¼ckgabe: [{ weight, reps }, ...] oder null.
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
  clearElement(root);

  const maxBeforeThisWorkout = getMaxWeightByExerciseId(workout.id);

  for (const item of workout.items) {
    const exName = exerciseNameById(item.exerciseId);
    const card = createNode("div", { className: "card" });
    card.dataset.exerciseId = item.exerciseId;

    const lastSets = getLastPerformanceSetsForExercise(state, item.exerciseId, workout.id);
    const lastSet = lastSets && lastSets.length ? lastSets[lastSets.length - 1] : null;
    const weightPlaceholder = lastSet && Number.isFinite(lastSet.weight) ? String(lastSet.weight) : "kg";
    const repsPlaceholder = lastSet && Number.isFinite(lastSet.reps) ? String(lastSet.reps) : "reps";

    let runningMax = maxBeforeThisWorkout[item.exerciseId] ?? 0;

    const topRow = createNode("div", { className: "row space" });
    const titleWrap = createNode("div");
    titleWrap.appendChild(createNode("div", { className: "label", text: exName }));
    titleWrap.appendChild(createNode("div", { className: "muted small mono", text: item.exerciseId }));
    const actionWrap = createNode("div", { className: "row" });
    actionWrap.style.gap = "8px";
    actionWrap.style.flexWrap = "wrap";
    const removeBtn = createNode("button", { className: "btn btn-ghost btn-xs", text: "Entfernen", attrs: { title: "Übung entfernen" } });
    removeBtn.dataset.action = "remove-ex";
    actionWrap.appendChild(removeBtn);
    topRow.append(titleWrap, actionWrap);
    card.appendChild(topRow);

    if (lastSets && lastSets.length) {
      const lastBlock = createNode("div", { className: "mt" });
      lastBlock.appendChild(createNode("div", { className: "muted small", text: "Letztes Mal:" }));
      const pills = createNode("div", { className: "last-time-pills" });
      for (const s of lastSets.slice(0, 5)) {
        const w = Number.isFinite(s.weight) ? s.weight : "—";
        const r = Number.isFinite(s.reps) ? s.reps : "—";
        pills.appendChild(createNode("span", { className: "last-time-pill", text: `${w} × ${r}` }));
      }
      lastBlock.appendChild(pills);
      card.appendChild(lastBlock);
    }

    const inputBlock = createNode("div", { className: "mt" });
    const inputRow = createNode("div", { className: "row" });
    inputRow.style.gap = "8px";
    inputRow.style.flexWrap = "wrap";
    const weightInput = createNode("input", { className: "input small w70", attrs: { inputmode: "decimal", placeholder: weightPlaceholder } });
    weightInput.dataset.field = "weight";
    const repsInput = createNode("input", { className: "input small w70", attrs: { inputmode: "numeric", placeholder: repsPlaceholder } });
    repsInput.dataset.field = "reps";
    const addSetBtn = createNode("button", { className: "btn btn-xs", text: "+ Set" });
    addSetBtn.dataset.action = "add-set";
    inputRow.append(weightInput, repsInput, addSetBtn);
    inputBlock.appendChild(inputRow);
    inputBlock.appendChild(createNode("div", { className: "muted small mt", text: "Tipp: kg und reps ausfüllen → + Set." }));
    card.appendChild(inputBlock);

    const setsWrap = createNode("div", { className: "mt sets" });
    if (!item.sets.length) {
      setsWrap.appendChild(createNode("div", { className: "muted small", text: "Noch keine Sets." }));
    } else {
      for (const [idx, s] of item.sets.entries()) {
        const w = Number.isFinite(s.weight) ? s.weight : "";
        const r = Number.isFinite(s.reps) ? s.reps : "";
        const weightNum = Number(s?.weight);
        const isPr = Number.isFinite(weightNum) && weightNum > 0 && weightNum > runningMax;
        if (isPr) runningMax = weightNum;
        const prLabel = isPr ? " 🔥 PR" : "";

        const setRow = createNode("div", { className: "row space set-row" });
        setRow.appendChild(createNode("div", { className: "mono", text: `${idx+1}.` }));
        setRow.appendChild(createNode("div", { className: "mono", text: `${w} kg × ${r}${prLabel}` }));
        const deleteBtn = createNode("button", { className: "btn btn-danger btn-xs", text: "x", attrs: { title: "Set löschen" } });
        deleteBtn.dataset.action = "del-set";
        deleteBtn.dataset.idx = String(idx);
        setRow.appendChild(deleteBtn);
        setsWrap.appendChild(setRow);
      }
    }
    card.appendChild(setsWrap);
    root.appendChild(card);
  }

  if (!workout.items.length) {
    root.appendChild(createNode("div", { className: "muted", text: "Keine Übungen im Workout. Oben hinzufügen." }));
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
      prCountEl.textContent = n === 1 ? "ðŸ”¥ 1 PR in diesem Training" : `ðŸ”¥ ${n} PRs in diesem Training`;
    }
  }

  fillExerciseSelect($("#addExerciseSelect"), { includePlaceholder: true });
  renderWorkoutItems(workout);
}

function renderHistory(){
  const root = $("#historyList");
  if (!root) return;
  clearElement(root);
  const workouts = sortWorkoutsNewestFirst(state.workouts);

  if (!workouts.length) {
    const emptyCard = createNode("div", { className: "card" });
    emptyCard.appendChild(createNode("div", { className: "muted", text: "Noch keine Workouts gespeichert." }));
    root.appendChild(emptyCard);
    return;
  }

  for (const w of workouts) {
    const row = createNode("div", { className: "card" });
    const layout = createNode("div", { className: "row space" });
    const info = createNode("div");
    info.appendChild(createNode("div", { className: "label", text: humanWorkoutTitle(state, w) }));
    info.appendChild(createNode("div", { className: "muted small mono", text: w.id }));

    const actions = createNode("div", { className: "row" });
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";
    const openBtn = createNode("button", { className: "btn btn-ghost btn-xs", text: "Öffnen" });
    openBtn.dataset.action = "open";
    openBtn.dataset.id = w.id;
    const deleteBtn = createNode("button", { className: "btn btn-danger btn-xs", text: "Löschen" });
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = w.id;
    actions.append(openBtn, deleteBtn);

    layout.append(info, actions);
    row.appendChild(layout);
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
    recencyValue.textContent = "-";
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
  toast("Workout gestartet âœ…");
}

function setupActions(){
  on("#btnSaveState", "click", () => {
    persist();
    rerenderAll();
    toast("State gespeichert âœ…");
  });

  on("#btnResetDev", "click", () => {
    if (!confirm("Reset (dev): State komplett lÃ¶schen?")) return;
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
    toast("Neuer Plan angelegt âœ…");
  });

  on("#btnAddExercise", "click", (ev) => {
    // prevent <details> toggle when clicking button in summary
    ev.preventDefault();
    ev.stopPropagation();

    const name = prompt("Neue Ãœbung (Name):");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    upsertExercise(state, trimmed);
    persist();
    rerenderAll();
    toast("Ãœbung angelegt âœ…");
  });

  on("#plansList", "click", (ev) => {
    const btn = ev.target.closest("button[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const planId = btn.dataset.id;

    if (action === "delete") {
      if (!confirm("Plan lÃ¶schen?")) return;
      const ok = deletePlan(state, planId);
      if (!ok) return toast("Default-PlÃ¤ne kÃ¶nnen nicht gelÃ¶scht werden.");
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
      toast("Plan gespeichert âœ…");
      return;
    }
  });

  // Training controls
  on("#btnStartWorkout", "click", startWorkout);
  on("#btnNewWorkout", "click", () => {
    if (state.meta.activeWorkoutId) {
      toast("Es lÃ¤uft schon ein aktives Workout.");
      return;
    }
    $("#newWorkoutCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  on("#btnEndWorkout", "click", () => {
    state.meta.activeWorkoutId = null;
    persist();
    rerenderAll();
    toast("Workout geschlossen âœ…");
  });

  on("#btnDeleteWorkout", "click", () => {
    const id = state.meta.activeWorkoutId;
    if (!id) return;
    if (!confirm("Workout wirklich lÃ¶schen?")) return;
    deleteWorkout(state, id);
    state.meta.activeWorkoutId = null;
    persist();
    rerenderAll();
    toast("Workout gelÃ¶scht âœ…");
  });

  on("#activeWorkoutNotes", "input", (ev) => {
    const id = state.meta.activeWorkoutId;
    const w = id ? getWorkout(state, id) : null;
    if (!w) return;
    setWorkoutNotes(w, ev.target.value);
    persistWorkoutNotesSoon();
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
      if (!confirm("Ãœbung aus dem Workout entfernen?")) return;
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
        toast("Bitte gÃ¼ltige kg und reps eingeben.");
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
      if (!confirm("Workout lÃ¶schen?")) return;
      deleteWorkout(state, id);
      if (state.meta.activeWorkoutId === id) state.meta.activeWorkoutId = null;
      persist();
      rerenderAll();
      toast("Workout gelÃ¶scht âœ…");
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
    toast("Export erfolgreich âœ…");
  });

  let pendingImport = null;

function hideImportPreview(){
  pendingImport = null;
  const box = $("#importPreview");
  box.style.display = "none";
  $("#importKind").textContent = "â€”";
  $("#importWorkouts").textContent = "â€”";
  $("#importPlans").textContent = "â€”";
  $("#importExercises").textContent = "â€”";
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
    toast(validation && !validation.ok ? "Import-Vorschau (ungÃ¼ltige Daten)" : "Import-Vorschau bereit âœ…");
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
    toast("Import abgebrochen: UngÃ¼ltige Daten. Bitte Validierungsfehler beheben.");
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
    toast("Import angewendet âœ…");
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
  registerServiceWorker();
  setActiveTab("training");
}

boot();



