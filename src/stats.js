import { sortWorkoutsNewestFirst } from "./workouts.js";

export function getLastWorkoutRecency(workouts) {
  const sorted = sortWorkoutsNewestFirst(workouts || []);
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

export function getLastWorkoutHint(workouts) {
  const recency = getLastWorkoutRecency(workouts);
  if (!recency) return "";
  if (recency.days === 0) return "Heute schon trainiert.";
  if (recency.days === 1) return "Letztes Training: gestern";
  return `Letztes Training: vor ${recency.days} Tage`;
}

export function getISOWeekKey(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const date = new Date(dateStr + "T12:00:00");
  if (isNaN(date.getTime())) return null;

  const isoWeekday = date.getDay() === 0 ? 7 : date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - (isoWeekday - 1));

  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeeklyConsistency(workouts) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const thisWeekKey = getISOWeekKey(todayStr);
  if (!thisWeekKey) return { count: 0, label: "Problematisch" };

  const uniqueDates = new Set();
  for (const workout of workouts || []) {
    if (getISOWeekKey(workout.date) === thisWeekKey && workout.date) {
      uniqueDates.add(workout.date);
    }
  }

  const count = uniqueDates.size;
  let label = "Problematisch";
  if (count >= 3) label = "Stark";
  else if (count === 2) label = "Gut";
  else if (count === 1) label = "Dranbleiben";

  return { count, label };
}

export function getMaxWeightByExerciseId(workouts, excludeWorkoutId = null) {
  const maxByExercise = Object.create(null);

  for (const workout of workouts || []) {
    if (excludeWorkoutId != null && workout.id === excludeWorkoutId) continue;

    for (const item of workout.items || []) {
      for (const set of item.sets || []) {
        const weight = Number(set?.weight);
        if (!Number.isFinite(weight) || weight <= 0) continue;
        if (!(item.exerciseId in maxByExercise) || weight > maxByExercise[item.exerciseId]) {
          maxByExercise[item.exerciseId] = weight;
        }
      }
    }
  }

  return maxByExercise;
}

export function countPrsInWorkout(workouts, workout) {
  const maxBeforeWorkout = getMaxWeightByExerciseId(workouts, workout?.id);
  let count = 0;

  for (const item of workout?.items || []) {
    let runningMax = maxBeforeWorkout[item.exerciseId] ?? 0;
    for (const set of item.sets || []) {
      const weight = Number(set?.weight);
      if (Number.isFinite(weight) && weight > 0 && weight > runningMax) {
        count++;
        runningMax = weight;
      }
    }
  }

  return count;
}

export function getLastPerformanceSetsForExercise(workouts, exerciseId, excludeWorkoutId = null) {
  const sorted = sortWorkoutsNewestFirst(workouts || []);
  for (const workout of sorted) {
    if (excludeWorkoutId != null && workout.id === excludeWorkoutId) continue;
    const item = (workout.items || []).find((entry) => entry.exerciseId === exerciseId);
    if (!item || !Array.isArray(item.sets) || item.sets.length === 0) continue;

    return item.sets.map((set) => ({
      weight: Number(set?.weight),
      reps: Number(set?.reps),
    }));
  }

  return null;
}
