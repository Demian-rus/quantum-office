# Quantum Office

**Project decisions and handoff:** [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md). Read this before editing the shell or Sheets.

**One application, several editors. First: Quantum Sheets.**

An independent, local-first office suite being developed for Windows and macOS. There is one launch screen and a shared navigation bar. The table, text, and presentation workspaces occupy the full window when opened. The text and presentation workspaces are not yet implemented; the app says so explicitly.

## Open immediately — no install

1. Open `Quantum-Office.html` in a current desktop Chromium / Chrome / Opera / Edge / Safari browser.
2. Choose **Таблицы** to create a workbook, or **Открыть демонстрацию** to open the sample budget.
3. Double-click cells to edit, press Enter, or type while a cell is selected. Add a sheet using `+` at the bottom.
4. Use **Сохранить файл** to download `.qbook` (or the native save dialog, if supported). Use **⇩** in the header to export a complete `.qbackup` archive.
5. Re-import via **Открыть / Импорт**.

No account, license server, external script, or network connection is required for the standalone HTML.

**Important:** browser-local autosave is a convenience, not durable file storage. In private mode, under `file://`, after clearing browser data, or after changing preview origins/URLs, saved drafts may be unavailable. Export `.qbook` and `.qbackup` regularly. The eventual desktop app will have explicit native file operations and an app-data store independent of updates.

## Implemented in the Sheets milestone

- Home screen and full-window editor with editor selector in the top bar
- Workbooks with multiple named sheets and independent cells
- Virtualized grid: up to 2,000 rows and 100 columns in the initial bounds
- Direct cell editing, formula bar, name box, range selection, keyboard navigation
- Basic formulas `+ - * /` with parentheses and `SUM`, `AVERAGE`, `COUNT`, `MIN`, `MAX` (same-sheet references)
- Cycle and divide-by-zero reporting
- Cell styles: bold, italic, foreground/background color, alignment and numeric formats
- Undo/redo for editing transactions, CSV import/export, clipboard TSV, standalone `.qbook` files
- Workspace backup and restore `.qbackup`, local autosave and previous snapshot recovery
- Small example workbook and automated tests

**Still not implemented:** charts, merged cells, most advanced formulas, large-workbook performance benchmarks, complete XLSX fidelity, macros, native Windows/macOS installers and signed updates. XLSX, filtering and sorting are partially supported. Browser storage alone is not durable.

## Developer commands

Needs Node.js 22+. The browser preview itself has zero npm dependencies.

```bash
npm test
npm run build
npm run dev       # local preview at http://127.0.0.1:5173
```

`dist/index.html` is the browser distributable and `Quantum-Office.html` is the same downloadable single-file artifact. `python tests/ui_smoke.py` runs a Chromium browser smoke test if Python Playwright plus Chromium are installed. The test uses an inline page to avoid external-network requirements.

The Tauri 2 scaffold in `src-tauri/` is for future desktop builds. Desktop installers have **not** been successfully built or tested in this milestone. They will not be distributed until Windows and macOS validation is completed.

## GitHub publication

Main repository: https://github.com/Demian-rus/quantum-office. The project is in active development; this is not a released office suite. The `.github/workflows/` folder provides automatic CI and a GitHub Pages preview after the repository and Pages have been configured.

See [ROADMAP.md](ROADMAP.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/UPDATES.md](docs/UPDATES.md).

### Sheets: заполнение диапазона

Выделите прямоугольный диапазон через Shift+стрелки или мышью. В «Правка» нажмите «Заполнить вниз» (`Ctrl+D`) или «Заполнить вправо» (`Ctrl+R`). Значения и стили берутся из верхней строки/левого столбца выделения; относительные ссылки в формулах сдвигаются, абсолютные `$A$1` сохраняются. Одно действие — один шаг отмены. При выходе ссылки за границы листа операция отклоняется целиком.


### Quantum Sheets: автофильтр и закрепление областей (экспериментально)

- **Данные → Автофильтр**: выделите прямоугольный диапазон с заголовками (например, `A1:D6`), нажмите Автофильтр. В заголовках появятся кнопки фильтрации. Сейчас поддерживается одно точное значение на столбец; фильтры разных столбцов комбинируются по условию И.
- Фильтр **не удаляет и не переставляет** данные. Массовая правка диапазона со скрытыми строками блокируется во избежание случайного изменения невидимых данных.
- **Вид → Верхняя строка / Первый столбец / По выбранной ячейке / Снять закрепление**: закрепление до 10 строк и столбцов с учётом прокрутки.
- Состояние сохраняется в `.qbook` и частично поддерживается в XLSX (`autoFilter`, `pane`, скрытые строки).
- **Ограничение XLSX:** сложные условия фильтрации Excel (несколько значений, дата, цвет, сложные пользовательские условия) не восстанавливаются. Сохраняйте оригинал отдельно.
- Проверки: `npm test`, `python tests/filter_freeze_browser.py`, `python tests/xlsx_filter_freeze_browser.py`.

### Sheets clipboard regression & toolbar icons (2026-10-28)

- Select any populated cell (no double-click), press `Ctrl+C` (or `Cmd+C`) and select a destination, then `Ctrl+V` / `Cmd+V`. Quantum Sheets has an internal clipboard for browser builds where Clipboard API permission is unavailable. Normal system clipboard text/TSV paste remains supported.
- In-app copy/paste preserves raw formulas, relative/absolute references, and cell styles; it is atomic on out-of-range errors. External plain-text paste remains data-only.
- Top bar/ribbon are not selectable page text. Tool icons are compact inline SVG, while controls retain accessible names and keyboard-visible focus.
- Run `node --test tests/clipboard.test.js` and `python tests/clipboard_browser.py` in addition to existing smoke.

### Quantum Sheets: inserting/deleting rows and columns (TASK 017)

Use **Вставка → Вставить строку / Удалить строку / Вставить столбец / Удалить столбец**. Operations affect one entire row or column at the active cell, carry cell styles and row/column sizes, and rebase supported A1 references (including `$` anchors). Deleting referenced cells produces visible `#REF!`. Undo via Ctrl+Z. For now disable AutoFilter before structural edits; editing is rejected if insertion would truncate the populated final row or column or produce an out-of-bounds formula. Complex XLSX formula semantics remain partial; preserve originals separately.


### TASK 018–019 — hide/show, launcher and weekly schedule

- **Вид:** hide selected row or column and show all explicitly hidden rows/columns. No contents deleted. Keyboard navigation skips explicit hidden cells. Supports `.qbook` and the limited XLSX `hidden` attributes. AutoFilter hiding is separate.
- Main screen: three graphic tiles (Sheets, Writer, Slides) without slogans. Only Sheets is working; other modules are future work. Inline SVG icons are native UI assets, no external network dependencies.
- Tabs: `+` creates a *new* sheet; a double-click on the tab or the pencil action renames it inline. Renaming never changes its ID or data; empty, duplicate and invalid Excel-style sheet names are rejected.
- Weekly schedule starter: seven weekday columns, 30-minute slots from 09:00 to 21:00, and a separate blank `Ученики` sheet. This is a starter sheet, **not** a synchronized calendar.
- Local browser auto-save is **only a draft cache**; explicitly save `.qbook` to disk and export `.qbackup` regularly. Do not trust a local HTML file + browser storage for irreplaceable work. Do not edit complex XLSX without preserving originals.
- Tests: `npm test`, `npm run build`, `python tests/launcher_browser.py` and existing Chromium XLSX/clipboard/structure/filter smoke.


### TASK 019 — каталоги шаблонов, график и заголовки

- Под тремя плитками главного экрана есть кнопки каталогов шаблонов каждого редактора. Для текста и презентаций карточки честно помечены как будущие.
- Шаблон «Недельное расписание занятий» повторяет основные секции предоставленной пользователем таблицы: цветные блоки дней, ученики, предметы, время, план занятий, результаты, примечания, проведение и оплата; листы «График», «Бухгалтерия», «Партнёрка». **Объединённые ячейки и сложные границы пока не реализованы:** доступны только простые одинаковые тонкие границы каждой ячейки и перенос текста.
- Заголовки строк/столбцов выводятся в неподвижных отдельных слоях поверх таблицы. Буква выделяет столбец, цифра строку, треугольник — весь текущий лист (в пределах 2 000 × 100). Выделение всего листа не означает, что безопасно можно изменять или копировать все 200 000 ячеек одновременно: массовые операции ограничены.
- Удалена кнопка переименования листа, осталось переименование двойным щелчком; **+** создаёт новый лист.
- Для регрессии: `npm test`, `npm run build`, `python tests/templates_headers_browser.py`, `python tests/launcher_browser.py`, `python tests/ui_smoke.py`.


### TASK 020 — fixed color selection and basic cell styling

- Selecting a cell, then choosing foreground/background color, now applies to **that selected cell/range**, even when the operating system color picker fires its change event after another cell receives focus. A stale selection from another workbook/sheet is rejected.
- Main ribbon offers **All borders**, **Remove borders**, **Wrap text**. Borders are four thin edges only, not individually configurable. Wrapped text can expand row height up to the current 160px limit.
- `.qbook` preserves these styles. XLSX export writes standard `borderId` / `wrapText`; import recognizes four matching thin edges only. Unsupported Excel styles remain lossy on import/export.
- Tests: `npm test`, `python tests/color_border_browser.py`, `python tests/color_border_xlsx_browser.py`.

### TASK 021: colors, borders and merged cells (alpha)

- **Home → text/fill color:** small palette with preset swatches plus a custom color field, operating on the selection captured when the palette opens.
- **Home → Borders:** outer outline, all borders, top, bottom, left, right, and clear. The outline command draws only the outer edge of a rectangle; internal cells remain borderless. Basic thin-line OOXML border export/import is supported.
- **Home → Merge / Unmerge:** true merged cells preserved in `.qbook`, and OOXML `mergeCells` is exported/imported in `.xlsx` within alpha limits. Merging refuses non-empty subordinate cells, overlapping regions, and ranges crossing frozen panes or containing hidden rows/columns. Unmerge does not destroy data.
- **Limitations:** merge-aware fill/copy/paste and structural row/column edits are not yet supported. Clipboard paste into a merged area is blocked. Complex Excel merges, thick/dashed styles, rich-text runs and advanced formatting are not lossless. Preserve original XLSX and save a `.qbook` backup.
- Regression commands: `npm test`, `npm run build`, `python tests/formatting21_browser.py`, `python tests/merge_xlsx_browser.py` plus older smoke scenarios. Desktop installers are still unverified.


### TASK 022 — merged-cell copy/paste

- `Ctrl+C` on a merged cell copies its whole region, not just the top-left data cell; `Ctrl+V` pastes merge geometry, raw formulas and styles to a free destination, with regular relative/absolute reference semantics. Undo reverts one paste.
- Partially selected merges, destination overlaps with other merges, cut/move (`Ctrl+X`) of merges, and fill/sort with merges are intentionally rejected to prevent data corruption. Undo the merge or unmerge first when those operations are required.
- Check with `node --test tests/merged_clipboard.test.js` and `python tests/merged_clipboard_browser.py`.

### TASK 023 — structural edits with merged cells

- Inserting before a merged area shifts the range; inserting within its row/column span expands it.
- Removing a non-anchor band inside the area shrinks the merge; removing an entire one-cell-wide remnant unmerges it.
- Deleting a merged area's *anchor row/column* is refused to protect the only retained value. The user must unmerge first.
- Edits remain limited to a single row/column, preserve cell contents/styles/formulas, undo in one operation, and save merged ranges to `.qbook` and supported `.xlsx`.
- Run `npm test`, `python tests/merged_structure_browser.py`, and the full browser CI regression suite.

### TASK 024 — insert/delete multiple rows or columns

Select a range covering **2–100 adjacent rows or columns**, then use the compact **Вставка** ribbon's corresponding insert/delete action. One selected cell still modifies exactly one row or column. The entire selected rows/columns are affected, not only the rectangular cells. Formulas, merged ranges, custom sizes, hidden flags and frozen panes are updated atomically; `Ctrl+Z` undoes the operation. Deletion of any merge's anchor band and structural edits under an active filter are refused to prevent data loss. No claim of full Excel structural reference compatibility is made.

### TASK 025 — conditional formulas for timetables and accounting

- The local formula parser now supports comparisons (`=`, `<>`, `<`, `>`, `<=`, `>=`), quoted strings (including doubled quotation marks), string concatenation (`&`), logical constants (`TRUE`, `FALSE`), and comma or semicolon separators.
- Implemented functions: `IF`, `IFERROR`, `AND`, `OR`, `NOT`, `COUNTIF`, `SUMIF`, `ROUND`, `ABS`, `COUNTA`, `COUNTBLANK`, `LEN`, alongside prior SUM/AVERAGE/MIN/MAX/COUNT. Example: `=SUMIF(C2:C20,"Оплачено",D2:D20)`. An IF branch not selected is not evaluated.
- Wildcard `*` and `?` in conditional-aggregate criteria are supported. The interpreter never uses JavaScript `eval`. Expression and range limits remain bounded.
- **Still not Excel parity:** no cross-sheet formulas, date types, structured table references, external links, advanced formula families, or dependency graph. Text and number coercion may differ from Excel for edge cases. Preserve a source workbook before XLSX import/export.
- Run `node --test tests/formula_conditional.test.js`, `python tests/formula_conditional_browser.py`, `npm test`, and `npm run build`.
