# BenchMark Pro – Projekt-Analyse v4

**Reiner Analyse-Durchlauf – keine Code-Änderungen.**

---

## 1. Ordnerstruktur

```
BenchmarkPro/
├── index.html              # Einstieg (HTML, lädt src/app.js als Modul)
├── manifest.json           # PWA-Manifest
├── service-worker.js       # Offline-Cache (verweist noch auf alte Pfade)
├── css/
│   └── styles.css          # Globale Styles
├── src/                    # Aktive Anwendungslogik (ES-Module)
│   ├── app.js              # Einstiegspunkt, State, UI-Binding, Boot
│   ├── version.js          # APP_VERSION, DATA_VERSION, STORAGE_KEY
│   ├── storage.js          # Load/Save/Export/Import (LocalStorage)
│   ├── models.js           # createEmptyState, isLikelyState, Defaults (Exercises/Plans)
│   ├── migrations.js       # Schema-Migrationen (dataVersion)
│   ├── plans.js            # ensureDefaults, createPlan, deletePlan, updatePlanFromTextarea
│   ├── exercises.js        # findExerciseByName, upsertExercise
│   ├── workouts.js         # Workout-CRUD, Sets, humanWorkoutTitle
│   ├── ui.js               # DOM-Helfer ($, $all), setActiveTab, toast
│   └── stats.js            # Platzhalter (Phase 2)
├── docs/
│   └── PROJECT_ANALYSIS_v4.md
└── (Root-Dateien app.js, storage.js, … sind nicht an index.html angebunden – vermutlich Legacy/Kopie)
```

**Hinweis:** `index.html` bindet nur `src/app.js` ein. Dateien im Projektroot (`app.js`, `storage.js`, `migrations.js`, `models.js`, `plans.js`, `exercises.js`, `workouts.js`, `ui.js`, `version.js`) werden von der aktuellen App nicht geladen.

---

## 2. Einstiegspunkt

- **HTML:** `index.html` (Zeile 180: `<script type="module" src="src/app.js"></script>`).
- **JavaScript:** `src/app.js` – beim Laden:
  1. State aus LocalStorage laden (`loadState()`),
  2. Migrationen ausführen (`runMigrations(state)`),
  3. Defaults ergänzen (`ensureDefaults(state, defaults)`),
  4. Meta/activeWorkoutId setzen,
  5. `boot()`: einmal `persist()`, dann `rerenderAll()`, Tabs, Event-Handler, Tab „Training“ aktiv.

---

## 3. Zentrale Module

| Modul | Rolle |
|-------|--------|
| **src/app.js** | State-Holding, Persistenz-Aufrufe, gesamte UI-Logik (Render, Event-Handler), Import/Export-UI, Boot. |
| **src/storage.js** | `loadState`, `saveState`, `resetState`, `exportState`, `parseImportFile`, `applyImportedState`; einzige Stelle mit LocalStorage-Zugriff. |
| **src/models.js** | `createEmptyState`, `isLikelyState`, `getDefaultExercises`, `getDefaultPlans` – State-Form und Default-Daten. |
| **src/version.js** | `APP_VERSION`, `DATA_VERSION`, `STORAGE_KEY` – Konstanten für Version und Storage. |
| **src/migrations.js** | `runMigrations(state)` – führt Schema-Migrationen basierend auf `state.dataVersion` aus. |
| **src/plans.js** | Defaults einpflegen, Plan anlegen/löschen/aus Textarea aktualisieren. |
| **src/exercises.js** | Übung per Name suchen/anlegen (`upsertExercise`). |
| **src/workouts.js** | Workouts/Sets/Notizen, IDs, Sortierung, Titel. |
| **src/ui.js** | `$`, `$all`, `setActiveTab`, `toast` (aktuell `alert`). |

---

## 4. Globaler State

- **Ort:** `src/app.js`, Zeile 10: `let state = loadState();`
- **Inhalt:** Ein einziges Objekt mit u. a.:
  - `appVersion`, `dataVersion`
  - `meta` (z. B. `updatedAt`, `lastMigration`, `activeWorkoutId`)
  - `exercises[]`, `plans[]`, `workouts[]`
- **Änderungen:** State wird in `app.js` direkt mutiert (z. B. `state.plans.push(...)`, `state.meta.activeWorkoutId = ...`). Nach relevanten Aktionen wird `persist()` aufgerufen, das `saveState(state)` ausführt.
- **Weitergabe:** State wird als Argument an Funktionen in `plans.js`, `exercises.js`, `workouts.js` übergeben; diese Module halten keinen eigenen globalen State.

---

## 5. LocalStorage – Lesen/Schreiben

- **Nur in:** `src/storage.js`.

| Funktion | Aktion |
|----------|--------|
| `loadState()` | `localStorage.getItem(STORAGE_KEY)` → JSON.parse → bei Fehler oder wenn `!isLikelyState(parsed)` → `createEmptyState()`. |
| `saveState(state)` | `state.meta.updatedAt` und Versionen setzen, dann `localStorage.setItem(STORAGE_KEY, JSON.stringify(state))`. |
| `resetState()` | `localStorage.removeItem(STORAGE_KEY)`. |

- **Key:** `STORAGE_KEY` aus `src/version.js` → `"benchmarkpro_v4"`.
- Die Root-Datei `storage.js` enthält ebenfalls LocalStorage-Zugriffe, wird von der App aber nicht verwendet.

---

## 6. Import-Flow (technisch)

1. **UI:** Diagnose-Tab → „Import JSON“ → `<input id="fileImport" type="file" accept="application/json">` (`index.html`).
2. **Event:** In `app.js` wird auf `#fileImport` „change“ gelauscht; Datei wird mit `file.text()` gelesen.
3. **Parsing:** `parseImportFile(text)` in `src/storage.js`:
   - `JSON.parse(fileText)` – bei Fehler: „Import abgelehnt: Datei ist kein gültiges JSON.“
   - **V4-Erkennung:** `isLikelyState(parsed)` (obj hat `exercises`, `plans`, `workouts` als Arrays und `dataVersion` als Zahl) → Rückgabe `{ kind: "v4", preview, state }`, State unverändert übernommen.
   - **Legacy:** Wenn `parsed` ein Objekt ist, aber nicht v4: `convertLegacyToV4(parsed)` baut einen neuen State (Workouts/Plans/Exercises aus verschiedenen möglichen Property-Namen), Rückgabe `{ kind: "legacy", preview, state: converted }`.
   - Sonst: „Import abgelehnt: Unbekanntes Format.“
4. **Vorschau:** Rückgabe enthält `preview`; `app.js` speichert `state` in `pendingImport` und ruft `showImportPreview(preview)` auf (Anzeige von Typ, Workout-/Plan-/Exercise-Anzahl, ggf. Hinweis).
5. **Anwenden:** Bei Klick auf „Import anwenden“:
   - `state = applyImportedState(pendingImport)` (in `storage.js`: nur `appVersion`, `dataVersion`, `meta` normalisieren),
   - dann in `app.js`: `ensureDefaults(state, defaults)`, `meta.activeWorkoutId = null`, `runMigrations(state)`, `persist()`, `rerenderAll()`, Preview ausblenden.

**Zusammenfassung:** Lesen → JSON.parse → Typ-Erkennung (v4 vs. Legacy) → Preview → Nutzer bestätigt → State ersetzen, Defaults/Migrationen, Speichern, Neuzeichnen.

---

## 7. Stellen ohne bzw. mit schwacher Validierung

- **Load (LocalStorage):**  
  - Nur `isLikelyState(parsed)` (Arrays + `dataVersion`). Keine Prüfung von Struktur der Einträge (z. B. dass `workouts[].items[].sets` aus Objekten mit `reps`/`weight` bestehen), keine Längen-/Tiefenlimits.
- **Import – v4:**  
  - V4-State wird 1:1 als State übernommen. Es gibt keine Schema- oder Typvalidierung (z. B. dass `exercises[].id` string ist, `plans[].exerciseIds` auf existierende IDs verweist, oder dass Workout-Items gültige `exerciseId` haben). Beschädigte oder manipulierte JSON-Dateien können inkonsistenten State erzeugen.
- **Import – Legacy:**  
  - `convertLegacyToV4` ist bewusst „best-effort“ und tolerant (verschiedene Property-Namen). Keine strenge Validierung der Quelldaten; fehlende oder falsche Felder führen zu Defaults/Leerwerten (z. B. Datum „1970-01-01“, leere Arrays).
- **applyImportedState:**  
  - Setzt nur Version und `meta`. Keine Prüfung, ob der übergebene State die erwarteten Keys/Strukturen hat.
- **Eingaben im UI:**  
  - Set-Werte (kg, reps) werden in `app.js` mit `Number(...)` geparst und auf `Number.isFinite`/`reps > 0` geprüft. Plan-/Übungsnamen und Notizen werden nicht gegen maximale Länge oder Sonderzeichen abgesichert (XSS-Risiko bei direkter Anzeige, siehe unten).

---

## 8. Potenzielle Risiken beim Import

1. **Keine tiefe Strukturvalidierung:**  
   V4-Import akzeptiert jedes Objekt, das `isLikelyState` erfüllt. Enthält die Datei z. B. falsche Typen (`exerciseId` als Zahl, `sets` als String) oder fehlende Felder, kann die App beim Rendern oder in Workout-/Plan-Funktionen mit Fehlern oder undefiniertem Verhalten reagieren.

2. **Referenzielle Integrität:**  
   Es wird nicht geprüft, ob `workouts[].items[].exerciseId` oder `plans[].exerciseIds[]` auf Einträge in `state.exercises` verweisen. Nach Import können „tote“ Referenzen entstehen (z. B. Übung gelöscht, aber noch in Plan/Workout).

3. **Speicher/Performance:**  
   Sehr große Import-Dateien (sehr viele Workouts/Plans/Exercises) werden vollständig geparst und in den State übernommen. Keine Begrenzung der Array-Längen oder Objekttiefe – theoretisch Risiko für hohen Speicherverbrauch oder Langzeit-Blockierung des Main-Threads.

4. **Überschreiben ohne Backup:**  
   „Import anwenden“ ersetzt den aktuellen State vollständig. Es gibt keinen Merge-Modus und keine automatische Sicherung des bisherigen States vor dem Ersetzen (Nutzer kann aktuellen Stand nur manuell vorher exportieren).

5. **Legacy-Interpretation:**  
   Verschiedene v3-ähnliche Formate werden mit Heuristiken gemappt. Ungewöhnliche Strukturen können zu falschen Zuordnungen (z. B. falsches Datum, falscher Plan) oder stillen Datenverlusten führen.

6. **XSS bei Anzeige:**  
   In `app.js` werden u. a. Plan-Namen, Übungsnamen und Notizen per `innerHTML` oder `.textContent` bzw. in Template-Strings ausgegeben. Wenn Import-Daten HTML/Script enthalten und an Stellen mit `innerHTML` landen, besteht XSS-Risiko. Wo genau `innerHTML` verwendet wird, sollte für eine Sicherheitsanalyse geprüft werden (z. B. `card.innerHTML = ...` in `renderPlans`, `renderWorkoutItems` – hier werden Nutzerdaten eingebaut).

---

## 9. Kurzüberblick Risiken

| Risiko | Schwere | Ort |
|--------|---------|-----|
| Keine tiefe Validierung von v4-Import | Mittel | storage.js, parseImportFile |
| Keine referentielle Integrität (exerciseId) | Mittel | Nach Import, überall bei Anzeige/Plan |
| Sehr große Imports ohne Limit | Niedrig | parseImportFile / applyImportedState |
| Vollständiges Ersetzen ohne Backup | Mittel | app.js, btnApplyImport |
| Legacy-Mapping fehleranfällig | Niedrig | storage.js, convertLegacyToV4 |
| XSS bei Nutzerdaten in innerHTML | Hoch (wenn betroffen) | app.js, Render-Funktionen |

---

## 10. Gelesene Dateien (für diese Analyse)

| # | Datei |
|---|--------|
| 1 | `index.html` |
| 2 | `manifest.json` |
| 3 | `service-worker.js` |
| 4 | `css/styles.css` |
| 5 | `src/app.js` |
| 6 | `src/storage.js` |
| 7 | `src/models.js` |
| 8 | `src/version.js` |
| 9 | `src/migrations.js` |
| 10 | `src/plans.js` |
| 11 | `src/exercises.js` |
| 12 | `src/workouts.js` |
| 13 | `src/ui.js` |
| 14 | `src/stats.js` |

Zusätzlich: Grep in Gesamtprojekt zu `localStorage`, `parseImportFile`, `applyImportedState`, `isLikelyState`; Glob-Suche für Ordnerstruktur und `docs/`.
