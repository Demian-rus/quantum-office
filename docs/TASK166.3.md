# TASK166.3 — binary bank images (candidate)

Base ab2064c8e874708385525d7505e14c0780645988. IndexedDB v2 adds assets (key = MIME + ':' + SHA-256, ArrayBuffer, MIME, length, digest); preserves tasks, indexes and meta. Internal task rows use imageAsset and empty task.image. QWORK v1, QWBANK v1/v2/v3 and .qbackup v3 retain original data URL, including exact original Base64 final quartet. All Base64 is decoded and hashed. Active raster images additionally require matching PNG/JPEG/WebP byte signatures and successful browser decoding. Dormant image fields in legacy QWORK (figure=graph/diagram/none) may contain arbitrary historical test/legacy bytes, so these are preserved verbatim rather than discarded; they cannot be activated as images until decoded successfully. Malformed active legacy images keep their original row and prevent migration completion. Editor uploads decode before acceptance.

Schema upgrade preserves original object stores. Batches of 16 prepare bytes/hash before writes, then compare old row and atomically commit bytes/references. Failed batches abort; earlier batches remain valid; no completion marker until all inline rows are converted and references checked. Failure leaves original inline data available for repair/export; reopen retries. Existing raw legacy localStorage provenance remains untouched. Old v1 windows block upgrade; no fallback blank database. Concurrent v2 writes use CAS. Explicit mark-and-sweep holds one transaction over tasks/assets; missing refs abort. No automatic deletion.

CRUD/import share transactions with assets. Logical snapshot includes consistent assets, SHA-256 verification outside IDB and portable hydration. Restore verifies input before atomic replacement of tasks, assets, metadata; current rows are compared before mutation and checked after commit. Catalogue requests metadata, selected preview loads one task. Compatibility-only small snapshot contains metadata (not images). QWORK/print/PDF receive hydrated records, never refs. Existing archive size limits and browser risks remain. No native adapter or SQLite.

Tests and measured results: the prior HEAD passed the specialized job including 24 workloads; full historical CI was blocked by TASK144 (see below). Final-head verification is separate.
The transaction helper keeps the original failure cause (e.g. quota) rather than masking it with secondary abort errors from outstanding requests. New tests separately check the actual rollback and failure reason. The benchmark uses deterministic 64×64 rasters, not a claim about maximum-size images.

Opening a v1 bank displays batch progress; corrupted previews report the problem without removing the original bytes. No object URLs are retained (decoder fallback revokes immediately).

The specialized suite includes a genuine v1 IndexedDB upgrade, persistent-profile browser restart, actual QWORK v1/PDF and booklet print paths, and cross-version restoration of a QWBANK v3 created by the exact TASK166.2 baseline. The comparison records logical task JSON and binary bytes separately from browser origin estimates.

## FINAL FIX — historical TASK144 and asynchronous addition

On HEAD `73e7e88d36bbddb88d1c2cccec093f3bab560a63`, both Chromium matrices failed at TASK144 line 41 (6 !== 7), because the immediate assertion raced asynchronous IndexedDB hydration. The test now waits for the document count and dialog closure and checks an exact copy of the source task (except its new ID). Single, selected and assemble actions share a per-dialog pending guard, document/workspace identity check and all-or-nothing hydration; active images decode before any document mutation. Closing/replacing the dialog or replacing the document cancels the pending result. Missing rows or broken images reject the complete selection.

## Actual prior measurements (not final-head timings)

Source: [PR Chromium job 138190698367](https://github.com/Demian-rus/quantum-office/actions/runs/45318357506/job/138190698367), HEAD `73e7e88d36bbddb88d1c2cccec093f3bab560a63`. All 24 results were extracted directly from the TASK1663_SCALE log. Times in milliseconds, sizes in bytes. Rasters are deterministic 64×64 PNGs, not representative of large photos. `originUsage` is an origin-wide estimate including both source/restore and cleanup activity, not per-bank physical disk or heap. No rerun used to select faster figures. In particular, 10,000 unique images increased restore time from **13,170.3 ms to 20,729.4 ms** (~57.4% slower); inspect and import also cost more. Text search and some other workloads regress; repeated image data deduplicates but reference overhead is nonzero. The portable archive intentionally retains all Base64 and does not shrink.

| version | count | scenario | importMs | openMs | pageMs | searchMs | taskMs | editMs | exportMs | backupMs | inspectMs | restoreMs | cleanupMs | taskBytes | assetBytes | uniqueAssets | originUsage | archiveBytes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 166.2 | 1000 | text | 190.6 | 0.6 | 22.4 | 12.1 | 0.1 | 1 | 38 | 65.2 | 85 | 206.8 | — | 1043950 | 0 | — | 1519755 | 1044381 |
| 166.2 | 1000 | repeated | 178.4 | 0.4 | 25.5 | 13.4 | 0 | 0.6 | 36.8 | 72.9 | 79.7 | 195.7 | — | 1506950 | 0 | — | 2066756 | 1507381 |
| 166.2 | 1000 | distinct | 187.9 | 3.7 | 26.4 | 11.5 | 0.1 | 0.6 | 38.5 | 69.7 | 87 | 283 | — | 1515754 | 0 | — | 2577611 | 1516185 |
| 166.2 | 1000 | mixed | 182.3 | 1.7 | 25.1 | 12.2 | 0.1 | 0.5 | 34.2 | 65.2 | 88.5 | 267 | — | 1393456 | 0 | — | 2103487 | 1393887 |
| 166.2 | 5000 | text | 2480.2 | 3.1 | 148.6 | 58 | 0.1 | 0.8 | 179.3 | 328.6 | 379.5 | 4281.1 | — | 5241949 | 0 | — | 5440921 | 5242380 |
| 166.2 | 5000 | repeated | 2288.1 | 0.5 | 141.4 | 56.6 | 0.2 | 0.5 | 212.2 | 362.7 | 399.1 | 4219.8 | — | 7556949 | 0 | — | 8379000 | 7557380 |
| 166.2 | 5000 | distinct | 2343 | 0.5 | 141.1 | 60.1 | 0.2 | 0.8 | 188.9 | 348.2 | 388.2 | 4390.9 | — | 7607205 | 0 | — | 12365818 | 7607636 |
| 166.2 | 5000 | mixed | 2289.2 | 0.4 | 136.5 | 60.8 | 0.1 | 0.9 | 189.3 | 337.5 | 381.6 | 2807.8 | — | 6990755 | 0 | — | 8555124 | 6991186 |
| 166.2 | 10000 | text | 8145.4 | 0.5 | 248.2 | 112.4 | 0.1 | 0.7 | 322.8 | 609.1 | 742 | 9869.8 | — | 10489450 | 0 | — | 11529231 | 10489884 |
| 166.2 | 10000 | repeated | 7949.9 | 0.5 | 290.4 | 134.2 | 0.2 | 0.8 | 392.8 | 767.7 | 832 | 9751.8 | — | 15119450 | 0 | — | 17146140 | 15119884 |
| 166.2 | 10000 | distinct | 8032.4 | 0.7 | 352.8 | 110.5 | 0.3 | 2 | 363 | 745 | 819.9 | 13170.3 | — | 15223430 | 0 | — | 22251413 | 15223864 |
| 166.2 | 10000 | mixed | 7722 | 1.1 | 320.4 | 118 | 0.2 | 1 | 369.7 | 721.9 | 800.3 | 9427 | — | 13987810 | 0 | — | 23219325 | 13988244 |
| 166.3 | 1000 | text | 219 | 0.6 | 25.4 | 12.2 | 0.4 | 1 | 34.9 | 64.8 | 74.9 | 358.2 | 16.9 | 1043950 | 0 | 0 | 3228175 | 1044381 |
| 166.3 | 1000 | repeated | 299.1 | 0.5 | 25.9 | 15.3 | 0.4 | 1.4 | 33.6 | 73.4 | 84.8 | 444 | 17.9 | 1264950 | 330 | 1 | 3490104 | 1507381 |
| 166.3 | 1000 | distinct | 912 | 0.6 | 31.6 | 13.9 | 0.4 | 1.4 | 72.4 | 105.6 | 394.8 | 1225.5 | 34.3 | 1264950 | 335593 | 1000 | 5589990 | 1516185 |
| 166.3 | 1000 | mixed | 686.5 | 0.6 | 22.7 | 17.4 | 0.3 | 1.6 | 48 | 120.3 | 155.6 | 789.3 | 23.4 | 1209700 | 83915 | 250 | 4684968 | 1393887 |
| 166.3 | 5000 | text | 4680 | 0.7 | 136.3 | 57.2 | 0.3 | 0.6 | 172.1 | 296.2 | 361.2 | 7249.8 | 79.2 | 5241949 | 0 | 0 | 8680856 | 5242380 |
| 166.3 | 5000 | repeated | 2370.7 | 0.7 | 106.2 | 66.6 | 0.4 | 1.4 | 192.8 | 398.4 | 398.9 | 5017.3 | 69.3 | 6346949 | 330 | 1 | 11822057 | 7557380 |
| 166.3 | 5000 | distinct | 8215.6 | 0.6 | 142 | 66.7 | 0.6 | 3.8 | 340 | 546.9 | 1984.7 | 9917.2 | 145.1 | 6346949 | 1682437 | 5000 | 13636272 | 7607636 |
| 166.3 | 5000 | mixed | 2939.2 | 0.8 | 122.2 | 61.3 | 0.5 | 1.8 | 222.7 | 416.3 | 786.6 | 3955.9 | 83 | 6070699 | 420638 | 1250 | 9093255 | 6991186 |
| 166.3 | 10000 | text | 8239.7 | 3.5 | 262 | 191.1 | 0.7 | 0.9 | 317.2 | 646.1 | 708.4 | 9814.1 | 139.5 | 10489450 | 0 | 0 | 11844493 | 10489884 |
| 166.3 | 10000 | repeated | 7652.2 | 0.6 | 296.3 | 132 | 0.8 | 2.8 | 318.1 | 785.7 | 832.2 | 9205.2 | 138.8 | 12699450 | 330 | 1 | 13675629 | 15119884 |
| 166.3 | 10000 | distinct | 11239.3 | 0.8 | 240.1 | 156.6 | 1.2 | 6.7 | 671.1 | 1059 | 4076.9 | 20729.4 | 335.9 | 12699450 | 3367552 | 10000 | 36329745 | 15223864 |
| 166.3 | 10000 | mixed | 9078.6 | 14.2 | 288.7 | 119 | 0.6 | 11.9 | 431.9 | 890.1 | 1624.6 | 13494 | 158.7 | 12146950 | 841948 | 2500 | 19452826 | 13988244 |

A separate bounded large-image test exercises deterministic photo-like 1024×768 PNG/JPEG/WebP (actual compressed size reported, within 4 MB upload limit), sharing, edits, backup and byte-exact restore. This does not claim 10,000 large photos fit browser memory or current archive limits.
