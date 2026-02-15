import { APP_VERSION, DATA_VERSION, STORAGE_KEY } from "./version.js";
import { loadState, saveState, exportState, importStateReplace, resetState } from "./storage.js";
import { getDefaultExercises, getDefaultPlans } from "./models.js";
import { ensureDefaults, createPlan, deletePlan, updatePlanFromTextarea } from "./plans.js";
import { upsertExercise } from "./exercises.js";
import { $, $all, setActiveTab, toast } from "./ui.js";

let state = loadState();

const defaults = {
  exercises: getDefaultExercises(),
  plans: getDefaultPlans()
};

ensureDefaults(state, defaults);
saveState(state); // persist defaults once

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
        <div class="row">
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

function rerenderAll(){
  renderHeader();
  renderStateSummary();
  renderDiagnostics();
  renderExercises();
  renderPlans();
}

function setupTabs(){
  $all(".tab").forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });
}

function setupActions(){
  $("#btnSaveState").addEventListener("click", () => {
    saveState(state);
    rerenderAll();
    toast("State gespeichert ✅");
  });

  $("#btnResetDev").addEventListener("click", () => {
    if (!confirm("Reset (dev): State komplett löschen?")) return;
    resetState();
    state = loadState();
    ensureDefaults(state, defaults);
    saveState(state);
    rerenderAll();
  });

  $("#btnAddPlan").addEventListener("click", () => {
    createPlan(state);
    saveState(state);
    rerenderAll();
    toast("Neuer Plan angelegt ✅");
  });

  $("#btnAddExercise").addEventListener("click", () => {
    const name = prompt("Neue Übung (Name):");
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    upsertExercise(state, trimmed);
    saveState(state);
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
      saveState(state);
      rerenderAll();
      return;
    }

    if (action === "save") {
      const nameEl = document.querySelector(`input[data-field="name"][data-id="${planId}"]`);
      const txtEl = document.querySelector(`textarea[data-field="exercises"][data-id="${planId}"]`);
      updatePlanFromTextarea(state, planId, nameEl?.value, txtEl?.value);
      saveState(state);
      rerenderAll();
      toast("Plan gespeichert ✅");
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
      saveState(state);
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
  rerenderAll();
  setupTabs();
  setupActions();
  setActiveTab("training");
}

boot();
