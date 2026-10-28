# Updates and file safety
During development, GitHub Pages serves the preview from main after CI; offline index.html is also available.
A separate desktop installation and signed auto-updater are future milestones. Tauri must use verified signed artifacts, a protected signing key, and migration/rollback tests. Never place user documents inside the application install directory. Preview and local file:// browser storage do not share origins.
