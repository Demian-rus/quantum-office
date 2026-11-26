"""Independent actual-PDF audit for owner review, not a raster PDF substitute."""
import json,re,sys
from pathlib import Path
import pymupdf as fitz
from pdf_task_numbers import task_numbers
base=Path(__file__).resolve().parents[1]/'evidence/task1502'
reports={stage:json.loads((base/stage/'report.json').read_text()) for stage in ['before','after']}
results=[]
for stage,report in reports.items():
 for entry in report['reports']:
  name=entry['name'];doc=fitz.open(base/stage/(name+'.pdf'));numbers=[]
  assert len(doc)==len(entry['layout']['pages'])
  text=''.join(p.get_text() for p in doc)
  for i,page in enumerate(doc):
   assert abs(page.rect.width-595.28)<1 and abs(page.rect.height-841.89)<1
   assert not page.get_images(),(stage,name,'raster output')
   numbers.extend(task_numbers(page))
   if stage=='after':
    assert not re.search(r'Academic|Scientific|Minimal|Tech',text)
    spans=[s for b in page.get_text('dict')['blocks'] for l in b.get('lines',[]) for s in l['spans'] if s['text'].strip()]
    for span in spans:
     x0,y0,x1,y1=span['bbox']
     if span['text'].strip()=='QX / Квант Икс':
      assert 'Caveat' in span['font'] and abs(span['size']-15)<.05 and span['color']==0,(name,span)
      assert any('Caveat' in font[3] and font[1]!='n/a' for font in page.get_fonts()),(name,'embedded Caveat')
      clip=fitz.Rect(page.rect.width-130,0,page.rect.width,27)
      pix=page.get_pixmap(matrix=fitz.Matrix(8,8),clip=clip,colorspace=fitz.csGRAY)
      dark=[j for j,v in enumerate(pix.samples) if v<105]
      assert dark,(name,'signature ink missing')
      top=min(j//pix.width for j in dark)*25.4/576
      right=(pix.width-1-max(j%pix.width for j in dark))*25.4/576
      assert abs(top-4)<.22 and abs(right-4)<.22,(name,'QX ink margins',top,right)
      assert all((fitz.Rect(span['bbox']) & fitz.Rect(other['bbox'])).is_empty for other in spans if other is not span),(name,'QX overlaps text')
     else: assert 25<=x0<x1<=page.rect.width-25 and 20<=y0<y1<=page.rect.height-10,(name,span)
    assert f'{i+1} / {len(doc)}' in page.get_text()
    topics=[s for s in spans if 'Углы, площади и координаты' in s['text']]
    if i==0 and name!='Compact':
     assert topics and all(s['color']==0 for s in topics),(name,'black topic ink')
   page.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(base/stage/(name+f'-page-{i+1:02}.png'))
  assert numbers==list(range(1,49 if name=='Dense-48' else 25)),(stage,name,numbers)
  if name.endswith('-Answers'):assert 'Найдите третий угол' not in text and 'Ответы' in text
  else:assert 'По обратной теореме Пифагора' not in text
  results.append({'stage':stage,'name':name,'pages':len(doc),'numbers':numbers,'rasterImages':0})
# Same-input canonical geometry/QWORK comparison; no removal of user-authored breaks.
a={r['name']:r for r in reports['before']['reports']};b={r['name']:r for r in reports['after']['reports']}
for name in a:
 if name=='Owner-Concept':continue # historical demo had synthetic breaks, reported separately
 assert json.loads((base/'before'/(name+'.qwork')).read_text())==json.loads((base/'after'/(name+'.qwork')).read_text()),name+' QWORK mutated'
 figures=lambda r:{s['task']:(s['figure']['w'],s['figure']['h']) for s in r['boxes'] if s['figure']}
 original,updated=figures(a[name]),figures(b[name])
 assert original.keys()==updated.keys(),(name,'figure identity changed',sorted(original),sorted(updated))
 # TASK160's adaptive layout may modestly resize a side figure in compact mode.
 # Preserve every diagram, its aspect ratio and readable physical size rather than
 # requiring byte-identical geometry from an older pagination algorithm.
 for task,(width,height) in original.items():
  new_width,new_height=updated[task]
  assert min(width,height,new_width,new_height)>0,(name,task,'degenerate figure')
  assert abs(new_width/width-1)<=0.10 and abs(new_height/height-1)<=0.10,(name,task,'figure resized over 10%',(width,height),(new_width,new_height))
  assert abs((new_width/new_height)/(width/height)-1)<=0.025,(name,task,'figure aspect ratio changed')
  assert new_width>=28 and new_height>=15,(name,task,'figure unreadably small',new_width,new_height)
 if name=='Compact':
  assert len(b[name]['layout']['pages'])<=len(a[name]['layout']['pages']),(name,'compact pagination regressed')
# PDF denominator glyph of S=d1*d2/2 has the same physical type size as the body.
formula=next(m for m in b['QX-academic']['math'] if m['task']==16)
page_no=next(s['page'] for s in b['QX-academic']['boxes'] if s['task']==16)
box=formula['box'];region=fitz.Rect(box['x']*72/25.4-1,box['y']*72/25.4-1,(box['x']+box['w'])*72/25.4+1,(box['y']+box['h'])*72/25.4+1)
page=fitz.open(base/'after/QX-academic.pdf')[page_no-1]
spans=[s for block in page.get_text('dict',clip=region)['blocks'] for line in block.get('lines',[]) for s in line['spans']]
assert any(s['text'].strip()=='2' and abs(s['size']-10)<.02 for s in spans),'full-size native denominator glyph'
(base/'pdf-result.json').write_text(json.dumps({'status':'PASS','documents':results,'nativeFractionBodyPt':10},ensure_ascii=False,indent=2))
print('PASS TASK150.2 PDF: native text/vectors, exact task and key content, QWORK, stable figures, black topic, top branding, full-size fraction')
