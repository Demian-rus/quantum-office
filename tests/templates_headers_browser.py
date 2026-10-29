from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=which('chromium') or None,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':768},accept_downloads=True)
 page.set_default_timeout(6500)
 errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf8'),wait_until='load')
 page.get_by_role('button',name='Шаблоны таблиц').click()
 assert page.get_by_role('heading',name='Шаблоны таблиц').is_visible()
 assert page.locator('.template-card').count()==4
 page.get_by_role('button',name='Недельное расписание занятий').click()
 assert page.locator('.sheet-tab').count()==3
 assert page.locator('.grid-cell[data-ref="A4"]').inner_text()=='Пн'
 assert page.locator('.grid-cell[data-ref="B2"]').inner_text()=='Ученики'
 assert page.locator('.grid-cell[data-ref="I2"]').inner_text()=='Стоимость'
 assert page.locator('.sheet-options[data-action="sheet-rename"]').count()==0
 assert page.locator('#grid-col-overlay').is_visible()
 head=page.locator('#grid-col-overlay .colhead').first
 top_before=head.bounding_box()['y']
 page.locator('#grid-scroll').evaluate('(el)=>{el.scrollTop=420;el.dispatchEvent(new Event("scroll"))}')
 page.wait_for_timeout(180)
 top_after=page.locator('#grid-col-overlay .colhead').first.bounding_box()['y']
 assert abs(top_after-top_before)<1,(top_before,top_after)
 # column header click selects entire column and row header click the entire row
 page.locator('#grid-col-overlay .colhead').filter(has_text='C').first.click()
 assert page.locator('#name-box').input_value()=='C1:C2000'
 page.locator('#grid-row-overlay .rowhead').first.click()
 selected=page.locator('#name-box').input_value()
 assert selected.startswith('A') and selected.endswith(':CV'+selected.split(':')[0][1:]),selected
 page.get_by_role('button',name='Выделить весь лист').click()
 assert page.locator('#name-box').input_value()=='A1:CV100000'
 # no extra rename button; double-click directly into tab
 page.locator('.sheet-tab').first.dblclick()
 name=page.get_by_role('textbox',name='Новое имя листа');assert name.is_visible()
 name.fill('Мой график');name.press('Enter')
 assert page.locator('.sheet-tab').first.inner_text()=='Мой график'
 page.get_by_role('button',name='Обзор').click()
 page.get_by_role('button',name='Шаблоны текстов').click()
 assert page.get_by_role('heading',name='Шаблоны текстов').is_visible()
 assert all(c.is_disabled() for c in page.locator('.template-card').all())
 page.get_by_role('button',name='На главную').click()
 page.get_by_role('button',name='Шаблоны презентаций').click()
 assert page.get_by_role('heading',name='Шаблоны презентаций').is_visible()
 assert not errors,errors
 page.screenshot(path=str(root/'tests/task19-templates.png'))
 print('PASS template routing, workbook structure, stable headers, whole row/column/sheet selection, doubleclick rename')
 browser.close()
