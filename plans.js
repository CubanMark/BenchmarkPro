import { upsertExercise } from "./exercises.js";

export function ensureDefaults(state, defaults){
  if (!state.exercises.length) state.exercises = defaults.exercises;
  if (!state.plans.length) state.plans = defaults.plans;
}

export function createPlan(state){
  const id = `plan_${Date.now()}`;
  const plan = { id, name: "Neuer Plan", exerciseIds: [], isDefault: false };
  state.plans.unshift(plan);
  return plan;
}

export function deletePlan(state, planId){
  const plan = state.plans.find(p => p.id === planId);
  if (!plan) return false;
  if (plan.isDefault) return false;
  state.plans = state.plans.filter(p => p.id !== planId);
  return true;
}

export function updatePlanFromTextarea(state, planId, name, textareaValue){
  const plan = state.plans.find(p => p.id === planId);
  if (!plan) return;

  plan.name = (name || "").trim() || plan.name;

  const lines = String(textareaValue || "")
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean);

  const ids = [];
  for (const line of lines) {
    const ex = upsertExercise(state, line);
    if (ex) ids.push(ex.id);
  }
  plan.exerciseIds = ids;
}
