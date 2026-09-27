# BenchMark Pro – Operational Context

## Current State
Version: 5.0.0 (DataVersion 5, Storage-Key unverändert benchmarkpro_v4)  
Neu: Snacks und Übungsbibliothek (library.js), Punkte/Wochenziel/Tageslimit und regelbasierte Vorschläge nach Tagesform und Defizit (engine.js), Heatmap, Ring, Körpergrafik, Kraftkurven (charts.js). Sport wird ohne Punkte erfasst (state.activities).
UI komplett neu (views.js, app.js, styles.css) mit Tabs Heute/Verlauf/Fortschritt/Mehr; renderers.js und stats.js entfernt. Tägliche Erinnerung per Periodic Background Sync (reminder.js, service-worker.js).

## Next Focus
Short-term: Motivation features without data model changes.

## Tech Stack
- Vanilla JavaScript (ES Modules)
- LocalStorage persistence
- PWA structure
- No backend
- No framework

## Fixed Decisions
- State is the single source of truth.
- PR calculation is UI-only (not persisted).
- No backend or authentication.
- Import performs hard replace with validation + backup.