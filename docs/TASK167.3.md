# TASK167.3 — education workspace UX candidate

Base: 7be748bbd93661cf9df7149ae9ad81652944a0dc; TASK167.1/#159 and TASK167.2/#160 merged. Main Verify passed; post-merge Chromium/Windows pending at start; Pages separate.

Audit: work center limited to 960px and fixed rails; PDF/visual editors modal and width-capped; diagnostics bounded center and nested borders; bank already standalone. This candidate uses a shell-owned internal mode (nonmodal dialog element retained as compatibility DOM, not a top-layer modal); underlying route is mounted and inert, close restores it; route guard and cancel confirmation protect working scientific and bank drafts. PDF remains same isolated iframe and renderer; actual scientific clone/commit logic remains unchanged. Dock preferences use existing localStorage profile mechanism, independent of QWORK/QWBANK, with pointer and keyboard resize, collapse, reset and responsive narrow drawers. Diagnostics reuse existing panels and bank reuse existing catalogue/large preview. No lecture branch, scientific models, SQLite or print design changes.

Acceptance pending: comparative screenshots, viewport/theme matrix, QWORK and navigation, native restart. Actual system DPI not tested. Draft only, no merge or release.
