"""TASK037: 180k-cell rectangular formatting, undo and native safety."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':860})
 page.set_default_timeout(20000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(value):
  name=page.locator('#name-box');name.fill(value);name.press('Enter')
 def effective(ref):
  return page.evaluate('(ref)=>getEffectiveStyle(sheet(),ref)',ref)
 select('B50000')
 page.locator('#formula-input').fill('Содержание')
 page.locator('#formula-input').press('Enter')
 select('B100:C90000')
 page.get_by_role('button',name='Заливка ячеек').click()
 page.locator('[data-action=palette-pick][data-value="#FFFF00"]').click()
 state=page.evaluate("""()=>({
  regions:sheet().rectangleStyles.length,
  cells:Object.keys(sheet().cells).length,
  one:getEffectiveStyle(sheet(),'B50000').bg,
  far:getEffectiveStyle(sheet(),'C90000').bg,
  outside:getEffectiveStyle(sheet(),'D90000').bg,
  text:getCell(sheet(),'B50000').value
 })""")
 assert state=={'regions':1,'cells':1,'one':'#FFFF00','far':'#FFFF00','outside':None,'text':'Содержание'},state
 # The Undo action is atomic even though 180k virtual positions changed.
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert effective('C89999').get('bg') is None
 assert page.evaluate("getCell(sheet(),'B50000').value")=='Содержание'
 page.keyboard.press('Control+y')
 assert effective('C89999')['bg']=='#FFFF00'
 # Smaller new rectangle overrides a subregion and clearing splits it.
 select('C40000:C60000')
 page.get_by_role('button',name='Цвет текста').click()
 page.locator('[data-action=palette-pick][data-value="#FF0000"]').click()
 assert effective('C50000')['color']=='#FF0000'
 assert effective('B50000').get('color') is None
 select('C45000:C55000')
 page.get_by_role('button',name='Сбросить формат').click()
 assert effective('C50000').get('color') is None
 assert effective('C50000').get('bg') is None
 assert effective('C44000')['color']=='#FF0000'
 assert effective('C44000')['bg']=='#FFFF00'
 page.get_by_role('button',name='Отменить').click()
 assert effective('C50000')['color']=='#FF0000'
 assert effective('C50000')['bg']=='#FFFF00'
 assert page.evaluate('Object.keys(sheet().cells).length')==1
 assert page.evaluate("""()=>{const restored=decodeBook(encodeBook(book()));return getEffectiveStyle(restored.sheets[0],'C50000').color;}""")=='#FF0000'
 # Now exports supported rectangles as real Excel style records and reimports.
 page.set_default_timeout(120000)
 roundtrip=page.evaluate("""async()=>{
  const bytes=await exportXLSX(book()),loaded=await importXLSX(bytes,'roundtrip.xlsx'),s=loaded.sheets[0];
  return {cells:Object.keys(s.cells).length,
    text:getCell(s,'B50000').value,
    above:getEffectiveStyle(s,'C44000'),middle:getEffectiveStyle(s,'C50000'),
    outside:getEffectiveStyle(s,'D50000'),regions:s.rectangleStyles.length};
 }""")
 assert roundtrip['cells']==1 and roundtrip['text']=='Содержание',roundtrip
 assert roundtrip['middle']['color']=='#ff0000' and roundtrip['middle']['bg']=='#ffff00',roundtrip
 assert roundtrip['above']['bg']=='#ffff00' and roundtrip['outside'].get('bg') is None,roundtrip
 assert 1<=roundtrip['regions']<=256,roundtrip
 assert not errors,errors
 print('PASS TASK037: 180k sparse formatting, overlap, split/reset, undo/redo, native persistence, XLSX roundtrip')
 browser.close()
