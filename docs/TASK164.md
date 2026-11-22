# Quantum Office — TASK164: task & solution authoring

## Product decision (owner, 2026-11-22)
- The bank is for **authoring physics and mathematics questions and written solutions**, including author-written analogues and EGE/OGE-style scoring. It does NOT store or generate videos. Video production and publishing occur outside Quantum Office.
- Replace the old bank `Режим для видео` with `Увеличить / Свернуть`. Make the task and its vector drawings large enough for taking a screenshot; answer and written solution remain in a disclosure beneath it.
- Keep the existing bank, edit existing question/drawing, avoid a second incompatible QWBANK storage.
- Improve discoverability, typography, preview and formatting with Obsidian-like Markdown conventions, not a huge decorative ribbon.

## Implemented
- Bank view: primary filters are search, subject, exam and topic. Other filters are in `Дополнительные фильтры`; a count indicates applied advanced filters. The short catalogue snippet removes Markdown markers.
- Big preview: larger vector/raster figure and consistent serif task text; `Ответ и решение` expands below; contains written explanation, answer and criteria as separate blocks.
- Bank editor: Markdown field toolbar for prompt, explanation and scoring criteria; button toggles editing and safe formatted preview. A live whole-task preview sits next to category fields.
- Formatting: headings, bold/italic/strike, ordered/unordered lists, blockquotes, horizontal lines, inline code, fenced code, simple Markdown tables, mathematical expressions in `\\(...\\)` and dollar-math notation, and display formulas.
- Two manually editable templates: physical model / law / solution / answer, and assessment rubric. The template does not state official FIPI scoring; points must be checked against the relevant year and problem.
- Serializer unchanged: existing `task.prompt`, `task.comment`, `task.criteria` and `task.answer` plain text fields in QWORK/QWBANK v1. No hidden automatic overwrites or AI calls.

## Limitations
- Markdown is rendered in the **interactive task-bank preview**, not interpreted as a full document-formatting system in existing compact/exam PDF layout. Existing PDF renderer remains unchanged to avoid old pagination regressions. A future print-layout task should deliberately add matching styling and regression tests.
- The 500-task `localStorage` bank cap and 1-figure-per-task QWORK-v1 model remain. Large personal collections need verified durable storage and a versioned schema migration, not an arbitrary localStorage limit increase.
- Automatic generation or evaluation of problem-specific EGE solutions is not implemented. The UI provides fields and structured templates; every scientific explanation and mark scheme must be authored/reviewed for correctness.
- Raw arbitrary HTML is intentionally not supported in Markdown and cannot execute user-provided markup.

## Checks
- `npm test`, `npm run build`, existing TASK145, TASK156, TASK160/161 browser regressions.
- New Node tests in `tests/task164_markdown.test.js`: math, headings, lists, tables, markup injection, compatibility.
- Chromium: `tests/task163_bank_browser.cjs` verifies new concise filters and enlarged view; `tests/task164_bank_browser.cjs` tests formatting controls, preview, saving, solution, rubric and large view.
- User evidence from `evidence/task164-bank/*.png` plus autonomous `Quantum-Office.html`.
