# Quantum Office — передача разработки локальному Codex

Дата: 25.11.2026. Репозиторий Demian-rus/quantum-office. Рабочий каталог владельца: Z:\Progr\Programming\quantum-office.

## 1. Начало работы

Прочитать AGENTS.md, docs/PROJECT_CONTEXT.md (последний раздел передачи приоритетнее исторических записей), docs/ARCHITECTURE.md, docs/EDUCATION_ROADMAP.md, ROADMAP.md, docs/TASK167.3.md и docs/UPDATES.md.

TASK166.1–166.4 (#154–157) и TASK167.1–167.2 (#159–160) объединены. TASK167.3 — Draft PR #161, ветка feat/task167-3-workspace-ux; авторизованный архитектор объединяет после шести PASS на одном SHA и проверяет main. Не считать кандидата выпущенным. Проверить фактический статус PR и актуальный main перед началом новой задачи. Не использовать промежуточный установщик. PR #158 лекций не объединён.

Если каталог уже существует, не перезаписывать и не сбрасывать локальные изменения. В PowerShell:

~~~powershell
Set-Location 'Z:\Progr\Programming\quantum-office'
git status --short
git branch --show-current
git log -5 --oneline
git remote -v
git fetch origin
git log -5 --oneline origin/main
~~~

Если каталог отсутствует, клонировать репозиторий после настройки собственного GitHub-доступа. После подтверждения архитектором merge и чистоты дерева создать отдельную ветку от актуального origin/main. Не выполнять reset --hard, clean -fdx, force push, merge чужих PR или удаление баз. Не хранить токены, документы владельца, ключи подписи в git.

## 2. Инструменты и команды

| Компонент | Версия / источник |
| --- | --- |
| Node.js | 22 (как CI); npm из установленного Node |
| Playwright JS | 1.56.1, package-lock.json |
| Rust | stable, MSVC target x86_64-pc-windows-msvc; Cargo.lock обязателен |
| Tauri | 2.12.7, tauri-build 2.7.6, CLI 2.11.4 |
| rusqlite | 0.43.0, bundled SQLite |
| Rust image | 0.25.10 (PNG/JPEG/WebP), base64 0.22.1, rfd 0.15.4 |
| Python для PDF-сравнений | PyMuPDF 1.26.5, Pillow 11.3.0; отдельные исторические Python Playwright тесты — по browser.yml |
| Windows | x64, VS Build Tools C++/MSVC и Windows SDK, WebView2 Evergreen Runtime; CI windows-2025 |
| Версия продукта | Native 0.4.0; package.json 0.3.0-alpha.1 — историческая JS-версия, не менять молча |

Установка JS и безопасная браузерная сборка:

~~~powershell
npm ci
npm test
npm run build
npm run dev
~~~

Preview: http://127.0.0.1:5173. Можно открыть Quantum-Office.html без сервера; origin и профили браузера не идентичны. Команда build генерирует Quantum-Office.html, Quantum-Office.zip, dist/index.html, dist/components.html, dist-native/index.html/app.js/app.css/draft-bootstrap.js и локальные print assets. Редактировать источники, не generated HTML. npm run check = unit + build.

~~~powershell
npx playwright install chromium
node tests/task143_browser.cjs
node tests/task1671_browser.cjs
node tests/task1672_browser.cjs
~~~

Полный перечень и имена запусков брать из .github/workflows/browser.yml, а не полагаться только на smoke. TASK167.3 сравнивает реальный baseline 7be748bbd93661cf9df7149ae9ad81652944a0dc, checkout в task1673-baseline и build там, затем node tests/task1673_browser.cjs (следовать точным путям workflow). Изолировать профили, использовать фикстуры, не пользовательские документы.

Нативная компиляция (не запускает приложение с данными владельца):

~~~powershell
rustup target add x86_64-pc-windows-msvc
Push-Location src-tauri
cargo test --locked --target x86_64-pc-windows-msvc
Pop-Location
npx --yes @tauri-apps/cli@2.11.4 build --target x86_64-pc-windows-msvc --bundles nsis -- --locked
~~~

Setup: src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/; standalone EXE в release/. CI формирует Portable отдельно. Native dev (npx --yes @tauri-apps/cli@2.11.4 dev) и запуск тестовой сборки разрешены только в отдельной Windows VM или учётной записи без рабочих данных. Не путать браузерный npm run dev с Tauri. Нативный smoke предназначен исключительно для одноразового GitHub-hosted runner: устанавливает приложение, меняет временную per-executable CDP policy, создаёт/заменяет тестовые записи, проверяет переустановку. НЕ запускать его на рабочем Windows-профиле и не подделывать GITHUB_ACTIONS/RUNNER_ENVIRONMENT.

## 3. Карта исходников и архитектура

- src/main.js — общий shell, route/render, launcher, ribbons, Sheets/Writer/Slides/Studio и маршруты diagnostics/work/bank. Состояние редакторов и глобальная навигация. Один shell; не встраивать отдельные HTML-приложения.
- src/styles.css и src/styles/ — локальные CSS imports, темы, общий дизайн, education/work-builder/diagnostics. docs/DESIGN_SYSTEM.md, dist/components.html — живой каталог.
- src/core/store.js, workbook.js, formulas.js, xlsx.js, writer-*, studio-* — модели и экспорт офисных редакторов; сохранять обратную совместимость.
- src/core/diagnostic-workbench.js, diagnostics.js, diagnostic-question-bank.js, diagnostic-media.js, student-hub.js — диагностики, библиотека, сессии, медиа, результаты ученика.
- src/core/work-builder.js — конструктор заданий, банк UI, режимы PDF и научных рисунков, нормализация банка и выбор repository, transaction guard; qwBankEdit, qwVisualEditor, qwCanNavigate, qwPanelPreference, qwInstallPanels. Не считать временный рисунок сохранённым в банке до явного Save.
- src/core/work-model.js — QWORK и нормализация/валидация задания, графика, схемы, ручного размера фигуры. work-physics.js, work-geometry.js, work-labels.js — физические модели, геометрия и подписи; work-content.js — MathML/Markdown/SVG. work-layout.js, work-print.js, work-print-fonts.js, work-print-theme.js — PDF/печатные модели и рендереры. Не дублировать движки.
- src/core/bank-repository.js — IndexedDB BankRepository; sqlite-bank-repository.js — адаптер SQLite с тем же интерфейсом; bank-assets.js — бинарные вложения; bank-backup.js — канонический архив/проверка; office-backup.js — общий QBACKUP. Банк не принадлежит Writer.
- scripts/build.mjs — единственный источник порядка ESM bundle и нативной подмены хранилища; scripts/native-storage-contract.mjs сверяет используемые ключи JS/Rust. Vendor JS поставляется локально. Native marker и отсутствие IPC должны приводить к ошибке, не к пустой браузерной базе.
- src-tauri/src/main.rs — Tauri commands, закрытие окна, app_data_dir; bank.rs и schema.sql — SQLite, bounded IPC, CRUD/restore/backup; drafts.rs — отдельные черновики, CAS/ACK/legacy sources; save_file.rs — нативная запись файла через выбранный пользователем путь; Cargo.lock, tauri.conf.json, capabilities/default.json — конфигурация сборки/безопасности.

## 4. Банк и модели документов

BankRepository (браузер IndexedDB quantum-office-bank v2) и SQLiteBankRepository (desktop) предоставляют listTasks(filters,pagination), listFacets, getTask, createTask, updateTask с expected revision, deleteTask, import/export, createVerifiedBackup, inspectRestore, restoreVerifiedBackup, assetDiagnostics/getStatistics. Каталог использует метаданные и пагинацию (макс. 80), получает полный объект по ID. Стабильные ID, уникальные номера 1..99999, ревизии, дата создания/изменения, счётчик выданных номеров, дедупликация полного содержания. Фасеты: subject, grade, exam, year, part, slot, difficulty, type, topic, subtopic, origin. Не переиспользовать удалённые номера, не обходить CAS. Не копировать чужие авторские задания; создавать собственные и проверять решения.

QWORK v1: JSON format quantum-work, version 1, id/title/subject/grade/topic/variant/instructions/layout/exam/tasks, настройки печати. Задание: id/type/part, prompt, answer, comment (письменное решение), criteria, metadata, points, answer/solution visibility/style, figure none/graph/diagram/image, position, figureWidth и optional figureWidthMode=manual, pageBreak. График: диапазоны осей, шаг/подписи, сетка, точки/элементы, режим координат, семейство кривой и параметры. Схема: типизированные фигуры и связи, координаты/стили. Изображения переносимых документов — data URL PNG/JPEG/WebP; внутренний банк хранит BLOB отдельно по MIME+SHA256, гидратирует один выбранный объект. Не растягивать рисунки, учитывать подписи осей (над вертикальной, справа от горизонтальной), сохранять размеры и единицы. Текст/формулы — существующие Markdown/MathML, не исполнять произвольный HTML/JS из документов.

QWBANK v1 — quantum-work-bank items; v2 — schema/count/checksum/items (обмен); v3 — quantum-work-bank-backup, schema 1, createdAt/count/records/meta/manifest с SHA-256 канонической sorted JSON UTF-8. Сохраняет полный task, постоянные номера/ревизии, метаданные, картинки и последовательность. SHA-256 проверяет целостность, не является подписью. Старые форматы читаются; v3 рекомендуется для полного переноса/восстановления. QBACKUP v3 объединяет данные редакторов и банк, но не гарантирует одну атомарную транзакцию всех хранилищ. Подробности TASK166.md, TASK166.2.md, TASK166.3.md, TASK166.4.md.

## 5. Нативные данные, миграция, резервные копии

Стабильный identifier com.quantumoffice.desktop. Обычно %APPDATA%\com.quantumoffice.desktop\bank.sqlite3 и drafts.sqlite3; snapshots рядом. Не хранить документы рядом с EXE; Portable использует тот же app_data_dir и не означает отдельную безопасную тестовую базу. Bank schema v1: tasks/meta/assets/task_assets, indexes, BLOB SHA/MIME/length, FK, sequence/generation. WAL, synchronous FULL, busy timeout, IMMEDIATE write transactions. Replace restore: предварительная проверка архива, поколение/снимок, защитный VACUUM INTO и атомарная запись. Не копировать один открытый .sqlite3 без WAL/SHM; для backup использовать штатный проверяемый QWBANK и native snapshot, закрыть приложение для дополнительной копии всего каталога. Не очищать assets автоматически. При ошибке целостности — сохранить оригинал, не создавать пустую базу поверх.

Draft schema v2: drafts(key,revision,value,sha256), legacy_sources. Native bootstrap загружает SQLite раньше редакторов; отсутствующие ключи мигрируют из legacy browser storage, существующее native значение/tombstone приоритетно, оригинал остаётся. Нативный интерфейс использует qoDraftStorage с revision/flush/ACK, retry и recovery. Панели — отдельный ключ quantum-office.education-panels.v1, не QWORK/QWBANK. Добавление нового ключа требует JS/Rust allowlists + build contract + тестов. Не считать pending запись подтверждённой. CloseRequested перехватывается в Rust, JS проверяет активный редактор и родительскую транзакцию, затем flush и draft_close. Отмена не закрывает и не создаёт ложную ошибку SQLite. В случае настоящей ошибки штатный аварийный экспорт сохраняет неподтверждённые значения перед закрытием. Не снимать эту защиту.

Перед обновлением: экспорт проверенного QWBANK v3, отдельные QWORK/QDOC/QBOOK/QSLIDES и QBACKUP при необходимости, проверить открытие копий в изоляции. Закрыть приложение и сохранить копию каталога данных. Новый Setup устанавливать поверх старого только после принятия архитектором. Не удалять AppData. Подписанного updater и гарантированного cross-version rollback пока нет.

## 6. Тестирование и принятие

Каждая задача: отдельная ветка, минимальный diff, npm test + build, соответствующие исторические UI regression, native Cargo tests при изменении storage, реальные Windows проверки при UI/IPC/save/close. GitHub Verify, Chromium smoke и Windows desktop SQLite — push и PR (6 результатов на одном head SHA; PR merge-ref в GITHUB_SHA отдельно от head). Не ослаблять assertions, не отключать тесты, не считать инфраструктурный FAIL продуктовым. Повторить только подтверждённый инфраструктурный сбой. В текущей задаче старый Chromium font-install failure прошёл rerun на том же HEAD. Для будущего отчёта проверять свежие workflow.

Windows evidence: scripts/task1664-windows-smoke.ps1, tests/task1664_cdp.cjs, task1664_native.cjs, task1673_native_dock.cjs, task1673_native_dialogs.cjs, task1664_scale.cjs, task1664_visual.cjs, task1664_pdf_compare.py, task1664_graphics_pdf.py. Нативная проверка использует disposable runner, реальную установленную Tauri/WebView2, настоящий CloseMainWindow, один ответственный обработчик диалогов, actual process exit, hash/revision witness, ordinary/reinstall/portable. Сравнение PDF через CDP не равно физической печати/ручному OS save dialog. Сохранять screenshots и JSON в evidence/native; browser TASK167.3 в evidence/task1673. Результаты не считать принятыми до финального CI и проверки архитектором. Известные ограничения: системный DPI 100/125/150 не проверен достоверно, реальная печать/OS диалоги требуют ручной проверки; архивы ограничены размером и памятью (20k records/260 MB canonical bank; draft 64 MB/key, 192 MB total); нет полной Office fidelity, updater/signing, Pages не настроен. Не обещать безопасное восстановление после любого внешнего дискового отказа.

## 7. Лекции и следующий приоритет

PR #158, feat/lecture-foundation, HEAD b4475806f42e72de0736b62828694ab8cfebd0a3, Draft. Не изменён этим этапом. QLECTURE v2: лекция/сценарий — два режима одного документа; 13 сокращённых разделов радиации, 15 SVG объектов, отдельный SVG/PNG и экспериментальный WebM графика. Изолированный smoke ранее PASS, нет полной общей интеграции, нативного сохранения/восстановления, полной библиотеки, полноценного mouse edit/масштабирования или проверенного импорта в Quantum Board. См. docs/LECTURE-LAB.md в указанной ветке. Не видеоредактор: преподаватель сам записывает лекцию, переносит отдельные изображения/анимации на доску.

После принятия TASK167.3 владелец первым делом хочет банк: удобный интерфейс и навигация, категории/фильтры, редактирование условий/письменных решений/критериев, крупный просмотр для записи, графики/схемы/иллюстрации, авторский контент. Не делать это без нового задания. Далее по согласованию: общий редактор научных объектов (предварительный TASK168), интеграция лекций (169), несколько объектов в задании (170), каталог/варианты/решения (171, часть может быть перенесена раньше по решению владельца), библиотека демонстраций/экспорт (172), авторский вариант физики в духе ЕГЭ-2018, 32 задания с проверенными решениями и обеими ориентациями PDF. Нумерация не утверждена как новый порядок. Не стартовать TASK168 автоматически.

## 8. Граница передачи

Текущий этап — только исправление нативной приёмки TASK167.3. Документ создан в кандидате до завершения финального CI; фактические результаты и SHA смотреть в PR #161 и GitHub Actions. Архитектор проверяет и объединяет, затем подтверждает main и выпуск. Локальный Codex продолжает по отдельным заданиям владельца после этой границы.