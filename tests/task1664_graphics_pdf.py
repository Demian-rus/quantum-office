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
