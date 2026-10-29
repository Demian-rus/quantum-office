"""TASK050 offline browser: chart insert, live updates, types, QBOOK, undo."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 page.set_default_timeout(15000);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{const s=sheet();[['A1','Регион'],['B1','План'],['A2','Север'],['B2','10'],
 ['A3','Юг'],['B3','20'],['A4','Восток'],['B4','=B2+B3']].forEach(([k,v])=>setCell(s,k,v));}""")
 entry=page.locator('#name-box');entry.fill('A1:B4');entry.press('Enter')
 page.get_by_role('tab',name='Вставка').click()
 page.get_by_role('button',name='Столбчатая диаграмма').click()
 assert page.locator('#chart-panel .qo-chart-svg').count()==1
 assert page.evaluate("sheet().charts.length")==1
 assert page.evaluate("chartData(book(),sheet(),sheet().charts[0]).points[2].value")==30
 page.evaluate("setCell(sheet(),'B2','50');changed()")
 assert page.evaluate("chartData(book(),sheet(),sheet().charts[0]).points[2].value")==70
 page.locator('#chart-panel [data-action=chart-type][data-type=line]').click()
 assert page.locator('#chart-panel svg polyline').count()==1
 page.locator('#chart-panel [data-action=chart-type][data-type=pie]').click()
 assert page.locator('#chart-panel svg circle').count()>=3
 title=page.locator('#chart-title');title.fill('Доход по регионам');title.press('Tab')
 assert page.evaluate("sheet().charts[0].title")=='Доход по регионам'
 assert page.evaluate("decodeBook(encodeBook(book())).sheets[0].charts[0].type")=='pie'
 page.locator('#chart-panel [data-action=chart-delete]').click()
 assert page.evaluate("sheet().charts.length")==0
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.evaluate("sheet().charts.length")==1
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+y')
 assert page.evaluate("sheet().charts.length")==0
 assert not errors,errors
 browser.close()
 print('PASS TASK050: live bar/line/pie, title, QBOOK, delete and undo')
