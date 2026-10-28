from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(**({'executable_path':which('chromium')} if which('chromium') else {}),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1366,'height':768})
    errs=[];page.on('pageerror',lambda err:errs.append(str(err)))
    page.set_content((root/'dist/index.html').read_text(),wait_until='load')
    page.get_by_role('button',name='Открыть демонстрацию').click()
    page.get_by_role('tab',name='Правка').click()
    assert page.locator('[data-action=find-open]').count()==1
    page.locator('[data-action=find-open]').click()
    page.locator('#find-term').fill('Транспорт')
    page.locator('[data-action=find-next]').click()
    assert page.locator('#name-box').input_value()=='A4'
    page.locator('#replace-term').fill('Логистика')
    page.locator('[data-action=replace-all]').click()
    assert page.locator('.grid-cell[data-ref="A4"]').inner_text()=='Логистика'
    page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
    assert page.locator('.grid-cell[data-ref="A4"]').inner_text()=='Транспорт'
    page.locator('[data-action=find-close]').click()
    # create a clean sheet for sorting (sample contains formulas)
    page.locator('.sheet-menu').click()
    def change(ref, text):
        page.locator('#name-box').fill(ref);page.locator('#name-box').press('Enter')
        page.locator('#formula-input').fill(text);page.locator('#formula-input').press('Enter')
    for ref,text in [('A1','Яблоко'),('B1','9'),('A2','Банан'),('B2','8'),('A3','Абрикос'),('B3','7')]: change(ref,text)
    page.locator('#name-box').fill('A1:B3');page.locator('#name-box').press('Enter')
    page.get_by_role('tab',name='Данные').click()
    page.locator('[data-action=sort-asc]').click()
    assert page.locator('.grid-cell[data-ref="A1"]').inner_text()=='Абрикос'
    assert page.locator('.grid-cell[data-ref="B1"]').inner_text()=='7'
    assert page.locator('.grid-cell[data-ref="A3"]').inner_text()=='Яблоко'
    assert not errs,errs
    page.get_by_role('tab',name='Главная').click()
    page.screenshot(path=str(root/'tests/ribbon-new.png'))
    print('Ribbon browser PASS: find, replace, undo, sort, layout, no JS errors')
    browser.close()
