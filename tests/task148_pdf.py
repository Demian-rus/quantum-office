"""Check the exported PDFs themselves, including raster colors and vector geometry."""
import os
import json
from pathlib import Path
import fitz

out = Path(os.environ['QW_REGRESSION_ROOT']) / 'task148' if os.environ.get('QW_REGRESSION_ROOT') else Path(__file__).resolve().parents[1] / 'evidence/task148'
targets = {'red': (220, 38, 38), 'green': (22, 163, 74), 'blue': (37, 99, 235)}
report = {}
for name in ('vector', 'raster'):
    doc = fitz.open(out / f'task148-{name}.pdf')
    assert len(doc) > 0
    counts = dict.fromkeys(targets, 0)
    for index, page in enumerate(doc):
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        pix.save(out / f'pdf-{name}-{index + 1}.png')
        samples = pix.samples
        for offset in range(0, len(samples), pix.n):
            r, g, b = samples[offset:offset + 3]
            for color, target in targets.items():
                if abs(r-target[0])+abs(g-target[1])+abs(b-target[2]) < 85:
                    counts[color] += 1
    assert all(n > 150 for n in counts.values()), (name, counts)
    report[name] = {'pages': len(doc), 'coloredPixels': counts}
    if name == 'vector':
        text = ''.join(page.get_text() for page in doc)
        assert all(label in text for label in ('F₁', 'F₂', 'F₃', '-10', 'Подвижный блок'))
        colored = {key: [] for key in targets}
        slopes = []
        for page in doc:
            for shape in page.get_drawings():
                color = shape.get('color')
                if color:
                    for key, target in targets.items():
                        if max(abs(color[i]*255-target[i]) for i in range(3)) < 2:
                            colored[key].append(shape)
                for item in shape['items']:
                    if item[0] == 'l':
                        dx, dy = item[2].x-item[1].x, item[2].y-item[1].y
                        if abs(dx) > 30:
                            slopes.append(abs(dy/dx))
        assert all(len(v) >= 2 for v in colored.values()), 'colored shafts and arrow heads'
        assert any(abs(slope - 3**-.5) < .02 for slope in slopes), '30-degree incline survives PDF'
        report[name]['coloredPaths'] = {key: len(value) for key, value in colored.items()}
report['status'] = 'PASS'
(out / 'pdf-validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print('PASS TASK148 PDF: actual colors, vector arrow heads, labels, negative ticks and 30° geometry')
