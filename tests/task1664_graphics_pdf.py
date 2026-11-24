"""Independent high-resolution raster check on actual printed arrow endpoints."""
import json, sys, math
from pathlib import Path
import fitz
from PIL import Image
root=Path(sys.argv[1])
report=[]
for engine in ('browser','windows'):
 for orientation in ('portrait','landscape'):
  name=f'graphics-{orientation}-{engine}'
  pdf=root/(name+'.pdf')
  if engine=='windows' and not pdf.exists(): continue
  proof=json.loads((root/(name+'-geometry.json')).read_text(encoding='utf8'))
  with fitz.open(pdf) as doc:
   images={}
   checks=[]
   for a in proof['arrows']:
    if a['color']!='rgb(37, 99, 235)':continue
    page=a['page'];scale=6
    if page not in images:
     pix=doc[page].get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=False)
     images[page]=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
    im=images[page];tx,ty=a['tip']['x'],a['tip']['y'];bx,by=a['base']['x'],a['base']['y']
    length=math.hypot(tx-bx,ty-by);ux,uy=(tx-bx)/length,(ty-by)/length
    radius=max(2.5,min(6,length+1))
    front=inside=0
    for y in range(max(0,int((ty-radius)*scale)),min(im.height,int((ty+radius)*scale)+1)):
     for x in range(max(0,int((tx-radius)*scale)),min(im.width,int((tx+radius)*scale)+1)):
      px,py=(x+.5)/scale-tx,(y+.5)/scale-ty
      along=px*ux+py*uy; across=abs(-px*uy+py*ux)
      r,g,b=im.getpixel((x,y));blue=b>r+70 and b>g+35 and r<150
      if blue and .7<along<radius and across<.7: front+=1
      if blue and -min(length*.85,2.5)<along<-min(length*.15,.25) and across<.55: inside+=1
    assert front==0,(name,a,'ink beyond tip',front)
    assert inside>0,(name,a,'missing arrow head ink')
    checks.append({'task':a['task'],'page':page+1,'outsideInk':front,'insideInk':inside})
   assert len(checks)>=15,(name,len(checks))
   report.append({'document':name,'checked':len(checks),'arrows':checks})
(root/'arrow-pdf-raster.json').write_text(json.dumps({'status':'PASS','documents':report},indent=2),encoding='utf8')
print('PASS actual PDF arrow endpoint raster checks:',[(x['document'],x['checked']) for x in report])

# Actual PDF glyph positions and raster ink, rather than only MathML attributes.
# Also verify the author PNG's four endpoint heads in the physical printed PDF.
math_report=[]
for engine in ('browser','windows'):
 for orientation in ('portrait','landscape'):
  name=f'ege2018-{orientation}-{engine}'
  pdf=root/(name+'.pdf')
  if engine=='windows' and not pdf.exists(): continue
  proof=json.loads((root/(name+'-geometry.json')).read_text(encoding='utf8'))
  with fitz.open(pdf) as doc:
   operators=[]
   for o in proof['operators']:
    if not (o['task']==11 and o['text']=='→' or o['task']==32 and o['text']=='='):continue
    page=doc[o['page']]; region=fitz.Rect(o['box'])
    chars=[c for block in page.get_text('rawdict')['blocks'] for line in block.get('lines',[]) for span in line['spans'] for c in span['chars'] if c['c'].strip()]
    cx=(region.x0+region.x1)/2;cy=(region.y0+region.y1)/2
    char=min((c for c in chars if c['c']==o['text']),key=lambda c:abs((c['bbox'][0]+c['bbox'][2])/2-cx)+abs((c['bbox'][1]+c['bbox'][3])/2-cy))
    bb=fitz.Rect(char['bbox'])
    assert abs((bb.x0+bb.x1)/2-cx)<3 and abs((bb.y0+bb.y1)/2-cy)<4,(name,o,'operator glyph not at measured position')
    same=[c for c in chars if abs((c['bbox'][1]+c['bbox'][3])/2-(bb.y0+bb.y1)/2)<3 and c!=char]
    left=max((c for c in same if c['bbox'][2]<=bb.x0+.08),key=lambda c:c['bbox'][2])
    right=min((c for c in same if c['bbox'][0]>=bb.x1-.08),key=lambda c:c['bbox'][0])
    gaps=[bb.x0-left['bbox'][2],right['bbox'][0]-bb.x1]
    assert 1.2<min(gaps)<=max(gaps)<5 and abs(gaps[0]-gaps[1])<1,(name,o,'asymmetric or missing spacing',gaps)
    delta=None
    if o['text']=='→':
     assert left['c'] in 'ABCD' and right['c'] in 'ABCD',(name,o,'transition letters')
     def ink_center(c):
      scale=12;pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),clip=fitz.Rect(c['bbox']),alpha=False)
      im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples)
      ys=[(pix.y+y+.5)/scale for y in range(im.height) for x in range(im.width) if max(im.getpixel((x,y)))<140]
      assert ys,(name,c,'missing operator/letter ink')
      return (min(ys)+max(ys))/2
     centers=list(map(ink_center,[left,char,right]));delta=abs(centers[1]-(centers[0]+centers[2])/2)
     assert delta<1.3,(name,o,'transition arrow off mathematical midline',delta)
    else:assert left['c'] in 'hce' and right['c'].isdigit(),(name,o,'constant operands')
    operators.append({'task':o['task'],'operator':o['text'],'leftGapPt':gaps[0],'rightGapPt':gaps[1],'inkCenterDeviationPt':delta})
   assert len(operators)==7,(name,'missing constant or transition operator',operators)
   png_checks=[]
   for page in doc:
    for image in page.get_image_info():
     if image['width']!=1826 or image['height']!=622:continue
     region=fitz.Rect(image['bbox']);sx=region.width/1826;sy=region.height/622
     for x,y,axis in [(76,28,'y'),(832,550,'x'),(1057,28,'y'),(1813,550,'x')]:
      tx=region.x0+x*sx;ty=region.y0+y*sy;scale=16
      pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale),clip=fitz.Rect(tx-7,ty-7,tx+7,ty+7),alpha=False)
      im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples);counts=[0,0,0]
      for Y in range(im.height):
       for X in range(im.width):
        rr,g,b=im.getpixel((X,Y))
        if not (b>rr+20 and b>g+10 and rr<120):continue
        xx=((pix.x+X+.5)/scale-tx)/sx;yy=((pix.y+Y+.5)/scale-ty)/sy
        along=yy if axis=='y' else -xx;across=xx if axis=='y' else yy
        if -14<along<-3 and abs(across)<3:counts[0]+=1
        if 10<along<14 and 2.6<across<4:counts[1]+=1
        if 10<along<14 and -4<across<-2.6:counts[2]+=1
      assert counts[0]==0 and counts[1]>0 and counts[2]>0,(name,axis,x,y,'protruding ink or missing head wings',counts)
      png_checks.append({'axis':axis,'sourceTip':[x,y],'outsideInk':counts[0],'headWingsInk':counts[1:]})
   assert len(png_checks)==4,(name,'task 7 original image missing or wrong size')
   math_report.append({'document':name,'operators':operators,'task7Endpoints':png_checks})
(root/'math-and-author-image-pdf.json').write_text(json.dumps({'status':'PASS','documents':math_report},indent=2),encoding='utf8')
print('PASS actual PDF math spacing, midline and task 7 head geometry:',[(x['document'],len(x['operators']),len(x['task7Endpoints'])) for x in math_report])
