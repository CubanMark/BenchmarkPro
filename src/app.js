import { APP_VERSION, DATA_VERSION, STORAGE_KEY } from "./version.js";
import { loadState, saveState, exportState, parseImportFile, applyImportedState, resetState, createBackup } from "./storage.js";
import { getDefaultExercises, getDefaultPlans } from "./models.js";
import { runMigrations } from "./migrations.js";
import { ensureDefaults, createPlan, deletePlan, updatePlanFromTextarea } from "./plans.js";
import { upsertExercise } from "./exercises.js";
import { createWorkout, getWorkout, addSetToWorkout, deleteSetFromWorkout, removeExerciseFromWorkout, ensureExerciseItem, sortWorkoutsNewestFirst, humanWorkoutTitle, deleteWorkout, setWorkoutNotes } from "./workouts.js";
import { registerServiceWorker } from "./pwa.js";
import { renderExercises as renderExercisesView, renderPlans as renderPlansView, fillExerciseSelect as fillExerciseSelectView, fillPlanSelect as fillPlanSelectView, renderWorkoutItems as renderWorkoutItemsView, renderHistory as renderHistoryView } from "./renderers.js";
import { analyzeWorkoutPrs } from "./stats.js";
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
  renderExercisesView($("#exerciseList"), state.exercises);
}

function renderPlans(){
  renderPlansView($("#plansList"), state.plans, state.exercises);
}

function fillExerciseSelect(sel, { includePlaceholder = false } = {}){
  fillExerciseSelectView(sel, state.exercises, { includePlaceholder });
}

function fillPlanSelect(sel){
  fillPlanSelectView(sel, state.plans);
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

function formatWorkoutPrSummary(prSummary) {
  const counts = prSummary?.counts || {};
  const parts = [];

  if (counts.topWeightCount === 1) parts.push("\uD83D\uDD25 1 Topgewicht-PR");
  else if (counts.topWeightCount > 1) parts.push(`\uD83D\uDD25 ${counts.topWeightCount} Topgewicht-PRs`);

  if (counts.topVolumeCount === 1) parts.push("\uD83D\uDCC8 1 Volumen-PR");
  else if (counts.topVolumeCount > 1) parts.push(`\uD83D\uDCC8 ${counts.topVolumeCount} Volumen-PRs`);

  if (!parts.length) return "";
  return `${parts.join(", ")} in diesem Training`;
}

/**
 * Liefert alle Sets der letzten Einheit fÃ¼r eine Ãœbung (aus state.workouts, excludeWorkoutId ausgeschlossen).
 * RÃ¼ckgabe: [{ weight, reps }, ...] oder null.
 */
function getLastPerformanceSetsForExercise(workouts, exerciseId, excludeWorkoutId) {
  const sorted = sortWorkoutsNewestFirst(workouts || []);
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
  const prSummary = analyzeWorkoutPrs(state.workouts, workout);
  renderWorkoutItemsView($("#workoutItems"), workout, {
    exerciseNameById,
    getLastPerformanceSetsForExercise,
    prSummary,
    workouts: state.workouts,
  });
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
  const prSummary = analyzeWorkoutPrs(state.workouts, workout);

  const prCountEl = $("#activeWorkoutPrCount");
  if (prCountEl) {
    const summaryText = formatWorkoutPrSummary(prSummary);
    if (!summaryText) {
      prCountEl.textContent = "";
      prCountEl.className = "muted small";
    } else {
      prCountEl.className = "active-workout-pr";
      prCountEl.textContent = summaryText;
    }
  }

  fillExerciseSelect($("#addExerciseSelect"), { includePlaceholder: true });
  renderWorkoutItems(workout);
}

function renderHistory(){
  renderHistoryView(
    $("#historyList"),
    sortWorkoutsNewestFirst(state.workouts),
    (workout) => humanWorkoutTitle(state, workout)
  );
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



