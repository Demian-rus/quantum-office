from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path=which('chromium') or None,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1366,'height':768})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((root/'dist/index.html').read_text(encoding='utf-8'))
    page.get_by_role('button',name='Открыть пример таблицы').click()
    page.locator('.sheet-menu').click() # blank sheet
    def write(ref,text):
        page.locator('#name-box').fill(ref);page.locator('#name-box').press('Enter')
        page.locator('#formula-input').fill(text);page.locator('#formula-input').press('Enter')
    write('A1','7');write('B1','=A1*2')
    page.get_by_role('tab',name='Вставка').click()
    assert page.get_by_role('button',name='Вставить строку').is_visible()
    page.get_by_role('button',name='Вставить строку').click()
    page.locator('#name-box').fill('B2');page.locator('#name-box').press('Enter')
    assert page.locator('#formula-input').input_value()=='=A2*2'
    assert page.locator('.grid-cell[data-ref="B2"]').inner_text()=='14'
    # Column operation via same ribbon; maintain formula references
    page.get_by_role('button',name='Вставить столбец').click()
    page.locator('#name-box').fill('C2');page.locator('#name-box').press('Enter')
    assert page.locator('#formula-input').input_value()=='=A2*2'
    page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
    assert page.locator('.grid-cell[data-ref="B2"]').inner_text()=='14'
    assert page.locator('.grid-cell[data-ref="C2"]').inner_text()==''
    page.locator('#name-box').fill('A1');page.locator('#name-box').press('Enter')
    page.get_by_role('button',name='Удалить строку').click()
    assert page.locator('.grid-cell[data-ref="A1"]').inner_text()=='7'
    assert page.locator('.grid-cell[data-ref="B1"]').inner_text()=='14'
    assert not errors,errors
    print('PASS STRUCTURE: insert row/column, formulas, undo, delete row in Chromium')
    browser.close()
