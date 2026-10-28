from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as playwright:
    browser=playwright.chromium.launch(**({'executable_path':which('chromium')} if which('chromium') else {}),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1440,'height':900})
    errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
    page.get_by_role('button',name='Открыть демонстрацию').click()
    def select(ref):
        page.locator('#name-box').fill(ref)
        page.locator('#name-box').press('Enter')
    def put(ref,value):
        select(ref)
        page.locator('#formula-input').fill(value)
        page.locator('#formula-input').press('Enter')
    put('A9','Clipboard regression')
    select('A9')
    page.locator('#grid-scroll').focus()
    page.keyboard.press('Control+c')
    select('F9')
    page.locator('#grid-scroll').focus()
    page.keyboard.press('Control+v')
    assert page.locator('.grid-cell[data-ref="F9"]').inner_text()=='Clipboard regression'
    select('F9')
    assert page.locator('#formula-input').input_value()=='Clipboard regression'
    # Real mouse selection, with no double-click or active text editor.
    page.locator('.grid-cell[data-ref="F9"]').click()
    page.keyboard.press('Control+c')
    page.locator('.grid-cell[data-ref="G10"]').click()
    page.keyboard.press('Control+v')
    assert page.locator('.grid-cell[data-ref="G10"]').inner_text()=='Clipboard regression'
    assert page.locator('.cell-editor').count()==0
    assert page.evaluate('window.getSelection().toString()')==''
    put('B10','=A9+10')
    select('B10')
    page.locator('#grid-scroll').focus()
    page.keyboard.press('Control+c')
    select('D12')
    page.locator('#grid-scroll').focus()
    page.keyboard.press('Control+v')
    select('D12')
    assert page.locator('#formula-input').input_value()=='=C11+10',page.locator('#formula-input').input_value()
    # Selection of toolbar text must be disabled while maintaining keyboard focus styles.
    assert page.locator('.ribbon').evaluate("el => getComputedStyle(el).userSelect")=='none'
    page.get_by_role('tab',name='Правка').click()
    assert page.get_by_role('button',name='Копировать').is_visible()
    page.get_by_role('tab',name='Главная').click()
    assert page.get_by_role('button',name='Жирный').locator('svg').count()==1
    assert not errors,errors
    browser.close()
    print('PASS: native Ctrl+C/Ctrl+V, formula translation, compact icons and nonselectable ribbon')
