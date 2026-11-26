# Quantum Office 0.4.3 — передача разработки через GitHub

Ветка передачи — `sync/office-0.4.3-local`. Исходный коммит версии — `2873e5fceb5223ae1bd1bb81edbb88569e86087f`. База сравнения — `main` на коммите `8d9f57354fa2d5d319482c67371026a07dcf0034`. До коммита передачи версия 0.4.3 содержит десять дополнительных коммитов относительно этой базы. У `main` на момент проверки нет коммитов, отсутствующих в версии 0.4.3.

## Архитектура и точки входа

| Область | Файлы и ответственность |
| --- | --- |
| Общая оболочка и навигация | [src/main.js](../src/main.js) переключает таблицы, Writer, конструктор, диагностики и банк. Общие и модульные стили находятся в [src/styles](../src/styles). |
| Редактор заданий | [work-builder.js](../src/core/work-builder.js) содержит `qwTaskEditor`, общие команды банка и конструктора, черновики редактирования и предпросмотр. [work-live-editor.js](../src/core/work-live-editor.js) связывает редактируемый DOM и исходный текст. |
| Текст и научные объекты | [work-content.js](../src/core/work-content.js) разбирает учебную разметку и строит MathML и SVG. [work-text-style.js](../src/core/work-text-style.js) задаёт допустимые настройки типографики и информационных блоков. Геометрия и физические обозначения находятся в [work-geometry.js](../src/core/work-geometry.js), [work-physics.js](../src/core/work-physics.js) и [work-labels.js](../src/core/work-labels.js). |
| Модель документа | [work-model.js](../src/core/work-model.js) нормализует QWORK, задания, фигуры, параметры печати и оформления. |
| Заголовки и номера | В [work-builder.js](../src/core/work-builder.js) `qwPrintDocumentHTML` собирает заголовок документа, метаданные и заголовки частей. `qwTaskHeading` формирует номер позиции и постоянный номер банка. `qwAnswerSections` формирует ключи. Подпись QX задаётся в [work-print-theme.js](../src/core/work-print-theme.js). |
| Издательские профили | `QW_PUBLISH_PROFILES` в [work-text-style.js](../src/core/work-text-style.js) задаёт экзаменационный сборник, лист практики и конспект. `qwPrintSettings` в [work-model.js](../src/core/work-model.js) валидирует профиль и нумерацию. Выбор профиля и параметры экспорта находятся в [work-builder.js](../src/core/work-builder.js). |
| Предпросмотр и PDF | `qwPrintDocumentHTML` и `qwTaskPreview` собирают печатный документ. `qwPreparePrintDocument` в [work-layout.js](../src/core/work-layout.js) измеряет содержимое, раскладывает книжный A4 или две колонки альбомного A4, делит длинные блоки и расставляет номера страниц. Экранный масштаб применяется к предпросмотру отдельно от печатной геометрии. [work-print.js](../src/core/work-print.js) содержит прежний совместимый путь PDF. |
| Метаданные банка | `qwBankNormalize` в [work-builder.js](../src/core/work-builder.js) нормализует предмет, класс, экзамен, год, часть, позицию, тему, подтему, сложность и происхождение. [bank-repository.js](../src/core/bank-repository.js), [sqlite-bank-repository.js](../src/core/sqlite-bank-repository.js) и [bank.rs](../src-tauri/src/bank.rs) обеспечивают каталог, фильтры, постоянные номера и проверку ревизий. |

## Хранилища и обмен

Автономная HTML-версия использует IndexedDB. Настольная версия использует Tauri, WebView2 и SQLite через адаптер `SQLiteBankRepository`. Схема банка описана в [schema.sql](../src-tauri/src/schema.sql). SQLite отдельно хранит записи, метаданные и бинарные вложения, проверяет ожидаемую ревизию при записи и выполняет восстановление транзакционно. Черновики и параметры панелей проходят через отдельное хранилище в [drafts.rs](../src-tauri/src/drafts.rs). Идентификатор приложения — `com.quantumoffice.desktop`. Штатный каталог Windows — `%APPDATA%\com.quantumoffice.desktop`.

QWORK v1 хранит учебную работу, порядок заданий, поля условия, ответа, решения и критериев, научные объекты и параметры печати. Дополнительные настройки типографики имеют собственное поле `version: 1`. QWBANK v1 и v2 используются для обмена заданиями. У v2 есть счётчик и контрольная сумма. QWBANK v3 — проверяемый резервный архив с SHA‑256, номерами, ревизиями, метаданными и вложениями. [bank-backup.js](../src/core/bank-backup.js) отвечает за проверку архива, [bank-assets.js](../src/core/bank-assets.js) — за обработку вложений.

## Изменения относительно main

- [BANK-01](BANK-01.md) добавил каталог банка, фильтры, масштабируемую пагинацию и подробную карточку задания.
- [BANK-02](BANK-02.md) и этапы [02.1](BANK-02.1.md)–[02.4](BANK-02.4.md) ввели общий редактор, вёрстку A4, индивидуальное оформление объектов, нумерацию, математические подписи и ключи.
- [UX-01](UX-01.md) обновил конструктор и связал предпросмотр A4 с печатной раскладкой. [CONTENT-01](CONTENT-01.md) добавил авторский вариант физики по модели ЕГЭ-2019 из 32 заданий.
- [UX-02](UX-02.md) унифицировал масштаб, прокрутку и математические подписи. [EDITOR-01](EDITOR-01.md) расширил ввод типографикой, контекстными командами, информационными блоками и издательскими профилями.

В Git включены исходники трёх воспроизводимых демонстраций — [варианта ЕГЭ](../content/physics-ege-2019-variant-1.cjs), листа практики и конспекта [по колебаниям](../content/physics-teaching-materials.cjs). Ветка также содержит синтетические фикстуры, тесты и существующую пару автономных артефактов `Quantum-Office.html` и `Quantum-Office.zip`.

## Сборка, запуск и проверка

Для веб-сборки используйте Node.js 22 и npm. Для регрессий нужен Chromium Playwright. HTML можно открыть прямо с диска или через локальный сервер (`npm run preview` после сборки). Профиль браузера для автоматических проверок должен быть одноразовым.

```powershell
npm ci
npm test
npm run build
npx playwright install chromium
node tests/ux02_browser.cjs
node tests/editor01_browser.cjs
node scripts/content01-export.cjs evidence/editor-01/content-01
node scripts/editor01-export.cjs
```

[build.mjs](../scripts/build.mjs) собирает автономный HTML и ZIP, веб-каталог `dist` и локальный пакет ресурсов `dist-native`. Для нативной проверки нужны Rust, Windows SDK и MSVC с целевой платформой `x86_64-pc-windows-msvc`.

```powershell
node scripts/native-icon.mjs
cargo test --manifest-path src-tauri/Cargo.toml --locked --target x86_64-pc-windows-msvc --features tauri/custom-protocol
npm exec --yes --package=@tauri-apps/cli@2.11.4 -- tauri build --target x86_64-pc-windows-msvc --bundles nsis -- --locked
```

Тестировать установленную программу следует в отдельном Windows-профиле или виртуальной машине. Portable также использует штатный каталог данных. Перед обновлением рабочей установки нужно экспортировать банк и документы и скопировать каталог данных после закрытия приложения.

На исходном коммите 0.4.3 локально прошли 644 JavaScript-теста, 13 Rust-тестов, браузерные проверки UX-02 и EDITOR-01, регрессии банка и конструктора, проверки PDF и сборка NSIS. Тест на синтетических данных подтвердил чтение заданий, вложений, черновиков и параметров 0.4.2. Интерактивная приёмка Windows и системный масштаб 125% и 150% остаются открытыми. Пакет NSIS не подписан. Модель задачи рассчитана на одну активную научную иллюстрацию. Образцы данных и ограничения описаны в [LOCAL_CODEX_HANDOFF.md](LOCAL_CODEX_HANDOFF.md).

Установщики, журналы, снимки, сгенерированные учебные PDF и архивы обмена из `evidence/`, зависимости, кэши и временные каталоги хранятся локально. Для разработки через GitHub достаточно исходников демонстраций и экспортных скриптов.
