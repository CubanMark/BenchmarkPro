import { APP_VERSION, DATA_VERSION, STORAGE_KEY } from "./version.js";
import { loadState, saveState, exportState, importStateReplace, resetState } from "./storage.js";
import { getDefaultExercises, getDefaultPlans } from "./models.js";
import { ensureDefaults, createPlan, deletePlan, updatePlanFromTextarea } from "./plans.js";
import { upsertExercise } from "./exercises.js";
import { createWorkout, getWorkout, addSetToWorkout, deleteSetFromWorkout, removeExerciseFromWorkout, ensureExerciseItem, sortWorkoutsNewestFirst, humanWorkoutTitle, deleteWorkout, setWorkoutNotes } from "./workouts.js";
import { $, $all, setActiveTab, toast } from "./ui.js";

let state = loadState();

const defaults = {
  exercises: getDefaultExercises(),
  plans: getDefaultPlans()
};

ensureDefaults(state, defaults);

// ensure meta
state.meta = state.meta || {};
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

  if (dateInp && !dateInp.value) {
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

function renderWorkoutItems(workout){
  const root = $("#workoutItems");
  root.innerHTML = "";

  for (const item of workout.items) {
    const exName = exerciseNameById(item.exerciseId);
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.exerciseId = item.exerciseId;

    const setsHtml = item.sets.map((s, idx) => {
      const w = Number.isFinite(s.weight) ? s.weight : "";
      const r = Number.isFinite(s.reps) ? s.reps : "";
      return `<div class="row space set-row">
        <div class="mono">${idx+1}.</div>
        <div class="mono">${w} kg × ${r}</div>
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

      <div class="mt">
        <div class="row" style="gap:8px; flex-wrap: wrap">
          <input class="input small w70" data-field="weight" inputmode="decimal" placeholder="kg" />
          <input class="input small w70" data-field="reps" inputmode="numeric" placeholder="reps" />
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
  const workoutId = state.meta.activeWorkoutId;
  const card = $("#activeWorkoutCard");
  const newCard = $("#newWorkoutCard");
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
  renderPlans();
  renderExercises();
  renderNewWorkoutControls();
  renderActiveWorkout();
  renderHistory();
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
  $("#btnSaveState").addEventListener("click", () => {
    persist();
    rerenderAll();
    toast("State gespeichert ✅");
  });

  $("#btnResetDev").addEventListener("click", () => {
    if (!confirm("Reset (dev): State komplett löschen?")) return;
    resetState();
    state = loadState();
    ensureDefaults(state, defaults);
    state.meta = state.meta || {};
    state.meta.activeWorkoutId = null;
    persist();
    rerenderAll();
  });

  $("#btnAddPlan").addEventListener("click", () => {
    createPlan(state);
    persist();
    rerenderAll();
    toast("Neuer Plan angelegt ✅");
  });

  $("#btnAddExercise").addEventListener("click", (ev) => {
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

  $("#plansList").addEventListener("click", (ev) => {
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
  $("#btnStartWorkout").addEventListener("click", startWorkout);
  $("#btnNewWorkout").addEventListener("click", () => {
    if (state.meta.activeWorkoutId) {
      toast("Es läuft schon ein aktives Workout.");
      return;
    }
    $("#newWorkoutCard").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#btnEndWorkout").addEventListener("click", () => {
    state.meta.activeWorkoutId = null;
    persist();
    rerenderAll();
    toast("Workout geschlossen ✅");
  });

  $("#btnDeleteWorkout").addEventListener("click", () => {
    const id = state.meta.activeWorkoutId;
    if (!id) return;
    if (!confirm("Workout wirklich löschen?")) return;
    deleteWorkout(state, id);
    state.meta.activeWorkoutId = null;
    persist();
    rerenderAll();
    toast("Workout gelöscht ✅");
  });

  $("#activeWorkoutNotes").addEventListener("input", (ev) => {
    const id = state.meta.activeWorkoutId;
    const w = id ? getWorkout(state, id) : null;
    if (!w) return;
    setWorkoutNotes(w, ev.target.value);
    persist();
    renderDiagnostics();
  });

  $("#btnAddExerciseToWorkout").addEventListener("click", () => {
    const id = state.meta.activeWorkoutId;
    const w = id ? getWorkout(state, id) : null;
    if (!w) return;
    const exId = $("#addExerciseSelect").value;
    if (!exId) return;
    ensureExerciseItem(w, exId);
    persist();
    renderActiveWorkout();
  });

  $("#workoutItems").addEventListener("click", (ev) => {
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
  $("#historyList").addEventListener("click", (ev) => {
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

  $("#btnExport").addEventListener("click", () => {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `benchmarkpro_v4_${APP_VERSION}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  $("#fileImport").addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      state = importStateReplace(text);
      ensureDefaults(state, defaults);
      state.meta = state.meta || {};
      state.meta.activeWorkoutId = null; // avoid dangling ids
      persist();
      rerenderAll();
      toast("Import ok ✅");
    } catch (e) {
      toast(String(e?.message || e));
    } finally {
      ev.target.value = "";
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
