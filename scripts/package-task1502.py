"""Verified before/after PDFs, every page PNG and five focused visual comparisons."""
import hashlib,json,shutil,zipfile
from pathlib import Path
import pymupdf as fitz
from PIL import Image,ImageDraw,ImageFont
root=Path(__file__).resolve().parents[1];base=root/'evidence/task1502';target=base/'review';archive=base/'TASK150.2-Review.zip'
archive.unlink(missing_ok=True)
assert json.loads((base/'pdf-result.json').read_text())['status']=='PASS'
if target.exists():shutil.rmtree(target)
target.mkdir(parents=True)
reports={s:{r['name']:r for r in json.loads((base/s/'report.json').read_text())['reports']} for s in ['before','after']}
for stage,entries in reports.items():
 out=target/stage;out.mkdir()
 for name,entry in entries.items():
  for ext in ['pdf','qwork']:shutil.copyfile(base/stage/(name+'.'+ext),out/(name+'.'+ext))
  with fitz.open(out/(name+'.pdf')) as doc:
   for i in range(len(doc)):shutil.copyfile(base/stage/(name+f'-page-{i+1:02}.png'),out/(name+f'-page-{i+1:02}.png'))
 shutil.copyfile(base/stage/'report.json',out/'report.json')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',20)
def comparison(name,title,document,kind):
 images=[]
 for stage in ['before','after']:
  entry=reports[stage][document];page_index=0;clip=None
  if kind in ['formula','figure']:
   task=16 if kind=='formula' else 3;record=next(s for s in entry['boxes'] if s['task']==task);page_index=record['page']-1;b=record['box']
   clip=fitz.Rect(12,max(0,b['y']-1),198,min(297,b['y']+max(38,b['h']+2)))
  elif kind=='header':clip=fitz.Rect(8,0,202,65)
  elif kind=='bottom':clip=fitz.Rect(8,180,202,297)
  with fitz.open(base/stage/(document+'.pdf')) as doc:
   if clip:clip=fitz.Rect(*(v*72/25.4 for v in clip))
   pix=doc[page_index].get_pixmap(matrix=fitz.Matrix(1.7 if kind!='page' else .85,1.7 if kind!='page' else .85),clip=clip,alpha=False)
   images.append(Image.frombytes('RGB',[pix.width,pix.height],pix.samples))
 width=max(i.width for i in images);height=max(i.height for i in images);canvas=Image.new('RGB',(width*2+36,height+90),'#edf0f3');draw=ImageDraw.Draw(canvas)
 draw.text((12,8),title,font=font,fill='#111')
 for i,(label,img) in enumerate(zip(['До','После'],images)):
  x=12+i*(width+12);draw.text((x,39),label,font=font,fill='#111');canvas.paste(img,(x,76))
 canvas.save(target/(name+'.png'))
comparison('01-bottom','Заполнение нижней части страницы','Owner-Concept','bottom')
comparison('02-header','Шапка и служебная зона QX','QX-academic','header')
comparison('03-formula','Задание 16: дробь и размер математики','QX-academic','formula')
comparison('04-figures','Рисунки: прежний размер и геометрия','QX-academic','figure')
comparison('05-density','Компактный лист целиком','Compact','page')
shutil.copyfile(root/'Quantum-Office.html',target/'Quantum-Office.html')
shutil.copyfile(base/'pdf-result.json',target/'pdf-result.json')
for name in ['TASK150.2.md']:
 shutil.copyfile(root/'docs'/name,target/name)
(target/'README.txt').write_text('TASK150.2 — материалы для проверки\n\nБаза: 152fbafed393315316de739c991df474fcb6017f.\nДо/после: один и тот же QWORK, сохранены размеры рисунков, текст 10 pt.\nOwner-Concept отдельно показывает прежний демонстрационный образец с искусственными разрывами после 8 и 16; после — естественная пагинация. Пользовательские разрывы по-прежнему соблюдаются.\nСтраницы PNG — копии для просмотра, PDF содержат настоящий текст, MathML и SVG.\nВ последней неполной странице остаётся естественный остаток; порядок задач не меняется ради заполнения.\nАвтономный HTML открывается без установки.\n',encoding='utf-8')
manifest={str(p.relative_to(target)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(target.rglob('*')) if p.is_file()}
(target/'SHA256.json').write_text(json.dumps(manifest,indent=2))
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(target.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(target))
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None and set(z.namelist())==set(manifest)|{'SHA256.json'}
 assert all(hashlib.sha256(z.read(k)).hexdigest()==v for k,v in manifest.items())
print('PASS TASK150.2 package:',len(manifest),'files,',archive.stat().st_size,'bytes')
