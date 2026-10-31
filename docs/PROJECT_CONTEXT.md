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


## TASK 041 — sparse row and column border inheritance (2026-10-29)

- User's third screenshot shows rectangular gaps in dark table borders. Their white pixel backgrounds match the surrounding white cells, so the disparity may stem from missing border edges, not white fill itself. No user XLSX was attached; no exact-file fidelity claim.
- Identified importer losses: borders were stripped from Excel col style defaults and row default styles were ignored. This task retains safe borders and colors in sparse columnStyles and new rowStyles; no full-sheet cell allocation. The merged-cell edge renderer uses effective inherited styles instead of looking only at explicit cell styles.
- If an individual Excel cell has an explicit style without a border, it can mask inherited borders using an empty borders map. Unrepresentable huge masks refuse import instead of dropping edges silently.
- Native QBOOK validation and Excel export include the row and column defaults. Chromium test builds an independent XLSX with column borders, row borders, white fill, explicit no-border cells and merges, then tests computed CSS borders and export via openpyxl.
- Remaining limits: complete precedence parity for complex Excel files, per-edge line weights/colors, conditional formatting and exact visual comparison to the original XLSX.


## TASK 042 — XLSX theme and indexed palette fills (2026-10-29)

- The owner asked to continue after TASK041. The owner workbook XLSX is still not attached, so root causes of any remaining color mismatch cannot be proved by the screenshot alone.
- Additional confirmed importer limitation: `stylesFromXML` only supported `rgb` attributes. Excel also uses `theme` and `indexed` colors, often for fills, fonts and borders. Unsupported colors silently appeared as default white/black.
- TASK042 resolves the workbook's real OOXML theme color scheme from its theme relationship and `clrScheme`; crucial SpreadsheetML ordering: theme 0=lt1 (white), 1=dk1 (black), 2=lt2, 3=dk2, 4–9 accent1–accent6. Supports `sysClr.lastClr`, `srgbClr.val`, legacy default indexed palette, optional custom `indexedColors` in styles.xml, and Excel-style luminance tint. A bounded default Office palette is used if the theme part is absent. Converts on input to existing safe #RRGGBB fields: no workbook schema change, no dense cell materialization and no external network.
- Independent browser test writes themed fills with custom accent1 and tinted variants, indexed fill, theme font/border via openpyxl; replaces real theme1.xml entry to prove no hardcoded accent. It verifies computed CSS, .qbook serialization and Excel export, plus Node tests for theme ordering/indexed/tint. Preserve the user's original source XLSX.
- Still unsupported: patterned/gradient fills, conditional formatting, alpha/transparency, full custom workbook theme roundtrip (export is resolved static RGB) and all advanced Excel drawing and font features. No pixel-perfect claim for the user's file without the actual XLSX.


## TASK 043 — per-side Excel border fidelity (2026-10-29)

- Owner continues requesting XLSX rendering fidelity. Prior TASK041 recovered row/column borders, TASK042 themed colors. This task targets different line styles, weights and colors within a single cell and on merged boundaries.
- Existing `borders` boolean sides and optional `borderColor` are retained for backwards compatibility. New optional `borderEdges` maps top/right/bottom/left to validated {line,color?}, where line is an enumerated Excel border style. It is sparse (only explicit cells and existing axis styles), not a dense 100k-row grid.
- Import parses true OOXML side style and resolved per-side theme/indexed/RGB colors. Grid rendering chooses per-edge CSS width, solid/dotted/dashed/double and color, and merged cells inspect actual boundary edges. XLSX export emits specific styles and colors for each side; legacy `thin` self-closing OOXML remains unchanged. Native QBOOK roundtrip preserves new optional metadata; malformed values are rejected, not injected into inline CSS.
- UI border presets reset imported edge metadata before assigning thin preset strokes; previously supported formats continue to behave as before.
- Tests: Node validates schema, legacy preset & XLSX style XML; Chromium generates independent openpyxl workbook with mixed sides on cells and a merge, checks actual computed CSS and QBOOK and exported XLSX reopened in openpyxl. Verify + complete browser smoke required at final HEAD.
- Remaining parity limits: exact dash-dot patterns mapped to supported CSS dashed strokes; Excel rich text, gradients, conditional formats, drawing objects and exact owner-file comparison need separate work. Original owner XLSX still not supplied.


## TASK 044 — atomic edit transactions and Excel-style Ctrl+Enter (2026-10-29)

- The owner confirms that Excel imports now look good and asks for continued editor functionality. Prior main `544eb7ba14b49e05e84cf97d087b8629de91c043`, TASK043 green. This task addresses editing/data-safety rather than further import work.
- **Confirmed atomicity defect:** the old `transact()` saved an Undo snapshot before invoking a mutation, but on an exception it did not roll back modified workbook content, removed the Redo history and left a failed Undo entry. New flow clones the active workbook once, stages its Undo snapshot, runs the mutation/recalculator and restores the exact original book and original Undo/Redo stacks on any synchronous failure. Geometry and formula cache are reset. Only successful changes mark the book dirty or persist to localStorage.
- **Ctrl+Enter** when editing a multi-cell selection now enters a single typed value/formula into all selected cells (up to 10,000). Relative references are translated from the active top-left anchor while absolute $ references remain fixed; existing individual styles are preserved, typed date/time formats retain existing parser behavior. Hidden rows/columns and intersecting merged cells are refused rather than overwritten. Fill is fully staged before mutation, checks the global 50,000 populated-cell limit and becomes a single Undo/Redo transaction.
- Plain Enter, Tab, Escape, Ctrl+D/Ctrl+R, ordinary cell editing and keyboard shortcuts retain their prior meanings. Single-cell Ctrl+Enter commits normally. Browser status only claims success if the operation completed.
- Unit test tests formulas, style retention, limits and native QBOOK roundtrip; Chromium covers real name-box selection, typing, physical Ctrl+Enter, one-step Undo/Redo, injected failed partial mutations, preservation of Redo history and refusal on merged selections. Run full Verify+Chromium on final HEAD before merge. Refresh standalone Quantum-Office.html and ZIP; attach real local artifact to user in every response.


## TASK 045 — deferred same-sheet cut and atomic move (2026-10-29)

- Owner requested continuing editor work after TASK044, whose main is `5f19e2b39414831e7f85a5708be5d41e89f4968a`; both Verify and Chromium were green on main.
- **Confirmed prior defect:** Ctrl+X synchronously copied and then immediately called `clearSelected()`, deleting source values before any successful paste. A failed, cancelled or external paste could leave the user with an empty source.
- Ctrl+X now captures a session-only `mode:'cut'` snapshot of cells, displayed styles, complete merged regions, original book/sheet IDs. Source is **not** mutated on cut. Ctrl+V on the same sheet verifies source remains byte-equivalent at the model snapshot level, validates hidden areas, overlap, freeze/merge compatibility and capacity, stages the entire move using a cloned sheet and only commits the complete result in one `transact()`. Source content and individual styles are cleared only when the destination has been applied successfully. Source and destination may overlap; complete merged regions may move as a unit; partial merges and foreign merged destination areas are refused.
- **Conservative formula integrity:** references to any moved source cell or intersecting range from existing formulas on the same book are detected and the move is refused with an explicit explanation. Moved formulas referring outside the moved source keep their original textual references (rather than being translated as a copy would). Rebinding dependent references correctly is future work; no silent formula loss. Cut to another workbook or sheet is refused; copy/paste remains the supported cross-document option.
- Cut clipboard is consumed only on a successful move; a failure leaves source, target, undo/redo and cut metadata unchanged. Browser native `cut` events and physical Ctrl+X both work, including Russian layouts. External text paste is not treated as a move if it differs from internal cut snapshot; browser clipboard API permission failures retain the in-app cut snapshot.
- Test `task045.test.js` covers overlapping moves, complete merged ranges, QBOOK roundtrip, stale source, hidden areas, cross-sheet refusal and dependent formula references. `task045_browser.py` performs physical Ctrl+X/V, one-step Undo/Redo, overlap, stale failure, merge and formula guard in Chromium.
- **Limits:** cut selection at most 10,000 cells, direct move is only same sheet; entire rows/columns, sparse whole-sheet style layers, external or multi-window clipboard and broad Excel reference rewrite semantics are not supported as a semantic cut/move. Continue protecting original files and .qbackup.
- Keep `Quantum-Office.html` and .zip current, test final HEAD with Node Verify and complete Chromium smoke, and deliver a direct downloadable HTML each response.


## TASK 046 — formula reference rebasing on atomic cut/move (2026-10-29)

- TASK045 (main `755f8ea9eb0a3c697f9c70db55c1344007a45854`) introduced deferred atomic same-sheet Ctrl+X/V but conservatively blocked moving any cells referenced by formulas. Main Verify and Chromium green before work.
- New `src/core/reference-move.js` rewrites formula references **only when an actual same-sheet cut move successfully commits**. Formula cells within the moved range and all existing dependent formulas in other cells/sheets are processed on a staged destination. Single refs and complete rectangular ranges wholly contained in the moved source change to their corresponding destination coordinates. Absolute `$A$1` references follow the moved cell while keeping their absolute markers. Sheet-qualified references (quoted and unquoted), Unicode sheet names and double-quoted formula string literals are preserved correctly; unqualified references on other sheets are not changed.
- Conservative scope: a formula range **partially** overlapping the move rectangle rejects the entire move before mutating any workbook cell. Unsupported external workbook references, Excel structured tables, complex unions or advanced AST semantics need a future bounded parser, not silent rewrites. Unrelated references (including references in moved formulas pointing outside the source) remain unchanged, unlike copy/paste relative shifts.
- All affected formulas across sheets are validated and staged before the active sheet contents and dependent formulas are committed. A refusal leaves source, target, other sheets and Undo/Redo intact via TASK044's atomic transaction. Existing stale cut, overlap and merged-region guards remain.
- Tests `task046.test.js`: absolute/relative refs, quoted/unquoted sheet names, string literals, full/partial ranges, inside formulas, multiple sheets, overlapping move, QBOOK persistence and atomic refusal. `task046_browser.py`: real Ctrl+X/V, other-sheet formulas, Undo/Redo and partially intersecting range refusal. TASK045's previously expected dependency refusal is revised only for cases that can now be safely rebound.
- Required full Node Verify and complete Chromium smoke at final HEAD. Refresh offline Quantum-Office.html and ZIP and always attach user-downloadable HTML.


## TASK 047 — external Excel links and Unicode sheet names (2026-10-29)

- Confirmed TASK046 bug: cut/move from Source!D5 rewrote `[Budget.xlsx]Source!D5` (an **external** workbook reference) as though it targeted the current book. Bare Unicode `Résumé!D5` was misparsed as an unqualified local D5.
- Tokenization now recognizes Unicode letters/numbers in identifiers and unquoted sheet qualifiers. Explicit external [Book.xlsx] prefixes and otherwise unsupported bare qualifiers that overlap moved coordinates are **rejected before mutation**; no silent rewrites.
- Local, quoted, absolute and ranged references continue to work. Does not implement external workbook calculation or full formula AST. Tests: Node + Chromium real Ctrl+X/V, Undo/Redo, atomic rejection. Use original XLSX as backup.


## TASK 048 — Excel-style Paste Values (2026-10-29)

- A new compact ribbon action «Вставить значения» (Home/Edit) and physical Ctrl+Shift+V paste **snapshotted computed results**, not formulas or source styles. The target's existing styles remain. Requires an in-app Ctrl+C snapshot; standard Ctrl+V continues copying styles/formulas.
- The values-only path rejects deferred Ctrl+X cut, any target merge, hidden destination rows/columns, out-of-bounds targets and workbook cell-cap overflow before mutating the sheet. It is one Undo/Redo transaction, and persists to QBOOK.
- Safety limitation of TSV snapshot: embedded tab/newline results and literal result strings beginning with '=' are refused rather than silently reinterpreted as formulas. Proper typed literal results require a future typed clipboard model. This operation is not the full Excel Paste Special menu.
- Node and Chromium regression tests, including physical keyboard, formula result, formatting, undo/redo and rejection; preserve offline HTML+ZIP.


## TASK 049 — structured Paste Values clipboard (2026-10-29)

- After TASK048, the in-app Ctrl+Shift+V incorrectly rejected formula results and text containing embedded tab/newline characters because its one-dimensional TSV split cannot distinguish separators inside cell content. This task adds a two-dimensional `clip.values` computed snapshot at copy time; the text TSV remains unchanged for external apps and the normal Ctrl+V still copies source formulas/styles.
- Paste Values checks snapshot dimensions, string value types, text consistency, hidden rows/columns, merges, cell limits and no-cut mode before any writes. Existing destination formatting survives; source edits after copying do not change paste results; a single Undo/Redo and native QBOOK roundtrip remain.
- Intentional limitation: raw strings starting with `=` are formulas in the current cell schema. Literal results starting with `=` are rejected rather than becoming unintended calculations. Typed cell metadata requires a separate future task with XLSX, QBOOK and editor validation.
- `tests/task049.test.js` covers snapshot exactness, cross-sheet formulas, malformed clips, ordinary Ctrl+V, QBOOK and refusal of `=` literals. `tests/task049_browser.py` uses physical Ctrl+C and Ctrl+Shift+V in Chromium, Undo/Redo, serialized QBOOK and failure atomicity. Do not merge without Verify and full Chromium smoke on final HEAD. Keep standalone HTML and ZIP current.


## TASK 050 — offline sheet charts (2026-10-29)

Adds real bar, line and pie charts from two-column category/value ranges of 2–51 rows, with an optional text header. The compact chart panel supports switching type, changing title and deleting; values and formula results are read live from the workbook. Chart metadata is validated and stored in sheet.charts (up to 30), persisting through QBOOK and backup. Chart references shift with row/column structural operations when possible; unsupported destructive edits refuse atomically. All SVG labels are escaped. XLSX export explicitly warns charts are NOT exported; preserve native .qbook. Unit and real Chromium regression tests added. Merge only with passing Verify and full Chromium smoke on final HEAD.


## TASK 051 — conditional formatting (2026-10-29)

Adds display-only conditional fills to Sheets: number greater/less/equal, text contains, and two-color min/max scale. Rules are attached to a bounded selection (max 1,200 cells each, max 24 per sheet) and stored separately from manual cell styles as `conditionalRules`. Every visible grid redraw evaluates current formula results; chart functionality is not changed. New compact manager on the Home tab lets owners create and remove rules, including custom highlight color. `validateWorkbook`, `.qbook` and backup carry strict rule validation. `changeSheetStructure` shifts rule ranges and aborts atomically if the rule would be destroyed. Undo/Redo use existing transact and history. Full Excel OOXML conditionalFormatting import/export is NOT implemented; XLSX export explicitly warns to save .qbook. Tests task051.test.js and task051_browser.py verify live styling, numeric/text matches, scales, schema integrity, QBOOK and structure. Require green final-head Verify+Chromium before merge.


## TASK 052 — dropdown and numeric Data Validation (2026-10-29)

Data ribbon provides creation/removal of bounded validation rules: list with 2–30 unique nonformula choices (semicolon/newline separated) or inclusive numeric interval. The active single cell in a list shows a real dropdown in the formula bar. Rule metadata stored in sheet.validations (max 32, max 4000 cells each, no intersecting ranges); schema is validated by validateWorkbook and persists in .qbook and backups. Blank input is permitted; formulas bypass direct input validation and their computed results are not yet validated. setCell, typing, TSV, in-app clipboard copy, values-only paste and filling enforce valid destinations, preventing partial writes; cut/move validates target before committing. Structural edits shift affected source ranges or refuse destructive operations. Supports Undo/Redo. XLSX import/export of these rules is not implemented; editor warns that .qbook should be retained. Tests task052.test.js and task052_browser.py cover model/runtime, atomicity, schema, QBOOK and history. Keep standalone HTML/ZIP current; merge only with green Verify and Chromium smoke at final HEAD.


## TASK 053 — print preview, layout, pagination (2026-10-30)

Sheets gains a genuine **Print Preview** action in File and View ribbons. It prints either the used cells or a separately saved selected print area, supports paper A4/Letter, portrait/landscape, percentage scale 60–125%, fit-to-width, headers (workbook and sheet name), row/column headings and page numbers. A bounded offline HTML layout uses the current evaluated/formatted cell contents, retains manual fills, and composes pages by visible row/column dimensions; browser-native `window.print()` is invoked only on user click and a print-only stylesheet hides the entire editing interface. Max 12,000 cells / 60 pages; merges cannot cross page splits. Preferences saved in sheet.printSettings and persist in .qbook and backups; structure edits shift safe stored areas or atomically refuse destructive deletes. Excel XLSX Print Area and page setup are not imported/exported; only .qbook preserves these preferences. Node tests task053.test.js and real Chromium task053_browser.py check UI and print intercept. Publish HTML/ZIP and only merge after passing Verify and full Chromium smoke on final commit.


## TASK 054 — XLSX data-validation roundtrip (2026-10-30)

Excel import/export now supports native dropdown lists stored as inline quoted OOXML `dataValidation type=list` and inclusive decimal-number intervals (`type=decimal operator=between`), including single-cell or rectangular sqref, Unicode escaping, saved .qbook and active restrictions after import. Export stops clearly for list items containing commas/quotes or a 255-character overflow rather than silently rewriting values. Excel formula-sourced dropdown lists, whole-number-only validation and other unsupported validation types are not imported; browser import status reports counts of skipped rules, avoiding a false completeness claim. Existing unsupported XLSX charts, conditional formatting and print settings remain out of scope. Node tests cover XML escaping and refusal, Chromium tests inspect real zipped worksheet XML, import/export/re-export, invalid cell rejection and unsupported Excel rules. CI must be green on final head before merge.


## TASK 055 — XLSX conditional formatting exchange (2026-10-30)

- Source baseline: merged TASK054 at `ee8debb748b68247190d706efd063f58a3544844`.
- Export supported native fill-only rules as standard OOXML `<conditionalFormatting>`: numeric greater/less/equal, exact string equality, case-insensitive contains-text and 2-point min/max color scales. Colors of non-scale rules use proper differential `<dxfs>` styles in `xl/styles.xml`, not duplicated underlying cell fills. The workbook and manual cell styles are not modified when exporting.
- Import supported Excel `cellIs`, `containsText` and two-point `colorScale` into bounded native `conditionalRules`. Excel's priority numbering is translated to native rule order. Two-color scales now optionally preserve their exact `lowColor` / `highColor` endpoints; older .qbook files use the legacy defaults. The original 24 rules and 1,200-cell-per-rule limits remain.
- Unknown or non-fill differential styles, unsupported predicates, stop-if-true rules, unusual scale definitions or invalid/out-of-bounds ranges are **skipped with a counted warning** on XLSX import, not silently claimed as supported. No guarantee that arbitrary Excel conditional formatting is lossless. Imported rules still pass native workbook validation; invalid native exports fail rather than writing misrepresented conditions.
- UI: reflect supported XLSX rules in both panels and export status, show imported/skipped conditional counts, and render imported scale swatches with the original colors. Charts and print settings remain .qbook-only.
- Tests: `tests/task055.test.js` validates DXF indexing, standard rule types, priority, XML escaping, custom-scale .qbook persistence and corruption guards; `tests/task055_browser.py` tests live export → import → re-export and unsupported-rule reporting. Verify (`npm test`, build) and full Chromium workflow must pass before merge. Offline HTML + ZIP are generated by `scripts/build.mjs` and attached as CI artifacts.
- Safety: native .qbook and a separate backup remain recommended before opening/saving important Excel workbooks. This is a limited XLSX compatibility milestone, not Excel parity.


## TASK 056 — XLSX chart parts and drawing interoperability (2026-10-30)

- Baseline: TASK055 merged at \`36a997ebcbd0ab722ddb11f60a690c3b9af7dc08\`. New interoperability is bounded to the three native chart types: vertical bar, line and pie, single series from adjacent category/value columns and at most 50 source intervals.
- Excel export uses native OOXML \`xl/charts/chartN-M.xml\`, \`xl/drawings/drawingN.xml\`, drawing relationships, worksheet relationships and package Content_Types overrides. It writes formula references to the existing worksheet source ranges plus calculated caches, not screenshots or flattened images. Chart source formula values can recalculate after spreadsheet edits.
- Imports Excel drawings only when the chart has a supported type and one referenced series from two adjacent columns on the same worksheet, and native \`chartData\` validates the result. Handles sheet names, text titles and an optional header. Unsupported/external/invalid chart parts are counted in \`skippedCharts\` and displayed as warnings, never presented as imported.
- Import follows local package part relationships only, rejects unsafe relative traversal, and does not make network requests. It does not import arbitrary Excel multi-series charts, horizontal/stacked bar, mixed/combo charts, chart-specific formatting, freeform positioning, external sources, trendlines or pivot charts. Chart positioning on export uses deterministic right-of-data anchors rather than pixel-perfect Excel placements.
- The new \`src/core/xlsx-charts.js\` implements chart OOXML without touching native chart rendering and computations. \`src/core/xlsx.js\` adds parts/hooks; \`scripts/build.mjs\` bundles the new module offline; UI states compatible exports and reports skipped objects.
- Automated coverage: \`tests/task056.test.js\` checks XML caches, source formulas, drawing relationships, title escaping and safe local paths; \`tests/task056_browser.py\` validates real ZIP package export → import → update data → re-export, and warns on unsupported horizontal charts. Full Node Verify, build and complete Chromium matrix are required.
- Full native chart feature parity and full XLSX fidelity are still unimplemented. Important files require independent \`.qbook\` backups.


## TASK 057 — usable one-click diagrams, including empty source ranges (2026-10-30)

- Owner reported that trying to create charts on the spreadsheet failed even after selecting cells. Root cause: TASK050 called strict chartData() *before* adding a chart, requiring an exact 2-column selection and populated numeric categories. Charts were blocked instead of created.
- The Insert tab now creates a chart with a single click from an empty sheet and never populates sample values in the user workbook. Blank chart A1:B6 renders an explanatory visible SVG placeholder and is saved in .qbook. Selecting one cell next to an existing adjacent category/value table attempts bounded auto-detection of that table. A wide multi-column selection uses the first two columns within the existing 51-row cap. Real filled 2-column selections retain their exact source.
- The chart sidebar exposes an editable source-range input with Apply and Use selection; new ranges must be two adjacent columns and 2..51 rows; updates are validated before mutation and are atomic Undo transactions. Changing chart type on empty data is permitted. The preview updates when source data are typed. Missing or malformed data are not invented or silently modified.
- TASK056 OOXML chart writer/importer now allows a fully blank source to have a zero-point cache, keeping its source range and chart object on XLSX roundtrip. Partially invalid nonempty charts still produce a clear data error instead of being misleadingly serialized.
- Tests: tests/task057.test.js (empty chart, native persistence, data detection, range change, empty OOXML) and tests/task057_browser.py (real Insert click on blank workbook, rendered placeholder, empty XLSX roundtrip, source editor, data updates, auto-detection and malformed source). Full Node, build and full Chromium CI required before merge.
- Limitations: chart support remains deliberately one-series, two-column, and 2..51 rows. This phase fixes usability of creating and linking charts, not multi-series/pivot or advanced formatting. Continue spreadsheet functionality after this verified fix.


## TASK 058 — XLSX print setup + per-sheet print area interoperability (2026-10-30)

- Baseline: TASK057 main \`4597be9af28e4f19023ff9d567ec93804019a2d5\`. Existing print dialog and .qbook remain unchanged. The new \`src/core/xlsx-print.js\` supports native Excel \`pageSetup\`, \`sheetPr/pageSetUpPr\`, and sheet-scoped \`_xlnm.Print_Area\` in workbook \`definedNames\`.
- Export: A4 (OOXML paperSize=9), Letter (1), landscape/portrait, scale 60/75/90/100/125, fitToWidth and a single rectangular print area per sheet. Uses sanitized, quoted Excel sheet names, escaped apostrophes and absolute refs, and emits standard fixed margins only (Quantum does not offer margin controls).
- Import: per-sheet mapping with \`localSheetId\`, validation of local rectangular range only, and counts for imported/skipped print settings. Multi-range, external references, unsupported paper sizes/scales or custom fit-to-page combinations are not silently claimed as preserved. Existing native defaults remain when unsupported and warning count is shown in the import status.
- Limitations: custom page margins, headers/footers, repeating titles, manual page breaks, per-page scaling and print quality settings are not represented by Quantum. Excel may paginate differently from the browser preview. Save .qbook backup for critical files.
- Coverage: \`tests/task058.test.js\` verifies page setup mappings, scoped area XML and unsafe ranges; \`tests/task058_browser.py\` checks 2-sheet XLSX export/import/re-export, .qbook, partial unsupported warnings and UI preview. Existing complete Chromium suite, npm tests and offline build must pass before merging.


## TASK 059 — draggable, resizable charts on the grid (2026-10-30)

- Baseline TASK058 merged at \`7bb040a4bb6b25d2fdd853682eb6a9ed49d6ef00\`. User explicitly wants actual Excel-style chart objects on the sheet, not merely a sidebar chart preview.
- Diagrams appear immediately as floating objects over the sheet cells with title handle, settings button and lower-right resize handle; the prior sidebar remains available for chart type, title, data-source changes and deletion.
- \`chart.layout\` is an optional validated \`{x,y,width,height}\` object in sheet-content CSS pixels. Newly created charts get deterministic sheet positions. Previous .qbook files without layout are accepted and rendered at a stable default.
- Pointer movement and resizing update only a temporary DOM preview; release commits one atomic \`transact\` for Undo/Redo, with existing rollback and autosave. Coordinates are bounded to the sheet dimensions (width 280–1000px, height 190–700px) and rendered in a persistent overlay sibling to the virtualized grid canvas. Scrolling moves charts with the sheet without triggering chart recreation or changing chart coordinates.
- XLSX export encodes sheet positions and dimensions as native xdr:twoCellAnchor \`from\`/\`to\` markers with OOXML EMU offsets. The importer recovers the anchor for supported drawings, falling back to a native deterministic layout if the imported anchor is outside Quantum's supported bounds. Source formulas and chart data are unchanged.
- Tests: \`tests/task059.test.js\` tests validation, QBOOK/legacy migration and drawing anchors; \`tests/task059_browser.py\` exercises visible sheet objects, pointer movement/resize, Undo/Redo, sidebar controls, worksheet scrolling and XLSX import/export pixel layout.
- Intentionally still single-series, adjacent-two-column data source and no freeform rotation, complex Excel chart controls or multi-series pivot graphs. Imported Excel formatting and unsupported extreme sizes may differ. Native .qbook backup remains recommended.


## TASK 060 — multi-series clustered bar and line charts (2026-10-30)

- Baseline TASK059 published at \`b129f9225aa20c70412f959aa403925f7b783333\`. Multi-series support extends category-first data ranges to 2..5 adjacent columns, giving 1..4 numeric series, with up to 51 selected rows per chart. Existing one-series charts stay compatible. Pie deliberately remains exactly one numeric series.
- Category labels come from the first selected column. When the first row contains text in all numeric columns, those cells name the series and are excluded from value points. Values remain linked to live worksheet data and formulas, including cross-sheet formulas. Incomplete or nonnumeric populated rows produce a visible error instead of fabricated data.
- Grouped bar charts draw color-coded bars side by side; line charts draw one independent colored line per series. Both draw an escaped legend for 2..4 series and preserve safe SVG rendering. Empty chart creation still works.
- One-click chart creation detects a block of adjacent values near the selected cell; wide selections use up to 4 numeric columns and the sidebar allows setting explicit ranges like A1:D6. Attempting to switch a multi-series graph directly to pie is rejected atomically until a 2-column source is selected.
- XLSX exporter writes one \`c:ser\` per series with separate \`c:cat\` and \`c:val\` formula references plus computed caches; source headers become chart title references. XLSX importer supports exactly 1..4 adjacent numeric series sharing the same category and row range on the same local sheet, and rejects unsupported disjoint/external/mixed/pivot sources without inventing data. In-sheet position and size remain preserved.
- \`tests/task060.test.js\` and \`tests/task060_browser.py\` cover grouped bars, multi-lines, formulas, QBOOK, source editing, atomic type validation, Excel roundtrips and unsupported-series warnings. Full Node and Chromium CI must pass before merge.
- Still no stacked/100% bar, scatter, dual-axis, trend lines, arbitrary range unions or pivot charts. Maintain .qbook backup for important Excel files.


## TASK 061 — chart display and axis controls (2026-10-30)

- Baseline published TASK060 at \`26126a1eca4b66efd36fb9a7bc7d5e25317a2934\`.
- Charts now optionally store a bounded \`chart.options\` style object: \`labels\` (value display), \`legend\` (bottom/right/none), \`grid\` (boolean), \`colors\` (up to four 6-digit #RRGGBB values), \`min\` and \`max\` (optional finite numeric axis limits, -1e12..1e12 with min < max). Legacy charts without options remain valid and render with defaults.
- User can edit these through chart settings; all updates use atomic transaction/Undo and refresh both the on-sheet chart and sidebar. Inputs escape text; the model accepts only safe hex colors and finite axis numbers.
- XLSX chart export writes native OOXML \`c:legend\`, \`c:dLbls\`, per-series \`c:spPr\` colors, axis \`c:min\`/\`c:max\`, and \`c:majorGridlines\`. Import reads the same limited supported subset back into native chart options. This does not claim to preserve arbitrary Excel chart styles.
- Native colors apply to line and grouped-bar series; pies retain per-slice automatic colors. Value labels are sampled at up to 12 category positions per series in the SVG to preserve legibility; Excel can display all values.
- Tests \`tests/task061.test.js\` and \`tests/task061_browser.py\` cover validation, QBOOK, type handling, Undo and OOXML interchange. Both full CI workflows must pass before publishing.


## TASK 062 — stacked and 100%-stacked column charts (2026-10-30)

- Baseline published TASK061 at \`b23f6a3f18b645e407e333c2b32261ae84c2b53d\`. Chart types now include \`stacked\` (ordinary stacked columns with independent positive/negative cumulative segments) and \`stacked100\` (100% normalized stacked columns). Original \`bar\`, \`line\` and \`pie\` types are unchanged and remain compatible with .qbook and XLSX.
- Source remains a bounded adjacent 2..5 column block, up to four numeric series. Header labels and formulas update both new variants in real time. 100%-stacked requires nonnegative values and positive total for every populated category; ordinary stacks can contain negative values and zero. Overflowing cumulative sums are refused to avoid silent SVG/XLSX data corruption.
- The Insert ribbon has direct stacked and 100%-stacked actions; an existing chart may switch types in its sidebar, through one Undo transaction. The 100%-stacked axis is always 0–100%, and its manual min/max inputs are hidden; changing from a manual-axis chart clears those axis limits atomically. Ordinary stacks retain optional user-defined axis bounds and styles.
- SVG draws genuine accumulated segments, percentage labels/ticks, up to four colored series, legends, and optional value labels. It is NOT a collection of clustered bars cosmetically recolored.
- Native OOXML import/export uses \`<c:barChart><c:grouping val="stacked|percentStacked"/>\`, \`<c:overlap val="100"/>\`, percent-axis number formatting, chart series caches and original cell-reference formulas. Unsupported groupings remain skipped with reporting; a modified/unsupported chart is never silently converted to a different type.
- New tests: \`tests/task062.test.js\` and \`tests/task062_browser.py\` cover normal stacks, percent normalization, mixed signs, invalid categories, formula links, UI Undo, XLSX roundtrips and unsupported groupings. Full Node and Chromium CI required before merge.
- Deliberate scope: no 100%-stacked negative categories (Excel semantics differ), no stacked area, combo charts or custom ordering. Continue recommending native .qbook backups for important Excel work.


## TASK 063 — true XY scatter charts (2026-10-30)

- TASK062 main baseline \`6c37981a6c86f4e59b690ec25858bc18080463fc\`. Added type \`scatter\` alongside bar, stacked, stacked100, line and pie. User creates XY charts from Insert → Точечная XY or changes an existing chart type in the side panel. Changes remain undoable and existing .qbook chart records do not require migration.
- A contiguous source rectangle contains one **numeric X column** and up to four **numeric Y columns**, maximum 50 data rows. Optional initial heading row can name series; X and every Y must be finite numeric values (or evaluated formulas) in every data row. Duplicate, negative and unsorted X values are valid. Coordinates are bounded in absolute value to 1e12 to prevent geometry overflow; invalid or missing X or Y returns a visible chart error, never silently fabricating a category.
- SVG plots true X/Y positions and independent numeric X and Y axes, marks per series without connecting lines, auto-bounds X, and applies existing optional Y min/max, grid, values, legend and colors. Chart data and preview update on edits including recalculated formulas.
- XLSX import/export uses an actual \`c:scatterChart\` with \`c:scatterStyle val="marker"\`, each \`c:ser\` carrying paired \`c:xVal/c:numRef\` and \`c:yVal/c:numRef\` formulas and numeric caches, two \`c:valAx\` axes, native colors and Y axis bounds. Import accepts only on-sheet adjoining Y columns sharing the same X source and row range; unsupported XY variants (lines/smoothing, external or disjoint sources, invalid numeric data) are reported skipped instead of silently relabeled.
- Tests: \`tests/task063.test.js\` and \`tests/task063_browser.py\` verify exact coordinate spacing, duplicate/negative/out-of-order X, formulas, QBOOK, SVG, type-switch Undo and XLSX roundtrip. Full Node and Chromium CI must pass.
- Scope intentionally excludes arbitrary paired nonadjacent XY ranges, trend lines, marker customization, logarithmic axes, dual-Y chart combos, and arbitrary Excel scatter subtypes. Back up important work in .qbook.


## TASK 064 — OLS trend lines, equations and R² for XY (2026-10-30)

- Baseline main: \`8d6a61d528faeb8b658198460058bdb545adbe77\` (TASK063), no unrelated repositories or global refactor.
- Scatter charts now support optional boolean \`options.trendline\`, \`options.trendEquation\` and \`options.trendR2\`; old chart options remain bit-for-bit compatible when these fields are absent. Other chart types explicitly reject enabled trend options. Switching an XY chart to another type turns all trend flags off in the same undoable transaction.
- \`linearRegression(points)\` runs centered ordinary least squares independently for each Y series versus its actual numeric X source. Returns slope, intercept, R² and count, with R² bounded to [0, 1]. Constant Y returns R²=1 when an intercept is valid; identical X or insufficient/invalid data produces no regression, not a fabricated slope. Regression recomputes from live values/formulas, never saved as stale coefficients.
- SVG draws each visible fitted line in its series color, dashed and clipped to numeric chart bounds; user can turn on equation and R² labels and read all per-series coefficients in the sidebar. Y manual limits, legend, colors and previous markers remain supported.
- XLSX uses native \`<c:trendline><c:trendlineType val="linear"/><c:dispRSqr/><c:dispEq/></c:trendline>\` in each scatter \`c:ser\` between markers and numeric X/Y references. Import recognizes the supported linear type on all series and preserves equation/R² flags. Mixed/unsupported polynomial/exponential and partial trendline setups are intentionally skipped with \`skippedCharts\` reporting, never silently replaced. Refuses export of singular-X fits when trendline is enabled.
- New tests \`tests/task064.test.js\` and \`tests/task064_browser.py\` cover regression correctness, formula changes, UI/Undo, QBOOK, OOXML, rejected types and bad coordinates. Both full Verify and Chromium workflows required before PR merge.
- Excludes regression confidence intervals, nonlinear models, extrapolation/forecast period, chart trendline customization, arbitrary Excel regression types.


## TASK 065 — quadratic XY trend (degree 2) and R² comparison (2026-10-30)

- Baseline: TASK064 main at \`637d76b5324f18d02f46051ad61fe293f29bafa3\`. New XY chart option \`trendType: 'linear'|'quadratic'\`, defaulting to linear; prior books and charts retain their original trend flags and results. Switching from scatter to other chart types clears enabled trend flags and resets model to linear atomically.
- Quadratic regression is true least squares on \`y=a*x²+b*x+c\`, with normalized centered X to avoid catastrophic numeric cancellation at large X offsets. At least three distinct X coordinates are needed (rank-deficient or invalid inputs do not produce a fake fit). Duplicate/unsorted/negative X coordinates are supported. Predictor computes from the centered representation; fitted coefficients and SSE/R² recompute on all relevant data edits, including formulas. Clamped R²=0..1. No promise of improved generalization just because training R² is higher.
- SVG renders a curved polynomial as 96 sampled, plot-clipped dashed segments in the corresponding series color (not a misleading straight line). Optional equation and R² labels use the selected model. The chart side panel offers model selection and per-series comparisons for linear R², quadratic R² and ΔR². Comparison results say unavailable for singular fits; switching types and styles supports existing Undo.
- XLSX preserves real editable chart regression: \`c:trendlineType val="poly"\`, \`c:order val="2"\`, Excel showEquation/R² flags; importer accepts exactly degree 2 polynomial or pre-existing linear model for all series and rejects mixed/unsupported orders (e.g., degree 3) rather than silently converting the model.
- Tests: \`tests/task065.test.js\`, \`tests/task065_browser.py\`. Include exact coefficient cases, large X offset stability, singular rank, QBOOK, undo, XML semantics, live recalculation, and unsupported-degree import. Merge only after full Node & Chromium workflows success on PR head.
- Exclusions: higher-degree regression, confidence intervals, regularization, extrapolation, arbitrary Excel trend types, continuous-curve smoothing beyond quadratic.


## TASK 067 — text-to-columns and remove duplicates; TASK066 cosmetics (2026-10-30)
- Published baseline main \`cb508d240dd50ef1faf99617f362127afe4af7bb\` (TASK065). TASK066 icon-only ribbon and compact chart cosmetic changes previously existed only in a standalone user-tested HTML; their layout rules are now carried into \`src/styles.css\` and \`src/main.js\` so future builds retain the accepted changes.
- Added \`src/core/data-transform.js\` for two actual spreadsheet operations, accessed in the Data tab as compact icon-only actions with title tooltips and existing group titles.
- Text to columns: selected one-column range, CSV-style quoted delimiters (semicolon, comma, tab, space, vertical bar), embedded escaped quotes, blank fields, 2,000-row / 20-column / 10,000-cell bounds, error before mutation for malformed quotes, formulas, merged/hidden/filter areas, conflicting adjacent data without explicit overwrite, data-validation conflicts. Shows result preview (up to six rows) before applying.
- Remove duplicates: selected 2–20 columns and up to 2,000 rows; configurable header and first-column vs full-row comparisons; case-insensitive exact string comparison; preserves first occurrence and its per-cell formatting; compacts **only** the selected rectangle while all other columns remain unchanged. Explicitly rejects formulas and merged/hidden/filter/large rectangle-style regions to avoid undocumented formula rewrites. Preview shows counts and original duplicate row numbers.
- Data tools are undoable with Ctrl+Z via existing \`transact\`, auto persist, QBOOK, and XLSX export. Revalidation of plan and complete \`validateWorkbook\` occur before transaction commits; any failure rolls back with original Undo/Redo stacks intact. Standalone module also prevents partial mutations from rejected plans.
- Regression tests: \`tests/task067.test.js\` + \`tests/task067_browser.py\`. Full Node and Chromium suites must pass before merge. Limitations: no arbitrary multi-character delimiters, no formula-aware record move, no multi-column split origins, no full-sheet row deletion. Keep backups of valuable books.


## TASK 068 — Excel-style row/column context sizing and Ctrl multi-range selection (2026-10-30)

- Branch forked from TASK067 head \`d9f715b8123baa93de86c3ae5e81011505376af0\`, not main, to preserve approved TASK066 icon-only ribbons and TASK067 data-cleaning tools while PR #74 awaits GitHub CI.
- Spreadsheet grid (including frozen regions): suppress the browser right-click menu *inside the grid only*. Right click a row/column header opens a compact numeric editor for precise height/width (px), displaying current value and enforcing the existing 22–160px row and 48–520px column limits. Right click a cell offers both dimension controls. Outside the grid, the browser native context menu remains unaffected. A group of Ctrl-selected complete rows/columns can be resized in one Undoable transaction, bounded to 500 items.
- Ctrl+click adds a separate selected cell/rectangle; Ctrl+drag creates a new rectangular range without merging it with old ranges. Up to 25 areas in memory, scoped per sheet; regular click/keyboard navigation clears extras. The grid and bottom status show the **union** of all areas (avoids double-counting overlaps) and active reference. Multi-range font/color, border presets, clear values and clear formats are atomic and Undoable. Other operations requiring a single contiguous region are blocked explicitly rather than silently using the final area only.
- Ctrl selection state is session-only and never added to QBOOK or XLSX; row/column dimensions persist through regular workbook schema and Excel transfer. Existing mouse drag resize handles and the View ribbon size action remain intact. New styles retain TASK066 approved compact cosmetics.
- Browser tests: \`tests/task068_browser.py\` covering Ctrl+click and Ctrl+drag, discontiguous styles/clear and Undo/Redo, exact dimension dialogs from row/column/cell right-click, multiheader dimension edits and out-of-bound protection; all existing Node and Chromium tests must pass before merge.


## TASK069 — multi-range typed values, formulas, Ctrl+D and Ctrl+R (2026-10-30)

- Baseline TASK068 merged main \`112513f79fef35ba3c3fba5397e13a10905ca52b\`. Existing browser-only Ctrl+click/Ctrl+drag additive selections and right-click dimensions remain unchanged. Adds **actual data operations** to multiple rectangles, not keyboard shortcuts alone.
- \`fillTypedAreas(sheet,areas,input,origin)\`: Ctrl+Enter while editing any cell in disjoint selection fills each selected cell in one Undo transaction. Formula references translate relative to the active edited cell, respecting $ locks. Every destination including numeric/list validation is checked on an isolated staged sheet first. If one formula is out of bounds, one destination invalid, merged, or 10k/50k sheet limit exceeded, **nothing** changes. Duplicate/overlapping ranges write each target once; existing styles remain.
- \`fillAreasDirection(sheet,areas,direction)\`: Ctrl+D / Ctrl+R copies from each selected rectangle's own first row/column, including formulas with correct relative coordinates and source formatting. Performs one atomic staged mutation and one Undo/Redo step. Disallows overlapping rectangles to avoid source overwrite ambiguity; each rectangular range must be at least 2 cells in the chosen direction; max 25 areas / 10k selected cells.
- Existing single-range fill and Ctrl+Enter remain compatible; unsupported multi-range operations still explicitly warn. Nothing new is persisted in schema; resulting cells and formulas serialize to QBOOK and XLSX normally.
- Tests: \`tests/task069.test.js\` plus \`tests/task069_browser.py\` and full 068 regression suite. Both full CI workflows must pass on final head before merge.


## TASK 070 — Excel-like drag-fill marker for numeric series and formulas (2026-10-30)

- Baseline TASK069 merged main \`493a9fd646592e57e801bfb341ce7bf8f7c8ebd1\`. Single contiguous selection has a small green corner drag handle whenever its bottom-right cell is in the visible viewport. With multiple Ctrl-selected regions, the handle is hidden. The handle does not alter the saved workbook or introduce extra actions in the ribbon.
- Left-button pointer drag from the handle toward cells below or right shows a green live target overlay, then calls \`extendFillHandle(sheet,from,to,direction,targetIndex)\` on pointerup within ONE undoable transaction. Sources are not overwritten and selection expands to show resulting range. Existing chart drag, cell selection, freeze panes, context sizing, and other pointer controls remain untouched.
- With two or more numeric evenly spaced seed values on the same row/column, extends an arithmetic series independently per row/column; with one number, repeats it. Text or non-arithmetic mixed input cycles source values and styles. Formula cells translate absolute/mixed and relative references to their destinations; no broken cross-row references. Copy preserves each seed cell's formatting.
- Operation is staged before mutating any original sheet cells, validating data-rule restrictions, bounds, merged cells, hidden or filtered positions and the 10k destination / 50k nonempty limits. Invalid moves leave original data and Undo history unchanged. Normal .qbook and XLSX persistence applies.
- Current limitation: mouse handle can be dragged downward and rightward within the currently visible grid; left/up drags, dates with calendars, automatic scroll on distant targets, series from only a single number without a second seed, and custom fill modes are not yet implemented.
- New tests \`tests/task070.test.js\` and \`tests/task070_browser.py\` cover true mouse dragging, arithmetic series, repeated text/numbers, formula translations, preview, Ctrl+Z/Y, data validation, QBOOK and native XLSX. Both full Verify and Chromium suites required before merging.

## TASK 071–074 — four-way fill, owner UI fixes, Ctrl selection restoration (2026-10-31)

- Resume existing Draft PR #80 on `feat/task071-four-way-date-autoscroll`. Do not create another parallel PR or merge before full final-head CI. The base `main` commit at task start was `0419c2de53ce2317587bc4f3e5d51f159dbf5e63`.
- TASK071 extends the bottom-right fill handle to up/down/left/right, adds viewport-edge pointer-driven autoscroll, arithmetic sequences in reverse directions, and Excel-serial daily date sequences (including leap days and two-date intervals). Formula translations respect anchored refs. Merged, hidden, filtered, out-of-bounds or invalid destinations reject before writes.
- TASK072 adds interactive checkbox marks `☐` / `☑` in worksheet cells (stored as normal Unicode values with center alignment, click to toggle, Undo works). XLSX round-trip carries text marks, **not Excel interactive controls**. Genuine font-family and size selectors added to the compact Home ribbon, with an allowlisted collection of Cyrillic-capable fonts, serialized in QBOOK and XLSX font records. Right-click entire-sheet corner offers compact global row/column size defaults, alongside existing individual and Ctrl-multi-header size editing.
- TASK073 fixes original root cause of jumping to top after ribbon actions: newly recreated scroll views must receive full grid-canvas geometry **BEFORE** restoring scroll offsets, otherwise Chromium clamps `scrollTop` to zero. Scroll handler renders on animation frames and overscans nearby rows/columns to reduce white gaps. More polished navy/green ribbon and near-black default grid text. Preserve system font fallbacks when unavailable.
- TASK074 fixes a real regression in TASK068: Ctrl+drag must continue extending an independent rectangle (mouseover after Ctrl-mousedown), while Ctrl-click on already selected cell removes that cell from selection. Ctrl on a fresh cell begins additive drag; Ctrl on a selected cell toggles off without starting drag. Max 25 rectangular areas.
- TASK074 additionally provides four ribbon fill directions under `Правка → Заполнение`. `fillSelection` / `fillAreasDirection` support Up/Down/Left/Right: Up copies from the bottom edge; Left copies from the right edge; both shift formula references and copy styles. Unlike the drag handle this is edge copying, not arithmetic-sequence extrapolation. All writes are staged and validated, with one undo transaction.
- Test files: `tests/task071.test.js`, `tests/task071_browser.py`, `tests/task072.test.js`, `tests/task072_browser.py`, `tests/task073_browser.py`, `tests/task074.test.js`, `tests/task074_browser.py`, plus critical existing `tests/task068_browser.py` to prevent Ctrl-drag regressions. Offline standalone `Quantum-Office.html` must be rebuilt with changes and delivered as direct downloadable HTML and ZIP, not raw GitHub source links.
- Browser and Node verification from final branch head is mandatory. The product still remains Sheets alpha; Writer/Slides are placeholders and XLSX compatibility is partial. Do not claim new work is merged into main until merge is explicitly done.

## TASK 075 — owner UX, rich cell formats and header-drag selection (2026-10-31)

- On sheet checkbox click, `toggleCellCheckbox` changes value without calling `setSelection`. Original selection remains intact; clicking the cell background or dragging over cells selects normally. State persists and remains Undoable.
- Home ribbon: text buttons `Ж` (bold), `К` (italic), `Ч` (underline) and `З` (strike) replace icon-only format labels, with text and fill color controls beside them. Alignment group has **two rows**: top/middle/bottom within a cell; horizontal left/center/right beneath. Compact UI has expanded font action group and consistent typography.
- Workbook style schema and QBOOK persist `underline:boolean`, `strike:boolean` and `verticalAlign:top|center|bottom` as sparse default/cell/column/rectangle formats. Grid renderer displays CSS text decoration and vertical flex alignment. XLSX reader/writer supports `<u/>`, `<strike/>` font records and cell `<alignment vertical="..."/>` with per-style deduplication. Old workbooks stay compatible.
- Pointer drag over a row-number or column-letter header selects the **full consecutive axis span** from initial header to target; ordinary single-click and Ctrl-additive header operations are maintained. Avoid starting selection from resize handles; retain 25-region limit. Drag state ends on pointer up/cancel, with click-suppression only for completed drags.
- Test coverage: `tests/task075.test.js`, `tests/task075_browser.py` added to CI. Existing `tests/clipboard_browser.py` updated to expect user-approved Cyrillic format glyphs instead of obsolete SVG bold icon. Browser-local regression confirmed mouse checkbox isolation, 4 formats, 6 alignment controls, header drag, XLSX roundtrip and old TASK032/073/074 scenarios.
- Direct user test artifact is `Quantum-Office-TASK075.html` and `Quantum-Office-TASK075.zip`, generated from Verify CI artifact at `b9bfaf8b` (same implementation source as later commits). PR #80 remains Draft until *final HEAD* Verify + Chromium workflows pass.

## TASK 095 — authoritative TASK094 recovery, appearance and Studio (2026-10-31)

- The owner now prioritizes Studio. TASK094 standalone (SHA-256 `0938db3062298dc07fe36613541d18f329641ce5e8ce554539fea26f242a9a8f`) was newer than GitHub PR #80. Recovered its modules and verified a byte-identical rebuild before new changes. Never roll back Writer/Slides/Studio to the old GitHub placeholders.
- Read `docs/TASK095.md` for full scope, actual validation and limitations. Studio now has real corner transforms/rotation, snapping, panning, inline multiline text, per-image non-destructive correction/crop/flip, accessible collapsible inspectors and explicit quota feedback.
- Global Save uses QDOC / QSTUDIO, with separate flat exports. Appearance is a menu: light/dark/system plus accents, without rebuilding document DOM or recoloring content. QSLIDES restores active slide and selection.
- `src/core/studio-model.js` owns pure validation/crop/filter/geometry helpers. Legacy QSTUDIO v1 fixtures are exported from actual TASK093 and TASK094 runtimes. New optional image fields must not be discarded on future edits. Existing native document formats stay readable.
- `npm run dev` serves the current built dist, not the stale root index. Run Node tests and the historical Chromium suite, plus `npm run test:studio` (23 functional checks and 32 captures). Python Playwright is pinned to 1.56.0 and npm Playwright to 1.56.1; both use Chromium revision 1194.
- Draft PR #80 and main must remain untouched until owner authorization. TASK095 is a separate branch. Future multi-page work requires a deliberate migration; no masks/retouch or complete professional photo-editor claim yet.
