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
    page.get_by_role('button',name='Открыть демонстрацию').click()
    assert page.locator('.global-bar').bounding_box()['height']<=42
    assert page.locator('.ribbon').bounding_box()['height']<=110
    assert page.locator('.grid-scroll').bounding_box()['y']<=185
    assert page.locator('#book-name').is_visible()
    assert page.get_by_role('button',name='Автосумма').count()==1
    # Create an empty sheet and enter numbers in A1:A3.
    page.locator('.sheet-menu').click()
    def write(ref,val):
        page.locator('#name-box').fill(ref)
        page.locator('#name-box').press('Enter')
        page.locator('#formula-input').fill(val)
        page.locator('#formula-input').press('Enter')
    for ref,val in [('A1','4'),('A2','6'),('A3','10')]:write(ref,val)
    page.locator('#name-box').fill('A4');page.locator('#name-box').press('Enter')
    page.locator('[data-action=autosum]').click()
    assert page.locator('#formula-input').input_value()=='=SUM(A1:A3)'
    assert page.locator('.grid-cell[data-ref="A4"]').inner_text()=='20'
    page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
    assert page.locator('.grid-cell[data-ref="A4"]').inner_text()==''
    page.locator('#name-box').fill('A1');page.locator('#name-box').press('Enter')
    page.locator('[data-action=bold]').click()
    assert page.locator('.grid-cell[data-ref="A1"]').evaluate('(el)=>el.style.fontWeight')=='750'
    page.locator('[data-action=clear-format]').click()
    assert page.locator('.grid-cell[data-ref="A1"]').evaluate('(el)=>el.style.fontWeight')==''
    assert page.locator('.grid-cell[data-ref="A1"]').inner_text()=='4'
    page.get_by_role('tab',name='Правка').click()
    assert page.locator('.ribbon').bounding_box()['height']<=110
    assert page.get_by_role('button',name='Найти / заменить').is_visible()
    page.get_by_role('tab',name='Данные').click()
    assert page.get_by_role('button',name='А → Я').is_visible()
    assert not errors,errors
    page.get_by_role('tab',name='Главная').click()
    page.screenshot(path=str(root/'tests/compact-ribbon.png'))
    print('PASS compact ribbon (<110px), autosum + undo, clear style + data preservation, responsive actions')
    browser.close()
