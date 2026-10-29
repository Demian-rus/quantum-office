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

## Previously validated work item — spreadsheet clipboard, header selection and icons

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


## TASK 027 — bounded dates, times and calendar calculations (2026-10-29)

- Date/time cells use Excel-compatible **1900-system serial numbers** stored as decimal strings plus cell style.format; actual dates are not plain display strings. YYYY-MM-DD, DD.MM.YYYY, optional time and HH:MM[:SS] typed by the user are recognized only when unambiguous; invalid input is not silently normalized. [27]:15 is explicitly a duration.
- Supported display formats: date → ДД.ММ.ГГГГ, time → ЧЧ:ММ, datetime → both, duration → accumulated hours and minutes. Use the compact Главная > Число buttons. To calculate lesson duration, type e.g. 09:15 and 11:45, set result formula =B2-B1, then select the duration format to show 2:30.
- Formulas: DATE, TODAY, YEAR, MONTH, DAY, TIME, HOUR, MINUTE. DATE accepts bounded integer month/day overflow and normalizes it like Excel; directly typed calendar dates validate actual Gregorian dates. TODAY uses the device's local calendar date at calculation time, not an always-on timer or dependency graph. Underlying formulas evaluate numeric serial values; YEAR/MONTH/DAY of a date string (instead of a numeric serial) are not automatically coerced.
- Excel's historical fictitious 1900-02-29 is represented when a sheet contains serial 60, for compatibility, but it is not generated from a real Gregorian date. The application explicitly rejects XLSX with workbook date system 1904 and OOXML t=d ISO dates rather than importing with silently shifted/incorrect values.
- XLSX export uses OOXML numeric cells and standard built-in number formats (14 date, 20 time, 22 datetime, 46 duration), and preserves formula text; import maps common built-in and basic custom calendar/clock formatting. This is NOT full Excel number formatting support and does not imply lossless XLSX round-trip. Preserve original files and .qbook/.qbackup copies.
- .qbook stores serial values and allowed formatting tokens unchanged; pre-existing books still validate. The app's browser localStorage is not durable local-file storage.
- Required acceptance: npm test (including tests/temporal.test.js), npm run build, Chromium tests/temporal_browser.py with independent openpyxl checks plus all prior browser suites. Do not merge PR #27 before green CI. Desktop installers remain unimplemented.
- Next main engineering priority: safe and efficient calculation dependency graph, volatile function handling, further date/time and formula compatibility. Avoid refactoring unrelated spreadsheet UI.


## TASK 028 — snapshot-scoped formula dependency graph and calculation cache (2026-10-29)

- Each call to formulaContext(book, sheet, rawMap) now creates an **ephemeral calculation session** for an explicit workbook snapshot. It caches calculated formula results and parsed ASTs, and records actual evaluated reference edges in forward/reverse dependency maps across sheets, including ranges and formulas that branch through IF/SUMIF. The graph is built lazily, not by scanning the whole workbook. This does NOT implement a persistent Excel-style recalculation graph.
- Repeated formula references during the same grid render, CSV/clipboard export or other shared-context operation reuse the saved result. The session is NEVER attached to workbook data, .qbook/.qbackup or browser localStorage. Every fresh render builds a fresh formulaContext; structural edits, formula edits, undo/redo and new workbook loads therefore have no stale persisted cache. Contexts are read-only snapshots unless explicitly updated via updateCalculationValue.
- updateCalculationValue(ctx, sheetName, ref, value) is an optional **snapshot-only** helper for future incremental calculation work. It changes the calculation snapshot's raw map (NOT user data), invalidates all known reverse dependents and re-records edges after re-evaluation. UI edits must still use established workbook/undo mechanisms and build a new context. Do not use it as the source of truth for disk documents.
- Runtime graph indexing is capped at 120,000 edges. When exceeded, cached snapshot values remain usable, but graphComplete=false and explicit incremental snapshot edits are refused until a new context is made; never attempt dirty propagation from an incomplete index. Missing or malformed formulas retain established #ERROR!, #REF!, #CYCLE! behavior.
- Lazy IF/IFERROR dependencies and cached results require special care: evaluation paths that detect any cycle are intentionally not memoized. This avoids root-order-dependent results when IFERROR catches a circular-reference error. Date-sensitive TODAY is captured consistently within a session, and reevaluated when a new context is constructed (e.g. redraw or reopen), NOT by a background ticker at midnight.
- Acceptance: npm test and build, Chromium UI including A1 changes/undo and cross-sheet recalc, unchanged XLSX/.qbook formula semantics. New tests/dependency_cache.test.js verifies fanout, reverse dependencies, branch rewiring, cycles, snapshot isolation and benchmark timings (informational; no flaky performance threshold). New tests/dependency_cache_browser.py runs real browser events. CI must be green before PR merge.
- Limitations: this is **render/session-local acceleration** and a foundation for a future persistent incremental engine; rebuilding contexts across scroll/render remains potentially expensive. No parallel calculation, no multi-worker shared cache, no storage schema changes, no new Excel functions. Future tasks can profile very large interlinked workbooks and use change tracking for genuine across-render incremental recomputation, with explicit invalidation and safe rollback.


## TASK 029 — incremental recalculation across UI renders (2026-10-29)

- Quantum Sheets retains one workbook calculation context across grid redraws, scrolling, selection changes and style-only edits. The in-memory controller in `src/core/recalculation.js` uses TASK 028 cache/dependency maps; it is never serialized into user files, localStorage or Undo history.
- Normal mutations via `transact()` compare a pre-transaction Undo snapshot against the authoritative new workbook. For up to 512 changed raw cell values, the snapshot updates its raw maps, invalidating only affected transitive dependents across sheets. Unrelated cached formula results and parsed ASTs remain available.
- Large bulk changes, sheet structure/names/order changes, graph overflow, failure to reconcile, and workbook-object replacement (Undo/Redo, imports, cloned/other books, workspace restores) trigger a safe full reset. Display formatting always consults live cell styles even when numeric results are cached.
- TODAY is stable during one session and refreshes at the next calculation after the local calendar day changes, without any persistent timer.
- UI grid rendering, selection statistics, date/time edit display, column auto-fit and text-wrap row sizing share the cache. Separate clipboard and file exports continue evaluating from independent snapshots.
- Never mutate saved sheet.cells directly from application UI code outside transact; test fixture code must use transact or explicitly reset the calculation controller. Changes to geometry during resize are allowed as they do not change formula values.
- Required acceptance: npm test, npm run build, all Chromium suites including tests/recalculation_browser.py, and verified offline HTML/ZIP. Never merge with failed checks.
- Performance limitation: each transaction performs a bounded O(populated cells) value comparison against the existing full-book Undo snapshot. Formatting-only operations still perform this scan; future measured optimization may introduce source-based changed-ref journals with conservative fallback.
- Older failure of the separate Deploy browser preview workflow remains unresolved and does not prove a calculation or build failure; main Verify and Chromium smoke on TASK 028 were both green.


## TASK 030 — formatting and selection UX corrections (2026-10-29)

- Owner provided a real-sheet screenshot (A1:CV2000 selected) and reported unreadable all-green selection; fill color not undoing with Ctrl+Z; left/center/right buttons not visibly moving text; and confusion/failure when applying an outside border to multiple independent cells.
- The grid uses flex layout; `text-align` alone could not align anonymous text items. Grid appearance now uses `justify-content: flex-start/center/flex-end` based on persisted `style.align`, while retaining existing number defaults and format serialization. Both physical UI geometry and `.qbook`/XLSX styles must remain correct.
- Ctrl+Z/Ctrl+Y while focused on the address `#name-box` or an HTML color picker operate the workbook Undo/Redo history, not the browser input text history; actual formula editing inputs, search/replace and document title must retain native text editing. Color, align and border changes remain transactions and are undoable. Real Chromium keyboard tests are required.
- Selection now uses a light blue tint without obscuring custom cell fills; row/column axis headers use contrasting blue-grey with darker selected headers and a dark active row/column. Frozen selected headers receive distinct styles. Selection must remain legible when all 200,000 possible grid cells are selected; the UI still renders only visible cells.
- External border is a perimeter operation, no merging or clearing interior required, and preserves previous internal borders and data. Top/bottom/left/right presets affect only their respective edges; whole-sheet outline is legal (4,196 perimeter cells). All-borders and clear-all presets remain limited to 10,000 target cells. Prevalidate the 50,000 populated-cell workbook limit before adding new styled cells.
- Tests: `tests/formatting030.test.js` covers border geometry, whole-sheet outline, old thin interior preservation, merge independence and XLSX/qbook styles; `tests/formatting030_browser.py` covers fill Undo/Redo from name box, physical alignment, outline on ordinary unmerged cells, active header contrast and 200k-selected perimeter formatting. Required all Node + Chromium green before merge.
- Do not replace an imported workbook by a lossy XLSX roundtrip. The desktop/native editors are still not finished; explicit exports remain necessary.


## TASK 031 — grid hairline visibility, reliable fill undo, launcher rename and professional templates (2026-10-29)

- Owner provided two current screenshots demonstrating that selected white-filled ranges and selected empty grid were visually losing base grey hairlines. Selected `.grid-cell` now retains explicit right/bottom 1px cool-grey borders and keeps the translucent selection overlay inside them (`inset:0 1px 1px 0`). The user's stored cell fill remains visually distinct from temporary selection shading. Frozen cells use the same treatment. This is UI-only; there is no change to stored border metadata.
- Owner again reported that Ctrl+Z did not undo a fill. TASK 031 restores focus to the grid after palette actions, and routes Ctrl+Z/Y from the idle (unchanged) formula bar to the workbook. Typing a value into the formula editor or in-cell editor still uses the browser's normal undo. Clicking the ribbon Undo/Redo buttons is an alternative; both are now visible on the Home ribbon. Browser tests must show a real fill reverting without altering cell text.
- Home/launcher cards now have an explicit `Переименовать` action. It opens an accessible inline input with Save and Cancel, validates nonblank names, updates `workspace.books[].name` and date, persists through the existing workspace saver and keeps the workbook ID, cells, Undo history and number of books unchanged. Esc cancels.
- The previously simplistic schedule, journal and budget generators were redesigned with consistent visual hierarchy, wider fit-to-purpose columns, taller wrapped rows, merged section headings, clear alternating row/day colors, and a small number of clearly labeled illustrative rows (never impersonating real clients or payments). The weekly schedule preserves `A4=Пн`, `B2=Ученики`, `I2=Стоимость`, three sheet names, and freeze `{rows:3,cols:2}`; day labels A4:A8 etc are now merged. The support ledgers receive similar structure and simple debt formulas.
- The journal template has 8 practical fields, sample pupils explicitly marked as examples, section groups and a note column with wrapping. The budget template has 8 fields, sample transactions, cumulative balance and a summary row of formulas; numeric strings with currency/percentage formatting are displayed as formatted amounts without changing raw values or formula semantics.
- Existing personal/legacy books are not migrated or restyled. Improvements affect only newly created templates. `.qbook` structure, `XLSX` limited support and backup contract are unchanged.
- New `tests/templates031.test.js` verifies dimensions, merges, styles, budget formula results, `.qbook` and XLSX. New `tests/task031_browser.py` verifies selected grid hairlines even with white fill, real fill Ctrl+Z/Y with an idle formula bar, home rename persistence and all three templates. Existing launcher/template tests updated for new merged titles. Browser CI must be green before merging.
- Full desktop installation is not yet implemented. User data stored only in browser localStorage still requires explicit `.qbook` or `.qbackup` exports for durability.

## TASK 032 — stable frozen panes and whole-sheet formatting (2026-10-29)

- Owner observed frozen merged titles visually collapsing/reopening during scroll. Root cause: drawGrid recreated frozen row DOM on each scroll and offset it with scrollTop. TASK 032 renders frozen rows in a separate viewport-anchored clipped layer. During vertical-only scroll those nodes retain identity and fixed screen position. Frozen columns have a separate clipped layer. Frozen corner headers stay on top of horizontally scrolled merged headers.
- Previously, whole-sheet A1:CV2000 selection followed by align left/center/right failed at the 10,000 styled cell limit. setWholeSheetAlignment stores one validated sheet.defaultAlign value and clears old individual align overrides among existing populated cells. It affects empty/future cells without creating 200,000 entries. The action is undoable and no new full-sheet formatting limit is silently applied to ordinary bounded operations.
- The optional defaultAlign property is saved to .qbook/.qbackup and accepts only left/center/right/null. XLSX writes per-column styles for 100 columns plus explicit effective styles on populated cells, avoiding 200,000 cell elements. XLSX import recovers a uniform alignment covering all columns; clipboard captures effective alignment.
- New tests/task032.test.js checks sparse sheet-wide alignment, overrides, corruption rejection, native/XLSX style export and clipboard. New tests/task032_browser.py checks frozen merged-header element identity and y stability during repeated vertical scrolls; also horizontal frozen corner, empty-cell center alignment across all 200,000 virtual cells, and Undo/Redo.
- Limits unchanged: actual worksheet has 2,000 rows x 100 columns and max 50,000 populated cells; Excel's larger native grids require future re-architecture. Ordinary selected rectangle formatting above 10,000 cells is still bounded unless selecting the entire sheet for alignment.
- Known performance tradeoff: pinned column cells may be refreshed as visible row ranges change. No persistent storage of DOM or calculation caches; browser localStorage is not durable saving.

## TASK 033 — 100,000 virtual rows with cached geometry (2026-10-29)

- Owner previously requested a more Excel-like row range than the old 2,000-row alpha. TASK 033 extends Quantum Sheets to **100,000 rows x 100 columns** = 10 million virtual positions, without allocating 10 million DOM or cell records. **Populated cell limit stays 50,000 per workbook**; this is not the full 1,048,576-row Excel format. Existing .qbook, .qbackup and supported XLSX files remain valid.
- `gridGeometry(sheet)` caches a compact Float64Array of row and column positions by sheet object in a WeakMap. Geometry is invalidated after structural transactions and by row/column resize, visibility and filter changes. Grid scrolling, row selection and navigation reuse the same cached coordinates rather than scanning 100k rows at each scroll event. Frozen header behavior from TASK 032 stays unchanged.
- Formula scalar references permit row 100,000; AST/range expansion stays bounded to 10,000 cells and the previous token/depth limits. Individual cell and column operations, clipboard and sorting remain bounded, with explicit errors instead of unbounded allocations.
- Full-sheet alignment from TASK 032 now applies to A1:CV100000 as one sparse defaultAlign value with Undo/Redo, and high-row targeted formatting works. Whole-sheet exterior border on 10m cells is not implemented; materializing its perimeter exceeds the 50k cell cap.
- Dense formats remain bounded: `exportCSV` refuses rectangle expansion above 250,000 cells (save .qbook or XLSX for very sparse far-away values), `valuesTSV` refuses over 20,000 and clear-format guards size before creating an array. Do not convert a sparse 100k-row file to dense CSV without understanding the data loss/performance tradeoff.
- `tests/task033.test.js` covers geometry cache invalidation, row 100000 formulas and .qbook, high-row filters, CSV guard and sparse XLSX export. `tests/task033_browser.py` verifies last-row editing, virtualization, formula recalculation, Ctrl+Z/Redo and all-sheet alignment. Old boundary tests were moved from row 2000 to row 100000 where they were explicitly asserting out-of-bounds semantics. No prior user data is migrated.
- Limitations: prefix cache occupies about 0.8 MB per actively referenced sheet and is rebuilt after structural mutations; very large filtered worksheets may require more advanced indexing in future tasks. This is a bounded interim scaling improvement, not unlimited rows or full Excel compatibility.

## TASK 034 — sparse bulk cleanup for 100,000-row worksheets (2026-10-29)

- Full-sheet and whole-column Delete, format reset, and No Borders now traverse only actual `sheet.cells` entries. The prior blanket 10,000-selection limit is removed for **destructive sparse operations** without constructing 10 million empty cell references. Applies to arbitrary large rectangles up to the 100,000 x 100 virtual grid; populated workbook cap remains 50,000.
- `clearCellValues(sheet,from,to,inspectOnly)` clears values and formulas while retaining styles and merges. A styled cell with cleared content persists as a styled blank; unstyled cleared cells are removed from the sparse map. For active auto-filters, its geometry cache invalidates after a changed value. `inspectOnly` previews the actual edits without mutating so no-op UI actions do not push useless Undo entries.
- `clearFormatting(sheet,from,to,inspectOnly)` clears only the styles of populated/styled cells inside selection. Selecting the entire sheet also clears `defaultAlign`; partial-range resets do not change the sheet-wide default alignment inherited from TASK 032. This deliberately avoids materializing empty cells merely to override a global default. Formatting reset leaves cell content and formulas intact.
- `applyBorderPreset(...,'none')` clears existing legacy `border` and modern `borders` metadata over any large selection, preserving values and other style properties. The action creates no new styled cells. Adding `all` borders still remains capped to 10,000 cells, and outline/edge drawing still observes the 50,000 populated-cell limit; new 10-million-cell borders would violate the sparse storage cap.
- UI Delete/Backspace and ribbon `Очистить содержимое`, `Сбросить формат`, and border menu `Без границ` invoke these operations using existing Undo/Redo transactions. The hidden-row selection guard first checks sparse explicit hide flags; only an active filter scans its affected rows. Hidden data must not be inadvertently altered by a bulk UI action.
- Tests include `tests/task034.test.js` for full-sheet, far-row and partial-column clearing, merge safety, preview, no borders, default alignment reset, .qbook and XLSX. `tests/task034_browser.py` verifies the same in Chromium, including 10-million-cell selection and multi-step Undo/Redo with no-op history.
- Important boundary: coloring, font formatting, adding all borders and copying/pasting massive empty ranges still require a future sparse style-layer and/or streaming design. Only clear/reset existing sparse data/styles/borders is newly unbounded. Do not advertise full Excel parity or unbounded 50k-cell limits.

## TASK 035 — Undo/Redo in Russian keyboard layouts, scroll track and status bar (2026-10-29)

- Owner again reported Ctrl+Z apparently doing nothing for fill, deleted cell contents and movements, despite ribbon Undo working in earlier automated tests. Root cause in hotkey detection: earlier window `keydown` checked `e.key.toLowerCase()==='z'`/`'y'`, while Russian layouts may send `я`/`н` for the physical keys. Shortcuts now accept `KeyboardEvent.code==='KeyZ'/'KeyY'` with `.key` fallback for alternate keyboards. Ctrl+Shift+Z and Ctrl+Y both redo; Ctrl+D/R are also layout-independent. The shortcut does not hijack native text Undo while a cell editor or modified text input is actively being edited. Idle formula-bar focus invokes workbook history.
- Workbook Undo/Redo now gives visible, short success/no-history feedback and explicitly resets the nonpersistent recalculation cache after restoring a snapshot. Focus returns to the table so repeated shortcuts work. History remains in-memory and is not persisted across app restarts; the user should not expect undo across browser reload or file reopen.
- Vertical scrollbar used to extend behind the fixed column-letter header. The scroll viewport now starts 31px below the header overlay, and the grid canvas, row virtualization, cell editor and ensureVisible calculations have matching local coordinates. Verified that the first data row begins at the bottom of the header, and the native scrollbar gutter starts there too. Frozen header overlay remains anchored.
- Status bar shows only selection address and count/sum/average, without an unrelated module label or worksheet capacity. Font is larger and dark for readability, including responsive displays. This does not change calculation logic, saved books or screen reader labels.
- Required tests: `tests/task035_browser.py` simulates physical Ctrl+Z/Y events with Cyrillic `.key` and Latin physical `.code`, checks fill, Delete, Undo/Redo, idle vs edited formula fields, DOM/coordinate placement of scrollbar, frozen headers and minimal high-contrast status. All existing Node and Chromium workflows must pass before publication.

## TASK 036 — sparse full-sheet and whole-column formatting (2026-10-29)

- The owner confirmed working Ctrl+Z in TASK 035 and requested continued Sheets development. This phase permits fill, text color, bold, italic, wrap, numeric formats and alignment on selected full columns and the whole sheet without 100k row entries per column.
- Optional defaultStyle on each sheet stores the sheet-wide style. Optional columnStyles stores up to 100 individual column styles. getEffectiveStyle combines sheet, column, explicit cell, and legacy defaultAlign. A full-height style change removes conflicting per-cell and narrower column override for that one property, retaining actual contents, merges and unrelated styling. Old user files without these fields remain valid.
- Native .qbook/.qbackup persists these layers; XLSX exports real OOXML col style attributes for every relevant column, and actual populated cells receive effective styles. XLSX import reads col styles into columnStyles. The in-app clipboard copies effective style. Never materialize 10 million empty cells.
- Full-sheet alignment clears conflicting column style overrides. A full-column format reset removes its sparse style entry. Whole-sheet reset also clears defaultStyle and defaultAlign. Partial small-range reset leaves the inherited column/sheet style intact. Later exact rectangular sparse style overrides will require an additional architectural task.
- Only whole-height columns or whole-sheet selections gain these compact formatting options. Arbitrary partial rectangles larger than 10,000 cells continue to show the existing guard. Unlimited all-borders and massive data pastes are not implemented. XLSX compatibility remains partial and browser storage is not a durable native file.
- New Node and Chromium tests confirm 10m virtual position fill, column colors/alignment, per-cell precedence, Undo/Redo, sparse .qbook and XLSX serialization, corruption and clipboard.


## TASK 037 — sparse arbitrary rectangular formatting (2026-10-29, draft)

- Continue from merged TASK036 at main `097fb0a`. This task adds ordered `rectangleStyles` layers for partial rectangles (for example `B100:C90000`), with at most 256 layers per sheet. Color, text color, bold, italic, alignment, numeric format and wrap affect virtual cells without allocating one saved cell per position. The still-limited 50,000 populated cells and 100,000 x 100 virtual grid do not change.
- Precedence: sheet default → whole-column default → ordered rectangles → explicitly edited cell. A newer large rectangle supersedes older explicit properties within its area without deleting raw values, formulas or unrelated styles. Full-column updates remove/split rectangle layers for the same property so the new column format actually wins. Partial format reset subtracts the selected rectangle into up to four surviving exterior fragments; whole-sheet reset removes all layers. Undo/Redo captures every operation as one transaction.
- `.qbook` and `.qbackup` preserve the ordered layers. Validation rejects corrupt ranges, malformed style keys, noncanonical refs and unbounded layer counts. Copying small ranges captures the visible effective style.
- **XLSX hard safety gate:** arbitrary rectangle layers currently lack a proven lossless XML encoding + compact importer. The export must **refuse** a workbook containing any such layer with a clear `.qbook` instruction. Never silently omit styling. Existing Excel exports without rectangles continue functioning; future task must add trustworthy XLSX interoperability.
- **Structural safety gate:** row/column insert/delete and sorting are currently refused while rectangle layers exist, until address rebasing/style movement are implemented. Formatting and clearing a selected rectangle are supported; merges, data and formula values remain unchanged. Dense clipboard copying and all-cell borders retain their previous limits.
- Regression coverage: `tests/task037.test.js` (180k virtual cells, overlap precedence, no-fill mask, partial clear splitting, full-column supremacy, native persistence, clipboard, XLSX refusal, corruption and guardrails); `tests/task037_browser.py` (real palettes, 180k range, Ctrl+Z/Y, reset, native save and Excel refusal). Run full Verify and Chromium smoke before merge.
- Desktop-native durable saving, full OOXML fidelity and published installers are still NOT complete. Use explicit .qbook/.qbackup backups; native Tauri packaging awaits independent testing.


## TASK 038 — bounded XLSX exchange of arbitrary sparse rectangles (2026-10-29)

- TASK 037 is merged: `main` was `24c5261` before this task. This task adds a deliberately bounded, standard-OOXML export for up to **200,000 rectangular styled virtual positions** across a workbook. XLSX does not offer a single sparse arbitrary-rectangle style instruction: it needs actual styled `<c s="..."/>` entries for empty cells, so generation is limited before allocating large XML. Overlapping layer areas are conservatively summed; if over cap, export refuses with a `.qbook` instruction, preserving the native workbook unchanged.
- For supported rectangles, the Excel worksheet contains real styles for all affected positions, including an explicit `s="0"` blank cell that masks an inherited column fill. Existing stored values/formulas keep their effective style, without modifying the in-memory book. Whole-column styles still use compact OOXML `<col style>` entries.
- Large XLSX XML files with more than 50,000 cell elements and at most 250,000 elements are imported by compacting horizontally/vertically adjacent equal style IDs into ordered rectangular regions. Missing properties are written as null masks where column defaults require suppression. Actual populated cells still count against the 50,000 per-workbook limit; styled blanks do not. More than 256 noncoalescible regions, unsupported blank-cell borders or oversized content safely reject import instead of silently losing formatting.
- The existing defensive XLSX file and XML size limits (15 MB archive, 10 MB per XML part, 30 MB uncompressed total) still apply. Complex Excel features outside existing partial coverage remain unsupported; round-tripping foreign documents may be lossy. Always keep original XLSX and a .qbook backup.
- Acceptance tests: Node checks actual styled OOXML cells and oversize refusal; Chromium verifies a ~185k-cell rectangle with a no-fill hole against global fill, formula and far-row data, compact reimport and unchanged workbook. Verify + entire browser suite must both pass at final HEAD before merge.


## TASK 039 — browser-verified direct QBOOK saving and reopening (2026-10-29)

- Prior merged `main`: `579fc42143f0d8cd828573d4dadf7b0307cd7733` (TASK 038). This is **NOT a verified Windows/macOS native filesystem implementation**, nor an OS-level fsync/crash-durability guarantee. It improves the currently available browser File System Access workflow only where the browser allows it.
- A single global `saveHandle` was unsafe across books, and its previous error path automatically downloaded a file after a direct-write failure, then emitted a potentially misleading success message. TASK 039 replaces that with **session-only, per-workbook** `directFiles` handles, per-book busy locks and explicit `Сохранить как`. Handles are never embedded in `.qbook`, backups or browser localStorage, and are lost on browser restart.
- Opening via the dedicated **`Открыть с диска`** action reads, validates and links an actual `.qbook` handle. General import of `.qbook`, CSV, XLSX and `.qbackup` stays available and does not bind the user to a source file implicitly. A second opening of the same file becomes a distinct workspace draft ID to avoid clobbering an already-open document.
- Direct saving: validate the complete new `.qbook` snapshot, compare current disk contents byte-for-byte with the last known snapshot, only then invoke `createWritable().write().close()`, and read back contents to verify. A detected outside edit is a hard conflict (never force overwrite); use Save As to a different empty file. A Save As selection containing unrelated bytes is rejected. Writer errors are reported and aborted when possible, without falsely claiming that disk writes completed. If the workbook changes during an asynchronous save, report that only the earlier snapshot was written and retain an unsaved indicator.
- The compact top bar distinguishes a browser-only draft, changes not saved to disk, a verified direct file and browser-local persistence errors. Ctrl+S is physical-code aware even in a Russian keyboard layout; Ctrl+Shift+S means Save As. The File ribbon contains both choices and disk open. When the direct picker is unavailable, Save initiates an ordinary download and explicitly says the download is not proof of a disk write. No automatic download occurs on a failed direct save.
- **Limitations / warnings:** this is browser API verification only. Reading before writing is not atomic across other processes, and a successful readback does not prove crash-safe fsync; browser File System Access semantics and permissions vary. Direct handles disappear after reload, and there is not yet a native app tested on Windows/macOS, background durable autosave, rollback of an interrupted operating-system write, or conflict-free multi-window collaboration. Keep independent `.qbook` and `.qbackup` copies for important work.
- `tests/task039.test.js` verifies complete read/open, conflicts, byte comparison, failed write and close, post-write mismatch, invalid file and oversized file; `tests/task039_browser.py` uses fake browser file handles with actual UI to test two independent books, reopening, Save As, outside changes, failed writes and invalid files. Require full Node+build and Chromium smoke on the final commit before merging.


## TASK 040 — XLSX layout fidelity for real workbooks (2026-10-29)

- Owner supplied side-by-side screenshots of an Excel timetable versus Quantum Sheets; defects included differently proportioned columns and text and green-grey borders instead of original black. The actual XLSX file was **not** attached, so a pixel-exact match against the owner's workbook cannot be asserted; browser zoom also appears different (check both at 100%).
- XLSX import now reads `sheetFormatPr` base/default column width and default row height (Excel character widths and points) and persists them as optional `sheet.defaultColumnWidth`/`defaultRowHeight`. Virtual geometry uses these defaults instead of Quantum's 116x29 CSS-pixel defaults. Explicit imported columns/rows preserve safe narrow dimensions down to 12px; user-created interactive row/column resizing still uses the existing 22px/48px minimum. Validate imports and native QBOOK restores for bounded metadata.
- Cell `fontSize` (Excel points, 6..72) and a uniform `borderColor` survive imports, exports and native serialization; the real renderer converts points to CSS pixels, using stored border colors (including automatic solid black) instead of the fixed green-grey styling. Font sizes and border color are strictly validated to avoid unsafe style injection. The existing binary border sides remain, i.e. mixed border weights, per-edge colors, fonts/families, rich text and other advanced XLSX features are still partial.
- Workbook export writes `sheetFormatPr` when the metadata is present; OOXML font sizes and border colors are encoded instead of silently discarded. `tests/task040_browser.py` generates a real XLSX via independent openpyxl and verifies imported default/narrow widths, default/explicit row heights, black merged-cell border, 14pt font rendering, persisted QBOOK metadata and export independently read by openpyxl.
- Require full Verify + Chromium at final HEAD. No silent rewriting of owner files; screenshots are evaluation inputs, not test fixtures. Update the standalone Quantum-Office.html and ZIP along with source; provide direct downloadable standalone HTML artifact to owner for testing.
