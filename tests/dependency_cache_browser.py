"""Real Chromium UI regression: snapshot memoization, edits, Undo, cross-sheet formulas."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1400,'height':850})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def write(ref,value):
  page.locator('#name-box').fill(ref);page.locator('#name-box').press('Enter')
  page.locator('#formula-input').fill(value);page.locator('#formula-input').press('Enter')
 def read(ref):
  page.locator('#name-box').fill(ref);page.locator('#name-box').press('Enter')
  return page.locator('.grid-cell[data-ref="'+ref+'"]').inner_text()
 # Many dependent cells in one workbook, one source subtotal.
 page.evaluate("""() => {
  const s=sheet();setCell(s,'A1','10');setCell(s,'B1','=A1*2');setCell(s,'C1','=B1+1');
  for(let i=1;i<=150;i++)setCell(s,'D'+i,'=B1+2');
  drawGrid();
 }""")
 assert read('C1')=='21',read('C1')
 stats=page.evaluate("""() => {
  const s=sheet(),raw=rawMap(s),ctx=formulaContext(book(),s,raw);
  for(let i=1;i<=150;i++)resultOf(s,'D'+i,raw,ctx);
  return {...ctx.calculation.stats,graphComplete:ctx.calculation.graphComplete,
          dependsOn:ctx.calculation.dependencies.get('ЛИСТ 1!D1')?.has('ЛИСТ 1!B1')};
 }""")
 assert stats['evaluated']==151,stats
 assert stats['hits']==149,stats
 assert stats['dependsOn'] and stats['graphComplete'],stats
 write('A1','20')
 assert read('C1')=='41',read('C1')
 assert read('D1')=='42',read('D1')
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert read('C1')=='21',read('C1')
 # Real sheet navigation must discard previous calculation snapshot.
 page.locator('.sheet-menu').click()
 write('A1',"='Лист 1'!B1+1")
 assert read('A1')=='21',read('A1')
 page.locator('.sheet-tab').first.click()
 write('A1','30')
 page.locator('.sheet-tab').last.click()
 assert read('A1')=='61',read('A1')
 assert not errors,errors
 print('PASS TASK 028: Chromium fanout cache, graph edges, edit/undo and cross-sheet refresh')
 browser.close()
