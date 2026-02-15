import { APP_VERSION, DATA_VERSION, STORAGE_KEY } from "./version.js";
import { loadState, saveState, exportState, parseImportFile, applyImportedState, resetState } from "./storage.js";
import { getDefaultExercises, getDefaultPlans } from "./models.js";
import { runMigrations } from "./migrations.js";
import { ensureDefaults, createPlan, deletePlan, updatePlanFromTextarea } from "./plans.js";
import { upsertExercise } from "./exercises.js";
import { createWorkout, getWorkout, addSetToWorkout, deleteSetFromWorkout, removeExerciseFromWorkout, ensureExerciseItem, sortWorkoutsNewestFirst, humanWorkoutTitle, deleteWorkout, setWorkoutNotes } from "./workouts.js";
import { $, $all, setActiveTab, toast } from "./ui.js";

let state = loadState();

// Run migrations (v4->v4). Legacy imports are handled separately.
const mig = runMigrations(state);
state = mig.state;

const defaults = {
  exercises: getDefaultExercises(),
  plans: getDefaultPlans()
};

ensureDefaults(state, defaults);

// Event listener setup: Ensuring that the DOM is loaded before we attach event listeners
document.addEventListener('DOMContentLoaded', function () {
  const importButton = document.getElementById('import-json'); // Make sure the element exists
  if (importButton) {
    importButton.addEventListener('click', function () {
      const fileInput = document.getElementById('file-input');
      if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = function (event) {
          const fileText = event.target.result;
          const parsedData = parseImportFile(fileText);
          if (parsedData) {
            applyImportedState(parsedData);
          }
        };
        reader.readAsText(file);
      } else {
        toast("Keine Datei ausgewählt", "error");
      }
    });
  } else {
    console.error("Import-Button nicht gefunden");
  }

  const exportButton = document.getElementById('export-json');
  if (exportButton) {
    exportButton.addEventListener('click', function () {
      exportStateToFile();
    });
  } else {
    console.error("Export-Button nicht gefunden");
  }

  // Ensure that the tabs are functioning after DOM is loaded
  const tabs = $all('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      setActiveTab(tab);
    });
  });
});

// Function to export state to file
function exportStateToFile() {
  const stateData = JSON.stringify(state);
  const blob = new Blob([stateData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'benchmarkpro-state.json';
  link.click();
  URL.revokeObjectURL(url);
}

// Optional: Other initialization and app logic
