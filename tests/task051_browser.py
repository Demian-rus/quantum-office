"""TASK051 real Chromium: rule creation, live cell fill, color scale, undo, QBOOK."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 page.set_default_timeout(15000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{const s=sheet();setCell(s,'A2','10');setCell(s,'A3','20');
 setCell(s,'A4','=A3*2');setStyle(s,'A3',{bg:'#ffffff',bold:true});}""")
 page.evaluate('recalculator.reset();drawGrid()')
 def select(address):
  box=page.locator('#name-box');box.fill(address);box.press('Enter')
 select('A2:A4')
 page.get_by_role('button',name='Условное форматирование').click()
 assert page.locator('#cf-panel').count()==1
 page.locator('#cf-kind').select_option('gt')
 page.locator('#cf-threshold').fill('15')
 page.locator('#cf-color').fill('#ffcccc')
 page.get_by_role('button',name='Применить к выделению').click()
 assert page.evaluate("sheet().conditionalRules.length")==1
 assert page.locator('#grid-scroll .grid-cell[data-ref=A3]').get_attribute('style').find('background:#ffcccc')!=-1
 assert page.locator('#grid-scroll .grid-cell[data-ref=A2]').get_attribute('style').find('background:#ffcccc')==-1
 assert page.evaluate("getCell(sheet(),'A3').style.bg")=='#ffffff'
 page.evaluate("setCell(sheet(),'A3','5');recalculator.reset();drawGrid()")
 assert 'background:#ffcccc' not in page.locator('#grid-scroll .grid-cell[data-ref=A3]').get_attribute('style')
 assert 'background:#ffcccc' not in page.locator('#grid-scroll .grid-cell[data-ref=A4]').get_attribute('style')
 assert page.evaluate("decodeBook(encodeBook(book())).sheets[0].conditionalRules.length")==1
 select('A2:A4')
 page.get_by_role('button',name='Применить к выделению').click()
 assert page.evaluate("sheet().conditionalRules.length")==2
 page.get_by_role('button',name='Удалить правило').first.click()
 assert page.evaluate("sheet().conditionalRules.length")==1
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.evaluate("sheet().conditionalRules.length")==2
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+y')
 assert page.evaluate("sheet().conditionalRules.length")==1
 assert not errors,errors
 print('TASK051 Chromium PASS: visible color rules, dynamic formulas, QBOOK and Undo/Redo')
 browser.close()
