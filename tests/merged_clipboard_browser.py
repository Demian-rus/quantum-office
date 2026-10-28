from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':768})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  x=page.locator('#name-box');x.fill(ref);x.press('Enter')
 def write(ref,value):
  select(ref);x=page.locator('#formula-input');x.fill(value);x.press('Enter')
 write('B2','=A1+10');select('B2:C3')
 page.get_by_role('button',name='Объединить ячейки').click()
 select('B2');page.locator('#grid-scroll').focus();page.keyboard.press('Control+c')
 select('F4');page.locator('#grid-scroll').focus();page.keyboard.press('Control+v')
 assert page.locator('.grid-cell[data-ref=F4].is-merged').count()==1
 select('F4');assert page.locator('#formula-input').input_value()=='=E3+10'
 page.locator('#grid-scroll').focus();page.keyboard.press('ArrowRight')
 assert page.locator('#name-box').input_value()=='H4'
 select('F4');page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.locator('.grid-cell[data-ref=F4].is-merged').count()==0
 assert page.locator('.grid-cell[data-ref=B2].is-merged').count()==1
 assert not errors,errors
 print('PASS merged clipboard, formulas, keyboard navigation, undo')
 browser.close()
