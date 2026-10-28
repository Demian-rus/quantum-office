from pathlib import Path
from shutil import which
from io import BytesIO
from openpyxl import load_workbook
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(**({'executable_path':which('chromium')} if which('chromium') else {}),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page();page.set_content((root/'dist/index.html').read_text(),wait_until='load')
 raw=page.evaluate('''async()=>{
 const b=newWorkbook('Стиль'); const s=currentSheet(b);
 setCell(s,'B2','План занятия');setStyle(s,'B2',{border:'thin',wrap:true,bg:'#f9e344',color:'#1a2a3a'});
 return Array.from(await exportXLSX(b));
 }''')
 wb=load_workbook(BytesIO(bytes(raw)));c=wb.active['B2']
 assert c.value=='План занятия'
 assert c.border.left.style=='thin' and c.border.top.style=='thin' and c.border.bottom.style=='thin'
 assert c.alignment.wrap_text is True
 assert c.fill.fgColor.rgb=='FFF9E344'
 data=page.evaluate('''async bytes=>{
 const b=await importXLSX(Uint8Array.from(bytes),'Стиль.xlsx');
 return b.sheets[0].cells.B2;
 }''',raw)
 assert data['value']=='План занятия'
 assert data['style']['wrap']==True and data['style']['border']=='thin'
 assert data['style']['bg']=='#f9e344'
 print('PASS XLSX styles: openpyxl reads real borders+wrap+color, Quantum imports again')
 browser.close()
