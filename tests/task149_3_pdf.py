"""Read the actual Chromium PDFs independently: pages, text, vectors and bounds."""
import json
import re
import unicodedata
import os
from pathlib import Path
import pymupdf

out = Path(os.environ.get('QW_TASK1493_EVIDENCE', Path(__file__).resolve().parents[1] / 'evidence/task149.3'))
measurements = {x['file']: x for x in json.loads((out / 'measurements.json').read_text(encoding='utf-8'))}
report = {'status': 'PASS', 'documents': []}
for name, count in [('Compact-Physics-Math', 4), ('Five-Illustrated-Tasks', 5), ('Math-Examples', 14)]:
    for teacher in (False, True):
        key = name + ('-Answers' if teacher else '')
        file = out / (key + '.pdf')
        doc = pymupdf.open(file)
        assert len(doc) == 1, (key, len(doc))
        page = doc[0]
        assert abs(page.rect.width - 595.28) < 1 and abs(page.rect.height - 841.89) < 1
        text = unicodedata.normalize('NFKC', page.get_text())
        if teacher:
            assert [int(n) for n in re.findall(r'(?m)^(\d+)\.', text)] == list(range(1,count+1)), (key,text)
            assert 'Ответы' in text and 'Задание' not in text
        else:
            assert len(re.findall(r'Задание\s+\d+', text)) == count, (key, text)
            assert all(re.search(r'Задание\s+' + str(i) + r'\b', text) for i in range(1, count + 1))
        assert not re.search(r'Рисунок\s*/\s*схема|Задание с графиком|\d+ б\.', text)
        assert not page.get_images(), 'formulas and illustrations must remain vector/selectable'
        if name == 'Compact-Physics-Math':
            for answer in ['10 Н.', '50 Н.', '10 см.']:
                assert (answer in text) == teacher, (key, answer)
            assert 'вершина' in text if teacher else True
        if name == 'Five-Illustrated-Tasks':
            for answer in ['30 Н.', '16 м.', '24 см2.']:
                assert (answer in text) == teacher, (key, answer)
        spans = [s for b in page.get_text('dict')['blocks'] if 'lines' in b for line in b['lines'] for s in line['spans'] if s['text'].strip()]
        for s in spans:
            x0, y0, x1, y1 = s['bbox']
            assert x0 >= (30 if teacher else 38) and y0 >= (25 if teacher else 30) and x1 <= page.rect.width - (30 if teacher else 38) and y1 <= page.rect.height - 12, (key, s)
        paths = page.get_drawings()
        if not teacher: assert len(paths) > (15 if name != 'Math-Examples' else 5)
        pix = page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False)
        pix.save(out / (key + '-verified-1.png'))
        measured = measurements[key]['layout']['pages'][0]
        if not teacher: assert len(measured['tasks']) == count
        assert measured['freeMm'] >= 0
        report['documents'].append({'file': file.name, 'pages': 1, 'tasksPerPage': [count], 'usedMm': round(measured['usedMm'], 2), 'freeMm': round(measured['freeMm'], 2), 'textSpans': len(spans), 'vectorPaths': len(paths), 'bounds': 'PASS', 'rasterImages': 0})

stress = pymupdf.open(out / 'stress/long-layout.pdf')
assert len(stress) >= 2
stress_text = re.sub(r'\s+', ' ', ' '.join(page.get_text() for page in stress))
assert stress_text.count('Измерения повторяют через равные интервалы времени.') == 60
assert stress_text.count('приведена формула и объяснён смысл каждой величины.') == 0
for i, page in enumerate(stress):
    assert 'Контрольная работа' in page.get_text(), ('missing running header', i + 1)
    for block in page.get_text('blocks'):
        assert block[1] >= 30 and block[3] <= page.rect.height - 12, ('stress bounds', i + 1, block)
    page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5), alpha=False).save(out / 'stress' / ('long-layout-' + str(i + 1) + '.png'))
report['stress'] = {'status': 'PASS', 'pages': len(stress), 'conditionSentences': 60, 'criteriaSentences': 0, 'bounds': 'PASS'}
(out / 'pdf-result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('PASS TASK149.3 PDF: unchanged one-page student layouts with 4/5/14 tasks, separate keys, vectors/bounds; long student conditions preserved without criteria')
