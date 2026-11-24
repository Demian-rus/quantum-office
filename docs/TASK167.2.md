# TASK167.2 — layout tools candidate

Base 0a69f6616e5443c2ca86f446400360dd10a1b383. Draft, not accepted. Legacy automatic layout keeps the old figureWidth ceiling. Manual mode is an optional figureWidthMode='manual' on a task, retaining existing width in CSS pixels; the print panel displays millimetres (96dpi). Reset removes the optional flag and returns to default width 220. The print layout uses the requested width subject to available space, height and label legibility; large figures may move below text. No graph or diagram coordinates, SQLite schema, or independent lecture branch changes. Existing format choices plus existing exam layout are independently selectable from orientation. Shared SVG icon system replaces the audited move/close/delete glyphs.

Tests: model roundtrip, independent widths, invalid input, reset, unchanged geometry. Browser/native and final CI evidence pending. No acceptance claimed.

Baseline Verify passed; Chromium dependency install failure and Pages configuration error separately observed. Windows was in progress at initial check.
