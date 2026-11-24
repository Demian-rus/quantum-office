"""Actual PDF media boxes, text and raster comparison (independent renderer)."""
import json
import sys
from pathlib import Path
import fitz
from PIL import Image, ImageChops, ImageStat

root = Path(sys.argv[1])
report = []
for prefix, orientation in ((p, o) for p in ("print", "ege2018") for o in ("portrait", "landscape")):
    expected = (595.28, 841.89) if orientation == "portrait" else (841.89, 595.28)
    with fitz.open(root / f"{prefix}-{orientation}-browser.pdf") as browser, fitz.open(root / f"{prefix}-{orientation}-windows.pdf") as native:
        assert len(browser) == len(native) >= 2, (orientation, len(browser), len(native))
        pages = []
        for index, (b, n) in enumerate(zip(browser, native)):
            for pdf in (b, n):
                assert abs(pdf.rect.width - expected[0]) < 2 and abs(pdf.rect.height - expected[1]) < 2, (orientation, pdf.rect)
                text = " ".join(pdf.get_text().split())
                assert text and "tauri.localhost" not in text and "Quantum Office — Тексты" not in text
                assert text.count("Квант Икс") == 1, (orientation, index, "missing or repeated branding")
            # Render both actual PDFs to identical resolution. Allow minor engine
            # antialiasing differences, but not missing layout, graphics or text.
            def render(page):
                pix = page.get_pixmap(matrix=fitz.Matrix(1, 1), alpha=False)
                return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
            bi, ni = render(b), render(n)
            assert abs(bi.width-ni.width)<=2 and abs(bi.height-ni.height)<=2
            ni = ni.resize(bi.size)
            diff = ImageChops.difference(bi, ni).convert("L")
            avg = ImageStat.Stat(diff).mean[0]
            changed = sum(diff.histogram()[32:]) / (diff.width * diff.height)
            bi.save(root / f"{prefix}-{orientation}-{index+1:02d}-browser.png")
            ni.save(root / f"{prefix}-{orientation}-{index+1:02d}-windows.png")
            diff.save(root / f"{prefix}-{orientation}-{index+1:02d}-diff.png")
            pages.append({"page":index+1,"meanAbsoluteGrayDifference":avg,"changedPixelsOver32":changed,"browserSizePt":[b.rect.width,b.rect.height],"windowsSizePt":[n.rect.width,n.rect.height]})
            assert avg < 12 and changed < .12, (orientation, index, avg, changed)
        report.append({"fixture":prefix,"orientation":orientation,"pages":pages})
(root / "pdf-raster-comparison.json").write_text(json.dumps({"status":"PASS","orientations":report},indent=2),encoding="utf8")
