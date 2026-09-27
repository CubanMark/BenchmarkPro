/**
 * Bildschirme v5. Jede Funktion bekommt den Kontext { state, ui, dayMap } und liefert HTML.
 * Interaktion läuft über data-action-Attribute (siehe app.js).
 */
import { AREAS, LOCATIONS, SPORTS, SNACKS, areaName, weightSteps } from "./library.js";
import {
  todayKey, mondayOf, addDays, isoWeek, weekSummary, areaCounts, daysSinceArea, exerciseById, exerciseName,
  exerciseSessions, suggest, snackById, fmtKg, counts, rawPoints, parseKey,
} from "./engine.js";
import { ring, paiRing, paiWeekBars, heatmap, hmLegend, bodySvg, lineChart, esc, fmtDate, WD } from "./charts.js";
import { APP_VERSION, DATA_VERSION, STORAGE_KEY } from "./version.js";

const checkSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const num = (n) => String(Math.round(Number(n) * 100) / 100).replace(".", ",");

function typeChip(type) {
  if (type === "mobility") return '<span class="chip m">Mobility</span>';
  if (type === "sport") return '<span class="chip s">Sport</span>';
  if (type === "workout") return '<span class="chip k">Workout</span>';
  return '<span class="chip k">Kraft-Snack</span>';
}
function pts(n) { return `+${n} ${n === 1 ? "Punkt" : "Punkte"}`; }
function back(action, label = "Zurück", extra = "") {
  return `<button class="link small back" data-action="${action}" ${extra}>${label}</button>`;
}

/* ================= Heute ================= */
export function home({ state, ui, dayMap }) {
  const s = state.settings;
  const w = weekSummary(state, dayMap);
  const need = Math.max(0, s.weeklyGoal - w.total);
  const needK = Math.max(0, s.strengthMin - w.k);
  const today = todayKey();
  const active = state.meta.activeWorkoutId ? state.workouts.find((x) => x.id === state.meta.activeWorkoutId) : null;
  const todayDay = dayMap.get(today);

  const paiDay = ui.paiDay || today;
  let strip = '<div class="weekstrip">';
  for (const { key, day } of w.days) {
    const dots = [
      ...(day?.workouts || []).map((x) => `<span class="dot ${x.type === "mobility" ? "m" : "k"}"></span>`),
      ...(day?.sports || []).map(() => '<span class="dot s"></span>'),
    ].join("");
    const future = key > today;
    strip += `<button class="wd${key === today ? " today" : ""}${key === paiDay ? " sel" : ""}" data-action="pai-day" data-day="${key}" ${future ? "disabled" : ""} aria-label="${esc(fmtDate(key))}: PAI eintragen"><span>${WD[parseKey(key).getDay()]}</span><span class="pts${day?.total ? "" : " zero"}">${day?.total || "·"}</span><span class="dots">${dots}</span><span class="pai">${day?.pai ?? ""}</span></button>`;
  }
  strip += "</div>";

  let status;
  if (w.goalMet) status = "<b>Wochenziel geschafft.</b>";
  else if (need === 0 && needK > 0) status = `Punkte reichen, es fehlen noch <b>${needK}</b> Kraftpunkte.`;
  else if (needK >= need) status = `Noch <b>${needK}</b> ${needK === 1 ? "Kraftpunkt" : "Kraftpunkte"}.`;
  else status = `Noch <b>${need}</b> ${need === 1 ? "Punkt" : "Punkte"}${needK ? `, davon ${needK} Kraft` : ""}.`;
  const paiGoal = s.paiGoal || 100;
  const paiStatus = w.pai >= paiGoal ? "<b>Ziel geschafft.</b>" : `Noch <b>${paiGoal - w.pai}</b> PAI.`;
  const backup = backupDue(state);

  const reminder = ui.reminderDue && !todayDay?.total
    ? `<div class="banner"><span>Heute noch keine Einheit. 5 Minuten reichen.</span><button class="link" data-action="go" data-view="energy">Snack starten</button></div>` : "";

  return `
  ${active ? `<div class="banner accent"><span><b>${esc(active.name || "Einheit")}</b> läuft noch.</span><button class="link" data-action="resume">Fortsetzen</button></div>` : ""}
  ${reminder}
  ${backup ? `<div class="banner"><span>${esc(backup)}</span><button class="link" data-action="backup">Jetzt sichern</button></div>` : ""}
  <div class="card">
    <div class="row between"><span class="eyebrow">Diese Woche · KW ${isoWeek(today)}</span><span class="small muted">${esc(fmtDate(today))}</span></div>
    <div class="tworings">
      <div>${ring(w.k, w.m, s.weeklyGoal, 118)}<div class="cap"><span><span class="dot k"></span> Kraft ${w.k}</span><span><span class="dot m"></span> Mobility ${w.m}</span></div><div class="st">${status}</div></div>
      <div>${paiRing(w.pai, paiGoal)}<div class="cap"><span><span class="dot s"></span> Bewegung</span></div><div class="st">${paiStatus}</div></div>
    </div>
    ${strip}
    ${paiForm(paiDay, dayMap)}
  </div>
  <button class="btn primary big" data-action="go" data-view="energy">Snack starten</button>
  <div class="btn-row"><button class="btn" data-action="go" data-view="workouts">Workout starten</button><button class="btn" data-action="sport">Sport eintragen</button></div>
  <div class="card stack">
    <div class="row between"><h3>Letzte 12 Wochen</h3><button class="link small" data-action="tab" data-tab="history">Alles ansehen</button></div>
    ${heatmap(dayMap, 12)}${hmLegend}
  </div>`;
}

/** Eingabe für den Tages-PAI aus der Uhr. */
function paiForm(key, dayMap) {
  const v = dayMap.get(key)?.pai;
  return `<form class="paiin" id="paiForm">
    <input id="paiDate" type="date" class="input" value="${esc(key)}" max="${todayKey()}" aria-label="Tag">
    <input id="paiVal" type="number" class="input" inputmode="numeric" min="0" max="300" value="${v ?? ""}" placeholder="PAI" aria-label="Tages-PAI an diesem Tag">
    <button type="submit" class="btn sport-btn">Speichern</button>
  </form>`;
}

/** Hinweistext, wenn das letzte Backup eine Woche oder länger her ist. Sonst null. */
export function backupDue(state) {
  if (!state.workouts.length) return null;
  const last = state.meta?.lastBackupAt;
  if (!last) return "Noch kein Backup gesichert.";
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 864e5);
  return days >= 7 ? `Letztes Backup vor ${days} Tagen.` : null;
}

/* ================= Tagesform ================= */
export function energy({ state, ui }) {
  const sportToday = (state.activities || []).some((a) => a.date === todayKey());
  const sport = ui.ctx.sport ?? sportToday;
  const place = ui.ctx.place || state.meta.lastPlace || "keller";
  const placeBtn = (id, label) => `<button data-action="place" data-place="${id}" aria-pressed="${place === id}">${label}</button>`;
  const placeText = { keller: "Alles, was im Keller steht.", home: "Wohnzimmer: ohne Hanteln und Bank, Bänder gehen.", away: "Büro oder unterwegs: ganz ohne Equipment." }[place];
  return `
  ${back("go", "Zurück", 'data-view="home"')}
  <div><span class="eyebrow">Snack starten</span><h2>Wo bist du?</h2></div>
  <div class="stack gap6">
    <div class="seg seg3" role="group" aria-label="Ort">${placeBtn("keller", "Keller")}${placeBtn("home", "Zuhause")}${placeBtn("away", "Unterwegs")}</div>
    <span class="small muted">${placeText}</span>
    <div class="ctx"><button class="toggle" data-action="ctx" data-key="sport" aria-pressed="${sport}">Heute schon Sport gehabt</button></div>
  </div>
  <h2>Wie fit bist du gerade?</h2>
  <div class="energy">
    <button data-action="energy" data-energy="1"><span class="lvl">1</span><span><h3>Platt</h3><span class="small muted">5 bis 6 Minuten, locker</span></span></button>
    <button data-action="energy" data-energy="2"><span class="lvl">2</span><span><h3>Okay</h3><span class="small muted">Normaler Kraftsnack, 6 bis 10 Minuten</span></span></button>
    <button data-action="energy" data-energy="3"><span class="lvl">3</span><span><h3>Fit</h3><span class="small muted">Längerer Kraftsnack, gerne mit Hanteln</span></span></button>
  </div>
  <button class="link" data-action="go" data-view="areas">Selbst aussuchen statt Vorschlag</button>`;
}

function snackCard(c, main, ui) {
  const label = c.isNew ? "Neu ausprobieren" : main ? (ui.pick && ui.pick !== ui.suggestions?.[0]?.id ? "Deine Auswahl" : "Vorschlag für jetzt") : "";
  if (!main) {
    return `<button class="alt" data-action="pick" data-id="${esc(c.id)}"><span><h3>${esc(c.title)}</h3><span class="small muted">${esc(c.area === "ganzkoerper" ? "Ganzkörper" : areaName(c.area))} · ${c.minutes} min · +${c.points}</span></span>${c.isNew ? '<span class="chip new">Neu</span>' : typeChip(c.type)}</button>`;
  }
  return `<div class="card sug stack gap6">
    <span class="eyebrow">${label}</span>
    <h2>${esc(c.title)}</h2>
    <div class="row wrap gap6">${typeChip(c.type)}<span class="chip">${esc(c.area === "ganzkoerper" ? "Ganzkörper" : areaName(c.area))}</span><span class="chip">${c.minutes} min</span><span class="chip">${esc(LOCATIONS[c.loc] || "")}</span><span class="chip">${pts(c.points)}</span></div>
    <div class="small muted">${c.exercises.map(esc).join(" · ")}</div>
    <div class="why">${c.reasons.map(([a, b]) => `<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>
    ${c.capped ? '<div class="small muted">Heute hast du das Punktelimit schon erreicht. Trainieren lohnt sich trotzdem.</div>' : ""}
    <button class="btn primary" data-action="start" data-kind="${c.kind}" data-id="${esc(c.kind === "new" ? c.exerciseId : c.id)}">Los geht's</button>
  </div>`;
}

export function suggestView({ state, ui, dayMap }) {
  const list = ui.suggestions || [];
  if (!list.length) {
    return `${back("go", "Zurück", 'data-view="energy"')}<div class="card"><h3>Kein passender Snack gefunden</h3><p class="muted small">Probier eine andere Tagesform oder such dir selbst etwas aus.</p></div><button class="btn" data-action="go" data-view="areas">Selbst aussuchen</button>`;
  }
  const main = list.find((c) => c.id === ui.pick) || list[0];
  const others = list.filter((c) => c !== main);
  return `${back("go", "Zurück", 'data-view="energy"')}
  ${snackCard(main, true, ui)}
  <div class="stack gap8"><span class="eyebrow">${main === list[0] ? "Oder lieber" : "Andere Optionen"}</span>${others.map((c) => snackCard(c, false, ui)).join("")}</div>`;
}

/* ================= Selbst aussuchen ================= */
export function areasView({ state, ui }) {
  const today = todayKey();
  const cnt = areaCounts(state, mondayOf(today), today);
  if (ui.area) {
    const snacks = SNACKS.filter((s) => s.area === ui.area);
    return `${back("area", "Alle Bereiche", 'data-area=""')}
    <h2>${esc(areaName(ui.area))}</h2>
    <div class="stack gap8">${snacks.map((s) => {
      const blocked = s.items.some((i) => exerciseById(state, i.exerciseId)?.rating === "no");
      return `<button class="alt" data-action="preview" data-id="${s.id}" ${blocked ? 'aria-disabled="true"' : ""}><span><h3>${esc(s.name)}</h3><span class="small muted">${s.items.map((i) => esc(exerciseName(state, i.exerciseId))).join(" · ")}</span><br><span class="small muted">${s.minutes} min · ${esc(LOCATIONS[s.loc])}</span></span>${typeChip(s.type === "mobility" ? "mobility" : "snack")}</button>`;
    }).join("")}</div>`;
  }
  return `${back("go", "Zurück", 'data-view="energy"')}
  <h2>Was willst du trainieren?</h2>
  <div class="areas">${AREAS.map((a) => {
    const c = cnt[a.id] || 0;
    const sub = a.id === "mobility" ? `${c} ${c === 1 ? "Einheit" : "Einheiten"} diese Woche` : a.target ? `${c} von ${a.target} Sätzen diese Woche` : `${c} Sätze diese Woche`;
    return `<button data-action="area" data-area="${a.id}"><h3>${a.name}</h3><small>${sub}</small></button>`;
  }).join("")}</div>`;
}

export function previewView({ state, ui }) {
  const s = snackById(ui.previewId);
  if (!s) return areasView({ state, ui });
  const since = daysSinceArea(state, s.area);
  const today = todayKey();
  const cnt = areaCounts(state, mondayOf(today), today)[s.area] || 0;
  const area = AREAS.find((a) => a.id === s.area);
  const c = {
    kind: "snack", id: s.id, title: s.name, area: s.area, type: s.type, minutes: s.minutes, loc: s.loc,
    points: s.type === "mobility" ? state.settings.points.mobility : state.settings.points.snack,
    exercises: s.items.map((i) => exerciseName(state, i.exerciseId)),
    reasons: [
      [area.name, s.area === "mobility" ? `${cnt} Einheiten diese Woche` : area.target ? `${cnt} von ${area.target} Sätzen diese Woche` : `${cnt} Sätze diese Woche`],
      ["Zuletzt", since == null ? "noch nie trainiert" : since === 0 ? "heute schon trainiert" : `vor ${since} ${since === 1 ? "Tag" : "Tagen"} trainiert`],
    ],
  };
  return `${back("area", "Zurück", `data-area="${s.area}"`)}${snackCard(c, true, { ...ui, pick: "x" })}`;
}

/* ================= Workout starten ================= */
export function workoutsView({ state }) {
  const last = (planId) => {
    const ds = state.workouts.filter((w) => w.planId === planId && counts(state, w)).map((w) => w.date).sort();
    if (!ds.length) return "noch nie";
    const d = Math.round((parseKey(todayKey()) - parseKey(ds[ds.length - 1])) / 864e5);
    return d === 0 ? "heute" : `vor ${d} ${d === 1 ? "Tag" : "Tagen"}`;
  };
  return `${back("go", "Zurück", 'data-view="home"')}<h2>Workout starten</h2>
  <div class="stack gap8">${state.plans.map((p) => `<button class="alt" data-action="start" data-kind="plan" data-id="${esc(p.id)}"><span><h3>${esc(p.name)}</h3><span class="small muted">${p.exerciseIds.map((id) => esc(exerciseName(state, id))).join(" · ") || "Noch keine Übungen"}</span><br><span class="small muted">Zuletzt ${last(p.id)}</span></span><span class="chip k">+${state.settings.points.workout}</span></button>`).join("")}
  <button class="alt" data-action="start" data-kind="free" data-id=""><span><h3>Freie Einheit</h3><span class="small muted">Übungen selbst zusammenstellen, auch unterwegs ergänzen</span></span><span class="chip k">+${state.settings.points.workout}</span></button></div>
  <button class="link small" data-action="go" data-view="plans">Pläne bearbeiten</button>`;
}

/* ================= Durchführung ================= */
function stepper(id, field, valueHtml, label) {
  return `<div class="step"><button data-action="adj" data-id="${id}" data-field="${field}" data-dir="-1" aria-label="${label} weniger">−</button><span>${valueHtml}</span><button data-action="adj" data-id="${id}" data-field="${field}" data-dir="1" aria-label="${label} mehr">+</button></div>`;
}

export function runView({ state, ui }) {
  const w = state.workouts.find((x) => x.id === state.meta.activeWorkoutId);
  if (!w) return home(arguments[0]);
  const isPast = w.date !== todayKey();
  let h = `<div class="row between">${back("cancel", w.finished ? "Schließen" : "Abbrechen")}<span class="chip">${w.minutes ? `${w.minutes} min` : isPast ? esc(fmtDate(w.date)) : "offen"}</span></div>
  <div><span class="eyebrow">${w.type === "workout" ? "Workout" : w.type === "mobility" ? "Mobility" : "Kraft-Snack"}</span><h2>${esc(w.name || "Einheit")}</h2></div>`;

  if (w.tryExerciseId) {
    const ex = exerciseById(state, w.tryExerciseId);
    if (ex?.hint) h += `<div class="hint">${esc(ex.hint)}</div>`;
  }

  if (!w.items.length) {
    h += `<div class="card stack center pad-l"><h3>Noch keine Übung</h3><span class="small muted">Stell dir dein Training zusammen. Gewicht und Wiederholungen werden aus deinem letzten Mal vorbefüllt.</span></div>`;
  }

  w.items.forEach((item, xi) => {
    const ex = exerciseById(state, item.exerciseId);
    if (!ex) return;
    if (ex.kind === "task") {
      h += `<div class="card task-row${item.done ? " done" : ""}"><span><h3>${esc(ex.name)}</h3>${item.detail ? `<span class="small muted">${esc(item.detail)}</span>` : ""}${ex.hint ? `<span class="small muted block">${esc(ex.hint)}</span>` : ""}</span><button class="chk" data-action="task" data-x="${xi}" aria-label="${esc(ex.name)} erledigt" aria-pressed="${!!item.done}">${checkSvg}</button></div>`;
      return;
    }
    const rows = item.rows || [];
    const unit = ex.kind === "time" ? "s" : "Wdh.";
    h += `<div class="card ex"><div class="row between"><h3>${esc(ex.name)}</h3><span class="row gap6"><span class="small muted">${rows.length} ${rows.length === 1 ? "Satz" : "Sätze"}</span><button class="icon-btn" data-action="remove-ex" data-x="${xi}" aria-label="${esc(ex.name)} entfernen">×</button></span></div>`;
    if (item.hint) h += `<div class="hint${item.hold ? " hold" : ""}">${esc(item.hint)}</div>`;
    rows.forEach((r, si) => {
      const id = `${xi}-${si}`;
      let wHtml;
      if (ex.kind !== "weight") wHtml = `<div class="step one"><span class="small muted">${ex.eq === "band" ? "Band" : "Körpergewicht"}</span></div>`;
      else if (ex.eq === "kb") wHtml = `<div class="step one"><span>${num(r.weight)}<small>kg</small></span></div>`;
      else wHtml = stepper(id, "weight", r.weight ? `${num(r.weight)}<small>kg</small>` : `<small class="muted">ohne</small>`, "Gewicht");
      h += `<div class="set${r.done ? " done" : ""}"><span class="n">${si + 1}</span>${wHtml}${stepper(id, "reps", `${r.reps}<small>${unit}</small>`, "Wiederholungen")}<button class="chk" data-action="set" data-id="${id}" aria-label="Satz ${si + 1} erledigt" aria-pressed="${!!r.done}">${checkSvg}</button></div>`;
    });
    h += `<button class="link small" data-action="add-set" data-x="${xi}">+ Satz hinzufügen</button></div>`;
  });

  h += `<button class="btn dashed" data-action="go" data-view="picker">+ Übung hinzufügen</button>`;
  h += `<label class="small muted stack gap4" for="runNotes">Notiz<textarea id="runNotes" data-action-input="notes" rows="2" placeholder="Optional">${esc(w.notes || "")}</textarea></label>`;
  const anyDone = w.items.some((i) => i.sets?.length || i.done);
  h += `<button class="btn primary" data-action="finish" ${anyDone ? "" : "disabled"}>${w.finished ? "Speichern" : "Fertig"}</button>`;
  if (!anyDone) h += `<span class="small muted center">Hake mindestens einen Satz ab, dann kannst du abschließen.</span>`;
  if (ui.timer != null) h += `<div class="timer"><span>Pause</span><span class="t" id="tval">${Math.floor(ui.timer / 60)}:${String(ui.timer % 60).padStart(2, "0")}</span><button class="link" data-action="skip-timer">Überspringen</button></div>`;
  return h;
}

/* ================= Übung hinzufügen ================= */
export function pickerView({ state, ui }) {
  const w = state.workouts.find((x) => x.id === state.meta.activeWorkoutId);
  const inW = new Set((w?.items || []).map((i) => i.exerciseId));
  const q = (ui.q || "").toLowerCase().trim();
  const today = todayKey();
  const cnt = areaCounts(state, mondayOf(today), today);
  const low = new Set(AREAS.filter((a) => a.target && (cnt[a.id] || 0) / a.target < 0.5).map((a) => a.id));
  const list = state.exercises.filter((e) => (q ? (e.name.toLowerCase().includes(q) || (e.aliases || []).some((a) => a.toLowerCase().includes(q)) || areaName(e.area).toLowerCase().includes(q)) : e.rating !== "no"));
  const groups = [...AREAS.map((a) => a.id), "sonstiges"].map((id) => [id, list.filter((e) => (e.area || "sonstiges") === id)]).filter(([, l]) => l.length);
  const lastTxt = (e) => {
    const s = exerciseSessions(state, e.id, w?.id)[0];
    if (!s) return e.rating == null ? "Noch nie gemacht" : "Noch nicht erfasst";
    const d = Math.round((parseKey(today) - parseKey(s.date)) / 864e5);
    const top = Math.max(...s.sets.map((x) => Number(x.weight) || 0));
    return `vor ${d} ${d === 1 ? "Tag" : "Tagen"} · ${s.sets.length} × ${Math.max(...s.sets.map((x) => x.reps))}${top ? ` mit ${fmtKg(top)}` : ""}`;
  };
  return `${back("go", "Zurück zum Training", 'data-view="run"')}<h2>Übung hinzufügen</h2>
  <input id="q" type="search" class="input" placeholder="Suchen, z. B. Rudern" value="${esc(ui.q || "")}" autocomplete="off" data-action-input="search">
  ${groups.map(([a, ls]) => `<div class="stack gap6"><div class="row between"><span class="eyebrow">${esc(areaName(a))}</span>${low.has(a) ? '<span class="chip warn">diese Woche wenig</span>' : ""}</div>
    ${ls.sort((x, y) => (y.rating === "love") - (x.rating === "love") || x.name.localeCompare(y.name, "de")).map((e) => `<button class="alt" data-action="add-ex" data-id="${esc(e.id)}" ${inW.has(e.id) ? "disabled" : ""}><span><h3>${esc(e.name)}</h3><span class="small muted">${esc(lastTxt(e))} · ${esc(LOCATIONS[e.loc] || "")}</span></span><span class="chip${e.rating == null ? " new" : ""}">${inW.has(e.id) ? "drin" : e.rating == null ? "neu" : "+"}</span></button>`).join("")}</div>`).join("") || '<p class="muted">Keine Übung gefunden.</p>'}
  <div class="card stack gap8"><h3>Neue Übung anlegen</h3>
    <input id="newExName" class="input" placeholder="Name der Übung" value="${esc(ui.q || "")}">
    <div class="row gap8 wrap"><select id="newExArea" class="input">${AREAS.map((a) => `<option value="${a.id}">${a.name}</option>`).join("")}</select>
    <select id="newExEq" class="input"><option value="lh">Langhantel</option><option value="kh2">Zwei Kurzhanteln</option><option value="kh1">Eine Kurzhantel</option><option value="kb">Kettlebell</option><option value="band">Band</option><option value="none">Körpergewicht</option></select></div>
    <button class="btn" data-action="create-ex">Anlegen und hinzufügen</button></div>`;
}

/* ================= Abschluss ================= */
export function doneView({ state, ui, dayMap }) {
  const w = state.workouts.find((x) => x.id === ui.doneId);
  if (!w) return home(arguments[0]);
  const s = state.settings;
  const wk = weekSummary(state, dayMap);
  const g = ui.gain ?? 0;
  const tryEx = w.tryExerciseId ? exerciseById(state, w.tryExerciseId) : null;
  return `<div class="card stack center gap6 pad-l">
    <span class="eyebrow">${esc(w.name || "Einheit")} erledigt</span>
    <div class="bignum pop">+${g}</div><div class="muted">${g === 1 ? "Punkt" : "Punkte"} für heute${g === 0 && ui.capped ? " (Tageslimit erreicht)" : ""}</div>
    <div class="mt8">${ring(wk.k, wk.m, s.weeklyGoal, 150)}</div>
    <div class="small">${wk.goalMet ? "<b>Wochenziel geschafft.</b>" : `Noch ${Math.max(0, s.weeklyGoal - wk.total)} bis zum Wochenziel.`}</div>
  </div>
  ${(ui.records || []).map((r) => `<div class="pr"><span class="medal">REKORD</span><span>${esc(r.text)}</span></div>`).join("")}
  ${tryEx && tryEx.rating == null ? `<div class="card stack gap8"><h3>Wie fandest du ${esc(tryEx.name)}?</h3><div class="rate">${[["love", "Mag ich"], ["ok", "Okay"], ["no", "Nein"]].map(([v, l]) => `<button data-action="rate" data-id="${esc(tryEx.id)}" data-v="${v}">${l}</button>`).join("")}</div></div>` : ""}
  <div class="card stack"><h3>Dein Kalender</h3>${heatmap(dayMap, 4)}</div>
  <button class="btn" data-action="tab" data-tab="home">Zurück zu Heute</button>`;
}

/* ================= Verlauf ================= */
export function historyView({ state, ui, dayMap }) {
  const key = ui.selDay || todayKey();
  const o = dayMap.get(key);
  const dayWorkouts = state.workouts.filter((w) => w.date === key && w.id !== state.meta.activeWorkoutId);
  const daySports = (state.activities || []).filter((a) => a.date === key);
  const entries = [
    ...dayWorkouts.map((w) => {
      const c = counts(state, w);
      const p = rawPoints(state, w);
      const sets = w.items.reduce((n, i) => n + (i.sets?.length || 0), 0);
      return `<div class="entry">${typeChip(w.type)}<span>${esc(w.name || planName(state, w))}<br><span class="small muted">${w.type === "mobility" ? `${w.items.filter((i) => i.done).length} Übungen` : `${sets} ${sets === 1 ? "Satz" : "Sätze"}`}${c ? "" : " · leer, zählt nicht"}</span></span><span class="row gap6"><span class="pts-badge">${c ? "+" + (p.k + p.m) : "·"}</span><button class="icon-btn" data-action="open-w" data-id="${esc(w.id)}" aria-label="Bearbeiten">✎</button><button class="icon-btn" data-action="del-w" data-id="${esc(w.id)}" aria-label="Löschen">×</button></span></div>`;
    }),
    ...daySports.map((a) => `<div class="entry">${typeChip("sport")}<span>${esc(a.kind)}<br><span class="small muted">${a.minutes} min · ${esc(a.intensity || "")}</span></span><span class="row gap6"><span class="pts-badge">·</span><button class="icon-btn" data-action="del-a" data-id="${esc(a.id)}" aria-label="Löschen">×</button></span></div>`),
  ];
  const weeks = 12;
  const paiGoal = state.settings.paiGoal || 100;
  const hasPai = Object.keys(state.pai || {}).length > 0;
  let paiCard = `<div class="card stack"><h3>PAI pro Woche</h3><p class="small muted">Trag auf „Heute“ deinen Tages-PAI aus Zepp ein, dann siehst du hier deine Wochen.</p></div>`;
  if (hasPai) {
    const bars = paiWeekBars(weeks, paiGoal, (mon) => weekSummary(state, dayMap, mon).pai);
    const done = bars.sums.slice(0, -1).filter((x) => x > 0);
    const avg = done.length ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) : 0;
    paiCard = `<div class="card stack"><div class="row between"><h3>PAI pro Woche</h3><span class="small muted">Ziel ${paiGoal}</span></div>
      <div class="chart">${bars.svg}</div>
      <div class="paistats"><div><b>${bars.sums[weeks - 1]}</b><span>diese Woche</span></div><div><b>${avg}</b><span>Schnitt pro Woche</span></div><div><b>${bars.sums.filter((x) => x >= paiGoal).length}</b><span>Wochen im Ziel</span></div></div></div>`;
  }
  const confirm = ui.confirmDel ? `<div class="banner warn"><span>Wirklich löschen?</span><span class="row gap8"><button class="link" data-action="confirm-del">Löschen</button><button class="link" data-action="cancel-del">Abbrechen</button></span></div>` : "";
  return `<div class="card stack"><div class="row between"><h3>Letzte 6 Monate</h3><span class="small muted">Tippe auf einen Tag</span></div>${heatmap(dayMap, 26, { selected: key, interactive: true })}${hmLegend}</div>
  ${confirm}
  <div class="card"><span class="eyebrow">${esc(fmtDate(key))}</span>
    ${entries.length ? `<div class="mt6">${entries.join("")}</div><p class="small muted mt8">${o?.total || 0} ${o?.total === 1 ? "Punkt" : "Punkte"} an diesem Tag${o && o.rawK + o.rawM > o.total ? ` (auf ${state.settings.dailyCap} begrenzt)` : ""}. Sport zählt nicht zu den Punkten.</p>`
      : `<p class="muted mt6">Keine Einheit an diesem Tag.</p>`}
    <div class="eyebrow mt8">Tages-PAI</div>
    ${paiForm(key, dayMap)}
  </div>
  ${paiCard}
  ${recentList(state)}`;
}

function planName(state, w) {
  if (w.planId) return state.plans.find((p) => p.id === w.planId)?.name || "Workout";
  return "Freies Training";
}

function recentList(state) {
  const rows = state.workouts.filter((w) => w.id !== state.meta.activeWorkoutId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || String(b.id).localeCompare(String(a.id))).slice(0, 12);
  if (!rows.length) return "";
  return `<div class="card"><h3>Letzte Einheiten</h3><div class="mt6">${rows.map((w) => `<button class="entry as-btn" data-action="day" data-day="${w.date}">${typeChip(w.type)}<span>${esc(w.name || planName(state, w))}<br><span class="small muted">${esc(fmtDate(w.date))}</span></span><span class="pts-badge">${counts(state, w) ? "+" + (rawPoints(state, w).k + rawPoints(state, w).m) : "·"}</span></button>`).join("")}</div></div>`;
}

/* ================= Fortschritt ================= */
export function progressView({ state, ui }) {
  const today = todayKey();
  const four = ui.bodyRange === "4";
  const from = four ? addDays(mondayOf(today), -21) : mondayOf(today);
  const cnt = areaCounts(state, from, today);
  const mult = four ? 4 : 1;
  const frac = (id) => { const a = AREAS.find((x) => x.id === id); return a?.target ? (cnt[id] || 0) / (a.target * mult) : (cnt[id] ? 0.5 : 0); };
  const names = Object.fromEntries(AREAS.map((a) => [a.id, a.name]));

  // Übungen mit mindestens zwei Einheiten für die Kurve
  const withData = state.exercises.filter((e) => e.kind !== "task")
    .map((e) => ({ e, s: exerciseSessions(state, e.id) }))
    .filter((x) => x.s.length >= 2)
    .sort((a, b) => b.s.length - a.s.length);
  const selId = withData.some((x) => x.e.id === ui.chartEx) ? ui.chartEx : withData[0]?.e.id;
  let chart = '<p class="muted small">Sobald du eine Übung mindestens zweimal gemacht hast, siehst du hier deine Kurve.</p>';
  if (selId) {
    const { e, s } = withData.find((x) => x.e.id === selId);
    const useW = e.kind === "weight" && s.some((x) => x.sets.some((y) => Number(y.weight) > 0));
    const pts = s.slice().reverse().map((x) => ({ date: x.date, v: useW ? Math.max(...x.sets.map((y) => Number(y.weight) || 0)) : Math.max(...x.sets.map((y) => Number(y.reps) || 0)) }));
    const unit = useW ? "kg" : e.kind === "time" ? "Sekunden" : "Wiederholungen";
    const lc = lineChart(pts, unit);
    const best = Math.max(...pts.map((p) => p.v));
    const cur = pts[pts.length - 1].v;
    const first30 = pts.find((p) => p.date >= addDays(today, -60));
    const delta = first30 ? cur - first30.v : 0;
    const u = useW ? " kg" : e.kind === "time" ? " s" : "";
    ui._chart = lc.geo; ui._chartUnit = u;
    chart = `<div class="small muted">${useW ? "Schwerster Satz pro Einheit in kg" : e.kind === "time" ? "Längster Satz pro Einheit in Sekunden" : "Meiste Wiederholungen pro Einheit"}, aus Workouts und Snacks</div>
      <div class="chart" id="chart">${lc.svg}<div class="tip" id="tip" hidden></div></div>
      <div class="recs"><div><span>Bestwert</span><b class="num">${num(best)}${u}</b></div><div><span>Aktuell</span><b class="num">${num(cur)}${u}</b></div><div><span>Letzte 2 Monate</span><b class="num ${delta > 0 ? "pos" : ""}">${delta > 0 ? "+" : ""}${num(delta)}${u}</b></div><div><span>Einheiten</span><b class="num">${s.length}</b></div></div>
      <div class="stack gap4"><span class="eyebrow">Letzte Einheiten</span>${s.slice(0, 5).map((x) => {
        const top = Math.max(...x.sets.map((y) => Number(y.weight) || 0));
        const reps = x.sets.map((y) => y.reps);
        const r = reps.every((v) => v === reps[0]) ? `${reps.length} × ${reps[0]}` : reps.join(" / ");
        return `<div class="entry slim"><span class="small muted">${esc(fmtDate(x.date))}</span><span>${r}${e.kind === "time" ? " s" : ""}${useW && top ? ` · ${fmtKg(top)}` : ""}</span></div>`;
      }).join("")}</div>`;
  }

  return `<div class="card stack">
    <h3>Trainierte Muskeln</h3>
    <div class="seg"><button data-action="range" data-range="w" aria-pressed="${!four}">Diese Woche</button><button data-action="range" data-range="4" aria-pressed="${four}">4 Wochen</button></div>
    <div class="bodies"><div>${bodySvg(false, frac, names)}<div class="lbl">Vorne</div></div><div>${bodySvg(true, frac, names)}<div class="lbl">Hinten</div></div></div>
    <div class="hm-legend center"><span>Sätze im Verhältnis zum Ziel</span><span class="row tight"><span class="sw" style="background:var(--h0)"></span><span class="sw" style="background:var(--h1)"></span><span class="sw" style="background:var(--h2)"></span><span class="sw" style="background:var(--h3)"></span><span class="sw" style="background:var(--h4)"></span></span><span>0 bis 100 %</span></div>
    <div class="arealist">${AREAS.filter((a) => a.id !== "mobility").map((a) => {
      const d = cnt[a.id] || 0, g = a.target * mult;
      return `<div class="arow ${g && d / g < 0.34 ? "low" : ""}"><span>${a.name}</span><div class="bar"><i style="width:${g ? Math.min(100, (d / g) * 100) : d ? 50 : 0}%"></i></div><span class="v">${g ? `${d}/${g}` : d}</span></div>`;
    }).join("")}
    <div class="arow"><span>Mobility</span><div class="bar m"><i style="width:${Math.min(100, ((cnt.mobility || 0) / (3 * mult)) * 100)}%"></i></div><span class="v">${cnt.mobility || 0}/${3 * mult}</span></div></div>
  </div>
  <div class="card stack">
    <h3>Kraftkurve</h3>
    ${withData.length ? `<div class="exsel">${withData.map(({ e }) => `<button class="toggle" data-action="chart-ex" data-id="${esc(e.id)}" aria-pressed="${e.id === selId}">${esc(e.name)}</button>`).join("")}</div>` : ""}
    ${chart}
  </div>`;
}

/* ================= Mehr ================= */
export function moreView({ state, ui }) {
  const s = state.settings;
  const row = (label, key, min, max, step = 1) => `<div class="srow"><span>${label}</span><div class="step small-step"><button data-action="setting" data-key="${key}" data-dir="-1" data-step="${step}" data-min="${min}" data-max="${max}" aria-label="${label} weniger">−</button><span>${s[key]}</span><button data-action="setting" data-key="${key}" data-dir="1" data-step="${step}" data-min="${min}" data-max="${max}" aria-label="${label} mehr">+</button></div></div>`;
  const lastBk = state.meta?.lastBackupAt;
  const perm = typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  return `<div class="card settings"><h3>Wochenziel</h3>
    ${row("Punkte pro Woche", "weeklyGoal", 3, 20)}
    ${row("davon mindestens Kraft", "strengthMin", 0, 20)}
    ${row("Höchstens pro Tag", "dailyCap", 1, 10)}
    ${row("PAI pro Woche", "paiGoal", 30, 300, 10)}
    <table class="pts"><tr><td>Workout</td><td>${s.points.workout}</td></tr><tr><td>Kraft-Snack</td><td>${s.points.snack}</td></tr><tr><td>Mobility-Snack</td><td>${s.points.mobility}</td></tr><tr><td>Tennis, Padel, Fußball</td><td>0</td></tr></table></div>
  <div class="card settings"><h3>Erinnerung</h3>
    <div class="srow"><span>Täglich erinnern, wenn noch nichts eingetragen ist</span><button class="sw-t" data-action="reminder-toggle" aria-pressed="${s.reminder.enabled}" aria-label="Erinnerung an oder aus"></button></div>
    <div class="srow"><label for="remTime">Uhrzeit</label><input id="remTime" type="time" class="input w-auto" value="${esc(s.reminder.time)}" data-action-input="reminder-time"></div>
    <p class="small muted">${perm === "denied" ? "Benachrichtigungen sind für diese App blockiert. Du kannst sie in den Android-Einstellungen der App erlauben." : "Android entscheidet selbst, wann die App im Hintergrund prüfen darf. Die Erinnerung kann sich deshalb etwas verschieben. Sicher klappt es mit einem Kalendertermin."}</p>
    <a class="btn" href="${esc(calendarLink(s.reminder.time))}" target="_blank" rel="noopener">Tägliche Erinnerung im Google Kalender anlegen</a></div>
  <div class="card settings"><h3>Equipment</h3>
    <div class="srow"><span>Gewicht der Kettlebell</span><div class="step small-step"><button data-action="kb" data-dir="-1" aria-label="leichter">−</button><span>${num(s.kbWeight)} kg</span><button data-action="kb" data-dir="1" aria-label="schwerer">+</button></div></div>
    <p class="small muted">Kurzhantel-Paar: ${weightSteps("kh2", s).slice(1).map(num).join(", ")} kg pro Hand.</p></div>
  <div class="card settings"><h3>Bibliothek</h3>
    <button class="srow as-btn" data-action="go" data-view="exercises"><span>Übungen</span><span class="muted">${state.exercises.length} ›</span></button>
    <button class="srow as-btn" data-action="go" data-view="plans"><span>Workout-Pläne</span><span class="muted">${state.plans.length} ›</span></button>
    <button class="srow as-btn" data-action="go" data-view="snacks"><span>Snacks</span><span class="muted">${SNACKS.length} ›</span></button></div>
  <div class="card settings"><h3>Daten</h3>
    <div class="srow"><span>Backup<br><span class="small muted">${lastBk ? `Zuletzt ${esc(fmtDate(state.meta.lastBackupDay || lastBk.slice(0, 10)))}` : "Noch keins gesichert"}</span></span><button class="btn small-btn" data-action="backup">Sichern</button></div>
    <p class="small muted">„Sichern“ öffnet das Teilen-Menü. Wähle dort Google Drive, dann liegt die Sicherung außerhalb des Handys.</p>
    <button class="link small" data-action="export">Stattdessen als Datei herunterladen</button>
    <div class="srow"><span>Import aus Datei</span><label class="btn small-btn" for="fileImport">Importieren</label></div>
    ${ui.importPreview ? importBox(ui.importPreview) : ""}
    ${ui.importResult ? `<div class="import ${ui.importResult.error ? "bad" : ""}"><b>${ui.importResult.error ? "Import fehlgeschlagen" : "Import abgeschlossen"}</b><p class="small">${esc(ui.importResult.text)}</p></div>` : ""}
    <p class="small muted">Vor jedem Import wird automatisch ein Backup im Browser angelegt.</p>
    <details class="small muted"><summary>Diagnose</summary><div class="kv mt6"><div>App</div><div>${APP_VERSION}</div><div>Datenversion</div><div>${state.dataVersion ?? DATA_VERSION}</div><div>Speicher</div><div>${STORAGE_KEY}</div><div>Gespeichert</div><div>${esc(state.meta?.updatedAt || "–")}</div><div>Einheiten</div><div>${state.workouts.length}</div><div>Sport</div><div>${state.activities.length}</div></div><button class="btn small-btn mt6" data-action="force-update">App aktualisieren</button><p class="small muted">Lädt die neueste Version, falls das Handy noch eine alte zwischengespeichert hat. Deine Daten bleiben.</p></details></div>
  <p class="small muted center">BenchMark Pro ${APP_VERSION}</p>`;
}

function importBox(p) {
  const bad = p.validation && !p.validation.ok;
  return `<div class="import ${bad ? "bad" : ""}"><b>${bad ? "Datei ist ungültig" : "Import-Vorschau"}</b>${p.fileName ? `<div class="small muted">${esc(p.fileName)} · ${Math.round((p.fileSize || 0) / 1024)} KB · App ${APP_VERSION}</div>` : ""}
    <div class="kv"><div>Einheiten</div><div>${p.preview.counts?.workouts ?? 0}</div><div>Pläne</div><div>${p.preview.counts?.plans ?? 0}</div><div>Übungen</div><div>${p.preview.counts?.exercises ?? 0}</div></div>
    ${bad ? `<pre class="small">${esc(p.validation.errors.slice(0, 8).join("\n"))}</pre>` : p.preview.note ? `<p class="small muted">${esc(p.preview.note)}</p>` : ""}
    <div class="btn-row"><button class="btn" data-action="import-cancel">Abbrechen</button>${bad ? "" : '<button class="btn primary-soft" data-action="import-merge">Hinzufügen</button>'}</div>
    ${bad ? "" : '<p class="small muted">„Hinzufügen“ ergänzt nur, was noch fehlt. Deine bisherigen Einträge bleiben.</p><button class="link small" data-action="import-apply">Stattdessen alles ersetzen</button>'}</div>`;
}

function calendarLink(time) {
  const [hh, mm] = String(time || "18:30").split(":");
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const start = `${ymd}T${hh.padStart(2, "0")}${mm.padStart(2, "0")}00`;
  const endMin = Number(hh) * 60 + Number(mm) + 10;
  const end = `${ymd}T${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}${String(endMin % 60).padStart(2, "0")}00`;
  const params = new URLSearchParams({
    action: "TEMPLATE", text: "BenchMark Snack", details: "5 Minuten reichen. Öffne BenchMark Pro und tippe auf Snack starten.",
    dates: `${start}/${end}`, recur: "RRULE:FREQ=DAILY",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/* ================= Übungen verwalten ================= */
export function exercisesView({ state, ui }) {
  const groups = [...AREAS.map((a) => a.id), "sonstiges"].map((id) => [id, state.exercises.filter((e) => (e.area || "sonstiges") === id)]).filter(([, l]) => l.length);
  const edit = ui.editEx ? exerciseById(state, ui.editEx) : null;
  return `${back("tab", "Mehr", 'data-tab="more"')}<h2>Übungen</h2>
  <p class="small muted">„Mag ich“ und „Okay“ landen in Snacks und Vorschlägen. „Nein“ wird nie vorgeschlagen. Ohne Bewertung heißt: kennst du noch nicht.</p>
  ${groups.map(([a, ls]) => `<div class="stack gap6"><span class="eyebrow">${esc(areaName(a))}</span>${ls.sort((x, y) => x.name.localeCompare(y.name, "de")).map((e) => `
    <div class="exrow${e.rating === "no" ? " no" : ""}">
      <button class="exname" data-action="edit-ex" data-id="${esc(e.id)}"><h3>${esc(e.name)}</h3><span class="small muted">${esc(eqName(e.eq))} · ${esc(LOCATIONS[e.loc] || "")}</span></button>
      <div class="rate" role="group" aria-label="Bewertung">${[["love", "Mag ich"], ["ok", "Okay"], ["no", "Nein"]].map(([v, l]) => `<button data-action="rate" data-id="${esc(e.id)}" data-v="${v}" aria-pressed="${e.rating === v}">${l}</button>`).join("")}</div>
      ${edit && edit.id === e.id ? editExForm(e) : ""}
    </div>`).join("")}</div>`).join("")}`;
}
function eqName(eq) {
  return { lh: "Langhantel", kh2: "Zwei Kurzhanteln", kh1: "Eine Kurzhantel", kb: "Kettlebell", band: "Band", none: "Körpergewicht", free: "Gewicht frei" }[eq] || "";
}
function editExForm(e) {
  const opt = (list, cur) => list.map(([v, l]) => `<option value="${v}" ${v === cur ? "selected" : ""}>${l}</option>`).join("");
  return `<div class="exedit stack gap8">
    <label class="small muted">Name<input class="input" id="exName" value="${esc(e.name)}"></label>
    <div class="row gap8 wrap">
      <label class="small muted">Bereich<select class="input" id="exArea">${opt(AREAS.map((a) => [a.id, a.name]), e.area)}</select></label>
      <label class="small muted">Ort<select class="input" id="exLoc">${opt(Object.entries(LOCATIONS), e.loc)}</select></label>
      <label class="small muted">Equipment<select class="input" id="exEq">${opt([["lh", "Langhantel"], ["kh2", "Zwei Kurzhanteln"], ["kh1", "Eine Kurzhantel"], ["kb", "Kettlebell"], ["band", "Band"], ["none", "Körpergewicht"], ["free", "Gewicht frei"]], e.eq)}</select></label>
      <label class="small muted">Erfassung<select class="input" id="exKind">${opt([["weight", "Gewicht und Wdh."], ["reps", "Nur Wiederholungen"], ["time", "Zeit in Sekunden"], ["task", "Abhaken (Mobility)"]], e.kind)}</select></label>
    </div>
    <div class="btn-row"><button class="btn" data-action="edit-ex" data-id="">Abbrechen</button><button class="btn primary-soft" data-action="save-ex" data-id="${esc(e.id)}">Speichern</button></div></div>`;
}

/* ================= Pläne ================= */
export function plansView({ state, ui }) {
  return `${back("tab", "Mehr", 'data-tab="more"')}<div class="row between"><h2>Workout-Pläne</h2><button class="btn small-btn" data-action="plan-new">+ Neuer Plan</button></div>
  ${state.plans.map((p) => `<div class="card stack gap8">
    <input class="input plan-name" value="${esc(p.name)}" data-action-input="plan-name" data-id="${esc(p.id)}" aria-label="Name des Plans">
    <div class="stack gap4">${p.exerciseIds.map((id, i) => `<div class="planex"><span>${esc(exerciseName(state, id))}</span><span class="row gap4"><button class="icon-btn" data-action="plan-move" data-id="${esc(p.id)}" data-i="${i}" data-dir="-1" aria-label="nach oben">↑</button><button class="icon-btn" data-action="plan-rm" data-id="${esc(p.id)}" data-i="${i}" aria-label="entfernen">×</button></span></div>`).join("") || '<span class="small muted">Noch keine Übungen</span>'}</div>
    <div class="row gap8"><select class="input" id="planAdd_${esc(p.id)}"><option value="">Übung hinzufügen …</option>${[...state.exercises].filter((e) => e.kind !== "task").sort((a, b) => a.name.localeCompare(b.name, "de")).map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("")}</select><button class="btn small-btn" data-action="plan-add" data-id="${esc(p.id)}">+</button></div>
    ${p.isDefault ? "" : `<button class="link small danger" data-action="plan-del" data-id="${esc(p.id)}">Plan löschen</button>`}
  </div>`).join("")}`;
}

/* ================= Snacks ================= */
export function snacksView({ state }) {
  return `${back("tab", "Mehr", 'data-tab="more"')}<h2>Snacks</h2>
  <p class="small muted">Die Bibliothek, aus der die Vorschläge kommen. Snacks mit einer Übung, die du auf „Nein“ gesetzt hast, werden nicht vorgeschlagen.</p>
  ${AREAS.map((a) => {
    const list = SNACKS.filter((s) => s.area === a.id);
    if (!list.length) return "";
    return `<div class="stack gap6"><span class="eyebrow">${a.name}</span>${list.map((s) => `<button class="alt" data-action="preview-any" data-id="${s.id}"><span><h3>${esc(s.name)}</h3><span class="small muted">${s.items.map((i) => esc(exerciseName(state, i.exerciseId)) + (i.sets ? ` ${i.sets}×${i.reps}` : "")).join(" · ")}</span><br><span class="small muted">${s.minutes} min · ${esc(LOCATIONS[s.loc])} · Tagesform ${s.energy.join(", ")}</span></span>${typeChip(s.type === "mobility" ? "mobility" : "snack")}</button>`).join("")}</div>`;
  }).join("")}`;
}

/* ================= Sport-Blatt ================= */
export function sportSheet(ui) {
  const f = ui.sportForm;
  const opts = (grp, list, cur) => `<div class="opts">${list.map((x) => `<button class="toggle" data-action="sport-opt" data-grp="${grp}" data-v="${esc(x)}" aria-pressed="${String(x) === String(cur)}">${esc(x)}${grp === "minutes" ? " min" : ""}</button>`).join("")}</div>`;
  return `<div class="sheet" role="dialog" aria-label="Sport eintragen"><h2>Sport eintragen</h2>
    <div class="stack gap6"><span class="small muted">Was?</span>${opts("kind", SPORTS, f.kind)}</div>
    <div class="stack gap6"><span class="small muted">Wie lange?</span>${opts("minutes", [60, 90, 120], f.minutes)}</div>
    <div class="stack gap6"><span class="small muted">Wie anstrengend?</span>${opts("intensity", ["Locker", "Mittel", "Hart"], f.intensity)}</div>
    <div class="stack gap6"><label class="small muted" for="sportDate">Wann?</label><input id="sportDate" type="date" class="input" value="${esc(f.date)}" max="${todayKey()}"></div>
    <div class="btn-row"><button class="btn ghost" data-action="sport-close">Abbrechen</button><button class="btn sport" data-action="sport-save">Speichern</button></div></div>`;
}
