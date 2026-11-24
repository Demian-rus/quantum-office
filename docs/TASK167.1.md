# TASK167.1 — education workspaces (implementation in progress)

Base `12e00fbeb2b526c698a43826e4b161e69cfa4ab6`. Draft branch only; no merge. TASK166.4 storage and printing remain unchanged. PR #158 is isolated and must not be merged or edited.

## Stage 1: stable native header
Native bootstrap previously prepended the pending/ACK/error status and recovery button directly to the document flow. A fixed bottom-right notification stack now hosts the ordinary toast and durable actionable draft error. Pending and ACK update the existing compact status indicator; routine writes do not show notifications. Persistent error is deduplicated and recovery export retained; explicit retry uses the existing flush without resetting revision protection. The same SQLite commands, ACK checks and close/recovery logic remain.

Added state/error/retry regression in task1664_drafts.test.js and real native geometry check before/pending/after ACK in task1664_native.cjs. Runtime and CI results pending; no claim of full task completion.

## Remaining TASK167.1
Independent education routes and catalogue, clean Writer, launcher groups, route-scoped commands, migration of historical UI tests, native restart and viewport acceptance. Future learning materials: two views of one editable document (theory/scenario), separate catalogue, editable science objects and export to Quantum Board. PR #158 remains an isolated prototype.

## Stage 2: independent education workspaces
Routes diagnostics/work/bank render their own surface under the common shell. Writer no longer mounts educational panels. Home groups office editors and educational tools; bank has a full-window nonmodal catalogue and retains the existing work-context picker. Bank add captures document, route generation and request ticket; a stale response cannot append after leaving/re-entering a workspace. Existing diagnostic payload remains in the compatible Writer storage envelope; new/plain text documents preserve it; legacy QDOC restoration explicitly asks before replacing it. No storage/schema or PDF changes. Runtime verification pending. Future materials remain theory/scenario views of one document; PR #158 untouched.

Additional targeted tests: actual layout selection + WebView2 geometry pending/ACK/controlled IPC failure/retry, route return, and real bank screen. Browser route suite uses 1920/1440/1024 in both themes, file exports/reloads and delayed read cancellation. Simulated write failure verifies the frontend error contract; it is not proof of physical disk failure. Physical DPI and manual owner acceptance remain separate.

CI first dedicated workspace smoke reached reload and confirmed actual route isolation, stale-read cancellation, QWORK download/import and PDF bytes. It failed exact diagnostic fixture equality because the synthetic question omitted canonical optional fields; the production reader filled those defaults on reload. Fixture now uses qdNormalize before capture, retaining full byte-equality assertion. Existing diagnostic ribbon selectors migrated to its standalone attribute. Windows push explicitly enabled for this branch; no existing workflow or test removed.

### Follow-up visual inspection
The first standalone bank screenshots showed the page navigation partially covered by the action footer: the catalogue occupied 100% of a body also containing storage bars. The catalogue now fills the remaining flex space, with pagination kept outside the scrolling results list. The viewport/theme regression checks pagination bounds against both the body and footer. Final CI required on this revision.

### Real native error acceptance
The preceding WebView2 test could not intercept the frozen Tauri IPC API and correctly failed because the write actually succeeded. The replacement test installs a temporary, narrowly scoped SQLite trigger only in the disposable GitHub Actions database, verifies an actual aborted write, screenshots both ordinary and 800×600 emulated WebView2 viewports, drops the trigger in a finally block, retries through the real UI and checks geometry and persistence. No fault-injection path is shipped with the app. Final six workflow results remain required.

### TASK167.1 final integration fix
On `221409df`, Verify push/PR passed (624 JS tests) and the specialized TASK167.1 Chromium jobs passed; both overall Chromium runs failed at TASK122 line 44 because the student roster decoration was still gated by the obsolete Writer route. Both guards now target `diagnostics`; the unused Writer-navigation diagnostic tab fallback is removed. TASK122 keeps all prior assertions and additionally checks that the selected student and roster survive reload and Writer navigation, without mounting in Writer. No storage or backup format changes. Native acceptance and all six workflows on the new HEAD must still be confirmed.

### Acceptance evidence on 2d96a18
Verify push/PR: 624/624 PASS; specialized workspace push/PR: PASS (30 theme/viewport route combinations). TASK122 push/PR both PASS including the new reload/route assertions. Both main Chromium jobs reached historical `ui_smoke.py` and failed its obsolete global four-card assertion (seven cards now expected, no page errors). Updated the assertion to require exactly four office cards and exactly three education cards; all other checks unchanged. Local Chromium reproduced the entire remaining smoke sequence with the updated assertions on the actual 2d96a18 HTML and passed. Full final CI is still required on the next HEAD. Native acceptance remains independent; no production code changed in this follow-up.
