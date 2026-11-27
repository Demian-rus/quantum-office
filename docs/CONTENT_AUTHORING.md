# Создание учебного контента для Quantum Office 0.4.4

Цель: обычный чат ChatGPT выдаёт UTF-8 JSON-файл .qwbank, который пользователь импортирует в локальный банк. Код, установщик и GitHub для этого не нужны. Не генерировать номера банка и не включать ложные ссылки на банк. Проверять физику/математику, единицы, точный ответ, решение, критерии, читаемость иллюстраций. Не добавлять подсказки и служебные заголовки в условие. Название task.title используется для поиска в каталоге.

## Форматы обмена

QWBANK v1: объект {"format":"quantum-work-bank","version":1,"items":[...]} — до 500 записей. v2: те же items, version:2, schema:1, count:items.length, checksum: строка FNV-1a от JSON.stringify(items), до 20000 записей. Контрольная сумма вычисляется до нормализации, поэтому для обычных чатов предпочтителен v1. Пример JS для v2:
```js
let n=2166136261;
for(let i=0,s=JSON.stringify(items);i<s.length;i++){
 n^=s.charCodeAt(i);n=Math.imul(n,16777619);
}
const pack={format:'quantum-work-bank',version:2,schema:1,count:items.length,checksum:(n>>>0).toString(16).padStart(8,'0'),items};
```

QWBANK v3 — проверяемая резервная копия, НЕ формат создания новых задач: сохраняет реальные ID, номера, ревизии, вложения, метаданные и SHA-256.

Запись: id (уникальный стабильный строковый ID до 80 символов, например author-physics-kinematics-uuid), bankNumber:0 или отсутствует, subject: physics/math/algebra/geometry, grade строка до 24, exam: general/oge/ege, topic/subtopic до 120, origin: original/adapted/generated, year: строка года происхождения (1900–2099) либо "", part: "1"/"2" либо "", slot: "1"…"40" либо "", difficulty: basic/advanced/high либо "", examYears: массив целых 1900–2099 (у general только пустой), task: объект.

Для демонстрации назначения тегов в CI применяется 2027 к тестовой копии; это не подтверждение соответствия ФИПИ. Год происхождения не равен году актуальности. Не назначать examYears автоматически по year, текущей дате или похожести задания. Только после проверки конкретной модели; для авторского примера без такой проверки поле пустое/отсутствует. Числа сортируются, дубликаты удаляются. Не выдумывать номер позиции slot или соответствие ФИПИ.

task: id (отдельный стабильный ID), type: short/extended/choice/graph/diagram/blanks/combined; prompt — условие; answer — ответ в требуемых единицах/форме; comment — полное решение (именно comment, не solution); criteria — критерии с баллами; points — 0–100; title до 120; part — текстовая часть; grade/exam/topic/subtopic/origin; tags — до 10 строк до 40; choices — 2–12 вариантов до 300 символов для choice. Текстовые поля до 16000 символов. figure: none/graph/diagram/image, одна активная иллюстрация на задачу. Не вставлять HTML/JS. Использовать publishing.figure: width (процент), maxMm, position: auto/left/right/below, align: left/center/right; остальные параметры оставлять по умолчанию. QWORK: {"format":"quantum-work","version":1,"id":"...","title":"...","subject":"physics","grade":"9","variant":"1","exam":"oge","layout":"booklet","tasks":[...]} — до 80 заданий, 18 МБ, examYear опциональный целый год модели. tasks содержат именно task, не оболочки QWBANK. Не присваивать source.kind=bank или source.number до реального импорта; приложение устанавливает эти ссылки при сборке.

## Разметка
В JSON обратная косая черта экранируется: "\\(\\frac{a}{b}\\)" (после чтения JSON это \(\frac{a}{b}\)). Поддерживаются \frac, \sqrt, \vec, индексы _{}, степени ^{}, \mathrm, \text, греческие буквы, \cdot, \times, \pm, \le, \ge, \neq, \infty, \begin{cases}...\end{cases} (2–8 строк). Не считать весь LaTeX поддерживаемым. Формула до 600 символов. Встроенный rich text: **жирный**, *курсив*, ++подчёркивание++, ~~зачёркивание~~, ^{верхний}, ~{нижний}, [[blank:6]], списки, Markdown-таблицы, отдельные блоки $$ на отдельных строках. Для обычных условий — простой текст и формулы; не делать внутренние заголовки и подсказки.

## Научные объекты

График: task.figure="graph", graph содержит xmin,xmax,ymin,ymax,step (положительный), xlabel,ylabel, points:[{x,y,label}], grid,connected,smooth,coordinateMode first/positiveX/math/custom. До 40 точек, внутри диапазонов. curveFamily points/quadratic/trigonometric и curve a,b,c/amplitude,frequency,phase,offset,trig sin/cos. elements: до 60 объектов point,line,arrow,polyline,text,function; координаты в единицах осей. На осях единицы измерения, без лишних названий. Пример полностью в content/authoring-examples.qwbank: velocity (график v(t), ответ 20 м).

Схема: task.figure="diagram", diagram — массив до 60 объектов, координаты SVG 520×320, y вниз. Каждый объект kind,x,y,x2,y2,label; стабильный id для связанных объектов, optional style/rotation. Векторы forceVector/velocityVector/accelerationVector — от (x,y) к (x2,y2), подпись без ручного рисования наконечника. Механика: block,incline,ground,rope,spring,pulley,fixedPulley,movablePulley,torque,dynamometer,weightSet. Электрика: resistor,rheostat,cell,battery,lamp,switchOpen,switchClosed,ammeter,voltmeter,wireOrth,junction. Связи wireOrth.links.start/end: {id,port:"L"/"R"} (U/D для junction); не заявлять электрическое моделирование. Геометрия: line,ray,infiniteLine,arrow,doubleArrow,dimension,polyline,arc,dashed,rect,circle,ellipse,regularPolygon,point,text,angle,triangle,rightTriangle,quadrilateral; vertices для треугольника, edgeLabels по порядку сторон. Связанные построения construction.kind parallel/perpendicular/midpoint/angleBisector/perpendicularBisector с reference на id. Величины-векторы изображать стрелками. Примеры forces и triangle в эталонном файле.

Изображение: figure:"image", image — data:image/png;base64,... (также jpeg/webp), до 6 млн символов; встроенные байты, не внешние ссылки. Не придумывать base64; использовать реальный проверенный файл. Вложения хранятся отдельно в базе. Файл QWBANK с несколькими изображениями проверять на размер и импорт.

## Полные примеры
[Эталонный QWBANK v1](../content/authoring-examples.qwbank) — пять полных авторских записей: график, физическая схема, квадратное уравнение с формулами, геометрическая схема, теплота. В нём нет назначенных постоянных номеров и нет непроверенной актуальности. CI импортирует его дважды, проверяет QWORK, MathML, SVG, печатный макет и отдельно добавляет годы на тестовой копии. Проверка не означает соответствия официальным экзаменационным моделям.

## Импорт и повторный импорт
Открыть банк → «Файлы и данные» → импорт QWBANK. Импорт нормализует запись и назначает постоянный номер локально. bankNumber:0 не является номером задания. Дедупликация сравнивает полный нормализованный состав записи без внешнего ID, номера и examYears; различающиеся годы при совпадении не перезаписывают локальные теги, сообщается конфликт. Изменённое условие/ответ/решение/критерии — не тот же контент. Не использовать импорт как обновление существующей записи; редактировать её в банке. После импорта проверить карточку, ответ, решение, критерии, визуализацию и только затем вручную подтвердить годы. Перед большим импортом создать резервную копию v3, проверить небольшой пакет. При сборке варианта выбрать нужный экзамен и год, приложение проверит соответствие выбранных задач. Не начинать массовое наполнение в рамках релиза.

Исходники спецификации: src/core/work-model.js, work-content.js, work-physics.js, work-builder.js, bank-repository.js, sqlite-bank-repository.js, bank-backup.js, bank-assets.js. При изменении форматов обновлять эту инструкцию.
