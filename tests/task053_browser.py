"""TASK053 real Chromium: print preview, page choices, saved region and native print."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 page.set_default_timeout(20000);errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
   const s=sheet();
   for(let n=1;n<=80;n++){setCell(s,'A'+n,'Строка '+n);setCell(s,'B'+n,String(n));}
   setCell(s,'B2','=B3+5');drawGrid();
 }""")
 box=page.locator('#name-box');box.fill('A1:B4');box.press('Enter')
 page.get_by_role('tab',name='Файл').click()
 page.get_by_role('button',name='Предпросмотр и печать').click()
 assert page.locator('#print-view').count()==1
 assert page.locator('.print-page').count()>=2
 assert 'Страница 1 из' in page.locator('.print-page-footer').first.inner_text()
 page.locator('[data-action=print-use-selection]').click()
 assert page.evaluate("sheet().printSettings.area.from")=='A1'
 assert page.evaluate("sheet().printSettings.area.to")=='B4'
 assert page.locator('.print-page').count()==1
 assert '8' in page.locator('.print-page').first.inner_text()
 page.locator('#print-paper').select_option('Letter')
 assert page.evaluate("sheet().printSettings.paper")=='Letter'
 page.locator('#print-orientation').select_option('landscape')
 assert page.locator('.print-page').first.get_attribute('style').find('--paper-width:1056px')!=-1
 page.locator('#print-scale').select_option('75')
 assert page.evaluate("sheet().printSettings.scale")==75
 assert page.evaluate("decodeBook(encodeBook(book())).sheets[0].printSettings.orientation")=='landscape'
 page.evaluate("window.__printCalled=0;window.print=()=>window.__printCalled++")
 page.locator('[data-action=print-now]').click()
 assert page.evaluate("window.__printCalled")==1
 assert '@page' in page.locator('#print-page-rule').inner_text()
 page.locator('[data-action=print-use-used]').click()
 assert page.evaluate("sheet().printSettings.area") is None
 page.locator('[data-action=print-close]').click()
 assert page.locator('#print-view').count()==0
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.evaluate("sheet().printSettings.area is not None")
 assert not errors,errors
 browser.close()
 print('TASK053 PASS: multi-page print, selection, paper, orientation, scale, QBOOK, browser print and undo')
