# BenchMark Pro – Operational Context

## Current State
Version: 5.1.0 (DataVersion 5, Storage-Key unverändert benchmarkpro_v4)  
5.1: Tages-PAI aus der Zepp-Uhr (state.pai = { "YYYY-MM-DD": Zahl }), zweiter Ring „Bewegung“ = PAI-Summe Mo–So (settings.paiGoal, Standard 100), Heatmap grün = Kraft, orange = PAI (Sport-Eintrag ohne PAI zählt als mittel), geteilt = beides. Backup über das Teilen-Menü (.txt, weil Android kein JSON teilt), Erinnerung auf „Heute“ nach 7 Tagen (meta.lastBackupAt/lastBackupDay).  
5.2: Beide Ringe, der Tagesstreifen auf „Heute“ und die Vorschläge zählen rollierend die letzten 7 Tage bis heute (last7Summary), kein Reset am Montag. Die Muskelgrafik unter Fortschritt zeigt 7 bzw. 28 Tage rollierend (5.2.1). Der Verlauf (Wochen-PAI-Balken, Wochen im Ziel) bleibt bei Kalenderwochen.  
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
- Import merges by default („Hinzufügen“); hard replace only on request, with validation + backup.