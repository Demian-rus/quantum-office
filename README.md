# Quantum Office

**One application, several editors. First: Quantum Sheets.**

An independent, local-first office suite being developed for Windows and macOS. There is one launch screen and a shared navigation bar. The table, text, and presentation workspaces occupy the full window when opened. The text and presentation workspaces are not yet implemented; the app says so explicitly.

## Open immediately — no install

1. Open `Quantum-Office.html` in a current desktop Chromium / Chrome / Opera / Edge / Safari browser.
2. Choose **Таблицы** to create a workbook, or **Открыть демонстрацию** to open the sample budget.
3. Double-click cells to edit, press Enter, or type while a cell is selected. Add a sheet using `+` at the bottom.
4. Use **Сохранить файл** to download `.qbook` (or the native save dialog, if supported). Use **⇩** in the header to export a complete `.qbackup` archive.
5. Re-import via **Открыть / Импорт**.

No account, license server, external script, or network connection is required for the standalone HTML. JSZip 3.10.1 is bundled locally under its MIT license (see `src/vendor/JSZIP-LICENSE.md`).

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

**Not implemented yet:** full XLSX fidelity, graphs, advanced formulas, filtering, advanced sorting with formula relocation, large-data performance benchmarks, Excel-format fidelity, macros, native installation and signed updates. Legacy v0.2 prototype files are not automatically migrated; `.qbook` and `.qbackup` formats in this version are new.

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

Source code is maintained in [Demian-rus/quantum-office](https://github.com/Demian-rus/quantum-office). Automated CI runs on each pull request. GitHub Pages requires repository Pages source configured for GitHub Actions.

See [ROADMAP.md](ROADMAP.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/UPDATES.md](docs/UPDATES.md).

### Sheets: заполнение диапазона

Выделите прямоугольный диапазон через Shift+стрелки или мышью. В «Правка» нажмите «Заполнить вниз» (`Ctrl+D`) или «Заполнить вправо» (`Ctrl+R`). Значения и стили берутся из верхней строки/левого столбца выделения; относительные ссылки в формулах сдвигаются, абсолютные `$A$1` сохраняются. Одно действие — один шаг отмены. При выходе ссылки за границы листа операция отклоняется целиком.

### XLSX compatibility (early, intentionally limited)

- **Open** `.xlsx` workbooks from Excel / LibreOffice, including multiple sheets, compressed XLSX archives, plain and shared strings, numeric cells, simple formulas, and basic cell styling.
- **Export** a new `.xlsx` with sheets, numbers, text, formulas, bold/italic, colors and basic number formats. It can be opened in Microsoft Excel and LibreOffice.
- Complex Excel features **are not supported**: charts, pivot tables, embedded media, VBA/macros, conditional formatting, named ranges, external links, rich text, images, merged cells, validation, sheet protection, advanced formulas, complex formatting, date types and shared-formula expansion. Importing then exporting such a file **will lose unsupported content**. Keep the original, use `.qbook` for ongoing editing, and export XLSX as a compatibility copy.
- The parser rejects malformed ZIP/XML, unsupported shared formula structures, over-limit workbooks and overly large archives instead of importing partial data silently. Maximum 15 MB compressed, 30 MB uncompressed, 25 sheets and 50,000 cells. Imported styles and formulas may render differently than Excel; check the results.
- Verify with `npm test`, `npm run build`, and `python tests/xlsx_browser.py` (requires Playwright, Chromium and openpyxl).

### Sheets: обновлённая панель, поиск и сортировка

- Группы команд теперь имеют чёткие названия снизу, читаемые подписи, единые размеры и более крупные области нажатия.
- **Правка → Найти / заменить** (`Ctrl+F`): поиск по значениям и текстам формул на текущем листе; «Заменить все» меняет обычный текст, но не формулы. Замена и сортировка — один шаг отмены (`Ctrl+Z`).
- **Данные → А → Я / Я → А**: сортировка выделенного прямоугольного диапазона по его первому столбцу, с переносом всего содержимого строк и оформления. Выделение должно включать минимум две строки. Заголовок не определяется автоматически: выделяйте только строки данных, если не хотите его сортировать.
- Сортировка не применяется к диапазону с формулами, пока не будет реализован корректный пересчёт ссылок при перемещении строк. Она отклоняется *до* изменения книги. Не пытайтесь заменить этим полноценную Excel-сортировку со сложными ссылками.
- Поиск и сортировка ограничены возможностями MVP и пока не затрагивают другие листы.

Проверки: `npm test`, `python tests/ui_smoke.py`, `python tests/ribbon_browser.py`, `python tests/xlsx_browser.py`.

### Sheets: compact ribbon and AutoSum

The spreadsheet application uses a compact, two-row command ribbon with one 40px application bar.
Tooltips and accessible names remain available for icon-only actions. The toolbar is independently horizontally scrollable on narrow screens; the grid occupies the remaining height.
New commands: **AutoSum** (sum a contiguous range above a blank cell, or selected columns in the next empty row; Alt+=), and **Clear formatting** without deleting values/formulas. Occupied sum targets are rejected atomically.

Run `python tests/compact_browser.py` for pixel bounds, operation behavior, undo, and navigation checks.

### Sheets: размеры строк и столбцов

- Потяните границу заголовка столбца/строки, чтобы изменить размер прямо в таблице. Двойной щелчок по границе столбца запускает автоподбор ширины, по границе строки — возврат стандартной высоты.
- Во вкладке **Вид** доступны компактные команды **Ширина столбца**, **Автоподбор ширины**, **Высота строки** и **Стандартная высота**. Размеры ограничены безопасными диапазонами (48–520 и 22–160 пикселей).
- Размеры хранятся отдельно для каждого листа, сохраняются в .qbook/.qbackup и экспортируются в XLSX (колонки `<cols>`, строки `ht`). Открытие XLSX с пользовательскими размерами поддерживает эти поля при попадании в указанные пределы.
- Перетаскивание размера — один шаг Ctrl+Z. Сетка использует реальные размеры при прокрутке, позиционировании и редактировании, а не просто изменение CSS.
- Пока не реализованы скрытые строки/столбцы и закрепление областей; импорт файлов с такими возможностями остаётся частичным.
- Проверки: `npm test`, `npm run build`, `python tests/dimensions_browser.py`.

### Quantum Sheets: автофильтр и закрепление областей (экспериментально)

- **Данные → Автофильтр**: выделите прямоугольный диапазон с заголовками (например, `A1:D6`), нажмите Автофильтр. В заголовках появятся кнопки фильтрации. Сейчас поддерживается одно точное значение на столбец; фильтры разных столбцов комбинируются по условию И.
- Фильтр **не удаляет и не переставляет** данные. Массовая правка диапазона со скрытыми строками блокируется во избежание случайного изменения невидимых данных.
- **Вид → Верхняя строка / Первый столбец / По выбранной ячейке / Снять закрепление**: закрепление до 10 строк и столбцов с учётом прокрутки.
- Состояние сохраняется в `.qbook` и частично поддерживается в XLSX (`autoFilter`, `pane`, скрытые строки).
- **Ограничение XLSX:** сложные условия фильтрации Excel (несколько значений, дата, цвет, сложные пользовательские условия) не восстанавливаются. Сохраняйте оригинал отдельно.
- Проверки: `npm test`, `python tests/filter_freeze_browser.py`, `python tests/xlsx_filter_freeze_browser.py`.

### Sheets — несколько значений автофильтра (experimental)

Выделите прямоугольный диапазон с заголовком → «Данные → Автофильтр» → стрелка в заголовке столбца. Отметьте одно или несколько значений и нажмите «Применить». Значения одного столбца объединяются через ИЛИ, разных столбцов — через И. Исходные ячейки не переставляются. Условия сохраняются в `.qbook` и в поддерживаемом подмножестве XLSX. За один раз отображается до 200 различных значений; сложные фильтры Excel пока не поддерживаются. Сохраняйте оригинальный XLSX отдельно.
