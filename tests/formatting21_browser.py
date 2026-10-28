from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':768})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  el=page.locator('#name-box');el.fill(ref);el.press('Enter')
 def write(ref,val):
  select(ref);el=page.locator('#formula-input');el.fill(val);el.press('Enter')
 write('B2','Занятия')
 select('B2')
 page.get_by_role('button',name='Заливка ячеек').click()
 assert page.get_by_role('dialog',name='Заливка').is_visible()
 assert page.locator('[data-action=palette-pick]').count()>=24
 page.locator('[data-action=palette-pick][data-value="#facc15"]').click()
 assert page.locator('.grid-cell[data-ref=B2]').evaluate('el=>getComputedStyle(el).backgroundColor')=='rgb(250, 204, 21)'
 select('B2')
 page.get_by_role('button',name='Цвет текста').click()
 page.locator('#palette-custom-color').evaluate("e=>{e.value='#aabbcc';e.dispatchEvent(new Event('change',{bubbles:true}));}")
 assert page.locator('.grid-cell[data-ref=B2]').evaluate('el=>el.style.color')=='rgb(170, 187, 204)'
 select('B2:D4');page.get_by_role('button',name='Границы').click()
 assert page.get_by_role('menuitem',name='Внешние границы').is_visible()
 page.get_by_role('menuitem',name='Внешние границы').click()
 assert 'border-top' in page.locator('.grid-cell[data-ref=B2]').get_attribute('style')
 assert 'border-top' not in page.locator('.grid-cell[data-ref=C3]').get_attribute('style')
 write('B2','Главный текст')
 select('B2:D4')
 page.get_by_role('button',name='Объединить ячейки').click()
 assert page.locator('.grid-cell[data-ref=B2].is-merged').count()==1
 assert page.locator('.grid-cell[data-ref=C2]').count()==0
 assert page.locator('.grid-cell[data-ref=B2]').evaluate('el=>el.getBoundingClientRect().width')>200
 select('B2');page.get_by_role('button',name='Разъединить').click()
 assert page.locator('.grid-cell[data-ref=C2]').count()==1
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.locator('.grid-cell[data-ref=B2].is-merged').count()==1
 assert not errors,errors
 page.screenshot(path=str(root/'tests/task21-formatting.png'))
 print('PASS presets/custom colors, outer border, merge/unmerge, undo')
 browser.close()
