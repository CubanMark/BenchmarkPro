# BenchMark Pro – Operational Context

## Current State
Version: 4.2.0  
Core system stable.  
PR badge, PR counter (active workout). Dashboard-Kacheln: Recency (Letztes Training, Ampel grün/gelb/rot) + Consistency (Diese Woche, Zähler + Badge Stark/Gut/Dranbleiben/Problematisch) als UI-only.  
No multi-profile support yet.

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