# Quantum Office architecture

## Состояние на передаче — 25.11.2026
TASK167.1/#159 и TASK167.2/#160 объединены. TASK167.3/#161 остаётся Draft до шести PASS на одном HEAD и решения архитектора; принятые компоненты не переделывать. После merge и проверки main дальнейшая разработка локальным Codex. Текущий main при подготовке передачи: `7be748bbd93661cf9df7149ae9ad81652944a0dc`. Источник актуального состояния: [LOCAL_CODEX_HANDOFF.md](LOCAL_CODEX_HANDOFF.md).
Общий ESM-фронтенд, отдельные routes диагностики/work/bank, внутренние рабочие режимы макета и научного редактора, не отдельные приложения. Browser: IndexedDB v2 для банка и бинарных assets, localStorage для черновиков/предпочтений. Native: Tauri 2, SQLite bank.sqlite3 и drafts.sqlite3, разрешённые IPC операции, ACK/CAS и отдельные миграции. Новый ключ dock-настроек в обоих allowlists; сборка проверяет согласованность. Native CloseRequested проходит через JS leave guard, flush/ACK, затем draft_close. Общие модели и PDF-рендереры не дублировать. Подробная карта файлов в handoff.

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
