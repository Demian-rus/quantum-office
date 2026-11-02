
# TASK099 — Interactive diagnostics in Quantum Writer

## Implemented

The **Диагностика** tab inside Quantum Writer opens a structured interactive document in two modes.

- **Конструктор:** title, description, up to 24 sections / 240 questions; question or practice type; editable prompt and hidden reference answer; add/remove questions and sections.
- **Проведение:** optional student name/code, show/hide reference answer, exclusive **Знает / Частично / Не знает** buttons, live counts and bar, weighted score (2/1/0), and per-topic breakdown.
- End the session to save a dated immutable summary. A maximum of 50 completed sessions are retained; active marks reset for the next pupil. CSV export protects leading spreadsheet-formula characters.
- Explicitly load a sample 8th-grade physics diagnostic; sample replacement requires confirmation.

## Files and preservation

Interactive content is a separate field of the existing Writer document; it does not modify ordinary rich-text HTML.

Browser autosave is a temporary draft, not a backup. Download a standalone **.qdiag** for the assessment, or **.qdoc** for a full Writer document that includes the assessment. Historical QDOC files without a diagnostic remain supported. HTML/TXT export contains ordinary Writer text only, not interactive cards.

QDIAG JSON import validates fields, limits sizes and escapes markup. Offline only; no cloud or mandatory account. Pupil names in local drafts and exports are personal data, so use pseudonyms where appropriate.

## Acceptance

Run npm test and npm run build. The focused suites are tests/task099.test.js and tests/task099_browser.cjs, wired into the Chromium workflow.

## Deliberate scope limits

No drag-and-drop ordering, embedded images or formula editor in cards, cloud sync, or interactive DOCX output. History is per diagnostic. A complete native desktop application remains separate future work.
