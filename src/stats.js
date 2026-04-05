import { sortWorkoutsNewestFirst } from "./workouts.js";

function parseLocalDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const date = new Date(dateStr + "T12:00:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(dateStr) {
  const date = parseLocalDate(dateStr);
  if (!date) return null;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  date.setHours(12, 0, 0, 0);
  return Math.max(0, Math.floor((today - date) / (24 * 60 * 60 * 1000)));
}

function compareByWorkoutDateAsc(a, b) {
  const dateDiff = String(a.date || "").localeCompare(String(b.date || ""));
  if (dateDiff !== 0) return dateDiff;
  return String(a.workoutId || "").localeCompare(String(b.workoutId || ""));
}

function compareByWorkoutDateDesc(a, b) {
  return compareByWorkoutDateAsc(b, a);
}

function sumSetVolume(sets) {
  let volume = 0;
  for (const set of sets || []) {
    const weight = Number(set?.weight);
    const reps = Number(set?.reps);
    if (!Number.isFinite(weight) || weight <= 0 || !Number.isFinite(reps) || reps <= 0) continue;
    volume += weight * reps;
  }
  return volume;
}

function getTopSet(sets) {
  let topWeight = 0;
  let topReps = 0;

  for (const set of sets || []) {
    const weight = Number(set?.weight);
    const reps = Number(set?.reps);
    if (!Number.isFinite(weight) || weight <= 0) continue;

    if (weight > topWeight || (weight === topWeight && Number.isFinite(reps) && reps > topReps)) {
      topWeight = weight;
      topReps = Number.isFinite(reps) && reps > 0 ? reps : 0;
    }
  }

  return { weight: topWeight, reps: topReps };
}

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
    if (getISOWeekKey(workout.date) === thisWeekKey && workout.date) uniqueDates.add(workout.date);
  }

  const count = uniqueDates.size;
  let label = "Problematisch";
  if (count >= 3) label = "Stark";
  else if (count === 2) label = "Gut";
  else if (count === 1) label = "Dranbleiben";

  return { count, label };
}

function createEmptyPrReference() {
  return { maxWeight: 0 };
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
        if (weight > reference.maxWeight) reference.maxWeight = weight;
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
  if (weight > reference.maxWeight) reference.maxWeight = weight;
  return reference;
}

function getBestWorkoutVolumeByExerciseId(workouts, excludeWorkoutId = null) {
  const bestVolumeByExercise = Object.create(null);

  for (const workout of workouts || []) {
    if (excludeWorkoutId != null && workout.id === excludeWorkoutId) continue;

    for (const item of workout.items || []) {
      const volume = sumSetVolume(item.sets || []);
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

    const itemVolume = sumSetVolume(item.sets || []);
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

export function getExerciseSessionRecords(workouts, exerciseId) {
  const records = [];

  for (const workout of workouts || []) {
    const item = (workout.items || []).find((entry) => entry.exerciseId === exerciseId);
    if (!item || !Array.isArray(item.sets) || !item.sets.length) continue;

    const topSet = getTopSet(item.sets);
    records.push({
      workoutId: workout.id,
      date: workout.date || "",
      setsCount: item.sets.length,
      sessionVolume: sumSetVolume(item.sets),
      topWeight: topSet.weight,
      topReps: topSet.reps,
    });
  }

  return records.sort(compareByWorkoutDateAsc);
}

function getStatusLabel(lastRecord, topWeight, bestSessionVolume) {
  if (!lastRecord) return "Keine Daten";
  if (lastRecord.topWeight >= topWeight || lastRecord.sessionVolume >= bestSessionVolume) return "Zuletzt verbessert";

  const days = daysSince(lastRecord.date);
  if (days != null && days > 21) return "Laenger nicht trainiert";
  if (days != null && days > 10) return "Etwas Pause";
  return "Stabil";
}

function getRecentVolumeTrend(records) {
  const lastThree = records.slice(-3);
  if (lastThree.length < 3) return "Noch wenig Trenddaten";

  const volumes = lastThree.map((entry) => entry.sessionVolume);
  if (volumes[0] < volumes[1] && volumes[1] < volumes[2]) return "Volumen in den letzten 3 Sessions steigend";
  if (volumes[0] > volumes[1] && volumes[1] > volumes[2]) return "Volumen in den letzten 3 Sessions fallend";
  return "Volumen zuletzt gemischt";
}

function getAverageSessionsPerMonth(records) {
  if (!records.length) return 0;
  if (records.length === 1) return 1;

  const first = parseLocalDate(records[0].date);
  const last = parseLocalDate(records[records.length - 1].date);
  if (!first || !last) return records.length;

  const diffDays = Math.max(1, Math.floor((last - first) / (24 * 60 * 60 * 1000)));
  const months = Math.max(1, diffDays / 30);
  return records.length / months;
}

function getBestPerformanceDate(records, bestSessionVolume, topWeight) {
  let bestDate = "";
  for (const record of records) {
    if (record.sessionVolume === bestSessionVolume || record.topWeight === topWeight) {
      if (!bestDate || String(record.date).localeCompare(bestDate) > 0) bestDate = record.date;
    }
  }
  return bestDate;
}

export function getActiveExerciseStats(workouts, minSessions = 3) {
  const exerciseIds = new Set();
  for (const workout of workouts || []) {
    for (const item of workout.items || []) {
      if (item?.exerciseId) exerciseIds.add(item.exerciseId);
    }
  }

  const stats = [];
  for (const exerciseId of exerciseIds) {
    const records = getExerciseSessionRecords(workouts, exerciseId);
    if (records.length < minSessions) continue;

    const lastRecord = records[records.length - 1];
    const topWeight = records.reduce((max, record) => Math.max(max, record.topWeight), 0);
    const bestSessionVolume = records.reduce((max, record) => Math.max(max, record.sessionVolume), 0);
    stats.push({
      exerciseId,
      sessionCount: records.length,
      topWeight,
      bestSessionVolume,
      lastWorkoutDate: lastRecord?.date || "",
      statusLabel: getStatusLabel(lastRecord, topWeight, bestSessionVolume),
      lastSessionVolume: lastRecord?.sessionVolume || 0,
      daysSinceLastSession: daysSince(lastRecord?.date),
    });
  }

  return stats.sort((a, b) => {
    const dateDiff = String(b.lastWorkoutDate || "").localeCompare(String(a.lastWorkoutDate || ""));
    if (dateDiff !== 0) return dateDiff;
    return b.sessionCount - a.sessionCount;
  });
}

export function getExerciseStatsDetail(workouts, exerciseId) {
  if (!exerciseId) return null;
  const records = getExerciseSessionRecords(workouts, exerciseId);
  if (!records.length) return null;

  const topWeight = records.reduce((max, record) => Math.max(max, record.topWeight), 0);
  const bestSessionVolume = records.reduce((max, record) => Math.max(max, record.sessionVolume), 0);
  const lastRecord = records[records.length - 1];
  const bestPerformanceDate = getBestPerformanceDate(records, bestSessionVolume, topWeight);
  const recentRecords = [...records].sort(compareByWorkoutDateDesc).slice(0, 5);
  const avgRecentVolume = recentRecords.length
    ? recentRecords.reduce((sum, record) => sum + record.sessionVolume, 0) / recentRecords.length
    : 0;

  const insights = [
    getRecentVolumeTrend(records),
    `Topgewicht aktuell ${topWeight} kg`,
    bestPerformanceDate ? `Bestleistung zuletzt vor ${daysSince(bestPerformanceDate) ?? 0} Tagen` : "Bestleistung noch offen",
  ];

  return {
    exerciseId,
    sessionCount: records.length,
    topWeight,
    bestSessionVolume,
    lastWorkoutDate: lastRecord?.date || "",
    lastSessionVolume: lastRecord?.sessionVolume || 0,
    lastTopWeight: lastRecord?.topWeight || 0,
    avgSessionsPerMonth: getAverageSessionsPerMonth(records),
    avgRecentVolume,
    bestPerformanceDate,
    daysSinceLastSession: daysSince(lastRecord?.date),
    insights,
    topWeightSeries: records.map((record) => ({ date: record.date, value: record.topWeight })),
    volumeSeries: records.map((record) => ({ date: record.date, value: record.sessionVolume })),
    recentSessions: recentRecords.map((record) => ({
      date: record.date,
      setsCount: record.setsCount,
      sessionVolume: record.sessionVolume,
      topWeight: record.topWeight,
      topReps: record.topReps,
    })),
  };
}
