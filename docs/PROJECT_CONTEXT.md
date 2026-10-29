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

## TASK 017 — bounded row/column structural editing (2026-10-28)

- The **Insert** ribbon has four compact actions: insert/delete one row, insert/delete one column at the active cell. Operates on the entire sheet, **not just selected range**.
- Preserve styles and custom dimensions, adjust formula references including absolute anchors on structural edits, and adjust frozen pane counts when an edit occurs within the frozen region. Deleted-cell references show `#REF!` instead of silently pointing at the wrong data.
- Currently refuse structural editing while auto-filter is enabled. Refuse insertion if a populated boundary cell, custom dimension, or formula would be moved out of the 2,000 × 100 bounds. Validate complete operation before mutation; one undo transaction.
- This is **not** Excel-equivalent range semantics: deleting a row referenced as a range endpoint may show `#REF!` rather than shortening the range. Cross-sheet formulas and advanced Excel table structures remain unsupported.
- Verify with `npm test`, `npm run build`, `python tests/structure_browser.py`; include older clipboard and XLSX regression smoke. Future chats must preserve these constraints and test cases.

## TASK 018 — explicit hide/show rows and columns

- View ribbon exposes hide selected row/column, show all previously hidden rows/columns. These are single-axis actions; no bulk hide yet. Zero-height/width geometry; data, formulas and cell formatting are preserved. Undo/redo is one transaction.
- Separate explicit visibility (`hiddenRows`, `hiddenColumns`) from auto-filter decisions. A sheet cannot hide every row or every column. Navigation skips hidden cells. Structural edits move hidden flags with row/column indices.
- `.qbook` preserves all flags. XLSX saves standard `row hidden` and `col hidden` attributes; on import, if a row is hidden by an active filter, XLSX does not distinguish it from explicit hiding. Import treats those as filter-hidden, documented as a compatibility limitation. Always preserve original Excel workbook.

## TASK 019 — home screen, sheet tabs and schedule (owner feedback)
- The owner rejected the oversized landing-page marketing copy (e.g. “Ваш офис”). Home is three clean editorial tiles: Sheets, Writer, Slides, with cohesive custom inline SVG icons. Sheets is real; Writer/Slides must clearly say planned.
- Keep recent files, import, backup and a small “Расписание занятий” template affordance. No separate installation for editor modules. Desktop-first design; browser remains provisional test environment.
- Sheet tab “+” creates a genuinely new sheet, no replacement. Inline rename on double-click, separate explicit pencil button, preserve id/content, reject duplicate/invalid names. Never confuse rename with new-sheet creation.
- Timetable starter has 7 weekdays, 30-minute rows, a separate pupils tab; it is only a starter, not a business-grade scheduling module. Autosave to browser localStorage is NOT a guarantee. Save .qbook and separate .qbackup frequently until native durable saving passes acceptance.


## TASK 019 — интерфейс шаблонов и заголовков (28.10.2026)

- Основное приложение — единое окно Quantum Office с выбором из трёх редакторов. Отдельная кнопка **«Шаблоны»** под каждой плиткой открывает именно каталог соответствующего типа. Тексты и презентации пока являются честно помеченными заглушками, никаких ложных сохранений и редакторов.
- Каталог Quantum Sheets содержит пустую книгу, **недельное расписание** по образцу пользователя, журнал учеников и учёт доходов/расходов. Открытие создаёт новую книгу и не изменяет файл шаблона.
- Эталон расписания: на первом листе «График» зелёная линия и заголовки, жёлтые блоки дней Пн—Вс, колонки «Ученики», «Класс / предмет», «Время занятий», «План занятий», «Результаты», «Примечание», «Проведено», «Стоимость», «Оплачено» и обзор недели справа; вспомогательные листы «Бухгалтерия» и «Партнёрка». Пользователь вводит реальные данные самостоятельно; придумывать имена учеников не следует.
- **Долгосрочная цель внешнего вида** — точный удобный макет, похожий на предоставленный пользователем XLSX, включая объединения ячеек и сложные границы. В TASK 019 объединения ещё НЕ поддерживаются: дни объединены визуально цветными блоками; настоящую модель merged cells и полноценный XLSX roundtrip реализовать отдельной задачей. Не выдавать приближённый макет за идентичный.
- Заголовки столбцов и строк должны быть строго закреплены в отдельных слоях DOM, а не прыгать при вертикальной прокрутке. Нажатие на букву выделяет весь столбец, на номер — всю строку, на треугольный угол — весь лист. Фактические пределы текущего движка: 2 000 строк × 100 столбцов; операции над чрезмерными выделениями запрещаются безопасно.
- На полосе листов оставлены **+** и закрытие листа; отдельную кнопку переименования удалить. Переименовать можно двойным щелчком по вкладке.
- Требование владельца: без активации и обязательного аккаунта, локальная работа, позднее нативная Windows/macOS сборка с безопасными обновлениями. Пока пользовательские рабочие данные хранить с резервной копией `.qbook`, XLSX поддерживается лишь частично.
- Обязательные проверки TASK 019: шаблоны и отдельные каталоги, корректность графика и `.qbook`, прокрутка с неподвижным заголовком, строки/столбцы/весь лист, двойное переименование, регрессии XLSX и буфера обмена.


## TASK 020 — selection-bound color tools, basic borders and wrap (2026-10-28)

- **Confirmed owner bug:** Chrome/Opera native color pickers may emit `change` after a different cell is selected. Capture workbook ID, worksheet ID and original selected rectangle on color picker activation (`pointerdown` / keyboard focus); apply the returned color to that saved rectangle. Do not silently apply the pending color to a different sheet. Regression test simulates deferred native `change`.
- The compact, preferred ribbon and the single-app architecture remain unchanged. Do NOT make toolbar buttons oversized.
- Added basic **all four thin borders** and **remove borders**, and **wrap text** formatting on selected cells. Wrap can enlarge affected row heights up to the supported limit; undo is atomic. These are real sheet model styles and are carried through `.qbook` and partial XLSX exchange.
- OOXML uses standard cell styles: `borders` with four thin edges, cell `borderId`, alignment `wrapText`. Import recognizes only exact thin borders on all four sides (not arbitrary partial, double or dashed styles). This is *not* full Excel border support. Keep original Excel files; complicated borders may be simplified.
- New tests: `tests/color_border_wrap.test.js`, `tests/color_border_browser.py`, `tests/color_border_xlsx_browser.py`. Browser test must confirm delayed color event targets original cell even if focus moves. XML test checks openpyxl and re-import.
- Next milestone: true merged cells (model, selections, formula behavior and XLSX roundtrip) with conflicts handled before mutations. Then conditional formatting, more number formats and robust native disk saving. Do not present a visual-only faux merge as real merged-cell support.

## TASK 021 — formatting palette, border menus, merged cells

- Owner specifically rejected native-only color pickers, indistinguishable symbols, and the old single “all borders” command applied to every cell. Keep the compact ribbon; each **text/fill color** button opens an in-app palette with preset swatches and a separate native custom-color field. Capture document, sheet and selected range at popover-open time. Palette actions affect that captured selection, not whatever is clicked next.
- **Borders** are an explicit dropdown: outer outline, all borders, top/bottom/left/right, none. Each style stores per-cell side flags for loss-aware XLSX roundtrips. Outline on B2:D4 must NOT draw borders around C3.
- **Merge / unmerge** are actual sheet-model operations with a `merges` array of canonical `{from,to}` rectangles; UI displays one merged region and XLSX uses `<mergeCells>`. The top-left cell is the only data-bearing cell; refuse merges when covered cells contain data instead of silently losing them. Reject overlapping merges, merges crossing frozen areas, filtered/hidden merges, and structural row/column edits until merge-aware rebasing is supported. Current alpha does not yet support inserting/pasting across merged regions; reject rather than corrupting data.
- Distinct compact SVG icons for color, merged ranges, border options and common navigation/visibility tools, without external fonts or network dependencies. Dialogs stay above fixed grid headers.
- User data policy remains: browser preview is not durable desktop storage; export `.qbook` and a separate backup for real work; XLSX complex features remain only partially supported.
- Acceptance: Node tests for overlap/data preservation/borders; Chromium dialog interactions, merge/unmerge and undo; XLSX roundtrip with `openpyxl`; all existing browser regressions; never claim full Excel equivalence.


## TASK 022 — safe merged-range clipboard and navigation (2026-10-28)

- Ctrl+C on the anchor of a single merged cell copies the **whole merged rectangle** (values, formulas, styling and merge geometry). Fully contained merges in multi-cell selections also copy. Partial selections that cut through a merge are rejected *without changing the workbook*.
- Ctrl+V into an unmerged destination transfers all merge geometry, moves relative formula references, keeps `$` absolute anchors, and is one undo transaction. Destination intersections with existing merges, invalid/malformed clipboard content, output outside 2,000 × 100 limits, hidden/frozen incompatible regions and formula translation errors are rejected before mutation.
- Movement via arrows skips the covered cells within the currently selected merged block (keyboard navigation); `Ctrl+X` with merges remains blocked to avoid silent loss of source geometry.
- Fill and row sorting involving any merged range are refused before changing cells. Structural insert/delete with merges remains explicitly blocked by existing safety policy until a separately tested reference-safe implementation exists.
- Native desktop app is still not released, and browser localStorage is not a guarantee of durable files. `qbook`/`qbackup` exports remain recommended for important work; XLSX import/export is partial.
- Acceptance: `npm test`, `npm run build`, `python tests/merged_clipboard_browser.py`, existing clipboard, structure and XLSX regression scripts; CI must pass before merge.

## TASK 023 — structural editing of merged cells (2026-10-28)

- Structural row/column edits are now merge-aware. Inserting **before** the first merged row/column shifts the entire merge; inserting **inside** the merged rectangle expands it. The content and formatting stay anchored at the upper-left cell.
- Deleting rows or columns **above/before** a merge shifts it; deleting a non-anchor interior band shrinks it. A resulting single-cell region ceases to be a merge.
- Deleting the band that contains the upper-left anchor of a merged region is intentionally rejected, even for an empty anchor: silently deleting that anchor or reanchoring its value is unsafe. Unmerge before this operation.
- Inserts that would push a merge outside 2,000 × 100 bounds, or grow it beyond 2,000 cells, reject without mutation. Active auto-filters still block structural operations. All edits occur atomically in the model and are covered by UI undo/redo.
- Tests: `tests/merged_structure.test.js`, `tests/merged_structure_browser.py` (real ribbon controls, undo, independent XLSX `openpyxl` check), all previous browser and model regression suites. The UI resolves a covered merged cell to its anchor; interior editing is supported by the model but selecting the interior of an existing merge through the name box currently resolves to the anchor.
- This is **bounded support**, not Excel-complete structural editing. Bulk inserted/deleted rows/columns, reorganizing references across sheets and advanced dynamic array formulas are still outstanding.

## TASK 024 — bounded multi-row/column structural editing (2026-10-29)

- Insert/Delete actions on the compact **Вставка** ribbon operate on the entire set of rows (or columns) covered by the current selection, max 100 adjacent rows/columns. Single-cell selection remains a single-row/single-column operation. Existing filtered sheets refuse the operation.
- The structural engine computes the final state once, without sequential single-row edits: values, styles, absolute/relative formula references, merges, custom dimensions, explicit hidden flags and frozen panes move consistently. The formula engine is still a limited MVP; range-references and advanced Excel structured references need later work.
- Deleting a band that intersects the top-left anchor of any merge refuses the whole action; deleting a non-anchor interior band shrinks the merge. Insertion at/inside merges shifts or expands them. Any out-of-bounds or 2,000-cell merged area is rejected before mutation.
- One operation means one undo step, with only the supported bounded result exported to XLSX. Keep existing `.qbook` backups; complex Excel workbooks are lossy.
- Required acceptance: `npm test`, `npm run build`, `tests/bulk_structure_browser.py`, and prior merged/structural/XLSX browser regressions.

## TASK 025 — conditional formula engine (2026-10-29)

- After TASK 024 was merged (squash `2eab3ffb184e77e38af3f3192bb92a1e75567f14`), formula support was expanded for tuition/timetable/accounting use: `IF`, `IFERROR`, `AND`, `OR`, `NOT`, `COUNTIF`, `SUMIF`, `ROUND`, `ABS`, `COUNTA`, `COUNTBLANK`, `LEN`, comparisons, quoted text and text concatenation. Both comma and semicolon argument separators are accepted.
- Parser produces a bounded AST, with lazy `IF`/`IFERROR` branches and no dynamic JavaScript execution. Preserve old SUM/AVERAGE/MIN/MAX/COUNT and cyclic-reference error behavior. Existing XLSX text formulas are left intact and recalculated in Excel on opening.
- Do not claim full Excel function compatibility. This is a bounded subset; cross-sheet references, dates and dependency tracking remain missing. Add new functions with independent Node and Chromium tests, and retain explicit file backups.


## TASK 026 — bounded inter-sheet references (2026-10-29)

- Formulas may read another sheet in the same workbook using `=График!A1` or `='Учёт оплаты'!B2`, including `$` anchors, same-sheet qualified references, `SUM`, `IF`, `COUNTIF`, `SUMIF` and same-sheet ranges with an explicit sheet prefix. Names with apostrophes use doubled single quotes. Quoted text literals remain separate.
- Recalculation on grid render follows current workbook content; cycle detection uses sheet-qualified cell identities. Missing sheets show `#REF!` and ambiguous case-insensitive sheet names are rejected on validation. Raw formula text survives `.qbook`/`.xlsx` export.
- IMPORTANT: shifting row/column references **from other worksheets** after structural changes, and editing sheet names referenced elsewhere, are NOT yet implemented. UI prevents structure editing, rename, and delete of a sheet targeted by formulas in other sheets rather than corrupt references. Explicitly remove those formulas before changing sheet layout; a later structural rewrite engine is needed.
- Cross-sheet formulas are a bounded subset; no 3D references (`Sheet1:Sheet3!A1`), external files, structured table references, name ranges or dependency-graph caching yet. Tested in `formula_sheets.test.js` and Chromium `formula_sheets_browser.py`. Large interlinked books can be slow until dependency tracking exists.
