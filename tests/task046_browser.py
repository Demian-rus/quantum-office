"""TASK046 — actual Ctrl+X/V rebinds dependent formula refs in every sheet."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1450,'height':860},accept_downloads=True)
 page.set_default_timeout(25000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box');box.fill(ref);box.press('Enter')
 def value(ref):
  return page.evaluate('(ref)=>getCell(sheet(),ref).value',ref)
 page.evaluate("""()=>{
  const s=sheet(),b=book(),summary=newSheet('Сводка');
  s.name='Лист 1';
  b.sheets.push(summary);
  setCell(s,'A1','10');setCell(s,'B1','20');
  setCell(s,'A2','=A1+B1');
  setCell(s,'Z10','=SUM(A1:B2)');
  setCell(s,'Z11','="A1"&$A$1');
  setStyle(s,'A1',{bg:'#ccffcc'});
  setCell(summary,'A1',"='Лист 1'!$A$1+1");
  setCell(summary,'A2',`="A1"&'Лист 1'!B1`);
 }""")
 select('A1:B2')
 page.keyboard.press('Control+x')
 assert value('A1')=='10'
 select('D4')
 page.keyboard.press('Control+v')
 page.wait_for_function("getCell(sheet(),'D4').value==='10'")
 data=page.evaluate("""()=>{
  const s=sheet(),summary=book().sheets.find(x=>x.name==='Сводка');
  return {
   a1:getCell(s,'A1').value,b1:getCell(s,'B1').value,
   d4:getCell(s,'D4').value,e4:getCell(s,'E4').value,
   d5:getCell(s,'D5').value,z10:getCell(s,'Z10').value,z11:getCell(s,'Z11').value,
   summary1:getCell(summary,'A1').value,summary2:getCell(summary,'A2').value,
   bg:getCell(s,'D4').style.bg
  };
 }""")
 assert data=={
  'a1':'','b1':'','d4':'10','e4':'20','d5':'=D4+E4',
  'z10':'=SUM(D4:E5)','z11':'="A1"&$D$4',
  'summary1':"='Лист 1'!$D$4+1",
  'summary2':'="A1"&\'Лист 1\'!E4',
  'bg':'#ccffcc'
 },data
 page.keyboard.press('Control+z')
 assert value('A1')=='10' and value('D4')==''
 assert page.evaluate("getCell(book().sheets.find(x=>x.name==='Сводка'),'A1').value")=="='Лист 1'!$A$1+1"
 page.keyboard.press('Control+y')
 assert value('D4')=='10'
 assert page.evaluate("getCell(book().sheets.find(x=>x.name==='Сводка'),'A1').value")=="='Лист 1'!$D$4+1"
 # Partially covered ranges must refuse atomically, even across sheets.
 page.evaluate("""()=>{
  const s=sheet(),t=book().sheets.find(x=>x.name==='Сводка');
  setCell(s,'A10','99');
  setCell(s,'B10','88');
  setCell(t,'C3',"=SUM('Лист 1'!A10:C10)");
 }""")
 select('A10:B10')
 page.keyboard.press('Control+x')
 select('G20')
 page.keyboard.press('Control+v')
 assert value('A10')=='99' and value('B10')=='88'
 assert value('G20')==''
 assert page.evaluate("getCell(book().sheets.find(x=>x.name==='Сводка'),'C3').value")=="=SUM('Лист 1'!A10:C10)"
 assert 'частично пересекающий' in page.locator('#toast').inner_text()
 assert page.evaluate("internalClipboard?.mode")=='cut'
 assert not errors,errors
 print('PASS TASK046: browser Ctrl+X/V rewrites absolute, local, ranged and cross-sheet formulas atomically; undo/redo and partial guard')
 browser.close()
