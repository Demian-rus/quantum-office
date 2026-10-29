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
 def select(x):
  page.locator('#name-box').fill(x);page.locator('#name-box').press('Enter')
 def write(x,y):
  select(x);page.locator('#formula-input').fill(y);page.locator('#formula-input').press('Enter')
 write('A2','first');write('A3','second');write('B3','=A3')
 select('A2:A3');page.get_by_role('tab',name='Вставка').click()
 page.get_by_role('button',name='Вставить выбранные строки').click()
 select('A4');assert page.locator('#formula-input').input_value()=='first'
 select('B5');assert page.locator('#formula-input').input_value()=='=A5'
 select('A2:A3');page.get_by_role('button',name='Удалить выбранные строки').click()
 select('A2');assert page.locator('#formula-input').input_value()=='first'
 assert not errors,errors
 print('PASS: mass insertion/deletion with correct addresses')
 browser.close()
