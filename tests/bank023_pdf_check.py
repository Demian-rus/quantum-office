"""Measure actual PDF ink and export 300% comparisons for BANK-02.3.

Run after tests/bank023_browser.cjs. Requires PyMuPDF and Pillow.
"""
import json
import math
import os
import sys
from collections import deque
from pathlib import Path

import fitz
from PIL import Image, ImageDraw


FINAL_EDITION = '--bank-02.4' in sys.argv
EVIDENCE = Path(__file__).resolve().parent.parent / 'evidence'
OUTPUT_OVERRIDE = os.environ.get('QO_BANK023_EVIDENCE')
OUT = Path(OUTPUT_OVERRIDE).resolve() if OUTPUT_OVERRIDE else EVIDENCE / ('bank-02.4' if FINAL_EDITION else 'bank-02.3')
PNG = OUT / 'pdf-pages'
FRAGMENTS = OUT / 'fragments'
PNG.mkdir(exist_ok=True)
FRAGMENTS.mkdir(exist_ok=True)


def render(page, area=None, scale=3, gray=False):
    pdf = page.get_pixmap(matrix=fitz.Matrix(scale, scale), clip=area,
                          colorspace=fitz.csGRAY if gray else fitz.csRGB, alpha=False)
    image = Image.frombytes('L' if gray else 'RGB', (pdf.width, pdf.height), pdf.samples)
    return pdf, image


def padded(rect, amount):
    return fitz.Rect(rect.x0-amount, rect.y0-amount, rect.x1+amount, rect.y1+amount)


def ink_bbox(image):
    return image.point(lambda value: 255 if value < 145 else 0).getbbox()


def measure_identifier(page, record):
    mark = fitz.Rect(record['mark'])
    # The row contains only the marker and the identifier, so this region
    # measures the printed identifier ink independently of CSS line metrics.
    left = mark.x1 + 2 * 72/25.4
    area = fitz.Rect(left-.2, mark.y0, min(left+90,page.rect.width), mark.y1)
    scale = 8
    pixmap, image = render(page, area, scale, gray=True)
    ink = ink_bbox(image)
    assert ink, ('missing identifier ink', record)
    ink_center = (pixmap.y+(ink[1]+ink[3])/2)/scale
    return abs(ink_center-(mark.y0+mark.y1)/2)


def radical_metrics(page, root):
    box, base = fitz.Rect(root['box']), fitz.Rect(root['base'])
    scale=8
    pix, image=render(page,padded(box | base,2),scale,gray=True)
    pixels=image.load()
    width,height=image.size
    x=lambda value: round(value*scale)-pix.x
    y=lambda value: round(value*scale)-pix.y
    dark=lambda i,j: 0<=i<width and 0<=j<height and pixels[i,j]<150
    middle=x((base.x0+base.x1)/2)
    rule_top=next((row for row in range(max(0,y(base.y0-1)),y(base.y0+1)+1)
                   if dark(middle,row)),None)
    assert rule_top is not None, ('blank radical rule',root)
    seed=(middle,rule_top)
    queue, component=deque([seed]), {seed}
    while queue:
        i,j=queue.popleft()
        for dy in (-1,0,1):
            for dx in (-1,0,1):
                neighbor=(i+dx,j+dy)
                if neighbor not in component and dark(*neighbor):
                    component.add(neighbor)
                    queue.append(neighbor)
    assert min(i for i,_ in component) < x(base.x0-.45), ('rule detached from hook',root)
    assert max(j for _,j in component)>rule_top+max(1.8,base.height*.6)*scale, ('rule detached vertically',root)
    last_ink=max(i for i,j in component if j==rule_top)
    assert abs(last_ink-x(base.x1))<=1.0*scale, ('wrong radical rule length',root)
    rule_bottom=max(j for i,j in component if i==middle)
    thickness=(rule_bottom-rule_top+1)/scale
    assert .38<=thickness<=1.1, ('irregular rule thickness',thickness,root)
    assert all((i,rule_bottom) in component or (i,rule_bottom-1) in component
               for i in range(x(base.x0+.55),last_ink-1)), ('discontinuous rule',root)
    x0=max(x(base.x0+.3),0)
    x1=min(x(base.x1-.1),width)
    start=max(j for i,j in component if x0<=i<x1)+1
    end=next((j for j in range(start,min(height,y(base.y1)+1))
              if any(dark(i,j) for i in range(x0,x1))),None)
    assert end is not None, ('missing radicand ink',root)
    gap=(end-start)/scale
    assert gap>=.25, ('radical rule touches radicand',gap,root)
    return {'page':root['page'],'task':root['number'],'formula':root['expression'],
            'gapPt':gap,'rulePt':thickness,'connected':True}


def montage(parts, destination, labels):
    canvas=Image.new('RGB',(max(im.width for im in parts)+24,sum(im.height+33 for im in parts)+12),'#e7ecf1')
    pen=ImageDraw.Draw(canvas)
    offset=9
    for image,label in zip(parts,labels):
        pen.text((12,offset),label,fill='#16232e')
        canvas.paste(image,(12,offset+19))
        offset+=image.height+33
    canvas.save(destination)


def locate(document, number):
    for i, page in enumerate(document):
        matches=page.search_for(f'№ {800+number:05}')
        if matches:
            return i,matches[0]
    raise AssertionError(f'baseline task {number} not found')


def text_spans(page, clip=None):
    return [span for block in page.get_text('dict',clip=clip)['blocks'] for line in block.get('lines', [])
            for span in line['spans'] if span['text'].strip()]


def verify_page_style(document, page, booklet=False, diagnostic=False):
    spans=text_spans(page)
    brands=[s for s in spans if s['text']=='QX / Квант Икс']
    assert len(brands)==1, ('brand count',page.number,brands)
    brand=brands[0]
    assert brand['size']==15 and brand['color']==0 and 'Caveat' in brand['font'],brand
    assert any('Caveat' in font[3] and document.extract_font(font[0])[3] for font in page.get_fonts()),'missing embedded face'
    assert brand['bbox'][0]>page.rect.width-150 and brand['bbox'][3]<page.rect.height*.065,brand
    expected=str(page.number+1) if (booklet or diagnostic) else f'{page.number+1} / {len(document)}'
    numbers=[s for s in spans if s['text']==expected and s['bbox'][1]>page.rect.height-39]
    assert len(numbers)==1, ('footer count',page.number,numbers)
    footer=fitz.Rect(numbers[0]['bbox'])
    assert abs((footer.x0+footer.x1)/2-page.rect.width/2)<.8,footer
    assert all(s is brand or s['bbox'][1]>=brand['bbox'][3]-.6 for s in spans),('ink in signature band',page.number)
    if not diagnostic:
        assert all(s['color']==0 for s in spans),('colored study text',page.number)
        assert all(s['opacity']==1 for s in page.get_texttrace()),('transparent study text',page.number)


def verify_final_figures(document, report):
    records={item['number']:item for item in report['tasks']}
    def spans(number):
        record=records[number]
        page=document[record['page']-1]
        return text_spans(page,fitz.Rect(record['rect']))
    force=spans(5)
    base={round(s['origin'][0],3):s for s in force if s['text']=='F'}
    assert len(base)==2,force
    left,right=sorted(base.values(),key=lambda s:s['origin'][0])
    assert abs(left['origin'][1]-right['origin'][1])<.15,left
    assert abs(left['size']-right['size'])<.02,right
    assert any(s['text']=='тр' and s['size']<left['size'] and s['origin'][1]>left['origin'][1]+.6 for s in force),force
    graph=spans(7)
    assert any(s['text']=='6' and s['origin'][1]>min(s['origin'][1] for s in graph if s['text']=='50') for s in graph),graph


def verify():
    geometry=json.loads((OUT/'geometry.json').read_text(encoding='utf-8'))
    results={'numberInkMaxPt':{},'radicals':{}}
    for report in geometry['docs']:
        name=report['name']
        with fitz.open(OUT/(name+'.pdf')) as document:
            landscape=report['layout']['layout']=='spread'
            size=(841.89,595.28) if landscape else (595.28,841.89)
            assert len(document)==report['layout']['sheets'],name
            for number,page in enumerate(document,1):
                assert abs(page.rect.width-size[0])<2 and abs(page.rect.height-size[1])<2,(name,page.rect)
                assert page.get_text().strip(),(name,number,'blank PDF page')
                assert not page.get_images(), (name,number,'unexpected raster illustration')
                if FINAL_EDITION:
                    verify_page_style(document,page,booklet=name.startswith('pupil-') or name=='math-raster-proof')
                _,image=render(page,scale=1.45)
                image.save(PNG/f'{name}-{number:02}.png')
            if FINAL_EDITION and name.startswith('pupil-'):
                verify_final_figures(document,report)
            deltas=[measure_identifier(document[row['page']-1],row) for row in report['tasks'] if row['permanent']]
            if deltas:
                results['numberInkMaxPt'][name]=round(max(deltas),4)
            if report['roots']:
                names=[f[3] for page in document for f in page.get_fonts()]
                assert any('DejaVuMathTeXGyre' in font for font in names),name
                results['radicals'][name]=[radical_metrics(document[r['page']-1],r) for r in report['roots']]
            print(f'{name}: {len(document)} pages, max DOM center error {report["maxCenterDeltaPt"]:.3f} pt, max ink center error {max(deltas,default=0):.3f} pt, {len(report["roots"])} radicals')

    portrait=next(r for r in geometry['docs'] if r['name']=='pupil-portrait')
    baseline_dir=EVIDENCE/'bank-02.3' if FINAL_EDITION else OUT/'before'
    if FINAL_EDITION:
        for kind in ('student','key'):
            with fitz.open(OUT/f'diagnostic-{kind}.pdf') as document:
                for page in document:
                    verify_page_style(document,page,diagnostic=True)
        baseline_geometry=json.loads((baseline_dir/'geometry.json').read_text(encoding='utf-8'))['docs'][0]['tasks']
        baseline_rows={row['number']:row for row in baseline_geometry}
    with fitz.open(baseline_dir/'pupil-portrait.pdf') as before, fitz.open(OUT/'pupil-portrait.pdf') as after:
        for number in ((1,5,7,13) if FINAL_EDITION else (9,12,14)):
            index,match=locate(before,number)
            legacy=before[index]
            baseline=padded(fitz.Rect(baseline_rows[number]['rect']),4) if FINAL_EDITION else fitz.Rect(18,max(10,match.y0-22),legacy.rect.width-12,min(legacy.rect.height-28,match.y0+{9:48,12:73,14:130}[number]))
            row=next(task for task in portrait['tasks'] if task['number']==number)
            page=after[row['page']-1]
            _,old_image=render(legacy,baseline)
            _,new_image=render(page,padded(fitz.Rect(row['rect']),4))
            labels=['BANK-02.3 · 300%',('Текущая сборка' if OUTPUT_OVERRIDE else 'BANK-02.4')+' · 300%'] if FINAL_EDITION else ['BANK-02.2 · 300%','BANK-02.3 · 300%']
            montage([old_image,new_image],FRAGMENTS/f'008{number:02}-compare-300.png',labels)
    with fitz.open(baseline_dir/'key-brief.pdf') as before, fitz.open(OUT/'key-brief.pdf') as after:
        _,original=render(before[0],fitz.Rect(29,37,before[0].rect.width-20,240))
        _,final=render(after[0],fitz.Rect(29,37,after[0].rect.width-20,240))
        montage([original,final],FRAGMENTS/'brief-key-compare-300.png',labels)
    with fitz.open(OUT/'math-raster-proof.pdf') as maths:
        proof=next(r for r in geometry['docs'] if r['name']=='math-raster-proof')
        for row in proof['tasks'][1:]:
            page=maths[row['page']-1]
            _,image=render(page,padded(fitz.Rect(row['rect']),4))
            image.save(FRAGMENTS/f'math-{row["number"]-1:02}-300.png')
    (OUT/'raster-geometry.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    assert all(error<=.5 for error in results['numberInkMaxPt'].values()),results['numberInkMaxPt']
    print('PASS independent PDF raster checks for number alignment, connected radicals, clearance and A4')
    if FINAL_EDITION:
        print('PASS black vector text, Caveat 15 pt, clean top band, centered footer, aligned forces and temperature axes')


if __name__=='__main__':
    verify()
