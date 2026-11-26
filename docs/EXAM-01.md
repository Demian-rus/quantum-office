# EXAM-01 — экзаменационный издательский стандарт

## Правила

- Заголовок ученика: «Вариант N» по центру. Внутреннее название QWORK сохраняется.
- Ключи: «Вариант N — ответы», «Вариант N — решения и критерии», «Вариант N — условия и решения».
- Номер: **№ 1 (00815).**; без записи банка — **№ 1.**. Квадратный маркер и отдельная колонка отменены именно для экзаменационного профиля.
- Поля `printSettings.examPartHeadings` и `examTopicHeadings` независимы от исторических настроек и по умолчанию выключены. Явные заголовки центрируются в своей колонке. Модель частей не меняется.
- Номер варианта хранится в существующем поле `variant` QWORK v1; нечисловые исторические значения сохраняются и для печати экзамена используют 1. Номер можно изменить через параметры работы или макет PDF.
- Экзаменационный профиль `exam` и старые документы `layout: booklet` без другого профиля используют новый стандарт. Прежний компактный макет `layout: exam` без нового профиля остаётся совместимым. Профили practice/notes и одиночный предпросмотр карточки банка не меняются.
- Постоянные номера читаются из `task.source.kind === 'bank'` и `source.number`; идентификатор из UUID, позиции или заголовка не вычисляется. CONTENT-01 связывает QWORK с реально присвоенными номерами после импорта. Старые QWORK без ссылки на запись банка не получают вымышленные номера; для привязки нужно собрать вариант из банка или повторно экспортировать исходник. Переносимый QWBANK остаётся без навязанных номеров.

## Проверка

```powershell
npm ci
npm test
npm run build
npx playwright install chromium
node scripts/content01-export.cjs evidence/exam-01/content
node scripts/editor01-export.cjs
node tests/exam01_browser.cjs
````

CONTENT-01 экспортирует пять PDF и PNG, проверяет число заданий/баллов, реальные номера, заголовки, отсутствие квадратов, геометрию номера/условия, сохранность банка и QWORK. Скрипты должны запускаться в одноразовом профиле. Не заменять ручную Windows-приёмку проверкой Chromium. Существующие пользовательские материалы и БД не мигрируются. Не выпускается установщик.

CI дополнительно строит два учебных материала и ключ на исходном HEAD 0.4.3 и на EXAM-01. `tests/exam01_practice_regression.py` сравнивает геометрию текста и растровое содержимое всех страниц, не только CSS-классы.

## FINAL FIX — локальная идентичность банка

При открытии QWORK проверяется запись по ID. Если совпадает дата создания записи (для новых сборок) либо все ключевые поля содержания, используется фактический локальный номер. При независимом импорте дата может отличаться: тогда необходимо точное совпадение содержания. При отсутствии записи, несовпадении или недоступности банка исходная ссылка сохраняется как `source.kind: external-bank` вместе с её номером, но этот номер не публикуется как номер локального банка. Пользователь получает сообщение при открытии. Банк не перенумеровывается. Для старого файла без метки даты с изменённым содержанием безопасное автоматическое подтверждение не всегда возможно; требуется пересборка из банка. QWORK остаётся доступен независимо от банка.

Новая работа и сборка из банка используют профиль exam; ключ следует активному макету. Старый layout exam без профиля открывается как прежний макет и исчезает из списка при уходе с него.

`node tests/exam01_filled_bank_browser.cjs` после CONTENT-01: изолированная база, пять существующих записей, 32 импортированных через UI, реальное выделение и сборка, QWORK/повторное открытие, четыре вида PDF, повторный импорт, внешний номер, совпадение ID с чужим содержимым, недоступность банка и переключение профиля. Не использовать рабочую базу владельца.

### Исторические ошибки CI

Базовый Chromium: https://github.com/Demian-rus/quantum-office/actions/runs/45795650416. Сравнение с https://github.com/Demian-rus/quantum-office/actions/runs/45802628856:

| Группа | Доказательство на базе | Классификация |
|---|---|---|
| TASK152 | job 139825493215: скрытый #qw-prompt | исторический селектор редактора |
| TASK161 | job 139825493403: тот же селектор | исторический селектор редактора |
| TASK147 / browser | job 139825493130: тот же селектор | исторический селектор; выгрузки отсутствуют вследствие остановки |
| TASK167.2 | job 139825493569: отсутствующая preview | исторический селектор ленты |
| TASK166.3 | job 139825493466: исчезнувший #qw-task-preview img | исторический селектор редактора |
| TASK150 | job 139825493090: те же координаты надписи | устаревшая геометрия UX-02, измерять видимый штрих |
| TASK160.1 | job 139825493405 PASS | устаревшее ожидание после EXAM-01, проверить фактический номер |

После устранения первых остановок открылись следующие проверки: TASK148 (тот же скрытый textarea), TASK150.2 (прежний отступ подписи), TASK166.4 (прежний интервал 5.25 мм вместо принятого 3 мм). См. jobs 139909978294, 139909976777, 139909976649 прогона 45820135643. Миграция селекторов и соответствующих ожиданий не означает удаления проверок функциональности. Новые тайм-ауты не увеличивать. Окончательный статус определяется результатами последнего SHA, Windows остаётся отдельной приёмкой.

TASK148 PDF: фактический векторный PDF артефакта 15117353931 (run 45821891787) содержит все подписи F₁, F₂, F₃, «Подвижный блок», а также Unicode U+2212 `−10`; исторический тест ожидал ASCII `-10`. Проверка обновлена на фактический математический минус; цвет, векторные стрелки и наклон сохранены. Дополнительный тест переключения профиля обнаружил момент, когда iframe ещё не содержит documentElement; ожидание готовности исправлено без изменения тайм-аута.

### Дополнительная историческая регрессия TASK149.1

В run 45822914092 (job 139919672674) первый непройденный шаг общего Browser — TASK149.1: прежний селектор `line[stroke="#d9dee4"]` возвращал 0 вместо 22. На исходном HEAD 0.4.3 `src/core/work-content.js:359,409,413` уже задаёт цвет `#dddddd` и семантический атрибут `data-qw-grid-line="true"`. Проверка переведена на этот атрибут с исключением вспомогательных линий reference; точное требование 22 линий сохранено. Классификация: историческое устаревшее ожидание, подтверждённое исходником базы, а не регрессия EXAM-01. Полный прогон после изменения должен подтвердить результат.

## FINAL FIX 2 — historical paint defaults and diagnostic execution

TASK149.1 job 139921944788 (run 45823569183): actual inspector #186ba3, selected SVG #222222. The same fallback expressions exist in the baseline f2d1432. This is a genuine historical editor mismatch, not EXAM-01 and not an incorrect selector. Shared effective paint functions preserve the renderer's existing default/explicit stroke and width; the inspector reads those values instead of obsolete defaults. Template stroke and point defaults are aligned; publishing curve behavior stays unchanged. No model defaults are materialized or stored. The historical test compares actual SVG to inspector, including palette and undo; block undo compares the captured original SVG rather than a retired hard-coded color.

The general Browser job now executes 144 historical steps after earlier failures if Chromium setup succeeded and the run was not cancelled. No step uses continue-on-error, so every failure still fails the job. Dependent tests may fail because prerequisite evidence is absent; these must be classified separately, not called independent functional failures. EXAM-01 and pixel checks remain unchanged. No protected document or bank migration is intended.


### FINAL FIX 2 — full Browser diagnostic (04e8827)

- Run 45834076905 / browser 139958166451: 16 independent groups passed; 15 failed steps in the general Browser job. Verify 648/648. Target EXAM, CONTENT, filled-bank and pixel checks passed. Actual 41 protected pages match approved output exactly at 144 DPI.
- TASK149.1: original color discrepancy is a historical real defect, fixed by shared effective style. Newly added post-Undo inspector assertion must reselect the object because visual Undo intentionally clears selection. Local downloaded Chromium HTML: default #222222, palette #dc2626, Undo #222222, inspector matches SVG.
- TASK149.2 sample: outdated save/preview selectors; missing generated QWORK caused dependent TASK149.2 PDF and TASK150.1 failures. Adapt footer audit to approved first-page header, centered pagination and QX signature; preserve mutation rejection and body limits.
- TASK149.3 layout: 42 W characters exceed the actual full text width in baseline 0.4.3 and current build. 35 W fit full width but not side column; retain 150 W oversized rejection. PDF bounds: QX is an intentional historical body-margin exception verified independently for embedded font, visible ink margins and overlaps.
- TASK149.4 browser: **open historical functional defect**, very long answer plus criteria (240/180 repeated sentences) is rejected with a block-fit error on both baseline 0.4.3 and current build. Do not waive mandatory stress check or change accepted print engine within this task. Save already generated ordinary PDF measurements independently before stress; previously the downstream PDF audit failed for missing report.
- TASK149.5 collision: independent verifier mistakes current #dddddd grid for geometry. Baseline/current descending segment probe confirms collisions only with grid strokes. Exclude semantic grid, not actual geometry. TASK149.5 PDF and TASK149.7 PDF regression lacked preceding reports.
- TASK149.6: historical numeric axis font expectation 8–9 pt contradicts approved 21 SVG units at 48 mm / 369 units, i.e. 7.743 pt. Verify derived physical size and actual grid color #dddddd. Dependent PDF report was missing.
- TASK149.7: genuine historical project Undo defect, reproduced on baseline/current with two visual Apply sessions. Reused work transaction recorded only once; each accepted modal edit now records a separate snapshot, without changing bank draft behavior. Original Undo assertion remains.
- TASK035: historical scrollbar test expected >=12 px; base/current CSS sets 11 px deliberately. Preserve actual header alignment and exact width. No Sheets production changes.
- These are not new EXAM-01 regressions. Remaining mandatory failures must be reported, not suppressed. No broad pagination rewrite, bank schema, publication layout, installer or merge in this batch.
