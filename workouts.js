export function slugify(s){
  return String(s)
    .toLowerCase()
    .trim()
    .replace(/[()]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function todayISODate(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

export function newWorkoutId(dateStr){
  return `w_${dateStr}_${Date.now().toString(36)}`;
}

export function createWorkout(state, { planId = null, date = todayISODate() } = {}){
  const id = newWorkoutId(date);
  const workout = {
    id,
    date,
    planId,
    notes: "",
    items: []
  };

  if (planId) {
    const plan = state.plans.find(p => p.id === planId);
    if (plan) {
      workout.items = plan.exerciseIds.map(exId => ({ exerciseId: exId, sets: [] }));
    }
  }

  state.workouts.push(workout);
  return workout;
}

export function getWorkout(state, workoutId){
  return state.workouts.find(w => w.id === workoutId) || null;
}

export function ensureExerciseItem(workout, exerciseId){
  let item = workout.items.find(i => i.exerciseId === exerciseId);
  if (!item) {
    item = { exerciseId, sets: [] };
    workout.items.push(item);
  }
  return item;
}

export function addSetToWorkout(workout, exerciseId, { reps, weight, note = "" }){
  const item = ensureExerciseItem(workout, exerciseId);
  item.sets.push({
    reps: Number(reps),
    weight: Number(weight),
    note: String(note || "")
  });
}

export function deleteSetFromWorkout(workout, exerciseId, setIndex){
  const item = workout.items.find(i => i.exerciseId === exerciseId);
  if (!item) return false;
  if (setIndex < 0 || setIndex >= item.sets.length) return false;
  item.sets.splice(setIndex, 1);
  return true;
}

export function removeExerciseFromWorkout(workout, exerciseId){
  const idx = workout.items.findIndex(i => i.exerciseId === exerciseId);
  if (idx === -1) return false;
  workout.items.splice(idx,1);
  return true;
}

export function setWorkoutNotes(workout, notes){
  workout.notes = String(notes || "");
}

export function setWorkoutDate(workout, dateStr){
  workout.date = dateStr;
}

export function deleteWorkout(state, workoutId){
  const idx = state.workouts.findIndex(w => w.id === workoutId);
  if (idx === -1) return false;
  state.workouts.splice(idx,1);
  return true;
}

export function sortWorkoutsNewestFirst(workouts){
  return [...workouts].sort((a,b) => {
    if (a.date === b.date) return (b.id||"").localeCompare(a.id||"");
    return (b.date||"").localeCompare(a.date||"");
  });
}

export function humanWorkoutTitle(state, workout){
  const planName = workout.planId ? (state.plans.find(p=>p.id===workout.planId)?.name || workout.planId) : "Freies Training";
  return `${workout.date} · ${planName}`;
}
