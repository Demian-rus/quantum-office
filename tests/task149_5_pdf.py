"""Verify final PDFs, including actual font resources and A/B against the actual AB path."""
import json
import os
import re
from pathlib import Path
import pymupdf
from pdf_graph_geometry import verify_ab

out = Path(os.environ.get('QW_TASK1495_EVIDENCE', Path(__file__).resolve().parents[1] / 'evidence/task149.5'))
browser = json.loads((out / 'browser-result.json').read_text(encoding='utf-8'))
measured = {r['file']: r for r in browser['reports']}
names = ['Compact-Geometry-Polished', 'Compact-Geometry-Answers-Polished', 'Practice-One-Task-Polished', 'Practice-Multiple-Tasks-Polished', 'Label-Collision-Cases']
result = {'status': 'PASS', 'documents': []}
all_prefixes = []
for name in names:
    doc = pymupdf.open(out / (name + '.pdf'))
    assert len(doc) == len(measured[name]['layout']['pages'])
    counts, numbers, headings = [], [], []
    for i, page in enumerate(doc):
        assert abs(page.rect.width - 595.28) < 1 and abs(page.rect.height - 841.89) < 1
        text = page.get_text()
        current = [int(n) for n in re.findall(r'(?m)^(\d+)\.', text)]
        if name.endswith('Answers-Polished') or name == 'Compact-Geometry-Polished':
            numbers.extend(current)
        counts.append(len(current))
        assert not page.get_images(), (name, 'must be vector')
        assert not re.search(r'Рисунок\s*/\s*схема|\d+ б\.|PRIVATE_|INTERNAL_', text)
        if 'Practice-' in name:
            assert 'Ответ:' not in text
        spans = [s for block in page.get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for s in line['spans'] if s['text'].strip()]
        for s in spans:
            b = pymupdf.Rect(s['bbox'])
            assert b.x0 >= 25 and b.y0 >= 22 and b.x1 <= page.rect.width - 25 and b.y1 <= page.rect.height - 10, (name, i, s)
            if s['color'] == 0xB42318:
                assert abs(s['size'] - 12) < .05
                assert any(n['bbox'][1] >= b.y1 and re.fullmatch(r'\d+\.', n['text'].strip()) for n in spans), 'heading must share the page with its task'
                headings.append({'text': s['text'], 'font': s['font'], 'size': round(s['size'], 2), 'color': '#b42318', 'page': i + 1})
            if name.endswith('Answers-Polished') and re.fullmatch(r'\d+\.', s['text'].strip()):
                all_prefixes.append({'number': int(s['text'].strip()[:-1]), 'font': s['font'], 'size': round(s['size'], 2), 'flags': s['flags']})
        page.get_pixmap(matrix=pymupdf.Matrix(1.6, 1.6), alpha=False).save(out / (name + '-' + str(i + 1) + '.png'))
    if name in ['Compact-Geometry-Polished', 'Compact-Geometry-Answers-Polished']:
        assert numbers == list(range(1, 25)), (name, numbers)
    if name == 'Compact-Geometry-Polished':
        assert 2 <= len(doc) <= 3 and len(headings) == 3  # TASK149.6 retains all tasks with larger figures
    if name.endswith('Answers-Polished'):
        assert len(doc) == 1 and 'Найдите третий угол' not in doc[0].get_text()
    if 'Practice-' in name:
        assert len(doc) == 1
    result['documents'].append({'file': name + '.pdf', 'pages': len(doc), 'numberedTasksPerPage': counts, 'vector': True, 'bounds': 'PASS', 'headings': headings})

assert len(all_prefixes) == 24
assert len({(p['font'], p['size']) for p in all_prefixes}) == 1
assert all('Black' not in p['font'] and p['flags'] & 16 and abs(p['size'] - 10) < .05 for p in all_prefixes)
result['answerNumbers'] = {'status': 'PASS', 'prefixes': all_prefixes}

def crosses(a, b, rect):
    if rect.contains(a) or rect.contains(b):
        return True
    cross = lambda p, q, r: (q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x)
    corners = [rect.tl, rect.tr, rect.br, rect.bl]
    for c, d in zip(corners, corners[1:] + corners[:1]):
        if cross(a,b,c)*cross(a,b,d) <= 0 and cross(c,d,a)*cross(c,d,b) <= 0:
            if max(min(a.x,b.x),min(c.x,d.x)) <= min(max(a.x,b.x),max(c.x,d.x)) and max(min(a.y,b.y),min(c.y,d.y)) <= min(max(a.y,b.y),max(c.y,d.y)):
                return True
    return False

control = next(f for f in measured['Compact-Geometry-Polished']['figures'] if f['task'] == 18)
doc = pymupdf.open(out / 'Compact-Geometry-Polished.pdf')
page = doc[control['page']-1]
f = control['boxPt']; region = pymupdf.Rect(f['x']-1,f['y']-1,f['x']+f['w']+1,f['y']+f['h']+1)
spans = [s for block in page.get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for s in line['spans'] if s['text'] in ['A','B'] and region.contains(pymupdf.Rect(s['bbox']))]
assert {s['text'] for s in spans} == {'A','B'}
source = json.loads((out / 'Compact-Geometry-Polished.qwork').read_text(encoding='utf-8'))
graph = source['tasks'][17]['graph']
assert [(p['x'],p['y'],p['label']) for p in graph['points']] == [(1,1,'A'),(4,5,'B')]
points, segments, transform = verify_ab(page, region, graph, control['points'])
a, b = points
labels = {}
for span in spans:
    rect = pymupdf.Rect(span['bbox']); labels[span['text']] = list(rect)
    for p0,p1,width in segments:
        assert not crosses(p0,p1,pymupdf.Rect(rect.x0-width/2,rect.y0-width/2,rect.x1+width/2,rect.y1+width/2)), span
assert labels['A'][2] < a.x and labels['A'][1] < a.y
assert labels['B'][0] > b.x and labels['B'][1] > b.y
result['task18'] = {'status':'PASS','page':control['page'],'points':[list(a),list(b)],'letterBounds':labels,'actualABPath':True,'A':'left and above, clear of line','B':'right and below',**transform}
(out / 'pdf-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS TASK149.5 PDF: A avoids actual AB vector/B right-below; all 24 prefixes share one bold font/size; red 12pt themes, vector A4 pages and bounds')
