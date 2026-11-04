"""TASK074 Chromium: ribbon fill up/left, exact relative formulas and Undo/Redo."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1450,'height':940})
 page.set_default_timeout(25000)
 failures=[]
 page.on('pageerror',lambda error:failures.append(str(error)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
  for(const [ref,value] of Object.entries({
   B5:'=A5+$D$1',E8:'=D8+$A8',D11:'слово',H11:'сохранить'
  }))setCell(sheet(),ref,value);
  changed();
 }""")
 def select(r):
  node=page.locator('#name-box')
  node.fill(r);node.press('Enter')
 page.locator('[data-action=ribbon][data-target=edit]').first.click()
 assert page.locator('[data-action=fill-up]').is_visible()
 assert page.locator('[data-action=fill-left]').is_visible()
 select('B3:B5')
 page.locator('[data-action=fill-up]').click()
 assert page.evaluate("getCell(sheet(),'B3').value")=='=A3+$D$1'
 assert page.evaluate("getCell(sheet(),'B4').value")=='=A4+$D$1'
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert page.evaluate("getCell(sheet(),'B3').value")==''
 page.keyboard.press('Control+y')
 assert page.evaluate("getCell(sheet(),'B3').value")=='=A3+$D$1'
 select('C8:E8')
 page.locator('[data-action=fill-left]').click()
 assert page.evaluate("getCell(sheet(),'C8').value")=='=B8+$A8'
 assert page.evaluate("getCell(sheet(),'D8').value")=='=C8+$A8'
 select('B11:D11')
 page.locator('[data-action=fill-left]').click()
 assert page.evaluate("getCell(sheet(),'B11').value")=='слово'
 assert page.evaluate("getCell(sheet(),'H11').value")=='сохранить'
 assert not failures,failures
 browser.close()
 print('PASS TASK074: toolbar fill up/left, relative and absolute formula translation, Undo/Redo')
