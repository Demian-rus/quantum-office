"""TASK038 — Excel-compatible 180k sparse style positions incl. explicit no-fill override."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':860},accept_downloads=True)
 page.set_default_timeout(120000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 before=page.evaluate("""async()=>{
  const s=sheet();
  setCell(s,'B50000','=1+2');
  setCell(s,'A100000','Сохранено');
  setBulkColumnStyle(s,'A1','CV100000',{bg:'#ff0000'});
  setRectangleStyle(s,'B100','C90000',{bg:'#facc15'});
  setRectangleStyle(s,'C70000','C75000',{bg:undefined});
  return {value:s.cells.B50000.value,count:Object.keys(s.cells).length,
    noFill:getEffectiveStyle(s,'C72000').bg,
    yellow:getEffectiveStyle(s,'B80000').bg};
 }""")
 assert before=={'value':'=1+2','count':2,'noFill':None,'yellow':'#facc15'},before
 data=page.evaluate("""async()=>{
  const before=JSON.stringify(book()),xlsx=await exportXLSX(book());
  const zip=await JSZip.loadAsync(xlsx,{checkCRC32:true});
  const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
  const imported=await importXLSX(xlsx,'proof.xlsx'),s=imported.sheets[0];
  return {
   xmlLength:xml.length,styleCells:(xml.match(/<c /g)||[]).length,
   masked:/<c r="C72000" s="0"\\/>/.test(xml),
   populated:Object.keys(s.cells).length,layers:s.rectangleStyles.length,
   value:s.cells.B50000?.value,far:s.cells.A100000?.value,
   a:getEffectiveStyle(s,'A80000').bg,
   b:getEffectiveStyle(s,'B80000').bg,
   mask:getEffectiveStyle(s,'C72000').bg,
   adjacent:getEffectiveStyle(s,'C69999').bg,
   outside:getEffectiveStyle(s,'D72000').bg,
   unchanged:JSON.stringify(book())===before
  };
 }""")
 assert data['styleCells']>170000 and data['xmlLength']<10000000,data
 assert data['masked'] and data['populated']==2 and data['layers']<=256,data
 assert data['value']=='=1+2' and data['far']=='Сохранено',data
 assert data['a']=='#ff0000' and data['outside']=='#ff0000',data
 assert data['b']=='#facc15' and data['adjacent']=='#facc15',data
 assert data['mask'] is None and data['unchanged'],data
 assert not errors,errors
 print('PASS TASK038: Excel XML real styles, 180k coalesced import, no-fill mask, formula and data')
 browser.close()
