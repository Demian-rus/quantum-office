"""TASK 033: sparse 100,000-row sheet, last-row editing and virtualized viewport."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':860},accept_downloads=True)
 page.set_default_timeout(11000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box');box.fill(ref);box.press('Enter')
 def write(ref,value):
  select(ref);box=page.locator('#formula-input');box.fill(value);box.press('Enter')
 state=page.evaluate("""() => {
  const s=sheet(),g=gridGeometry(s);
  return {rows:LIMITS.rows,geometry:g.y.length,virtualHeight:g.y.at(-1),cells:Object.keys(s.cells).length,
          reused:gridGeometry(s)===g};
 }""")
 assert state['rows']==100000 and state['geometry']==100001,state
 assert state['virtualHeight']>2500000 and state['cells']==0 and state['reused'],state
 write('A99999','41')
 write('B99999','=A99999+1')
 select('B99999')
 assert page.locator('.grid-cell[data-ref="B99999"]').inner_text()=='42'
 assert page.locator('#grid-scroll').evaluate('el=>el.scrollTop')>2500000
 write('A100000','7')
 write('B100000','=A100000*3')
 select('B100000')
 assert page.locator('.grid-cell[data-ref="B100000"]').inner_text()=='21'
 count=page.evaluate('Object.keys(sheet().cells).length')
 assert count==4,count
 # Render at end of long sheet should stay virtual; number of DOM cells is viewport bounded.
 visible=page.locator('#grid-canvas .grid-cell').count()
 assert 0<visible<1500,visible
 # Undo and redo at last row must preserve references and values.
 page.get_by_role('button',name='Отменить').first.click()
 select('B100000')
 assert page.locator('.grid-cell[data-ref="B100000"]').inner_text()==''
 page.get_by_role('button',name='Повторить').first.click()
 select('B100000')
 assert page.locator('.grid-cell[data-ref="B100000"]').inner_text()=='21'
 page.get_by_role('button',name='Выделить весь лист').click()
 assert page.locator('#name-box').input_value()=='A1:CV100000'
 page.get_by_role('button',name='По центру').click()
 assert page.evaluate('sheet().defaultAlign')=='center'
 assert page.evaluate('Object.keys(sheet().cells).length')==4
 select('CV100000')
 assert page.locator('.grid-cell[data-ref="CV100000"]').evaluate('el=>getComputedStyle(el).justifyContent')=='center'
 assert not errors,errors
 page.screenshot(path=str(root/'tests/task033-100k.png'))
 print('PASS TASK033: 100k rows, high-row formulas, sparse editing, viewport virtualization and undo')
 browser.close()
