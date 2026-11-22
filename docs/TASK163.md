# Quantum Office — TASK162/163 (22.11.2026)

## TASK162 — launcher layout and entry points
- PR #150, branch `feat/task162-launcher-bank-entry`, base `main` at `ebcc1f3500373f6e9fb6b8cfde7d248d24efef33`.
- The four main editor cards are arranged in proportional responsive editor columns, with their own compact square inset actions and aligned template links.
- Texts insets: `Конструктор` opens the Writer/work workspace, `Банк заданий` opens its existing QWBANK catalogue.
- Responsive layouts: 4 columns desktop, 2 columns tablet, 1 column narrow mobile. Existing editors and template actions are unchanged.
- QA: `tests/task162_launcher_browser.cjs` verifies card/quick-action geometry at 1600, 900 and 390 CSS pixels, main routes and bank entry.

## TASK163 — task bank catalogue and recording workflow
- PR #151, branch `feat/task163-bank-catalog-video`, based on PR #150.
- **One canonical QWBANK-v1 store** (`quantum-office.work-bank.v1`) is reused; no secondary bank or automatic destructive migration.
- Two-column bank: on the left searchable entries with selectors for subject, class, exam, year, part, task slot, level, type, topic, subtopic and origin; on the right a large vector/image task preview.
- Clicking `Просмотр` displays the selected task. Answer and explanation remain below the condition in a collapsed `Ответ и решение` section by default.
- `Режим для видео` hides catalogue/filter/solution controls and enlarges the exercise on a clean white background for screenshot/capture with snipping tools. It does **not** create a screenshot file or automatically upload content to Quantum Board.
- `+ Новая задача` creates a draft in the existing editor without creating any stored entry until explicit save. Cancel leaves the bank unchanged.
- Existing tasks can be edited (prompt, type, answer, criteria, explanation, graph, physical diagram, image, metadata). New and existing multiple-choice tasks also expose a multiline answer-options editor.
- Creation assigns a permanent local bank display number through existing `qwBankAllocateNumber`; import collisions and QWORK sources keep the behavior from TASK160.1. Standard QWBANK export and import remain available.

## Limits and next migration
- **500 records maximum per local bank**, enforced by existing QWBANK-v1 model; browser `localStorage` also has a finite quota. Treat this as a *working personal collection*, not durable storage for thousands of large illustrated tasks.
- The user should periodically export `.qwbank`; never represent browser autosave as guaranteed file storage.
- Existing QWORK-v1 tasks store one top-level figure (graph, diagram or image). A diagram can contain multiple vector objects, but multiple independently editable figure attachments per task require a separate model migration.
- Inline HTML/semantic editable tables and a larger bank on IndexedDB or verified filesystem persistence are separate subsequent stages. Do not silently widen limits or change QWBANK schema.
- Existing PNG/JPEG assets are raster; video mode enlarges display but cannot improve source resolution.

## Acceptance
- `npm test`, `npm run build`, legacy TASK145/156/160/161 browser tests, `tests/task162_launcher_browser.cjs`, `tests/task163_bank_browser.cjs`.
- Verify task preview, solution disclosure, topic search, creating/editing and cancelling, question choices, QWBANK import/export, and printing unaffected in portrait and landscape.
- Screenshots: `evidence/task162-launcher` and `evidence/task163-bank` from Chromium.
- PRs remain Draft until review; merge into main only with green CI and an unchanged tested HEAD.
