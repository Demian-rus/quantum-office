**REQUIRED FIRST READ: `docs/PROJECT_CONTEXT.md` — product decisions, owner UX feedback, current limitations, future plan and handoff.**

# Quantum Office engineering rules

1. One app, common shell, separate *editor workspaces*; first priority Quantum Sheets. Preserve the launcher and top-level switching.
2. Zero proprietary activation, mandatory cloud accounts or subscriptions. Offline editing is a core requirement.
3. Preserve data and document schema across iterations. Every change touching saving/importing needs round-trip and corruption tests.
4. Do not claim features are implemented before they are proven in actual runtime tests. Do not claim desktop builds are ready merely because Tauri scaffold exists.
5. `npm test` and `npm run build` are the minimum for every change; include Chromium smoke for UI changes.
6. Stop unbounded refactors; one task, one reviewable change, and evidence. Keep GitHub project isolated from Quantum Board and Quantum Portal.
7. Never tell the user their data is safe solely because browser localStorage has an autosave. Recommend explicit file and backup exports until native durable saving passes tests.
8. Never store signing private keys, user documents or credentials in git.
