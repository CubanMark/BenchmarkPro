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

function createEmptyPrReference() {
  return {
    maxWeight: 0,
  };
}

export function getExercisePrReferenceById(workouts, excludeWorkoutId = null) {
  const referenceByExercise = Object.create(null);

  for (const workout of workouts || []) {
    if (excludeWorkoutId != null && workout.id === excludeWorkoutId) continue;

    for (const item of workout.items || []) {
      for (const set of item.sets || []) {
        const weight = Number(set?.weight);
        if (!Number.isFinite(weight) || weight <= 0) continue;

        const reference = referenceByExercise[item.exerciseId] || createEmptyPrReference();
        if (weight > reference.maxWeight) {
          reference.maxWeight = weight;
        }

        referenceByExercise[item.exerciseId] = reference;
      }
    }
  }

  return referenceByExercise;
}

export function getMaxWeightByExerciseId(workouts, excludeWorkoutId = null) {
  const referenceByExercise = getExercisePrReferenceById(workouts, excludeWorkoutId);
  const maxByExercise = Object.create(null);

  for (const [exerciseId, reference] of Object.entries(referenceByExercise)) {
    maxByExercise[exerciseId] = reference.maxWeight;
  }

  return maxByExercise;
}

function classifySetPr(set, reference) {
  const weight = Number(set?.weight);
  if (!Number.isFinite(weight) || weight <= 0) return null;

  if (weight > reference.maxWeight) {
    return { type: "top-weight", emoji: "\uD83D\uDD25", shortLabel: "Topgewicht-PR" };
  }

  return null;
}

function applySetToReference(set, reference) {
  const weight = Number(set?.weight);
  if (!Number.isFinite(weight) || weight <= 0) return reference;

  if (weight > reference.maxWeight) {
    reference.maxWeight = weight;
  }

  return reference;
}

function getItemVolume(item) {
  let volume = 0;
  for (const set of item?.sets || []) {
    const weight = Number(set?.weight);
    const reps = Number(set?.reps);
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(reps) || reps <= 0) continue;
    volume += weight * reps;
  }
  return volume;
}

function getBestWorkoutVolumeByExerciseId(workouts, excludeWorkoutId = null) {
  const bestVolumeByExercise = Object.create(null);

  for (const workout of workouts || []) {
    if (excludeWorkoutId != null && workout.id === excludeWorkoutId) continue;

    for (const item of workout.items || []) {
      const volume = getItemVolume(item);
      if (!(item.exerciseId in bestVolumeByExercise) || volume > bestVolumeByExercise[item.exerciseId]) {
        bestVolumeByExercise[item.exerciseId] = volume;
      }
    }
  }

  return bestVolumeByExercise;
}

export function analyzeWorkoutPrs(workouts, workout) {
  const referenceByExercise = getExercisePrReferenceById(workouts, workout?.id);
  const bestVolumeByExercise = getBestWorkoutVolumeByExerciseId(workouts, workout?.id);
  const setPrsByExerciseId = Object.create(null);
  const exercisePrsByExerciseId = Object.create(null);
  const counts = {
    topWeightCount: 0,
    topVolumeCount: 0,
  };

  for (const item of workout?.items || []) {
    const runningReference = {
      ...(referenceByExercise[item.exerciseId] || createEmptyPrReference()),
    };
    const setPrs = [];

    for (const set of item.sets || []) {
      const pr = classifySetPr(set, runningReference);
      setPrs.push(pr);

      if (pr?.type === "top-weight") counts.topWeightCount++;

      applySetToReference(set, runningReference);
    }

    setPrsByExerciseId[item.exerciseId] = setPrs;

    const itemVolume = getItemVolume(item);
    const bestPreviousVolume = bestVolumeByExercise[item.exerciseId] ?? 0;
    const hasTopVolumePr = itemVolume > 0 && itemVolume > bestPreviousVolume;
    exercisePrsByExerciseId[item.exerciseId] = {
      volume: hasTopVolumePr ? {
        type: "top-volume",
        emoji: "\uD83D\uDCC8",
        shortLabel: "Volumen-PR",
        currentVolume: itemVolume,
        previousVolume: bestPreviousVolume,
      } : null,
    };

    if (hasTopVolumePr) counts.topVolumeCount++;
  }

  return {
    setPrsByExerciseId,
    exercisePrsByExerciseId,
    counts,
    totalCount: counts.topWeightCount + counts.topVolumeCount,
  };
}

export function countPrsInWorkout(workouts, workout) {
  return analyzeWorkoutPrs(workouts, workout).totalCount;
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
