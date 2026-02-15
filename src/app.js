import { APP_VERSION, DATA_VERSION, STORAGE_KEY } from "./version.js";
import { loadState, saveState, resetState, exportState, importStateReplace } from "./storage.js";
import { qs, qsa, setText, setActiveTab } from "./ui.js";

let state = loadState();

function renderHeader() {
  setText(qs("#versionBadge"), APP_VERSION);
}

function renderStateSummary() {
  const summary = {
    plans: state.plans?.length ?? 0,
    workouts: state.workouts?.length ?? 0,
    exercises: state.exercises?.length ?? 0
  };
  setText(qs("#stateSummary"), JSON.stringify(summary));
}

function renderDiagnostics() {
  setText(qs("#diagAppVersion"), APP_VERSION);
  setText(qs("#diagDataVersion"), DATA_VERSION);
  setText(qs("#diagStorageKey"), STORAGE_KEY);
  setText(qs("#diagUpdatedAt"), state?.meta?.updatedAt ?? "—");
}

function wireTabs() {
  qsa(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      setActiveTab(btn.dataset.tab);
      renderStateSummary();
      renderDiagnostics();
    });
  });
}

function wireActions() {
  qs("#btnSave").addEventListener("click", () => {
    saveState(state);
    renderStateSummary();
    renderDiagnostics();
    log("Saved.");
  });

  qs("#btnReset").addEventListener("click", () => {
    const ok = confirm("Reset local v4 state? (dev)");
    if (!ok) return;
    resetState();
    state = loadState();
    renderStateSummary();
    renderDiagnostics();
    log("Reset done.");
  });

  qs("#btnExport").addEventListener("click", () => {
    const json = exportState(state);
    downloadText(`benchmarkpro_v4_export_${new Date().toISOString().slice(0,10)}.json`, json);
  });

  qs("#importFile").addEventListener("change", async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    const text = await file.text();
    try {
      state = importStateReplace(text);
      renderStateSummary();
      renderDiagnostics();
      log("Import ok (replace).");
    } catch (e) {
      console.error(e);
      alert(`Import failed: ${e?.message ?? e}`);
    }
  });
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function log(msg) {
  console.log("[BM]", msg);
}

function main() {
  renderHeader();
  renderStateSummary();
  renderDiagnostics();
  wireTabs();
  wireActions();
  setActiveTab("train");
}

main();
