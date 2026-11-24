# TASK167.1 — education workspaces (implementation in progress)

Base `12e00fbeb2b526c698a43826e4b161e69cfa4ab6`. Draft branch only; no merge. TASK166.4 storage and printing remain unchanged. PR #158 is isolated and must not be merged or edited.

## Stage 1: stable native header
Native bootstrap previously prepended the pending/ACK/error status and recovery button directly to the document flow. A fixed bottom-right notification stack now hosts the ordinary toast and durable actionable draft error. Pending and ACK update the existing compact status indicator; routine writes do not show notifications. Persistent error is deduplicated and recovery export retained; explicit retry uses the existing flush without resetting revision protection. The same SQLite commands, ACK checks and close/recovery logic remain.

Added state/error/retry regression in task1664_drafts.test.js and real native geometry check before/pending/after ACK in task1664_native.cjs. Runtime and CI results pending; no claim of full task completion.

## Remaining TASK167.1
Independent education routes and catalogue, clean Writer, launcher groups, route-scoped commands, migration of historical UI tests, native restart and viewport acceptance. Future learning materials: two views of one editable document (theory/scenario), separate catalogue, editable science objects and export to Quantum Board. PR #158 remains an isolated prototype.
