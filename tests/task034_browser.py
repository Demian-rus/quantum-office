"""TASK034: full 10m-cell selection uses sparse Delete, format reset and border removal."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1400,'height':860})
 page.set_default_timeout(14000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""() => {
  transact(()=>{
   const s=sheet();
   setCell(s,'A1','верх');setCell(s,'B50000','=A1&"!"');
   setCell(s,'CV100000','низ');
   setStyle(s,'B50000',{bg:'#aabbcc',bold:true});
   setStyle(s,'CV100000',{border:'thin'});
   setStyle(s,'C10',{borders:{top:true,bottom:true}});
   setWholeSheetAlignment(s,'center');
  });drawGrid();
 }""")
 assert page.evaluate('Object.keys(sheet().cells).length')==4
 page.get_by_role('button',name='Выделить весь лист').click()
 assert page.locator('#name-box').input_value()=='A1:CV100000'
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Delete')
 cleared=page.evaluate("""() => ({
  cells:Object.keys(sheet().cells).length,
  a:sheet().cells.A1,b:sheet().cells.B50000,far:sheet().cells.CV100000,
  align:sheet().defaultAlign
 })""")
 assert cleared['cells']==3,cleared
 assert cleared['a'] is None and cleared['b']['value']=='' and cleared['far']['value']=='',cleared
 assert cleared['align']=='center',cleared
 page.get_by_role('button',name='Отменить').first.click()
 assert page.evaluate("sheet().cells.CV100000.value")=='низ'
 assert page.evaluate("sheet().cells.B50000.value")=='=A1&"!"'
 page.get_by_role('button',name='Повторить').first.click()
 assert page.evaluate("sheet().cells.CV100000.value")==''
 page.get_by_role('button',name='Границы').click()
 page.get_by_role('menuitem',name='Без границ').click()
 borders=page.evaluate("""() => ({
  existing:Object.keys(sheet().cells).length,
  far:sheet().cells.CV100000,
  interior:sheet().cells.C10,
  colored:sheet().cells.B50000
 })""")
 assert borders['existing']==1,borders
 assert borders['far'] is None and borders['interior'] is None,borders
 assert borders['colored']['style']['bg']=='#aabbcc',borders
 page.get_by_role('button',name='Отменить').first.click()
 assert page.evaluate("sheet().cells.CV100000.style.border")=='thin'
 page.get_by_role('button',name='Повторить').first.click()
 assert page.evaluate("sheet().cells.CV100000") is None
 page.get_by_role('button',name='Сбросить формат').click()
 formatted=page.evaluate("""() => ({
  align:sheet().defaultAlign, cells:Object.keys(sheet().cells).length
 })""")
 assert formatted=={'align':None,'cells':0},formatted
 page.get_by_role('button',name='Отменить').first.click()
 assert page.evaluate("sheet().defaultAlign")=='center'
 assert page.evaluate("sheet().cells.B50000.style.bg")=='#aabbcc'
 before=page.evaluate('undoStacks.get(book().id).length')
 page.get_by_role('button',name='Сбросить формат').click()
 page.get_by_role('button',name='Сбросить формат').click()
 after=page.evaluate('undoStacks.get(book().id).length')
 assert after==before+1,(before,after)
 assert not errors,errors
 print('PASS TASK034: 10m virtual selection Delete, border clear, format reset, Undo/Redo, no-op history')
 browser.close()
