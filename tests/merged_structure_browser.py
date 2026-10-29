from pathlib import Path
from shutil import which
from io import BytesIO
from playwright.sync_api import sync_playwright
from openpyxl import load_workbook
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':768})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.get_by_role('button',name='Открыть пример таблицы').click()
 page.locator('.sheet-menu').click()
 def write(ref,value):
  page.locator('#name-box').fill(ref);page.locator('#name-box').press('Enter')
  page.locator('#formula-input').fill(value);page.locator('#formula-input').press('Enter')
 write('B2','Header')
 page.locator('#name-box').fill('B2:C3');page.locator('#name-box').press('Enter')
 page.get_by_role('tab',name='Главная').click()
 page.get_by_role('button',name='Объединить ячейки').click()
 assert page.locator('.grid-cell[data-ref="B2"].is-merged').count()==1
 page.locator('#name-box').fill('A1');page.locator('#name-box').press('Enter')
 page.get_by_role('tab',name='Вставка').click()
 page.get_by_role('button',name='Вставить выбранные строки').click()
 assert page.locator('.grid-cell[data-ref="B3"].is-merged').inner_text()=='Header'
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.locator('.grid-cell[data-ref="B2"].is-merged').count()==1
 page.locator('#name-box').fill('A1');page.locator('#name-box').press('Enter')
 page.get_by_role('button',name='Вставить выбранные столбцы').click()
 assert page.locator('.grid-cell[data-ref="C2"].is-merged').inner_text()=='Header'
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 page.locator('#name-box').fill('B2');page.locator('#name-box').press('Enter')
 page.get_by_role('button',name='Удалить выбранные строки').click()
 assert page.locator('.grid-cell[data-ref="B2"].is-merged').inner_text()=='Header'
 assert 'началом объединения' in page.locator('#toast').inner_text()
 page.evaluate("()=>{changeSheetStructure(sheet(),'row','insert',2);render();}")
 assert page.locator('.grid-cell[data-ref="B2"].is-merged').bounding_box()['height']>85
 raw=page.evaluate('async()=>Array.from(await exportXLSX(book()))')
 wb=load_workbook(BytesIO(bytes(raw)))
 assert 'B2:C4' in [str(m) for m in wb.worksheets[-1].merged_cells.ranges]
 assert wb.worksheets[-1]['B2'].value=='Header'
 assert not errors,errors
 print('PASS merged structural editing, undo, anchor protection and XLSX roundtrip')
 browser.close()
