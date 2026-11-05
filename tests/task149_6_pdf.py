"""Independent inspection of actual Chromium PDF vectors, text and page geometry."""
import json, os, re
from pathlib import Path
import pymupdf

out=Path(os.environ.get('QW_TASK1496_EVIDENCE',Path(__file__).resolve().parents[1]/'evidence/task149.6'))
browser=json.loads((out/'browser-result.json').read_text(encoding='utf-8'))
measure={r['name']:r for r in browser['reports']}
names=['Compact-Geometry-Improved','Practice-One-Per-Page-Three-Tasks','Practice-Multiple-Tasks-Improved','Physics-Graph-Comparison']
result={'status':'PASS','documents':[]}
for name in names:
    doc=pymupdf.open(out/(name+'.pdf')); counts=[]; all_numbers=[]; separators=0; numeric_fonts=[]
    assert len(doc)==len(measure[name]['layout']['pages'])
    for i,page in enumerate(doc):
        assert abs(page.rect.width-595.28)<1 and abs(page.rect.height-841.89)<1
        assert not page.get_images(),name+' must stay vector'
        text=page.get_text(); numbers=[int(x) for x in re.findall(r'(?m)^(\d+)\.',text)];counts.append(len(numbers));all_numbers+=numbers
        assert not re.search(r'Рисунок\s*/\s*схема|\d+ б\.|PRIVATE_|INTERNAL_',text)
        spans=[s for b in page.get_text('dict')['blocks'] if 'lines' in b for line in b['lines'] for s in line['spans'] if s['text'].strip()]
        for s in spans:
            x0,y0,x1,y1=s['bbox'];assert x0>=26 and y0>=22 and x1<=page.rect.width-26 and y1<=page.rect.height-10,(name,i,s)
            assert s['text']!='�',(name,s)
            if name=='Physics-Graph-Comparison' and re.fullmatch(r'[-−]?\d+',s['text']):numeric_fonts.append(s['size']);assert 8<=s['size']<=9
        for p in page.get_drawings():
            if p.get('fill') and max(abs(a-b) for a,b in zip(p['fill'],[224/255,228/255,232/255]))<.01:
                assert .24<=p['rect'].height<=.4,('actual divider thickness',p['rect'].height)
                separators+=1
        page.get_pixmap(matrix=pymupdf.Matrix(1.6,1.6),alpha=False).save(out/(name+'-'+str(i+1)+'.png'))
    if name=='Compact-Geometry-Improved':
        assert all_numbers==list(range(1,25));assert 2<=len(doc)<=3
        assert separators>=24-len(doc),'every adjoining task pair gets a thin divider'
        assert measure[name]['bodyPt']>=9.99
        assert all(s['figure'] is None or s['figure']['kind']=='graph' or 39<=s['figure']['widthMm']<=45 for s in measure[name]['sections'])
    if name=='Practice-One-Per-Page-Three-Tasks':
        assert len(doc)==3 and counts==[1,1,1]
        for i,keyword in enumerate(['прямоугольном треугольнике','график функции','Брусок массой']):assert keyword in doc[i].get_text()
        assert all(s['spaceMm']>=170 for s in measure[name]['sections'])
    if name=='Practice-Multiple-Tasks-Improved':assert len(doc)==1 and counts==[3]
    if name=='Physics-Graph-Comparison':
        assert len(doc)==1 and counts==[4] and len(numeric_fonts)>=30
        # Independently read vector grid segments in PDF points, then convert to mm.
        horizontal=[];vertical=[]
        for p in doc[0].get_drawings():
            if not p.get('color') or max(abs(a-b) for a,b in zip(p['color'],[217/255,222/255,228/255]))>.01:continue
            for item in p['items']:
                if item[0]!='l':continue
                a,b=item[1:3]
                if abs(a.y-b.y)<.1:horizontal.append(abs(a.x-b.x)*25.4/72)
                if abs(a.x-b.x)<.1:vertical.append(abs(a.y-b.y)*25.4/72)
        assert len(horizontal)>=40 and len(vertical)>=40
        assert all(abs(v-48)<.1 for v in horizontal) and all(abs(v-48*216/369)<.1 for v in vertical)
        result['pdfVectorGridMm']={'width':round(horizontal[0],3),'height':round(vertical[0],3),'horizontalSegments':len(horizontal),'verticalSegments':len(vertical)}
    result['documents'].append({'file':name+'.pdf','pages':len(doc),'tasksPerPage':counts,'separators':separators,'vector':True,'bounds':'PASS'})

# An independent PDF key check after a real mouse reorder: answer ownership stays with task ID.
workflow=json.loads((out/'Reorder-Workflow.qwork').read_text(encoding='utf-8'))
key=pymupdf.open(out/'Reorder-Answers.pdf');answers={int(n):s.strip() for n,s in re.findall(r'(?m)^(\d+)\.\s*([^\n]+)',key[0].get_text())}
for i,q in enumerate(workflow['tasks']):
    assert answers[i+1]==q['answer'],(i+1,q['answer'],answers)
result['answerMappingAfterReorder']='PASS'
(out/'pdf-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print('PASS TASK149.6 PDF: four vector A4 documents, 24 tasks, exactly three distinct one-task pages, dividers, 8–9pt axes, equal PDF grid mm and reordered answer keys')
