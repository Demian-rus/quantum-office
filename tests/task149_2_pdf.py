"""Inspect the actual app-generated PDFs independently of the HTML layout."""
import json
import os
import re
import unicodedata
from pathlib import Path
import pymupdf
from pdf_footer_bounds import verify_page_bounds

out = Path(os.environ['QW_TASK1492_EVIDENCE']) if os.environ.get('QW_TASK1492_EVIDENCE') else Path(__file__).resolve().parents[1] / 'evidence/task149.2'
report = {}
project = json.loads((out / 'Quantum-Office-Sample.qwork').read_text(encoding='utf-8'))
assert project['subject'] == 'physics'
metadata = f"Физика · {project['grade']} класс · Вариант {project['variant']}"
for audience in ('Student', 'Answers'):
    file = out / f'Quantum-Office-Sample-{audience}.pdf'
    doc = pymupdf.open(file)
    assert len(doc) == (2 if audience == 'Student' else 1), (file.name, len(doc))
    text = unicodedata.normalize('NFKC', ''.join(p.get_text() for p in doc))
    assert all(f'Задание {i}' in text for i in range(1, 5)) if audience == 'Student' else 'Ответы' in text
    assert 'Для преподавателя' not in text
    for answer in ('10 Н.', '50 Н.', '10 см.'):
        assert (answer in text) == (audience == 'Answers'), (audience, answer)
    pages = []
    for i, page in enumerate(doc):
        assert abs(page.rect.width - 595.28) < 1 and abs(page.rect.height - 841.89) < 1
        label = metadata + (' · Ключ ответов' if audience == 'Answers' else '')
        spans, footers = verify_page_bounds(page, label, i + 1, len(doc))
        drawings = page.get_drawings()
        if audience == 'Student': assert len(drawings) > 15, 'illustrations must remain vector paths'
        assert not page.get_images()
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
        pix.save(out / f'{audience}-verified-{i + 1}.png')
        pages.append({'page': i + 1, 'textSpans': len(spans), 'vectorPaths': len(drawings), 'sizePt': [page.rect.width, page.rect.height], 'footers': footers})
    if audience == 'Student':
        assert all(f'Задание {i}' in doc[0].get_text() for i in (1, 2))
        assert all(f'Задание {i}' in doc[1].get_text() for i in (3, 4))
    else:
        assert [int(n) for n in re.findall(r'(?m)^(\d+)\.',text)] == [1,2,3,4]
        assert 'Брусок массой' not in text
    report[audience] = {'pages': pages, 'selectableText': True, 'answersSeparated': True}

assert project['version'] == 1 and len(project['tasks']) == 4
assert {o['kind'] for q in project['tasks'] for o in q['diagram']} >= {'polyline', 'arc', 'dimension', 'doubleArrow'}
g = project['tasks'][2]['graph']
assert (g['curve']['a'], g['curve']['b'], g['curve']['c']) == (1, -4, 3)
assert g['ymin'] < -1 and g['coordinateMode'] == 'math'
raster = pymupdf.open(out / 'sample-raster-regression.pdf')
assert len(raster) >= 1
report['rasterCompatibilityPages'] = len(raster)
report['status'] = 'PASS'
(out / 'pdf-result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('PASS TASK149.2 PDF: unchanged two-page student layout, separate one-page key, vector figures/formulas, answer isolation and bounds')
