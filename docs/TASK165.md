# Quantum Office — TASK165: Markdown and written solutions in PDF

## User goal
After TASK164's interactive task-bank Markdown authoring, use the same authored formatting in exam printouts and in the teacher's written solutions PDF while preserving the compact A4 exam layout and original QWORK/QWBANK v1 documents.

## Scope
- Explicit Markdown syntax opts in the relevant individual condition or answer field. Plain legacy tasks stay on the original `qwContentHTML` print pathway. `\\(...\\)` alone is already supported in the legacy pathway and deliberately does not enable the rich layout.
- Rich print fields support headings, emphasis, lists, quotations, formulae (inline MathML and displayed blocks), code and simple Markdown tables. HTML is escaped.
- For student task PDFs, *all* tables are placed after the condition and centered in the available column. When both a figure and a native table are present, the figure is below the text; the table wrapper is retained instead of being destroyed during relocation.
- In the answer/solution PDF, table order is preserved within the written explanation or rubric and centered. Do not move a scoring rubric to the very end if the author wrote explanatory text after it.
- Optional teacher `Подробные решения` and `Критерии оценивания` controls are preselected when relevant fields have content. The answer-only export remains possible by unchecking them.
- Do not duplicate `Решение` or `Критерии` headings when already provided in the author's Markdown.
- Display MathML can occupy a full-width box while having narrow ink; print overflow validation measures its first math child, not the display wrapper.

## Compatibility and what remains intentionally unchanged
- Source schema and local bank migration: no changes, QWORK/QWBANK v1.
- EGE 2018 author booklet, 32 tasks: portrait 6 physical pages; landscape 6 A4 sheets (11 logical columns) on source fixture `QuantumOffice_EGE2018_32_tasks_v2.qwork`, unchanged from TASK164 locally.
- Native Chromium vector browser print is the target. The historical raster PDF fallback is unchanged.
- This does not generate solutions automatically, grade responses by official FIPI rules or store video.
- For unusually large unbreakable tables / formulae, print may still require a more compact table or shorter equation. Future work can add page-friendly table row splitting and a versioned multi-figure model.

## Acceptance evidence
- `npm test` including `tests/task165_rich_print.test.js` (plain legacy, Markdown, equation and HTML escaping).
- `tests/task165_rich_print_browser.cjs`: two A4 orientations; student booklet with Markdown table and graph, teacher solution and scoring rubric, narrow/centered table placement, HTML safe rendering, answer-only option.
- All historical pagination and diagram tests, especially TASK150, TASK154, TASK160.1 and TASK161.
- Independent visual review of produced one-task written solution PDF: formulas, rubric table and semantic heading hierarchy; validate before merge.
