import { slugify } from "./workouts.js";

export function findExerciseByName(state, name){
  const n = name.trim().toLowerCase();
  return state.exercises.find(ex =>
    ex.name.toLowerCase() === n || (ex.aliases || []).some(a => a.toLowerCase() === n)
  ) || null;
}

export function upsertExercise(state, name){
  const trimmed = name.trim();
  if (!trimmed) return null;

  const existing = findExerciseByName(state, trimmed);
  if (existing) return existing;

  const baseId = slugify(trimmed);
  let uniqueId = baseId;
  let i = 2;
  while (state.exercises.some(e => e.id === uniqueId)) {
    uniqueId = `${baseId}_${i++}`;
  }
  const ex = { id: uniqueId, name: trimmed, aliases: [] };
  state.exercises.push(ex);
  return ex;
}
