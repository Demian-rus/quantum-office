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

**Not implemented yet:** XLSX import/export, graphs, advanced formulas, filtering/sorting, large-data performance benchmarks, Excel-format fidelity, macros, native installation and signed updates. Legacy v0.2 prototype files are not automatically migrated; `.qbook` and `.qbackup` formats in this version are new.

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

This archive is a local Git project, not a published GitHub repository. A GitHub user with repository-creation rights must create `Demian-rus/quantum-office` once; details in [GITHUB_SETUP.md](GITHUB_SETUP.md). The `.github/workflows/` folder provides automatic CI and a GitHub Pages preview after the repository and Pages have been configured.

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
