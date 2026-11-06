"""Independent verification of actual Quantum Office PDF output, including light grid pixels."""
import json
import os
import re
import unicodedata
from pathlib import Path
import pymupdf

out = Path(os.environ.get('QW_TASK1494_EVIDENCE', Path(__file__).resolve().parents[1] / 'evidence/task149.4'))
browser = json.loads((out / 'browser-result.json').read_text(encoding='utf-8'))
measurements = {r['name']: r for r in browser['reports']}
source = json.loads((out / 'Compact-Geometry.qwork').read_text(encoding='utf-8'))
report = {'status': 'PASS', 'documents': []}
expected = {'Compact-Geometry': [12, 12], 'Compact-Geometry-Answers': [24], 'Practice-One-Task': [1], 'Practice-Multiple-Tasks': [3]}
# Keep this a content/geometry check, not a fixed-capacity pagination algorithm:
# compatible fonts on another OS may move one exercise to the following page.
expected['Compact-Geometry'] = [len(p['tasks']) for p in measurements['Compact-Geometry']['layout']['pages']]
assert 2 <= len(expected['Compact-Geometry']) <= 3 and sum(expected['Compact-Geometry']) == 24  # TASK149.6 uses 40mm illustrations and separators
for name, counts in expected.items():
    doc = pymupdf.open(out / (name + '.pdf'))
    assert len(doc) == len(counts), (name, len(doc))
    numbers = []
    pages = []
    for i, page in enumerate(doc):
        assert abs(page.rect.width - 595.28) < 1 and abs(page.rect.height - 841.89) < 1
        text = unicodedata.normalize('NFKC', page.get_text())
        current = [int(n) for n in re.findall(r'(?m)^(\d+)\.', text)]
        assert len(current) == counts[i], (name, i + 1, current)
        numbers.extend(current)
        assert not re.search(r'PRIVATE_|INTERNAL_|Задание \d+|Ответ:|Рисунок\s*/\s*схема|\d+ б\.', text)
        assert not page.get_images(), (name, 'raster image found')
        spans = [s for b in page.get_text('dict')['blocks'] if 'lines' in b for line in b['lines'] for s in line['spans'] if s['text'].strip()]
        for span in spans:
            x0, y0, x1, y1 = span['bbox']
            assert x0 >= 30 and y0 >= 25 and x1 <= page.rect.width - 30 and y1 <= page.rect.height - 12, (name, span)
        assert any(abs(s['size'] - 10) < .05 for s in spans), 'readable ordinary body font'
        pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), alpha=False)
        pix.save(out / (name + '-' + str(i + 1) + '.png'))
        measured = measurements[name]['layout']['pages'][i]
        assert measured['freeMm'] >= -.05
        pages.append({'page': i + 1, 'tasks': current, 'usedMm': round(measured['usedMm'], 2), 'freeMm': round(measured['freeMm'], 2), 'vectorPaths': len(page.get_drawings()), 'rasterImages': 0})
    assert numbers == list(range(1, sum(counts) + 1)), (name, numbers)
    if name == 'Compact-Geometry-Answers':
        full_text = ' '.join(p.get_text() for p in doc)
        assert 'Ответы' in full_text and 'По обратной теореме Пифагора' in full_text
        assert all(q['prompt'][:24] not in full_text for q in source['tasks']), 'conditions leaked into key'
        for answer in ['65°', '68°', '62°', '57°', 'AB и BC', '80°']:
            assert answer in full_text, answer
    if name.startswith('Practice-'):
        page = doc[0]
        grids = []
        for s in measurements[name]['sections']:
            b = s['solutionBoxMm']
            # Sample only the interior of the actual solution area, away from the condition/figure.
            rect = pymupdf.Rect(b['x'] + 4, b['y'] + 4, b['x'] + b['width'] - 4, b['y'] + min(b['height'] - 4, 35))
            rect = pymupdf.Rect(*(v * 72 / 25.4 for v in rect))
            pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), clip=rect, colorspace=pymupdf.csGRAY, alpha=False)
            samples = pix.samples
            mean = sum(samples) / len(samples)
            minimum = min(samples)
            ink = sum(v < 254 for v in samples) / len(samples)
            assert minimum > 200 and mean > 248 and .005 < ink < .4, (name, minimum, mean, ink)
            grids.append({'task': s['task'], 'solutionHeightMm': round(s['solutionMm'], 2), 'meanGray': round(mean, 2), 'minimumGray': minimum, 'inkFraction': round(ink, 4)})
        pages[0]['lightGrid'] = grids
    report['documents'].append({'file': name + '.pdf', 'pages': pages, 'bodyPt': 10, 'bounds': 'PASS'})

(out / 'pdf-result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('PASS TASK149.4 PDF: 24 exercises at measured capacity, separate 24-answer key, one/three practice tasks, A4 bounds, vector content and actual light grid pixels')
