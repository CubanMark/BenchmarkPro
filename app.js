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

// Handling the import action (for instance, when a user uploads a plan)
function importFile(fileText) {
  const parsedData = parseImportFile(fileText);
  if (parsedData) {
    applyImportedState(parsedData);
  }
}

// Export state as JSON to a file
function exportStateToFile() {
  const stateData = JSON.stringify(state);
  // logic for exporting the state to a file
}
