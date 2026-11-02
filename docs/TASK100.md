
# TASK100 — Quantum Writer: diagnostic builder and student journal

## Scope

A reviewable follow-up to TASK099, based on `feat/task099-writer-interactive-diagnostics` (Draft PR #85). No merge to main.

### Builder

- Reorder sections using arrow buttons, questions via arrow buttons and pointer drag handle; transfer questions between sections through an accessible select.
- Duplicate questions with fresh stable IDs (marks are not duplicated).
- Per-question weight from 1 to 10 points and partial-credit percentage from 0 to 100. Existing TASK099 questions normalize to 2 points / 50% partial credit.
- Safely delete questions/sections without carrying active marks to nonexistent questions.
- The normal Writer text remains separate from interactive data.

### Assessment and journal

- Immediate weighted score and fractional points, plus per-topic results.
- Students are explicit profiles stored in the current diagnostic document. Add a student in the builder or from the session; select a stored student or enter a one-off name.
- Finish session to append an immutable dated result. Filter history by student and show the number of sessions, average and latest percentage.
- Profile labels can be renamed; delete only removes from roster, not historical result snapshots.
- Exports: `.qdiag` and `.qdoc` include optional fields and preserve previous QDIAG version 1 semantics. Result CSV has additional earned/available point columns and formula-injection safeguards.

### Limits and boundaries

Up to 24 sections, 240 questions, 80 student profiles and 50 saved sessions per diagnostic. Profiles are document-local (not a shared cross-document student database). Existing historical totals are retained; older results without point details remain valid. No automatic answer checking, editable DOCX interactivity, cloud sync, multi-user database or gradebook aggregation across separate documents.

### Validation

- `tests/task100.test.js` covers scoring precision, model moves/duplication, profile identity, serialization, and older TASK099 file compatibility.
- `tests/task100_browser.cjs` exercises actual UI interactions, native drag/drop, live scoring, student profiles, reload persistence and `.qdiag` export.
- Run `npm test`, `npm run build`, and the Chromium smoke suite before acceptance.

Until native persistent saving is proven, download QDIAG/QDOC backups to disk. For pupil privacy prefer aliases and avoid sharing exported documents containing names.
