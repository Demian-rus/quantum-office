from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=which('chromium') or None,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':768})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'))
 page.get_by_role('button',name='Открыть пример таблицы').click()
 page.locator('.sheet-menu').click()
 def write(ref,val):
  page.locator('#name-box').fill(ref);page.locator('#name-box').press('Enter')
  page.locator('#formula-input').fill(val);page.locator('#formula-input').press('Enter')
 write('A2','7')
 write('B1','=A2*2')
 page.locator('#name-box').fill('A2');page.locator('#name-box').press('Enter')
 page.get_by_role('tab',name='Вид').click()
 page.get_by_role('button',name='Скрыть строку').click()
 assert page.locator('.grid-cell[data-ref="A2"]').count()==0
 page.get_by_role('button',name='Показать строки').click()
 assert page.locator('.grid-cell[data-ref="A2"]').inner_text()=='7'
 page.locator('#name-box').fill('B1');page.locator('#name-box').press('Enter')
 assert page.locator('#formula-input').input_value()=='=A2*2'
 page.get_by_role('button',name='Скрыть столбец').click()
 assert page.locator('.grid-cell[data-ref="B1"]').count()==0
 page.get_by_role('button',name='Показать столбцы').click()
 assert page.locator('.grid-cell[data-ref="B1"]').inner_text()=='14'
 assert not errors,errors
 print('PASS explicit hide/show rows and columns; formulas and data survive')
 browser.close()
