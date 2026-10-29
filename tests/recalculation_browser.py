"""TASK 029: real Chromium redraw reuse, incremental edit/Undo and cross-sheet visibility."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':850})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def write(ref,value):
  page.locator('#name-box').fill(ref);page.locator('#name-box').press('Enter')
  page.locator('#formula-input').fill(value);page.locator('#formula-input').press('Enter')
 def read(ref):
  page.locator('#name-box').fill(ref);page.locator('#name-box').press('Enter')
  return page.locator('.grid-cell[data-ref="'+ref+'"]').inner_text()
 write('A1','10');write('B1','=A1*2');write('C1','=B1+1');write('D1','=10+20')
 assert read('C1')=='21'
 assert read('D1')=='30'
 before=page.evaluate("""() => {
  const s=sheet(),v=recalculator.view(book(),s);
  resultOf(s,'C1',v.raw,v.ctx);resultOf(s,'D1',v.raw,v.ctx);
  return {created:recalculator.stats.created,incremental:recalculator.stats.incremental,
          evaluated:v.ctx.calculation.stats.evaluated,graph:v.ctx.calculation.graphComplete};
 }""")
 assert before['graph'] and before['incremental']>=4,before
 # One hundred selection/scroll/redraw cycles must not recreate the calculation session.
 page.evaluate("""() => {
  const scroll=document.getElementById('grid-scroll');
  for(let i=0;i<100;i++){scroll.scrollTop=(i%2)*400;drawGrid();}
  scroll.scrollTop=0;drawGrid();
 }""")
 page.locator('#name-box').fill('A1:C1');page.locator('#name-box').press('Enter')
 after_redraw=page.evaluate("""() => ({created:recalculator.stats.created,
  evaluated:recalculator.view(book(),sheet()).ctx.calculation.stats.evaluated})""")
 assert after_redraw['created']==before['created'],(before,after_redraw)
 assert after_redraw['evaluated']==before['evaluated'],(before,after_redraw)
 write('A1','20')
 assert read('C1')=='41'
 assert read('D1')=='30'
 after_edit=page.evaluate("""() => ({created:recalculator.stats.created,
   incremental:recalculator.stats.incremental,
   evaluated:recalculator.view(book(),sheet()).ctx.calculation.stats.evaluated})""")
 assert after_edit['created']==before['created'],after_edit
 assert after_edit['incremental']>before['incremental'],after_edit
 assert after_edit['evaluated']==before['evaluated']+2,(before,after_edit)
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert read('C1')=='21'
 after_undo=page.evaluate('recalculator.stats.created')
 assert after_undo>before['created'],after_undo
 page.locator('.sheet-menu').click()
 write('A1',"='Лист 1'!C1+1")
 assert read('A1')=='22'
 page.locator('.sheet-tab').first.click()
 write('A1','30')
 page.locator('.sheet-tab').last.click()
 assert read('A1')=='62'
 assert not errors,errors
 print('PASS TASK 029 Chromium: 100 redraws share cache, targeted edit, Undo reset and inter-sheet invalidation')
 browser.close()
