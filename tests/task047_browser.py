"""TASK 047 Chromium: move cannot rewrite Unicode foreign sheets or external workbooks."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 page.set_default_timeout(15000)
 errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box');box.fill(ref);box.press('Enter')
 page.evaluate("""()=>{
  const s=sheet(),b=book();s.name='Source';b.sheets.push(newSheet('Résumé'));
  setCell(s,'D5','17');setCell(s,'D6','25');
  setCell(s,'X20','=D5*2');setCell(s,'X21','=Résumé!D5');
  setCell(s,'X22','="D5"&D5');
 }""")
 select('D5:D6');page.keyboard.press('Control+x');select('G10');page.keyboard.press('Control+v')
 page.wait_for_function("getCell(sheet(),'G10').value==='17'")
 data=page.evaluate("""()=>{const s=sheet();return [
  getCell(s,'D5').value,getCell(s,'G10').value,getCell(s,'G11').value,
  getCell(s,'X20').value,getCell(s,'X21').value,getCell(s,'X22').value]}""")
 assert data==['','17','25','=G10*2','=Résumé!D5','="D5"&G10'],data
 page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'D5').value")=='17'
 page.keyboard.press('Control+y')
 assert page.evaluate("getCell(sheet(),'G10').value")=='17'
 page.evaluate("""()=>{const s=sheet();setCell(s,'D5','17');setCell(s,'X23','=[Budget.xlsx]Source!D5')}""")
 select('D5');page.keyboard.press('Control+x');select('J20');page.keyboard.press('Control+v')
 assert page.evaluate("getCell(sheet(),'D5').value")=='17'
 assert page.evaluate("getCell(sheet(),'J20').value")==''
 assert 'внешнюю' in page.locator('#toast').inner_text()
 assert not errors,errors
 print('PASS TASK047: Unicode qualifier, external rejection, Undo/Redo')
 browser.close()
