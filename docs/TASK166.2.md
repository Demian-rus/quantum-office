# TASK166.2 — SHA-256 bank backup and safe recovery

Base: main 8462e85d47b94e5a3fa6994f5f4dd6ce0400d9bf. Branch: feat/task166-2-bank-backup-recovery. Draft PR #155; no merge.

## QWBANK v3 file

The independent .qwbank archive has format quantum-work-bank-backup, version 3 and schema 1. Fields: format, version, schema, createdAt, count, records, meta, manifest.

- records: full IndexedDB records, preserving IDs, bankNumber, revision, createdAt, updatedAt, metadata, and complete QWORK task model (prompt, answer, Markdown written solutions, criteria, graphs, diagrams, embedded Base64 images).
- meta: sequence (including previously issued and deleted numbers), legacyMigration and legacyBackup (where applicable).
- manifest: algorithm SHA-256, serialization sorted-json-utf8-v1, bytes and lowercase SHA-256 digest.

Hash input is UTF-8 encoding of the complete object excluding only manifest, with recursive sorted object keys and preserved array order. JSON serialization rejects undefined, non-finite numbers and unsupported primitive types. The checksum covers count, sequence, full records, timestamps and all other substantial fields. SHA-256 is an integrity check, NOT an authenticity signature: malicious content can be rehashed by an attacker who controls the file.

Current limits: 20,000 records, at most 260 MB of canonical bank data. Base64 images occupy memory during serialization. Web Crypto SHA-256 is required. New code does not implement SQLite, Tauri, separate binary attachments or streaming file serialization.

## Backup preparation

BankRepository.createVerifiedBackup takes a single readonly IndexedDB transaction covering tasks and meta. It does not mutate/delete records. The resulting snapshot receives a deterministic hash, then is verified again before UI requests a file download. A browser download request does NOT prove successful persistence on disk; the user must check the downloaded file. The UI reports progress and provides cancellation before the commit phase.

## Restoration and strict invariant

BankRepository.inspectRestore validates JSON structure, format, version, schema, count, unique IDs/numbers, complete task content, old migration backup, sequence, SHA-256 and actual UTF-8 byte count. Nothing is written. It also reads an existing-bank snapshot and gives a one-use restore token; the UI displays date, count, integrity and current-bank count.

BankRepository.restoreVerifiedBackup revalidates the SHA-256 before opening exactly one IDB readwrite transaction on tasks and meta. It checks all existing records and metadata against the inspected snapshot inside that transaction; any stale window state fails RESTORE_CONFLICT. Empty mode forbids existing data. Replace mode requires explicit acknowledgement and a separate requested download of the current bank, plus an additional confirmation. The transaction clears/rebuilds tasks and updates sequence/legacy migration metadata together. Errors, quota exceptions, aborts and failed IDB requests abort the entire transaction, leaving pre-existing records unchanged.

After commit, the repository reopens the logical snapshot and verifies every record and the sequence against the archive before reporting success. An external disk failure AFTER commit cannot be fully rolled back by browser IndexedDB; this residual risk must not be described as guaranteed recovery. An abort during the write transaction, in contrast, is atomic by IndexedDB semantics.

The preview token is invalidated after success or cancellation. The failed restore never silently initializes a new blank bank.

## Combined .qbackup v3

Existing .qbackup v1/v2 reading and QWORK v1, QWBANK v1/v2 import/export are unchanged. New quantum-office-backup-v3 contains the validated legacy Office v2 document backup and a full QWBANK v3 archive. An additional SHA-256 manifest protects the combined payload and the bank has its own SHA-256.

There is NO cross-transaction atomicity between IndexedDB and localStorage. On opening a combined v3 archive, both layers are fully verified first. The UI then offers export of the embedded verified bank to a separate .qwbank file. The user can restore this through the isolated atomic bank dialog. A separate confirmation is required to restore the four editors; that existing localStorage operation uses only best-effort rollback. NO one-click all-Office restore guarantee is claimed. This is an intentional safety boundary, not a pretend native transaction.

## Tests and CI

- tests/task1662.test.js: deterministic digest, full content, malformed JSON, tamper, invalid digest/count/duplicate IDs/numbers/sequence/unsupported version.
- tests/task1662_browser.cjs: real offline Chromium with SHA verification, full model fields, failpoint after partial writes, synthetic QuotaExceededError, signal cancellation during writes, byte-for-byte unchanged prior snapshot, stale two-tab restore, empty and replace, close/reopen, persistent sequence, UI backup/download/preview/acknowledgement and Office v3 plus old Office v2.
- tests/task1662_scale_browser.cjs: measured file sizes and backup, SHA verification, inspection, restore and reopen timings for 1,000/5,000/10,000 records. Evidence written to evidence/task1662/scale-report.json. Do not invent performance numbers.
- CI task1662-bank-recovery dedicated job, full historical Chromium smoke, TASK166.1 regressions, Verify Quantum Office.

Main at merge of TASK166.1: Verify Quantum Office and Chromium smoke success (runs 45130788174, 45130788203). Deploy browser preview failure on actions/configure-pages@v5 is due to unconfigured GitHub Pages and predates these changes.
