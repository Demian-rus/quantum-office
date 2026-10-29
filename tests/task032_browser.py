"""TASK 032: frozen merged headers do not get recreated during vertical scroll.
Whole-sheet alignment applies to 200,000 virtual cells without materializing them."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1500,'height':820},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.get_by_role('button',name='Шаблоны таблиц').click()
 page.get_by_role('button',name='Учёт доходов и расходов').click()
 header=page.locator('#grid-frozen-rows .grid-cell[data-ref=A1]')
 assert header.count()==1,'frozen row overlay missing'
 assert page.locator('#grid-canvas .grid-cell[data-ref=A1]').count()==0
 first=header.bounding_box();assert first
 state=page.evaluate("""() => {
  window._fixedHeader=document.querySelector('#grid-frozen-rows .grid-cell[data-ref=A1]');
  return {frozenRows:sheet().freeze.rows,headerText:window._fixedHeader.textContent,
          count:document.querySelectorAll('#grid-frozen-rows .grid-cell').length};
 }""")
 assert state['frozenRows']==5 and state['headerText'].startswith('ДОХОДЫ'),state
 for pos in [250,500,750,1050,1300,650,100]:
  page.locator('#grid-scroll').evaluate('(el,y)=>{el.scrollTop=y;el.dispatchEvent(new Event("scroll"));}',pos)
  after=header.bounding_box()
  assert abs(after['y']-first['y'])<1.1,(pos,first,after)
  assert page.evaluate('document.querySelector("#grid-frozen-rows .grid-cell[data-ref=A1]")===window._fixedHeader'),pos
 assert not errors,errors
 # Whole-sheet alignment must work without the former 10k limit, preserve data,
 # display on an empty cell and roundtrip through undo.
 page.get_by_role('button',name='Выделить весь лист').click()
 assert page.locator('#name-box').input_value()=='A1:CV2000'
 before=page.evaluate('Object.keys(sheet().cells).length')
 page.get_by_role('button',name='По центру').click()
 after=page.evaluate("""() => ({
  defaultAlign:sheet().defaultAlign,count:Object.keys(sheet().cells).length,
  merged:sheet().merges.length,undo:undoStacks.get(book().id).length})""")
 assert after['defaultAlign']=='center',after
 assert after['count']<=before and after['merged']>=5,after
 assert page.locator('#toast.bad.active').count()==0
 assert page.locator('.grid-cell[data-ref=C26]').count()==1
 align=page.locator('.grid-cell[data-ref=C26]').evaluate('el=>getComputedStyle(el).justifyContent')
 assert align=='center',align
 page.get_by_role('button',name='Отменить').first.click()
 assert page.evaluate('sheet().defaultAlign') is None
 page.get_by_role('button',name='Повторить').first.click()
 assert page.evaluate('sheet().defaultAlign')=='center'
 page.locator('#name-box').fill('CV2000');page.locator('#name-box').press('Enter')
 assert page.locator('.grid-cell[data-ref=CV2000]').evaluate('el=>getComputedStyle(el).justifyContent')=='center'
 # Format is not a 200000-entry cell map.
 assert page.evaluate('Object.keys(sheet().cells).length')<=before
 page.get_by_role('button',name='Обзор').click()
 page.get_by_role('button',name='Шаблоны таблиц').click()
 page.get_by_role('button',name='Недельное расписание занятий').click()
 assert page.evaluate('sheet().freeze.cols')==2
 left=page.locator('#grid-frozen-rows .grid-cell[data-ref=A1]')
 x=left.bounding_box()['x']
 page.locator('#grid-scroll').evaluate('(el)=>{el.scrollLeft=700;el.dispatchEvent(new Event("scroll"));}')
 assert abs(left.bounding_box()['x']-x)<1.1,('frozen corner shifted',x,left.bounding_box()['x'])
 assert not errors,errors
 print('PASS TASK032: stable frozen header identity and geometry, 200k alignment, Undo/Redo and horizontal freeze')
 browser.close()
