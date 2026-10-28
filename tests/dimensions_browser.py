from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    args={'executable_path':which('chromium')} if which('chromium') else {}
    browser=p.chromium.launch(**args,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1366,'height':768})
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content((root/'dist/index.html').read_text(),wait_until='load')
    page.get_by_role('button',name='Открыть демонстрацию').click()
    page.get_by_role('tab',name='Вид').click()
    page.locator('#name-box').fill('B1')
    page.locator('#name-box').press('Enter')
    assert page.locator('.grid-cell[data-ref="B1"]').evaluate('(e)=>e.offsetWidth')==116
    page.once('dialog',lambda d:d.accept('210'))
    page.get_by_role('button',name='Ширина столбца').click()
    assert page.locator('.grid-cell[data-ref="B1"]').evaluate('(e)=>e.offsetWidth')==210
    page.locator('#name-box').fill('B2')
    page.locator('#name-box').press('Enter')
    page.once('dialog',lambda d:d.accept('60'))
    page.get_by_role('button',name='Высота строки').click()
    assert page.locator('.grid-cell[data-ref="B2"]').evaluate('(e)=>e.offsetHeight')==60
    page.locator('#grid-scroll').focus()
    page.keyboard.press('Control+z')
    assert page.locator('.grid-cell[data-ref="B2"]').evaluate('(e)=>e.offsetHeight')==29
    grip=page.locator('.col-resizer[data-index="1"]')
    bounds=grip.bounding_box()
    page.mouse.move(bounds['x']+4,bounds['y']+7)
    page.mouse.down()
    page.mouse.move(bounds['x']+35,bounds['y']+7,steps=4)
    page.mouse.up()
    assert page.locator('.grid-cell[data-ref="B1"]').evaluate('(e)=>e.offsetWidth')>210
    page.locator('#grid-scroll').focus()
    page.keyboard.press('Control+z')
    assert page.locator('.grid-cell[data-ref="B1"]').evaluate('(e)=>e.offsetWidth')==210
    assert not errors, errors
    print('PASS dimensions browser: geometry, row/col controls, dragging, undo')
    browser.close()
