# Quantum Office architecture

## Актуальное состояние и направление (24.11.2026)
Windows x64 Tauri 2/WebView2/Rust/SQLite уже объединён через PR #157; native CI main PASS. Общий исходный фронтенд сохраняет автономный HTML. Нативное хранилище bank.sqlite3/drafts.sqlite3, отдельный каталог данных со стабильным identifier com.quantumoffice.desktop, проверяемые архивы и защитные снимки; не переходить молча на пустое браузерное хранилище. Автообновления и подпись релиза пока не реализованы.
Отделяем образовательные рабочие области от Writer: диагностики, конструктор, банк и будущие лекции. Один shell, самостоятельные маршруты и команды, не вложенные редакторы. Общая типизированная научная графика через адаптеры существующих моделей и рендереров; фиксированные версии/независимые копии объектов в документах, обратная совместимость QWORK/QWBANK/QLECTURE. Лекции и сценарии — две проекции одного документа, не видеомонтаж; отдельный экспорт объектов. PR #158 экспериментальный, ещё не интегрирован.
Подробности в [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) и [EDUCATION_ROADMAP.md](EDUCATION_ROADMAP.md). Ниже историческая архитектурная запись, не текущий статус.

- One application, one home screen, full-window editor workspace.
- Quantum Sheets is the first functioning editor. Writer and Slides remain roadmap items.
- Source: plain ESM under src; no runtime network calls or external JavaScript dependencies.
- Formula expressions are parsed, never passed into JavaScript eval.
- Small workbook model: books → sheets → sparse cells. Preview bounds: 2000 rows × 100 columns.
- Browser autosave (localStorage) is **not** reliable native file storage. Export .qbook or .qbackup for durability.
- XLSX, DOCX, PPTX, automatic updater, native installation and migration are NOT implemented.
- Native Windows/macOS version is planned with Tauri after persistence and compatibility work.
