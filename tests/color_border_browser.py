from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(**({'executable_path':which('chromium')} if which('chromium') else {}),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':768})
 errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content((root/'dist/index.html').read_text(),wait_until='load')
 page.get_by_role('button',name='Таблицы',exact=True).first.click() if page.get_by_role('button',name='Таблицы',exact=True).count() else page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box');box.fill(ref);box.press('Enter')
 def write(ref,value):
  select(ref);f=page.locator('#formula-input');f.fill(value);f.press('Enter')
 write('B2','Значение')
 select('B2')
 page.locator('#fill-color').dispatch_event('pointerdown',{'button':0})
 # Simulate the native picker committing only after selection moved.
 select('C3')
 page.locator('#fill-color').evaluate("e=>{e.value='#ffcc00';e.dispatchEvent(new Event('change',{bubbles:true}));}")
 assert page.locator('.grid-cell[data-ref="B2"]').evaluate('e=>e.style.backgroundColor')=='rgb(255, 204, 0)'
 assert page.locator('.grid-cell[data-ref="B2"]').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(255, 204, 0)' # still visible while selected/after focus changes
 assert page.locator('.grid-cell[data-ref="C3"]').evaluate('e=>e.style.backgroundColor')!='rgb(255, 204, 0)'
 # Fresh choice on active cell applies to the selected cell, without next click.
 select('B2');page.locator('#text-color').dispatch_event('pointerdown',{'button':0})
 page.locator('#text-color').evaluate("e=>{e.value='#e02030';e.dispatchEvent(new Event('change',{bubbles:true}));}")
 assert page.locator('.grid-cell[data-ref="B2"]').evaluate('e=>e.style.color')=='rgb(224, 32, 48)'
 # Selected cells must display their own fill immediately, not wait for the next click.
 select('B2')
 assert page.locator('.grid-cell[data-ref="B2"]').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(255, 204, 0)'
 page.get_by_role('button',name='Все границы').click()
 assert 'inset' in page.locator('.grid-cell[data-ref="B2"]').evaluate('e=>e.style.boxShadow')
 page.get_by_role('button',name='Перенос текста').click()
 assert 'is-wrapped' in page.locator('.grid-cell[data-ref="B2"]').get_attribute('class')
 page.get_by_role('button',name='Убрать границы').click()
 assert page.locator('.grid-cell[data-ref="B2"]').evaluate('e=>e.style.boxShadow') == ''
 assert page.locator('.grid-cell[data-ref="B2"]').inner_text()=='Значение'
 page.keyboard.press('Control+z')
 assert 'inset' in page.locator('.grid-cell[data-ref="B2"]').evaluate('e=>e.style.boxShadow')
 assert not errors,errors
 print('PASS color picker keeps initial selection; borders, wrap and undo')
 browser.close()
