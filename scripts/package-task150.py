"""Package native PDFs and every rendered page for owner review; no PDF raster substitution."""
import json,hashlib,os,shutil,subprocess,zipfile
from pathlib import Path
import pymupdf as fitz
root=Path(os.environ.get('QW_TASK150_ROOT',Path(__file__).resolve().parents[1])).resolve()
base=root/'evidence/task150';review=base/'review';archive=base/'TASK150-Review.zip'
# A previous successful archive must never survive an incomplete rerun.
archive.unlink(missing_ok=True)
formats=['Worksheet','Compact-24','Practice','Answers','Legacy-Exam']
concepts=[f'QX-{theme}{suffix}' for theme in ['academic','scientific','minimal']
          for suffix in ['', '-Answers','-BW','-BW-Answers']]
stages={'before':formats,'after':formats+['Long-Flow']+concepts}
required=[root/'Quantum-Office.html']+[root/'docs'/name for name in
          ['TASK150.md','TASK150.1.md','TASK150-BRANDING-ARCHITECTURE.md','TASK151-DRAFT.md']]
required += [base/stage/(name+ext) for stage,names in stages.items()
             for name in names for ext in ['.pdf','.qwork']]
required += [base/'before/report.json',base/'after/report.json',base/'after/pdf-result.json']
missing=[str(p.relative_to(root)) for p in required if not p.is_file() or not p.stat().st_size]
if missing:raise SystemExit('Incomplete TASK150 inputs:\n'+'\n'.join(missing))
for stage,names in stages.items():
    report=json.loads((base/stage/'report.json').read_text())
    assert report['status']=='PASS' and report['before']==(stage=='before'), (stage,'browser validation')
    assert sorted(r['name'] for r in report['reports'])==sorted(names), (stage,'browser inventory')
    for entry in report['reports']:
        with fitz.open(base/stage/(entry['name']+'.pdf')) as pdf:
            assert len(pdf)==len(entry['layout']['pages']), (stage,entry['name'],'PDF page count')
pdf_report=json.loads((base/'after/pdf-result.json').read_text())
assert pdf_report['status']=='PASS' and sorted(d['name'] for d in pdf_report['documents'])==sorted(stages['after']), 'PDF validation inventory'
if review.exists():shutil.rmtree(review)
review.mkdir(parents=True)

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
    for name in formats:
        file=source/(name+'.pdf');shutil.copyfile(file,target/file.name)
        shutil.copyfile(source/(name+'.qwork'),target/(name+'.qwork'))
        for i,p in enumerate(fitz.open(file)):
            p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(target/(name+f'-page-{i+1:02}.png'))
    if stage=='after':
        file=source/'Long-Flow.pdf';shutil.copyfile(file,target/file.name)
        shutil.copyfile(source/'Long-Flow.qwork',target/'Long-Flow.qwork')
        for i,p in enumerate(fitz.open(file)):p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(target/('Long-Flow'+f'-page-{i+1:02}.png'))
    contact(sorted(target.glob('*.pdf')),review/(stage+'-all-pages.png'))
for theme,name in [('academic','QX-Academic-Tech'),('scientific','QX-Scientific'),('minimal','QX-Minimal')]:
    doc=fitz.open()
    for suffix in ['', '-Answers','-BW','-BW-Answers']:
        with fitz.open(base/'after'/('QX-'+theme+suffix+'.pdf')) as sample:doc.insert_pdf(sample)
    doc.set_metadata({'title':name+' - colour and monochrome samples','creator':'Quantum Office / TASK150','subject':'Same 24 exercises: work 1-3, key 4, BW work 5-7, BW key 8'})
    file=review/(name+'.pdf');doc.save(file,garbage=4,deflate=True)
    shutil.copyfile(base/'after'/('QX-'+theme+'.qwork'),review/(name+'.qwork'))
    for i,p in enumerate(doc):p.get_pixmap(matrix=fitz.Matrix(1.5,1.5),alpha=False).save(review/(name+f'-page-{i+1:02}.png'))
    contact([file],review/(name+'-all-pages.png'))
for name in ['TASK150.md','TASK150.1.md','TASK150-BRANDING-ARCHITECTURE.md','TASK151-DRAFT.md']:
    file=root/'docs'/name
    shutil.copyfile(file,review/name)
shutil.copyfile(root/'Quantum-Office.html',review/'Quantum-Office.html')
for name in ['report.json','pdf-result.json']:shutil.copyfile(base/'after'/name,review/name)
shutil.copyfile(base/'before/report.json',review/'baseline-report.json')
(review/'provenance.json').write_text(json.dumps({'baseline':'d0f1b3c6ec98b88aa73d784f5f5859be8059a338',
    'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()},indent=2))
(review/'README.txt').write_text('TASK150 review\n\nBefore: exact main d0f1b3c6ec98b88aa73d784f5f5859be8059a338.\nAfter: see Draft PR HEAD / TASK150.md.\n\nEach QX PDF has 8 pages: 1-3 colour work, 4 colour answer key; 5-7 BW work, 8 BW key.\nAll concepts use the same 24 exercises; explicit concept page breaks are intentional.\nPDFs contain native text/MathML/SVG, not page screenshots. PNGs are review copies only.\nOpen Quantum-Office.html offline; no installation. No QX style is enabled by default.\n')
manifest={str(p.relative_to(review)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(review.rglob('*')) if p.is_file() and p.name!='SHA256.json'}
(review/'SHA256.json').write_text(json.dumps(manifest,indent=2))
pending=archive.with_suffix('.zip.tmp')
with zipfile.ZipFile(pending,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(review.rglob('*')):
        if p.is_file():z.write(p,p.relative_to(review))
with zipfile.ZipFile(pending) as z:
    assert z.testzip() is None
    assert set(z.namelist())==set(manifest)|{'SHA256.json'}
    assert all(hashlib.sha256(z.read(name)).hexdigest()==digest for name,digest in manifest.items())
pending.replace(archive)
print('Packaged',archive,len(manifest),'files',archive.stat().st_size,'bytes')
