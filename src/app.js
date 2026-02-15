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

// Wait for the window to fully load before adding event listeners
window.onload = function() {
  console.log("Window fully loaded, checking DOM elements...");

  setTimeout(function() {
    // Ensure the Import Button is available before attaching the event listener
    const importButton = document.getElementById('import-json');
    if (importButton) {
      console.log("Import Button found. Adding event listener.");
      importButton.addEventListener('click', function () {
        const fileInput = document.getElementById('file-input');
        if (fileInput && fileInput.files.length > 0) {
          console.log("File selected, reading...");
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
          console.error("No file selected");
          toast("Keine Datei ausgewählt", "error");
        }
      });
    } else {
      console.error("Import button not found in the DOM");
    }

    // Ensure the Export Button is available before adding the event listener
    const exportButton = document.getElementById('export-json');
    if (exportButton) {
      console.log("Export Button found. Adding event listener.");
      exportButton.addEventListener('click', function () {
        exportStateToFile();
      });
    } else {
      console.error("Export button not found in the DOM");
    }

    // Ensure that the tabs are functioning after DOM is loaded
    const tabs = $all('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', function () {
        setActiveTab(tab);
      });
    });
  }, 200); // Delaying slightly to ensure all elements are loaded
};

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
