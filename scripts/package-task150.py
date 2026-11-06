"""Package native PDFs and every rendered page for owner review; no PDF raster substitution."""
import json,hashlib,shutil,zipfile
from pathlib import Path
import pymupdf as fitz
root=Path(__file__).resolve().parents[1];base=root/'evidence/task150';review=base/'review';review.mkdir(parents=True,exist_ok=True)

def contact(files,target):
    count=sum(len(fitz.open(f)) for f in files);doc=fitz.open();page=doc.new_page(width=320*4,height=460*((count+3)//4));idx=0
    for file in files:
        source=fitz.open(file)
        for i,p in enumerate(source):
            x=(idx%4)*320;y=(idx//4)*460;page.insert_text((x+8,y+14),file.stem+' / '+str(i+1),fontsize=10)
            page.insert_image(fitz.Rect(x+8,y+23,x+312,y+453),stream=p.get_pixmap(matrix=fitz.Matrix(.6,.6)).tobytes('png'),keep_proportion=True);idx+=1
    page.get_pixmap().save(target)

for stage in ['before','after']:
    source=base/stage;target=review/stage;target.mkdir(exist_ok=True)
    for name in ['Worksheet','Compact-24','Practice','Answers','Legacy-Exam']:
        file=source/(name+'.pdf');shutil.copyfile(file,target/file.name)
        if (source/(name+'.qwork')).exists():shutil.copyfile(source/(name+'.qwork'),target/(name+'.qwork'))
        for i,p in enumerate(fitz.open(file)):
            p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(target/(name+f'-page-{i+1:02}.png'))
    if stage=='after':
        file=source/'Long-Flow.pdf';shutil.copyfile(file,target/file.name)
        for i,p in enumerate(fitz.open(file)):p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(target/('Long-Flow'+f'-page-{i+1:02}.png'))
    contact(sorted(target.glob('*.pdf')),review/(stage+'-all-pages.png'))
for theme,name in [('academic','QX-Academic-Tech'),('scientific','QX-Scientific'),('minimal','QX-Minimal')]:
    doc=fitz.open()
    for suffix in ['', '-Answers','-BW','-BW-Answers']:
        with fitz.open(base/'after'/('QX-'+theme+suffix+'.pdf')) as sample:doc.insert_pdf(sample)
    doc.set_metadata({'title':name+' - colour and monochrome samples','creator':'Quantum Office / TASK150','subject':'Same 24 exercises: work 1-3, key 4, BW work 5-7, BW key 8'})
    file=review/(name+'.pdf');doc.save(file,garbage=4,deflate=True)
    for i,p in enumerate(doc):p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(review/(name+f'-page-{i+1:02}.png'))
    contact([file],review/(name+'-all-pages.png'))
for name in ['TASK150.md','TASK150-BRANDING-ARCHITECTURE.md','TASK151-DRAFT.md']:
    file=root/'docs'/name
    if file.exists():shutil.copyfile(file,review/name)
shutil.copyfile(root/'Quantum-Office.html',review/'Quantum-Office.html')
for name in ['report.json','pdf-result.json']:shutil.copyfile(base/'after'/name,review/name)
shutil.copyfile(base/'before/report.json',review/'baseline-report.json')
(review/'README.txt').write_text('TASK150 review\n\nBefore: exact main d0f1b3c6ec98b88aa73d784f5f5859be8059a338.\nAfter: see Draft PR HEAD / TASK150.md.\n\nEach QX PDF has 8 pages: 1-3 colour work, 4 colour answer key; 5-7 BW work, 8 BW key.\nAll concepts use the same 24 exercises; explicit concept page breaks are intentional.\nPDFs contain native text/MathML/SVG, not page screenshots. PNGs are review copies only.\nOpen Quantum-Office.html offline; no installation. No QX style is enabled by default.\n')
manifest={str(p.relative_to(review)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(review.rglob('*')) if p.is_file() and p.name!='SHA256.json'}
(review/'SHA256.json').write_text(json.dumps(manifest,indent=2))
archive=base/'TASK150-Review.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(review.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(review))
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
print('Packaged',archive,len(manifest),'files',archive.stat().st_size,'bytes')
