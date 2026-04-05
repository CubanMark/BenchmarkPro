import { clearElement, createNode } from "./ui.js";

export function renderExercises(root, exercises) {
  if (!root) return;
  clearElement(root);

  const sorted = [...exercises].sort((a, b) => a.name.localeCompare(b.name, "de"));
  for (const exercise of sorted) {
    const pill = createNode("div", { className: "pill" });
    const content = createNode("div");
    const alias = exercise.aliases && exercise.aliases.length ? ` · aliases: ${exercise.aliases.join(", ")}` : "";
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
    const deleteBtn = createNode("button", { className: "btn btn-danger", text: "Löschen" });
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
    exercisesWrap.appendChild(createNode("div", { className: "label", text: "Übungen (eine pro Zeile)" }));
    const exercisesInput = createNode("textarea", { className: "mt" });
    exercisesInput.dataset.field = "exercises";
    exercisesInput.dataset.id = plan.id;
    exercisesInput.value = planToTextarea(plan, exercises);
    exercisesWrap.appendChild(exercisesInput);
    exercisesWrap.appendChild(createNode("div", {
      className: "muted small mt",
      text: "Tipp: Frei tippen. Unbekannte Übungen werden automatisch als neue Exercise angelegt."
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
    option.textContent = "Übung wählen...";
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
    titleWrap.appendChild(createNode("div", { className: "label", text: exerciseName }));
    titleWrap.appendChild(createNode("div", { className: "muted small mono", text: item.exerciseId }));
    const actionWrap = createNode("div", { className: "row" });
    actionWrap.style.gap = "8px";
    actionWrap.style.flexWrap = "wrap";
    const removeBtn = createNode("button", { className: "btn btn-ghost btn-xs", text: "Entfernen", attrs: { title: "Übung entfernen" } });
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
    inputBlock.appendChild(createNode("div", { className: "muted small mt", text: "Tipp: kg und reps ausfüllen -> + Set." }));
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
        const deleteBtn = createNode("button", { className: "btn btn-danger btn-xs", text: "x", attrs: { title: "Set löschen" } });
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
    root.appendChild(createNode("div", { className: "muted", text: "Keine Übungen im Workout. Oben hinzufügen." }));
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
    const openBtn = createNode("button", { className: "btn btn-ghost btn-xs", text: "Öffnen" });
    openBtn.dataset.action = "open";
    openBtn.dataset.id = workout.id;
    const deleteBtn = createNode("button", { className: "btn btn-danger btn-xs", text: "Löschen" });
    deleteBtn.dataset.action = "delete";
    deleteBtn.dataset.id = workout.id;
    actions.append(openBtn, deleteBtn);

    layout.append(info, actions);
    row.appendChild(layout);
    root.appendChild(row);
  }
}
