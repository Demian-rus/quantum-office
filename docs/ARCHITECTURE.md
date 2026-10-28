# Quantum Office architecture
- One application, one home screen, full-window editor workspace.
- Quantum Sheets is the first functioning editor. Writer and Slides remain roadmap items.
- Source: plain ESM under src; no runtime network calls or external JavaScript dependencies.
- Formula expressions are parsed, never passed into JavaScript eval.
- Small workbook model: books → sheets → sparse cells. Preview bounds: 2000 rows × 100 columns.
- Browser autosave (localStorage) is **not** reliable native file storage. Export .qbook or .qbackup for durability.
- XLSX, DOCX, PPTX, automatic updater, native installation and migration are NOT implemented.
- Native Windows/macOS version is planned with Tauri after persistence and compatibility work.
