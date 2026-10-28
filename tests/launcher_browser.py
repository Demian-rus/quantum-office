from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path=which('chromium') or None, args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1366,'height':768},accept_downloads=True)
    page.set_default_timeout(4500)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content((root/'dist/index.html').read_text(encoding='utf-8'))
    assert page.locator('.launcher-tile').count()==3
    assert page.locator('.launcher-tile svg').count()==3
    assert page.locator('.home-top h1').count()==0
    page.screenshot(path=str(root/'tests/launcher-new.png'))
    page.get_by_role('button',name='Расписание занятий').click()
    assert page.locator('.sheet-tab').count()==2
    assert page.locator('.grid-cell[data-ref="A1"]').inner_text()=='Время'
    assert page.locator('.grid-cell[data-ref="B1"]').inner_text()=='Понедельник'
    assert page.locator('.grid-cell[data-ref="A2"]').inner_text()=='09:00'
    assert page.locator('.sheet-tab').first.inner_text()=='Неделя'
    assert page.locator('.sheet-tab').last.inner_text()=='Ученики'
    page.locator('.sheet-menu').click()
    assert page.locator('.sheet-tab').count()==3
    assert page.locator('.sheet-tab').last.inner_text()=='Лист 1'
    # Insert data on third sheet then rename without making/deleting another sheet.
    page.locator('#name-box').fill('C4');page.locator('#name-box').press('Enter')
    page.locator('#formula-input').fill('Занятие');page.locator('#formula-input').press('Enter')
    page.locator('.sheet-tab').last.dblclick()
    inp=page.get_by_role('textbox',name='Новое имя листа')
    assert inp.count()==1
    inp.fill('План')
    inp.press('Enter')
    assert page.locator('.sheet-tab').count()==3
    assert page.locator('.sheet-tab').last.inner_text()=='План'
    page.locator('#name-box').fill('C4');page.locator('#name-box').press('Enter')
    assert page.locator('#formula-input').input_value()=='Занятие'
    # An explicit pencil action also renames, while plus creates another tab.
    page.get_by_role('button',name='Переименовать текущий лист').click()
    inp=page.get_by_role('textbox',name='Новое имя листа');inp.fill('График');inp.press('Enter')
    assert page.locator('.sheet-tab').last.inner_text()=='График'
    page.locator('.sheet-menu').click()
    assert page.locator('.sheet-tab').count()==4
    assert page.locator('.sheet-tab').last.inner_text()=='Лист 1'
    page.get_by_role('button',name='Обзор').click()
    assert page.locator('.launcher-tile').count()==3
    assert page.locator('.file-card').count()==1
    assert not errors,errors
    print('PASS launcher 3 icon cards, timetable, new sheets, inline doubleclick/pencil rename, content preserved')
    browser.close()
