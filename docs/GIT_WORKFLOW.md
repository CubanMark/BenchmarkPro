# Benchmark Pro Git Workflow

## Branches
- `main`: stabiler Release-Stand, jederzeit nutzbar
- `next`: laufende Optimierung und Integration neuer Verbesserungen
- `feature/*`: einzelne Arbeitspakete, immer von `next` aus

## Empfohlener Ablauf
1. Aktuellen stabilen Stand auf `main` per Tag sichern.
2. Neue Arbeit auf `feature/*` von `next` starten.
3. Feature in `next` mergen und kurz manuell pruefen.
4. Wenn `next` stabil ist, nach `main` mergen.
5. Auf `main` neuen Release-Tag setzen und nach GitHub pushen.

## Versionierung
- Patch: `v4.3.1`, `v4.3.2` fuer Bugfixes und Härtung
- Minor: `v4.4.0` fuer rueckwaertskompatible Verbesserungen
- Major: `v5.0.0` fuer Profilsystem oder groessere Strukturwechsel

## Release-Checkliste
- App startet ohne Fehler
- Workout anlegen, Set speichern, Workout erneut oeffnen
- Plan speichern und erneut verwenden
- Export und Re-Import funktionieren
- Ungueltiger Import wird abgelehnt
- `src/version.js` passt zum Git-Tag
