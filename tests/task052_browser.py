"""TASK052 Chromium: dropdown, rejection, numeric bounds, undo and QBOOK."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 page.set_default_timeout(16000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box');box.fill(ref);box.press('Enter')
 select('B2:B4')
 page.get_by_role('tab',name='Данные').click()
 page.get_by_role('button',name='Проверка данных').click()
 assert page.locator('#validation-panel').count()==1
 page.locator('#validation-list').fill('Готово; В работе; Отложено')
 page.get_by_role('button',name='Добавить правило').click()
 assert page.evaluate("sheet().validations.length")==1
 select('B2')
 assert page.locator('#validation-cell-select').count()==1
 page.locator('#validation-cell-select').select_option(label='Готово')
 assert page.evaluate("getCell(sheet(),'B2').value")=='Готово'
 assert page.evaluate("decodeBook(encodeBook(book())).sheets[0].validations.length")==1
 page.locator('#formula-input').fill('Нельзя')
 page.locator('#formula-input').press('Enter')
 assert page.evaluate("getCell(sheet(),'B2').value")=='Готово'
 assert 'Выберите вариант' in page.locator('#toast').inner_text()
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'B2').value")==''
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+y')
 assert page.evaluate("getCell(sheet(),'B2').value")=='Готово'
 select('D2:D4')
 page.locator('#validation-kind').select_option('number')
 page.locator('#validation-min').fill('10')
 page.locator('#validation-max').fill('50')
 page.get_by_role('button',name='Добавить правило').click()
 assert page.evaluate("sheet().validations.length")==2
 page.evaluate("setCell(sheet(),'D2','25');drawGrid()")
 assert page.evaluate("getCell(sheet(),'D2').value")=='25'
 assert page.evaluate("""()=>{try{setCell(sheet(),'D2','55');return false;}catch(e){return e.message.includes('разрешены числа');}}""")
 assert page.evaluate("getCell(sheet(),'D2').value")=='25'
 page.get_by_role('button',name='Удалить проверку').last.click()
 assert page.evaluate("sheet().validations.length")==1
 assert not errors,errors
 browser.close()
 print('TASK052 Chromium PASS: dropdown, rejection, numeric, QBOOK and undo')
