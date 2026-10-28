from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

def run():
    url=Path(__file__).parents[1].joinpath('dist/index.html').as_uri()
    with sync_playwright() as p:
        browser=p.chromium.launch(**({'executable_path':which('chromium')} if which('chromium') else {}),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        page=browser.new_page(viewport={'width':1440,'height':900},device_scale_factor=1,accept_downloads=True)
        page.set_default_timeout(4000)
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.set_content(Path(__file__).parents[1].joinpath("dist/index.html").read_text(),wait_until="load")
        assert page.locator('.launcher-tile').count()==3
        assert page.get_by_text('Ваш офис.').count()==0
        page.screenshot(path=str(Path(__file__).parent/'home.png'),full_page=True)
        page.get_by_role('button',name='Открыть пример таблицы').click()
        assert page.locator('.grid-cell[data-ref="A1"]').count()==1
        assert page.locator('.grid-cell[data-ref="B6"]').count()==1
        assert page.locator('.grid-cell[data-ref="B6"]').inner_text().strip()!=''
        page.screenshot(path=str(Path(__file__).parent/'sheets.png'),full_page=True)
        # Formula-aware fill: relative reference changes and absolute anchor stays put.
        def select_ref(value):
            page.locator('#name-box').fill(value)
            page.locator('#name-box').press('Enter')
        select_ref('G1')
        page.locator('#formula-input').fill('=B2+$C$2')
        page.locator('#formula-input').press('Enter')
        select_ref('G1:G3')
        page.get_by_role('tab',name='Правка').click()
        page.get_by_role('button',name='Заполнить вниз').click()
        assert page.locator('.grid-cell[data-ref="G2"]').inner_text().strip()!=''
        select_ref('G2')
        assert page.locator('#formula-input').input_value()=='=B3+$C$2'
        page.locator('#grid-scroll').focus()
        page.keyboard.press('Control+z')
        select_ref('G2')
        assert page.locator('#formula-input').input_value()==''
        select_ref('G1:G3')
        page.locator('#grid-scroll').focus()
        page.keyboard.press('Control+d')
        select_ref('G3')
        assert page.locator('#formula-input').input_value()=='=B4+$C$2'
        page.locator('.grid-cell[data-ref="A8"]').dblclick()
        page.locator('.cell-editor').fill('Проверка текста')
        page.locator('.cell-editor').press('Enter')
        assert page.locator('.grid-cell[data-ref="A8"]').inner_text()=='Проверка текста'
        page.locator('.sheet-menu').click()
        assert page.locator('.sheet-tab').count()==3
        page.locator('.sheet-tab').last.click()
        page.get_by_role('button',name='Обзор').click()
        assert page.locator('.file-card').count()==1
        assert not errors,errors
        print('UI smoke PASS: home, example, formula, cell edit, multi-sheet, navigation; no JS errors')
        browser.close()
if __name__=='__main__': run()
