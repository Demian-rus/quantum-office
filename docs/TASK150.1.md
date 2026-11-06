# TASK150.1 — CI validation and complete TASK150 review package

Base: `22f2ebea55cb408a8000d88f1b35908af6d7b9f0`.
Branch: `fix/task1501-ci-validation`; Draft PR targets `design/task150-pdf-layout`.
No merge or deployment.

The original TASK149.2 PDF assertion and missing-before-PDF packaging failure
were reproduced in a clean worktree at the exact base SHA. The two-page student
PDF and one-page answer key have footer bounds y=812.5123–821.4443 pt.
The key metadata also ends with `Ключ ответов`.

Body margins remain x>=30, y>=25, right>=30, bottom>=30 pt. Only the exact
metadata and current `N / M` number can occupy the existing bottom band
(height-30 through height-12 pt). Both fields are required once on every page,
with their existing 8pt font, common baseline and no horizontal overlap.
27 mutations of actual student/key PDF pages exercise missing/wrong/duplicate/
misplaced/clipped fields and body text outside margins; all must be rejected.
Content, page count, answer isolation, vector and QWORK checks remain enabled.

TASK150 review has an independent Chromium CI job. It builds the pinned
`d0f1b3c6ec98b88aa73d784f5f5859be8059a338` baseline and current HTML, generates
baseline then final PDFs, runs PDF validation, checks incomplete-input rejection,
packages and verifies the ZIP before uploading the complete artifact. Failure
output is separately named diagnostics-incomplete. Historical browser tests run
in the browser job without being removed or skipped by the new review job.

Packaging requires all 23 PDF/QWORK inputs, three successful validation reports,
the standalone HTML and documentation. It rejects absent/empty inputs, checks
report inventories and page counts, removes any stale success ZIP, and publishes
the ZIP only after CRC, exact member inventory and SHA256 verification. Every
PDF page has a PNG review image; all three QX concepts retain colour/BW work
and separate answer keys. Runtime provenance identifies baseline and final HEAD.

A fresh Linux run also reproduced a parser ambiguity in TASK149.4/149.5/150:
a MathML superscript followed by sentence punctuation becomes a flattened line
`2.` and was counted as a 25th task. These checks now read the actual bold
number-prefix spans. The exact ordered 1–24 assertions remain unchanged;
missing, duplicate and wrong prefixes in serialized PDF copies are rejected.
No coordinate, geometry or body-font tolerance was increased.

No files under src/, models, schema, math/geometry, vector renderers or other
editors are changed. Validation commands and final CI URLs are recorded in the
Draft PR; generated evidence is uploaded by CI.

Local validation: 561 Node tests and build PASS; TASK149.2–149.7 browser/PDF,
offline/ZIP regressions and TASK150 browser/PDF PASS. All 27 footer mutations,
3 task-number mutations, 54 missing-input cases, one empty-PDF case and
3 invalid-report cases reject damaged input. The full review ZIP contains
14 PDFs and 40 individual page PNGs plus contact sheets, 3 QX QWORKs, both
stages of format QWORKs, successful reports, docs, provenance and offline HTML.
Baseline/final fixture comparison excludes only independently allocated project
and task IDs; every other QWORK field, including geometry, is equal.

Linux local system-font fallback differs from GitHub's browser dependencies;
baseline compact distribution is 10+12+2 locally (still 3 pages), final is
10+14. PDF bounds and all semantic/geometry checks pass at unchanged tolerances.
Native Windows/macOS and physical print were not tested in this CI-only task.
