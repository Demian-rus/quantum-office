# Quantum Office — PRODUCT CONTEXT (source of truth)

Updated: 2026-10-28. Repository: `Demian-rus/quantum-office`, main branch. This document is intentionally written for the next developer, agent or ChatGPT conversation.

## Owner's non-negotiable product decision

We are building **ONE integrated office application** for Windows 10/11 and macOS, not three installers. The application opens a **launcher/dashboard** from which the user can choose **Quantum Sheets** (spreadsheet), **Quantum Writer** (documents), **Quantum Slides** (presentations), and later additional modules. Upon entering a module, **that editor uses the full workspace**. Switching is done using a small, consistent global navigation at the very top, without losing open documents or creating separate windows for every task. The shell should be genuinely desktop-first, but the same frontend must run in a browser for no-install manual testing.

This is a long-term independent office suite with a distinctive design, **not a pixel-for-pixel clone of Microsoft Office**. Use familiar interactions where they improve usability (especially Excel keyboard shortcuts and clipboard). No Microsoft activation, subscriptions, mandatory account, permanent connection, or dependence on proprietary Office installation for ordinary local work. A legal Tauri desktop wrapper is planned; it is NOT a finished product today.

## Visual / interaction feedback from the owner

- **Very compact ribbon, inspired by Excel's information density.** The owner explicitly rejects huge buttons, oversized empty groups and large decorative controls. Grid space matters; desktop header ~40 px, tabs ~29 px, ribbon ~73 px is the present direction. Use dense groups with small, legible icon actions and tooltips.
- The owner likes the existing **dark navy application bar, green accents, white grid and overall current appearance**. Do not throw away or redesign it wholesale.
- Stop using inconsistent Unicode glyphs as toolbar icons. Prefer a consistent compact vector icon set (currently inline SVG paths, no remote font dependency). Icons must be discernible but not large.
- **No browser text selection in top header or ribbon.** Clicking/dragging over controls should never leave a blue highlighted block of toolbar text. Preserve `:focus-visible` for keyboard accessibility; avoid hacks that remove meaningful focus indication.
- **Ctrl+C/Ctrl+V on selected spreadsheet cells must copy/paste immediately, WITHOUT double-clicking into an editor.** The owner reported seeing an 'inserted from clipboard' toast while no value appeared. Clipboard behavior must be tested with browser permission restrictions, native keystrokes, formulas, multi-cell ranges and unrelated external text. No success toast unless the model changed as expected.
- Browser build is a **testing surface**, not a reason to compromise the actual installed Windows/macOS application. Keep native filesystem, reopen, upgrades, performance and cross-platform architecture central; don't spend months fixing browser-only cosmetic behavior irrelevant to desktop.
- The owner prefers you to **keep implementing between manual QA sessions**. Do not request a manual check at each small increment.

## Reality check — current implementation, not an Excel replacement

The first operational module is **Sheets alpha**. It currently has a launcher and compact ribbon, a bounded virtualized grid (around 2,000 rows × 100 columns), multiple sheets, basic formulas and functions, relative/absolute references, copying/fill, undo/redo, CSV and partial XLSX exchange, widths/heights, search/replace, row sort, simple multi-value filters, freeze panes and basic styles. **Writer and Slides are placeholders**, not usable editors. Browser localStorage is temporary convenience only; .qbook and .qbackup exports exist. Desktop installation/updating has only a Tauri scaffold and CI planning, NOT tested installers.

**Do not claim full XLSX compatibility.** Current import/export drops unsupported Excel features (charts, pivots, macros, named ranges, complex styles, relationships, embedded objects, dates as typed values etc.). Never overwrite a source Excel workbook on the basis of this partial support. Preserve backups and warn about limitations.

## Engineering priorities (rough order, not promises)

1. Data safety and routine spreadsheet UX: dependable native clipboard and selection, multi-document tabs, durable direct file save/reopen, crash recovery, keyboard navigation and comprehensive regression tests.
2. Solid Sheets data model: insert/delete/hide rows and columns, merges, cell types and date handling, format borders/number/display, sorting/filtering, validation, conditional formatting.
3. Real formula engine: AST, dependency graph, larger library, cross-sheet formulas, errors, efficient recalculation, references after structural changes.
4. Broad XLSX compatibility with golden round-trip samples and explicit lossless-vs-lossy decisions; print/PDF.
5. Analytics and usability: charts, pivot tables, tables, data transformations, charts and large workbooks, profiling on thousands of populated cells.
6. Quantum Writer (rich text, pages, tables, DOCX) and Quantum Slides (slide layout, objects, presentation, PPTX) in the same shell. Incremental milestones and independent acceptance suites.
7. Windows/macOS packages and signed stable update channels; app documents must be separate from installed binaries and survive every update. Explicit migration/rollback strategy.

## Development and review process

- Work only in `Demian-rus/quantum-office`; NEVER change `quantum-board`, `quantum-portal`, or `quip-ui-lab` for this project.
- Check current remote `main` and open PRs before work. New feature or bugfix in a branch → Draft PR → automated Node + browser smoke → report status → merge only after tests are green. No fabricated passes, PRs or publication URLs.
- Always cover functional fixes with regression tests at model and browser levels. An animated toast is NOT a test of a successful edit.
- Keep testable standalone `Quantum-Office.html` current. It should be downloadable and open without installation (Chrome/Opera/Edge); native installers and future in-app updates are separate release artifacts.
- Do not publish/sign user credentials, signing keys, private samples or personally identifiable workbook content.
- Document new limits and limitations. Distinguish implemented, in-progress and intended features. Maintain this file as a persistent handoff.

## Current work item — spreadsheet clipboard, header selection and icons

Target: native-feeling copy/paste on a selected grid cell; a private in-memory clipboard fallback when `navigator.clipboard` is unavailable; preserve formulas and style within the app; allow external TSV paste. Use nonselectable shell chrome and consistent small inline vector icons. Keep compact measurements and `:focus-visible`. Tests include an actual Chromium Ctrl+C → click different cell → Ctrl+V round-trip without double-clicking, formula shifting and no header text selection. No new Sheets features should regress this behavior.

## Acceptance gates for final desktop product

- Real files on disk reopen byte-equivalent or semantically equivalent after application restart and update, with recovery from crashes.
- Native Windows and macOS builds install, run offline, open/edit/save, and update safely. Both platforms must be tested.
- UI workflows in each editor have independent black-box smoke tests; keyboard shortcuts and undo/redo are not optional.
- Complex OOXML import/export must be declared partial unless a test corpus confirms fidelity. Native Quantum formats must not be corrupted by unsupported data.
