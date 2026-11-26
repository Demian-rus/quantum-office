"""Compare actual practice/notes output to the exact 0.4.3 baseline."""
import sys
import hashlib
from pathlib import Path
import fitz

before, after = map(Path, sys.argv[1:3])
for name in ("practice-sheet.pdf", "practice-key.pdf", "theory-notes.pdf"):
    with fitz.open(before / name) as old, fitz.open(after / name) as new:
        assert len(old) == len(new), (name, len(old), len(new))
        for i, (a, b) in enumerate(zip(old, new), 1):
            assert a.rect == b.rect, (name, i, "page size")
            assert a.get_text("words") == b.get_text("words"), (name, i, "words or text positions")
            aa, bb = a.get_pixmap(matrix=fitz.Matrix(1, 1)), b.get_pixmap(matrix=fitz.Matrix(1, 1))
            assert (aa.width, aa.height) == (bb.width, bb.height), (name, i, "raster size")
            assert hashlib.sha256(aa.samples).digest() == hashlib.sha256(bb.samples).digest(), (name, i, "raster changed")
        print(f"PASS {name}: {len(old)} pages, text geometry and raster identical")
