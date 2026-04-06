import { clearElement, createNode } from "./ui.js";

export function renderExercises(root, exercises) {
  if (!root) return;
  clearElement(root);

  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, "de"));
  for (const exercise of sorted) {
    const pill = createNode("div", { className: "pill" });
    const content = createNode("div");
    const alias = exercise.aliases && exercise.aliases.length ? ` - aliases: ${exercise.aliases.join(", ")}` : "";
    content.appendChild(createNode("div", { className: "name", text: exercise.name }));
    content.appendChild(createNode("div", { className: "muted small mono", text: exercise.id + alias }));
    pill.appendChild(content);
    root.appendChild(pill);
  }
}

export function planToTextarea(plan, exercises) {
  return plan.exerciseIds
    .map((id) => exercises.find((exercise) => exercise.id === id)?.name || id)
    .join("\n");
}

export function renderPlans(root, plans, exercises) {
  if (!root) return;
  clearElement(root);

  for (const plan of plans) {
    const card = createNode("div", { className: "card" });
    const topRow = createNode("div", { className: "row space" });
    const titleRow = createNode("div", { className: "row" });
    titleRow.style.gap = "10px";
    titleRow.appendChild(createNode("div", { className: "label", text: "Plan" }));
    if (plan.isDefault) {
      titleRow.appendChild(createNode("span", { className: "badge mono", text: "default" }));
    }

    const actions = createNode("div", { className: "row" });
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";
    const saveBtn = createNode("button", { className: "btn btn-ghost", text: "Speichern" });
    saveBtn.dataset.action = "save";
    saveBtn.dataset.id = plan.id;
    const deleteBtn = createNode("button", { className: "btn btn-danger", text: "Loeschen" });
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = plan.id;
    deleteBtn.disabled = Boolean(plan.isDefault);
    actions.append(saveBtn, deleteBtn);
    topRow.append(titleRow, actions);

    const nameWrap = createNode("div", { className: "mt" });
    nameWrap.appendChild(createNode("div", { className: "label", text: "Name" }));
    const nameInput = createNode("input", { className: "input mt small" });
    nameInput.dataset.field = "name";
    nameInput.dataset.id = plan.id;
    nameInput.value = plan.name;
    nameWrap.appendChild(nameInput);

    const exercisesWrap = createNode("div", { className: "mt" });
    exercisesWrap.appendChild(createNode("div", { className: "label", text: "Uebungen (eine pro Zeile)" }));
    const exercisesInput = createNode("textarea", { className: "mt" });
    exercisesInput.dataset.field = "exercises";
    exercisesInput.dataset.id = plan.id;
    exercisesInput.value = planToTextarea(plan, exercises);
    exercisesWrap.appendChild(exercisesInput);
    exercisesWrap.appendChild(createNode("div", {
      className: "muted small mt",
      text: "Tipp: Frei tippen. Unbekannte Uebungen werden automatisch als neue Exercise angelegt."
    }));

    card.append(topRow, nameWrap, exercisesWrap);
    root.appendChild(card);
  }
}

export function fillExerciseSelect(select, exercises, { includePlaceholder = false } = {}) {
  if (!select) return;
  clearElement(select);

  if (includePlaceholder) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Uebung waehlen...";
    select.appendChild(option);
  }

  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, "de"));
  for (const exercise of sorted) {
    const option = document.createElement("option");
    option.value = exercise.id;
    option.textContent = exercise.name;
    select.appendChild(option);
  }
}

export function fillPlanSelect(select, plans) {
  if (!select) return;
  clearElement(select);

  for (const plan of plans) {
    const option = document.createElement("option");
    option.value = plan.id;
    option.textContent = plan.name;
    select.appendChild(option);
  }
}

export function renderWorkoutItems(root, workout, {
  exerciseNameById,
  getLastPerformanceSetsForExercise,
  prSummary,
  workouts,
}) {
  if (!root) return;
  clearElement(root);

  for (const item of workout.items) {
    const exerciseName = exerciseNameById(item.exerciseId);
    const card = createNode("div", { className: "card" });
    card.dataset.exerciseId = item.exerciseId;
    const setPrs = prSummary?.setPrsByExerciseId?.[item.exerciseId] || [];
    const exercisePrs = prSummary?.exercisePrsByExerciseId?.[item.exerciseId] || {};

    const lastSets = getLastPerformanceSetsForExercise(workouts, item.exerciseId, workout.id);
    const nextSetTemplate = lastSets && lastSets.length
      ? lastSets[item.sets.length] || lastSets[lastSets.length - 1]
      : null;
    const weightPreset = nextSetTemplate && Number.isFinite(nextSetTemplate.weight) ? String(nextSetTemplate.weight) : "";
    const repsPreset = nextSetTemplate && Number.isFinite(nextSetTemplate.reps) ? String(nextSetTemplate.reps) : "";
    const weightPlaceholder = weightPreset || "kg";
    const repsPlaceholder = repsPreset || "reps";

    const topRow = createNode("div", { className: "row space" });
    const titleWrap = createNode("div");
    const titleLine = createNode("div", { className: "row" });
    titleLine.style.gap = "8px";
    titleLine.style.alignItems = "center";
    titleLine.appendChild(createNode("div", { className: "label", text: exerciseName }));
    if (exercisePrs.volume) {
      titleLine.appendChild(createNode("span", { className: "badge mono", text: `${exercisePrs.volume.emoji} Volumen-PR` }));
    }
    titleWrap.appendChild(titleLine);
    titleWrap.appendChild(createNode("div", { className: "muted small mono", text: item.exerciseId }));
    const actionWrap = createNode("div", { className: "row" });
    actionWrap.style.gap = "8px";
    actionWrap.style.flexWrap = "wrap";
    const removeBtn = createNode("button", { className: "btn btn-ghost btn-xs", text: "Entfernen", attrs: { title: "Uebung entfernen" } });
    removeBtn.dataset.action = "remove-ex";
    actionWrap.appendChild(removeBtn);
    topRow.append(titleWrap, actionWrap);
    card.appendChild(topRow);

    if (lastSets && lastSets.length) {
      const lastBlock = createNode("div", { className: "mt" });
      lastBlock.appendChild(createNode("div", { className: "muted small", text: "Letztes Mal:" }));
      const pills = createNode("div", { className: "last-time-pills" });
      for (const set of lastSets.slice(0, 5)) {
        const weight = Number.isFinite(set.weight) ? set.weight : "-";
        const reps = Number.isFinite(set.reps) ? set.reps : "-";
        pills.appendChild(createNode("span", { className: "last-time-pill", text: `${weight} \u00D7 ${reps}` }));
      }
      lastBlock.appendChild(pills);
      if (exercisePrs.volume) {
        lastBlock.appendChild(createNode("div", {
          className: "muted small mt",
          text: `Volumen: ${exercisePrs.volume.currentVolume} statt ${exercisePrs.volume.previousVolume}`
        }));
      }
      card.appendChild(lastBlock);
    }

    const inputBlock = createNode("div", { className: "mt" });
    const inputRow = createNode("div", { className: "row" });
    inputRow.style.gap = "8px";
    inputRow.style.flexWrap = "wrap";
    const weightInput = createNode("input", { className: "input small w70", attrs: { inputmode: "decimal", placeholder: weightPlaceholder } });
    weightInput.dataset.field = "weight";
    weightInput.value = weightPreset;
    const repsInput = createNode("input", { className: "input small w70", attrs: { inputmode: "numeric", placeholder: repsPlaceholder } });
    repsInput.dataset.field = "reps";
    repsInput.value = repsPreset;
    const addSetBtn = createNode("button", { className: "btn btn-xs", text: "+ Set" });
    addSetBtn.dataset.action = "add-set";
    inputRow.append(weightInput, repsInput, addSetBtn);
    inputBlock.appendChild(inputRow);
    inputBlock.appendChild(createNode("div", { className: "muted small mt", text: "Tipp: kg und reps ausfuellen -> + Set." }));
    card.appendChild(inputBlock);

    const setsWrap = createNode("div", { className: "mt sets" });
    if (!item.sets.length) {
      setsWrap.appendChild(createNode("div", { className: "muted small", text: "Noch keine Sets." }));
    } else {
      for (const [idx, set] of item.sets.entries()) {
        const weight = Number.isFinite(set.weight) ? set.weight : "";
        const reps = Number.isFinite(set.reps) ? set.reps : "";
        const pr = setPrs[idx];
        const prLabel = pr ? ` ${pr.emoji} ${pr.shortLabel}` : "";

        const setRow = createNode("div", { className: "row space set-row" });
        setRow.appendChild(createNode("div", { className: "mono", text: `${idx + 1}.` }));
        setRow.appendChild(createNode("div", { className: "mono", text: `${weight} kg \u00D7 ${reps}${prLabel}` }));
        const deleteBtn = createNode("button", { className: "btn btn-danger btn-xs", text: "x", attrs: { title: "Set loeschen" } });
        deleteBtn.dataset.action = "del-set";
        deleteBtn.dataset.idx = String(idx);
        setRow.appendChild(deleteBtn);
        setsWrap.appendChild(setRow);
      }
    }

    card.appendChild(setsWrap);
    root.appendChild(card);
  }

  if (!workout.items.length) {
    root.appendChild(createNode("div", { className: "muted", text: "Keine Uebungen im Workout. Oben hinzufuegen." }));
  }
}

export function renderHistory(root, workouts, humanWorkoutTitle) {
  if (!root) return;
  clearElement(root);

  if (!workouts.length) {
    const emptyCard = createNode("div", { className: "card" });
    emptyCard.appendChild(createNode("div", { className: "muted", text: "Noch keine Workouts gespeichert." }));
    root.appendChild(emptyCard);
    return;
  }

  for (const workout of workouts) {
    const row = createNode("div", { className: "card" });
    const layout = createNode("div", { className: "row space" });
    const info = createNode("div");
    info.appendChild(createNode("div", { className: "label", text: humanWorkoutTitle(workout) }));
    info.appendChild(createNode("div", { className: "muted small mono", text: workout.id }));

    const actions = createNode("div", { className: "row" });
    actions.style.gap = "8px";
    actions.style.flexWrap = "wrap";
    const openBtn = createNode("button", { className: "btn btn-ghost btn-xs", text: "Oeffnen" });
    openBtn.dataset.action = "open";
    openBtn.dataset.id = workout.id;
    const deleteBtn = createNode("button", { className: "btn btn-danger btn-xs", text: "Loeschen" });
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = workout.id;
    actions.append(openBtn, deleteBtn);

    layout.append(info, actions);
    row.appendChild(layout);
    root.appendChild(row);
  }
}

function createSvgElement(tagName, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    el.setAttribute(key, String(value));
  }
  return el;
}

function createLineChart(series, stroke) {
  const svg = createSvgElement("svg", {
    viewBox: "0 0 320 140",
    class: "stats-chart-svg",
    role: "img",
    "aria-label": "Verlauf",
  });

  svg.appendChild(createSvgElement("line", { x1: 16, y1: 120, x2: 304, y2: 120, stroke: "rgba(255,255,255,0.12)" }));
  svg.appendChild(createSvgElement("line", { x1: 16, y1: 16, x2: 16, y2: 120, stroke: "rgba(255,255,255,0.12)" }));

  if (!series.length) return svg;

  const values = series.map((entry) => Number(entry.value) || 0);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = Math.max(1, maxValue - minValue);
  const points = series.map((entry, idx) => {
    const x = series.length === 1 ? 160 : 16 + (288 * idx) / (series.length - 1);
    const y = 120 - (((Number(entry.value) || 0) - minValue) / range) * 92;
    return { x, y };
  });

  const pathData = points.map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  svg.appendChild(createSvgElement("path", {
    d: pathData,
    fill: "none",
    stroke,
    "stroke-width": 3,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }));

  for (const point of points) {
    svg.appendChild(createSvgElement("circle", {
      cx: point.x,
      cy: point.y,
      r: 4,
      fill: stroke,
    }));
  }

  return svg;
}

function createDualAxisChart(weightSeries, volumeSeries) {
  const svg = createSvgElement("svg", {
    viewBox: "0 0 320 160",
    class: "stats-chart-svg",
    role: "img",
    "aria-label": "Topgewicht und Volumen Verlauf",
  });

  svg.appendChild(createSvgElement("line", { x1: 20, y1: 132, x2: 300, y2: 132, stroke: "rgba(255,255,255,0.12)" }));
  svg.appendChild(createSvgElement("line", { x1: 20, y1: 18, x2: 20, y2: 132, stroke: "rgba(90,167,255,0.18)" }));
  svg.appendChild(createSvgElement("line", { x1: 300, y1: 18, x2: 300, y2: 132, stroke: "rgba(74,222,128,0.18)" }));

  const count = Math.max(weightSeries.length, volumeSeries.length);
  if (!count) return svg;

  const weightValues = weightSeries.map((entry) => Number(entry.value) || 0);
  const volumeValues = volumeSeries.map((entry) => Number(entry.value) || 0);
  const weightMin = Math.min(...weightValues);
  const weightRange = Math.max(1, Math.max(...weightValues) - weightMin);
  const volumeMin = Math.min(...volumeValues);
  const volumeRange = Math.max(1, Math.max(...volumeValues) - volumeMin);

  const buildPoints = (series, min, range) => series.map((entry, idx) => {
    const x = count === 1 ? 160 : 20 + (280 * idx) / (count - 1);
    const y = 132 - (((Number(entry.value) || 0) - min) / range) * 96;
    return { x, y, value: Number(entry.value) || 0 };
  });

  const weightPoints = buildPoints(weightSeries, weightMin, weightRange);
  const volumePoints = buildPoints(volumeSeries, volumeMin, volumeRange);

  const buildPath = (points) => points.map((point, idx) => `${idx === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");

  svg.appendChild(createSvgElement("path", {
    d: buildPath(weightPoints),
    fill: "none",
    stroke: "rgba(90,167,255,1)",
    "stroke-width": 3,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }));
  svg.appendChild(createSvgElement("path", {
    d: buildPath(volumePoints),
    fill: "none",
    stroke: "rgba(74,222,128,1)",
    "stroke-width": 3,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  }));

  for (const point of weightPoints) {
    svg.appendChild(createSvgElement("circle", { cx: point.x, cy: point.y, r: 4, fill: "rgba(90,167,255,1)" }));
  }
  for (const point of volumePoints) {
    svg.appendChild(createSvgElement("circle", { cx: point.x, cy: point.y, r: 4, fill: "rgba(74,222,128,1)" }));
  }

  svg.appendChild(createSvgElement("text", { x: 20, y: 12, fill: "rgba(90,167,255,0.95)", "font-size": 10 }));
  svg.lastChild.textContent = `${Math.round(weightMin)}-${Math.round(weightMin + weightRange)} kg`;
  svg.appendChild(createSvgElement("text", { x: 212, y: 12, fill: "rgba(74,222,128,0.95)", "font-size": 10 }));
  svg.lastChild.textContent = `${Math.round(volumeMin)}-${Math.round(volumeMin + volumeRange)} Vol`;

  return svg;
}

function renderSessionComparison(detail) {
  const wrap = createNode("div", { className: "stats-compare-wrap mt" });
  const best = Math.max(1, Number(detail.bestSessionVolume) || 0);
  const latest = Number(detail.lastSessionVolume) || 0;
  const latestPct = Math.max(12, (latest / best) * 100);
  const delta = latest - best;

  const latestRow = createNode("div", { className: "stats-compare-row" });
  latestRow.appendChild(createNode("div", { className: "label", text: "Letzte Session" }));
  latestRow.appendChild(createNode("div", { className: "mono", text: String(Math.round(latest)) }));
  const latestBar = createNode("div", { className: "stats-compare-bar is-latest" });
  latestBar.style.width = `${Math.min(100, latestPct)}%`;

  const bestRow = createNode("div", { className: "stats-compare-row mt" });
  bestRow.appendChild(createNode("div", { className: "label", text: "Bester Wert" }));
  bestRow.appendChild(createNode("div", { className: "mono", text: String(Math.round(best)) }));
  const bestBar = createNode("div", { className: "stats-compare-bar is-best" });
  bestBar.style.width = "100%";

  wrap.append(latestRow, latestBar, bestRow, bestBar);
  wrap.appendChild(createNode("div", {
    className: "muted small mt",
    text: delta === 0 ? "Letzte Session entspricht dem Bestwert." : delta > 0 ? `Neue Session liegt ${Math.round(delta)} ueber dem alten Bestwert.` : `Zur Bestleistung fehlen ${Math.round(Math.abs(delta))}.`
  }));
  return wrap;
}

export function fillStatsExerciseSelect(select, activeExerciseStats, selectedExerciseId, exerciseNameById) {
  if (!select) return;
  clearElement(select);

  if (!activeExerciseStats.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Keine aktiven Uebungen";
    select.appendChild(option);
    select.disabled = true;
    return;
  }

  select.disabled = false;
  for (const stat of activeExerciseStats) {
    const option = document.createElement("option");
    option.value = stat.exerciseId;
    option.textContent = exerciseNameById(stat.exerciseId);
    option.selected = stat.exerciseId === selectedExerciseId;
    select.appendChild(option);
  }
}

export function renderStatsOverview(root, activeExerciseStats, selectedExerciseId, exerciseNameById) {
  if (!root) return;
  clearElement(root);

  if (!activeExerciseStats.length) {
    root.appendChild(createNode("div", { className: "card muted", text: "Noch keine aktiven Uebungen mit mindestens 3 Sessions." }));
    return;
  }

  for (const stat of activeExerciseStats) {
    const card = createNode("button", {
      className: `card stats-overview-card${stat.exerciseId === selectedExerciseId ? " is-selected" : ""}`,
    });
    card.type = "button";
    card.dataset.action = "select-stats-exercise";
    card.dataset.exerciseId = stat.exerciseId;

    const topRow = createNode("div", { className: "row space" });
    topRow.appendChild(createNode("div", { className: "label", text: exerciseNameById(stat.exerciseId) }));
    topRow.appendChild(createNode("span", { className: "badge mono", text: `${stat.sessionCount} Sessions` }));

    const metrics = createNode("div", { className: "stats-overview-metrics mt" });
    metrics.appendChild(createNode("div", { className: "stats-overview-value mono", text: `${stat.topWeight} kg` }));
    metrics.appendChild(createNode("div", { className: "muted small", text: `Topgewicht / Volumen ${Math.round(stat.bestSessionVolume)}` }));

    const footer = createNode("div", { className: "row space mt" });
    footer.appendChild(createNode("div", { className: "muted small mono", text: stat.lastWorkoutDate || "-" }));
    footer.appendChild(createNode("span", { className: "stats-status-badge", text: stat.statusLabel }));

    card.append(topRow, metrics, footer);
    root.appendChild(card);
  }
}

export function renderStatsDetail(root, detail, exerciseName) {
  if (!root) return;
  clearElement(root);

  if (!detail) {
    root.appendChild(createNode("div", { className: "card muted", text: "Waehle eine aktive Uebung, um Statistikdaten zu sehen." }));
    return;
  }

  const kpiCard = createNode("div", { className: "card" });
  kpiCard.appendChild(createNode("div", { className: "label", text: exerciseName }));
  const kpiGrid = createNode("div", { className: "stats-kpi-grid mt" });
  const kpis = [
    { label: "Topgewicht", value: `${detail.topWeight} kg` },
    { label: "Bestes Volumen", value: String(Math.round(detail.bestSessionVolume)) },
    { label: "Letzte Session", value: detail.lastWorkoutDate || "-" },
    { label: "Sessions", value: String(detail.sessionCount) },
  ];
  for (const item of kpis) {
    const tile = createNode("div", { className: "stats-kpi-tile" });
    tile.appendChild(createNode("div", { className: "label", text: item.label }));
    tile.appendChild(createNode("div", { className: "stats-kpi-value mono", text: item.value }));
    kpiGrid.appendChild(tile);
  }
  kpiCard.appendChild(kpiGrid);

  const chartGrid = createNode("div", { className: "stats-chart-grid mt" });

  const topWeightCard = createNode("div", { className: "card" });
  topWeightCard.appendChild(createNode("div", { className: "label", text: "Leistungs-Verlauf" }));
  const legend = createNode("div", { className: "row mt" });
  legend.appendChild(createNode("span", { className: "stats-legend-item stats-legend-weight", text: "Topgewicht" }));
  legend.appendChild(createNode("span", { className: "stats-legend-item stats-legend-volume", text: "Volumen" }));
  topWeightCard.appendChild(legend);
  topWeightCard.appendChild(createDualAxisChart(detail.topWeightSeries, detail.volumeSeries));
  chartGrid.appendChild(topWeightCard);

  const volumeCard = createNode("div", { className: "card" });
  volumeCard.appendChild(createNode("div", { className: "label", text: "Session-Vergleich" }));
  volumeCard.appendChild(renderSessionComparison(detail));
  chartGrid.appendChild(volumeCard);

  const sessionsCard = createNode("div", { className: "card mt" });
  sessionsCard.appendChild(createNode("div", { className: "label", text: "Letzte Sessions" }));
  const sessionList = createNode("div", { className: "stats-session-list mt" });
  for (const session of detail.recentSessions) {
    const row = createNode("div", { className: "row space stats-session-row" });
    row.appendChild(createNode("div", { className: "mono small", text: session.date }));
    row.appendChild(createNode("div", { className: "mono small", text: `${session.topWeight} kg x ${session.topReps}` }));
    row.appendChild(createNode("div", { className: "mono small", text: `Vol ${Math.round(session.sessionVolume)}` }));
    sessionList.appendChild(row);
  }
  sessionsCard.appendChild(sessionList);

  const insightsCard = createNode("div", { className: "card mt" });
  insightsCard.appendChild(createNode("div", { className: "label", text: "Trainingsmuster" }));
  const insightGrid = createNode("div", { className: "stats-insight-grid mt" });
  const patterns = [
    { label: "Sessions / Monat", value: detail.avgSessionsPerMonth.toFixed(1) },
    { label: "Volumen Schnitt (5)", value: Math.round(detail.avgRecentVolume) },
    { label: "Letztes Training", value: detail.daysSinceLastSession == null ? "-" : `${detail.daysSinceLastSession} Tage` },
  ];
  for (const item of patterns) {
    const tile = createNode("div", { className: "stats-kpi-tile" });
    tile.appendChild(createNode("div", { className: "label", text: item.label }));
    tile.appendChild(createNode("div", { className: "stats-kpi-value mono", text: String(item.value) }));
    insightGrid.appendChild(tile);
  }
  insightsCard.appendChild(insightGrid);

  const insightList = createNode("div", { className: "stats-insight-list mt" });
  for (const text of detail.insights || []) {
    insightList.appendChild(createNode("div", { className: "stats-insight-item", text }));
  }
  insightsCard.appendChild(insightList);

  root.append(kpiCard, chartGrid, sessionsCard, insightsCard);
}
