# Lecture foundation — experimental, not integrated
Base: 79471a8536f3fb1fd3b60b37733e6f864bc194ba (TASK166.4 merged).

Owner idea: independent educational workspaces, lecture scenes, reusable visual objects and interactive demonstrations. Existing Quantum Studio is a photo/drawing editor; do not create a second Studio. Prefer extracting reusable geometry, physics symbols and graph validation from work-* via compatibility adapters rather than breaking QWORK/QWBANK or copying renderers. Keep Writer, Slides, Diagnostics and work-builder functional.

This initial change adds only a versioned lecture model, an editable-text seed of 13 radiation scenes (condensed from the chat scenario), descriptions of planned figures and deterministic calculations for three demonstrations. It is NOT a working lecture workspace, not an animation renderer, not durable storage, not a complete transcription of the original narration. QLECTURE v1 is experimental, no installed-format guarantee. No arbitrary JavaScript or HTML executable from project data.

Next stages:
1. Standalone lecture route in existing shell with scene list, editor, inspector, playback-only view. Keep notes separate from display. Import/export QLECTURE explicitly; validate all input before changing active project; no autosave claim until allowlists, native persistence and backup tests are implemented.
2. Render typed visual objects (SVG, graphs, diagrams), separate visual library and object editor (existing Studio extended or separate science workspace). Preserve document snapshots / pinned revisions, avoid dangling references. Static SVG/PNG export. Scene visuals must be actually rendered, not just described. Decay model is expectation, not stochastic simulation; attenuation is narrow monoenergetic primary beam; photon model uses exact SI constants.
3. Typed animation tracks: time, keyframes, play/pause/reset/scrub, deterministic physical model sampling. Distinguish visual animation from numerical simulation. Accessibility and offline use.
4. Integration with diagnostics/task bank/Slides/Writer via compatible adapters, versioned document formats, native storage, QBACKUP coverage, Windows restart/reinstall acceptance, regression tests for existing documents and rendering.

No changes to main, CI, native drafts, SQLite, existing routes or build source list. npm test will discover the new Node tests; run npm test, npm run build and browser acceptance before integration. No new dependency. Do not merge while current installer acceptance is pending without explicit approval.
