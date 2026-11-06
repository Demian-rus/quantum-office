"""Inspect real native PDFs: vectors, text, density, monochrome and preview baselines."""
import json,os,re
from pathlib import Path
import pymupdf as fitz
root=Path(__file__).resolve().parents[1]
out=Path(os.environ.get('QW_TASK150_EVIDENCE',root/'evidence/task150/after'))
report=json.loads((out/'report.json').read_text());results=[]
for entry in report['reports']:
    name=entry['name'];doc=fitz.open(out/(name+'.pdf'))
    assert len(doc)==len(entry['layout']['pages']),(name,'page count')
    numbers=[];vectors=0
    for i,p in enumerate(doc):
        assert abs(p.rect.width-595.28)<1 and abs(p.rect.height-841.89)<1
        assert not p.get_images(),(name,'unexpected rasterisation')
        text=p.get_text();assert not re.search('PRIVATE_|INTERNAL_|�',text),(name,'text corruption/leak')
        nums=[int(n) for n in re.findall(r'(?m)^(\d+)\.',text)];numbers.extend(nums)
        drawings=p.get_drawings();vectors+=len(drawings)
        spans=[s for b in p.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans'] if s['text'].strip()]
        for s in spans:
            x0,y0,x1,y1=s['bbox'];assert 25<=x0<x1<=p.rect.width-25 and 20<=y0<y1<=p.rect.height-10,(name,i,s)
        if '-BW' in name:
            for d in drawings:
                for key in ['color','fill']:
                    c=d.get(key)
                    if c and len(c)==3:assert max(c)-min(c)<.005,(name,key,c)
            for s in spans:
                c=s['color'];channels=[(c>>16)&255,(c>>8)&255,c&255];assert max(channels)==min(channels),(name,s['text'],hex(c))
        # DOM glyph baselines vs native PDF glyph origins, not unrelated screen ink boxes.
        for expected in [b for b in entry['textBoxes'] if b['page']==i]:
            candidates=[]
            for block in p.get_text('rawdict')['blocks']:
                for line in block.get('lines',[]):
                    chars=[c for span in line['spans'] for c in span['chars']];line_text=''.join(c['c'] for c in chars)
                    start=line_text.find(expected['text'])
                    if start>=0:candidates.append(chars[start])
            assert candidates,(name,'missing text',expected)
            distance=min(max(abs(s['origin'][0]-expected['x']),abs(s['origin'][1]-expected['y'])) for s in candidates)
            assert distance<=.75,(name,'preview/PDF baseline',distance,expected)
        p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(out/(name+f'-{i+1}.png'))
    if name=='Compact-24':
        assert numbers==list(range(1,25)) and len(doc)==2
        assert abs(entry['bodyPt']-10)<.001 and all(p['freeMm']>=0 for p in entry['layout']['pages'])
    if name.startswith('QX-'):
        assert numbers==list(range(1,25)),(name,numbers)
        if 'Answers' in name:assert 'Найдите третий угол' not in ''.join(p.get_text() for p in doc)
    if name=='Long-Flow':assert re.sub(r'\s+',' ',' '.join(p.get_text() for p in doc)).count('Измерения повторяют')==120
    assert vectors>0
    results.append({'name':name,'pages':len(doc),'vectorPaths':vectors,'rasterImages':0,'baselinesPt':.75,'bounds':'PASS','numbers':numbers})
(out/'pdf-result.json').write_text(json.dumps({'status':'PASS','documents':results},ensure_ascii=False,indent=2))
print('PASS TASK150 PDF: native text/vectors, no rasters, all 24 tasks/answers, BW colours, page bounds and preview/PDF baselines <=0.75pt')
