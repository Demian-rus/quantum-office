# TASK166.4 — Windows SQLite (implementation candidate)

Base 926af256cabfc58cdbc5af91eb5a1d448fac7a75. Draft, no merge. Unaccepted until Windows build, real launch, full historical CI and interoperability evidence exist.

## Architecture
Same JS source, browser build and native build with explicit marker; fail closed on missing IPC. Tauri 2.12.7 / tauri-build 2.7.6 / CLI 2.11.4, rusqlite 0.43.0 bundled SQLite. Top-level dependencies specified; first Windows CI generates actual Cargo.lock to commit before acceptance. Docs: https://v2.tauri.app/reference/config/ and https://v2.tauri.app/distribute/windows-installer/; https://www.sqlite.org/wal.html and https://www.sqlite.org/pragma.html.

SQLite in Tauri app_data_dir, stable identifier com.quantumoffice.desktop, normally %APPDATA%\\com.quantumoffice.desktop\\bank.sqlite3. Existing non-SQLite file or unsupported schema fails without replacement. Each IPC operation uses a short-lived connection, worker thread, parameterized queries, WAL, FULL synchronous, foreign keys, 10s busy timeout and IMMEDIATE writes. Schema v1: tasks (separate rows, revision and permanent number, JSON model, indexed classification), assets (BLOB, SHA, MIME, size), task_assets (foreign-key links/roles), meta (sequence, generation, provenance). Generation guards restore against concurrent changes. Active images decode and validate MIME; dormant legacy bytes kept. Export/backup rehydrates exact original Base64; portable formats remain shared.

Native replacement creates a checked VACUUM INTO snapshot before entering write transaction; generation checked again under lock, all new records re-read before commit; three most recent recognized snapshots retained (best-effort retention across concurrent processes). No raw copying of WAL database. No automatic browser profile extraction. Browser QWBANK v3 is intended transfer mechanism; QBACKUP continues existing separate bank flow. Other editor drafts still WebView2 localStorage.

Native bounded IPC command set, no arbitrary SQL or shell interface. Folder opening is fixed application data folder. Export uses a user-selected native save dialog, temporary file and replacement, with no arbitrary write path exposed. File open uses existing WebView file inputs. Existing print preview uses generated iframe scripts; CSP and WebView print need actual GUI validation. No blanket unsafe-eval or remote script permission. Unsigned candidate, NSIS configured for offline WebView2 installer. Portable executable requires installed WebView2.

## CI and limitations
Windows x64 workflow runs JS build/tests, real SQLite Rust tests, installer build and EXE launch/restart. Cargo lock generation preliminary, not reproducible until committed. GUI PDF/print, DPI, native save cancellation across all editor callers, cross-version archive and scale comparisons, large image test and full fault coverage remain acceptance gates. Do not represent candidate as ready. Pages baseline fails at actions/configure-pages: enable Pages with GitHub Actions as source in settings; no workflow disabled.

## Dependency resolution and native runtime acceptance

Cargo.lock is committed from the CI resolver (SHA-256 861988c4c4bc25c09cfe3d4fec1e18dbfd737f4fd575724f56fd898b89fece63). Build/test use --locked. The Windows smoke also connects to the actual release WebView2 using a loopback debugging switch set only by CI, verifies bidirectional verified archive transfer with large PNG/JPEG/WebP, CAS, metadata paging, native snapshots, UI bank insertion, PDF byte generation and both print layouts, then checks persistence after process restart. No production debugging listener is enabled. This test is an acceptance gate, not a claimed result before successful execution.
