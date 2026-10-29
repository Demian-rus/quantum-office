"""TASK049: values snapshot with embedded tabs/newlines, undo/redo and QBOOK."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 page.set_default_timeout(15000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box');box.fill(ref);box.press('Enter')
 page.evaluate("""()=>{
  const s=sheet();setCell(s,'A1','Alpha\\nBeta');setCell(s,'B1','red\\tblue');
  setCell(s,'C1','=SUM(A2:B2)');setCell(s,'A2','10');setCell(s,'B2','5');
  setStyle(s,'F10',{bg:'#ff0000',bold:true});
 }""")
 select('A1:C1');page.locator('#grid-scroll').focus();page.keyboard.press('Control+c')
 assert page.evaluate('internalClipboard.values')==[['Alpha\nBeta','red\tblue','15']]
 select('F10');page.locator('#grid-scroll').focus();page.keyboard.press('Control+Shift+v')
 values=page.evaluate("()=>['F10','G10','H10'].map(k=>getCell(sheet(),k).value)")
 assert values==['Alpha\nBeta','red\tblue','15'],values
 assert page.evaluate("getCell(sheet(),'F10').style")=={'bg':'#ff0000','bold':True}
 page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'F10').value")==''
 page.keyboard.press('Control+y')
 assert page.evaluate("getCell(sheet(),'H10').value")=='15'
 assert page.evaluate("""()=>{const b=decodeBook(encodeBook(book())),s=currentSheet(b);
 return getCell(s,'F10').value==='Alpha\\nBeta'&&getCell(s,'G10').value==='red\\tblue'&&getCell(s,'H10').value==='15';}""")
 page.evaluate("internalClipboard.values[0][1]=42")
 select('N10');page.locator('#grid-scroll').focus();page.keyboard.press('Control+Shift+v')
 assert page.evaluate("getCell(sheet(),'N10').value")==''
 assert 'повреждён' in page.locator('#toast').inner_text().lower()
 assert not errors,errors
 print('TASK049 Chromium PASS: exact structured values, Ctrl+Shift+V, Undo/Redo, QBOOK and corrupted clipboard')
 browser.close()
