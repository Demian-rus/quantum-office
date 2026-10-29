"""TASK048: values-only shortcut, toolbar, undo/redo, merge and cut safety."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 page.set_default_timeout(15000);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  n=page.locator('#name-box');n.fill(ref);n.press('Enter')
 page.evaluate("""()=>{const s=sheet();setCell(s,'A1','10');setCell(s,'B1','5');
  setCell(s,'C1','=A1+B1');setStyle(s,'F4',{bg:'#ff0000',bold:true});setStyle(s,'G4',{bg:'#00ff00'});}""")
 select('A1:C1');page.locator('#grid-scroll').focus();page.keyboard.press('Control+c')
 select('F4');page.locator('#grid-scroll').focus();page.keyboard.press('Control+Shift+v')
 cells=page.evaluate("""()=>['F4','G4','H4'].map(x=>getCell(sheet(),x))""")
 assert [c['value'] for c in cells]==['10','5','15'],cells
 assert cells[0]['style']=={'bg':'#ff0000','bold':True}
 assert cells[1]['style']=={'bg':'#00ff00'}
 select('H4');assert page.locator('#formula-input').input_value()=='15'
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'F4').value")==''
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+y')
 assert page.evaluate("getCell(sheet(),'H4').value")=='15'
 page.evaluate("""()=>{const s=sheet();setCell(s,'A5','33');setCell(s,'A6','44');mergeCells(s,'D8','E8');}""")
 select('A5:A6');page.locator('#grid-scroll').focus();page.keyboard.press('Control+c')
 select('D8');page.get_by_role('tab',name='Правка').click()
 page.get_by_role('button',name='Вставить значения').click()
 assert page.evaluate("getCell(sheet(),'D8').value")==''
 assert page.evaluate("getCell(sheet(),'D9').value")==''
 select('A5');page.locator('#grid-scroll').focus();page.keyboard.press('Control+x')
 select('K11');page.locator('#grid-scroll').focus();page.keyboard.press('Control+Shift+v')
 assert page.evaluate("getCell(sheet(),'A5').value")=='33'
 assert page.evaluate("getCell(sheet(),'K11').value")==''
 assert not errors,errors
 print('TASK048 Chromium PASS: values-only shortcut, toolbar, formatting, undo/redo, guards')
 browser.close()
