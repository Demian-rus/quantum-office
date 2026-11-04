"""TASK036: 10m virtual-cell sheet and full-column styles without cell materialization."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':850},accept_downloads=True)
 page.set_default_timeout(20000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box');box.fill(ref);box.press('Enter')
 def write(ref,val):
  select(ref);field=page.locator('#formula-input');field.fill(val);field.press('Enter')
 def effective(ref):
  return page.evaluate('(r)=>getEffectiveStyle(sheet(),r)',ref)
 write('B3','Проба');write('A99999','Дальняя строка')
 assert page.evaluate('Object.keys(sheet().cells).length')==2
 page.get_by_role('button',name='Выделить весь лист').click()
 assert page.locator('#name-box').input_value()=='A1:CV100000'
 page.get_by_role('button',name='Заливка ячеек').click()
 page.locator('[data-action=palette-pick][data-value="#FFFF00"]').click()
 state=page.evaluate("""()=>({
  all:sheet().defaultStyle.bg,columns:Object.keys(sheet().columnStyles).length,
  populated:Object.keys(sheet().cells).length,
  last:getEffectiveStyle(sheet(),'CV100000').bg
 })""")
 assert state=={'all':'#FFFF00','columns':0,'populated':2,'last':'#FFFF00'},state
 assert page.evaluate('getEffectiveStyle(sheet(),"C50000").bg')=='#FFFF00'
 # User's Russian keyboard physical Ctrl+Z works for sparse bulk formatting.
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert page.evaluate("getEffectiveStyle(sheet(),'B3').bg") is None
 page.keyboard.press('Control+y')
 assert page.evaluate("getEffectiveStyle(sheet(),'B3').bg")=='#FFFF00'
 # Whole B column formatting overlays the global sheet style, no dense cell map.
 select('B1:B100000')
 page.get_by_role('button',name='По центру').click()
 assert effective('B100000')['align']=='center'
 assert effective('A100000').get('align') is None
 page.get_by_role('button',name='Цвет текста').click()
 page.locator('[data-action=palette-pick][data-value="#FF0000"]').click()
 assert effective('B99999')['color']=='#FF0000'
 assert effective('C99999').get('color') is None
 select('B100000')
 assert page.locator('.grid-cell[data-ref=B100000]').evaluate('el=>getComputedStyle(el).justifyContent')=='center'
 # Re-saving and rendering far-away cells preserves layer and actual values.
 assert page.evaluate('Object.keys(sheet().cells).length')==2
 page.evaluate("""()=>{const b=decodeBook(encodeBook(book())),s=b.sheets[0];
  if(s.cells.A99999.value!=='Дальняя строка'||
     getEffectiveStyle(s,'B100000').color!=='#FF0000'||
     getEffectiveStyle(s,'C100000').bg!=='#FFFF00')throw Error('Native roundtrip failed');
 }""")
 # Export XML should use column styles instead of 100k blank cells.
 info=page.evaluate("""async()=>{
  const data=await exportXLSX(book()),zip=await JSZip.loadAsync(data,{checkCRC32:true});
  const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
  const styles=await zip.file('xl/styles.xml').async('string');
  return {n:(xml.match(/<c /g)||[]).length, columns:(xml.match(/<col /g)||[]).length,
   red:styles.includes('FFFF0000'),yellow:styles.includes('FFFFFF00'),
   sized:xml.length,hasStyle:/<col min="2" max="2"[^>]*style="/.test(xml)};
 }""")
 assert info['n']==2 and info['columns']==100 and info['hasStyle'],info
 assert info['red'] and info['yellow'] and info['sized']<40000,info
 # Re-import this concrete XLSX and check 100k-row styles survive, not just XML.
 imported=page.evaluate("""async()=>{const bytes=await exportXLSX(book());
  const imported=await importXLSX(bytes,'roundtrip.xlsx');
  const s=imported.sheets[0];
  return {rows:Object.keys(s.cells).length,value:s.cells.A99999.value,
    red:getEffectiveStyle(s,'B100000').color,
    yellow:getEffectiveStyle(s,'C100000').bg,
    centered:getEffectiveStyle(s,'B70000').align};}""")
 assert imported=={'rows':2,'value':'Дальняя строка','red':'#ff0000','yellow':'#ffff00','centered':'center'},imported

 # Resetting whole-column formatting does not delete contents.
 select('B1:B100000')
 page.get_by_role('button',name='Сбросить формат').click()
 assert effective('B50000').get('color') is None
 assert effective('B50000')['bg']=='#FFFF00'
 assert page.evaluate('Object.keys(sheet().cells).length')==2
 page.keyboard.press('Control+z')
 assert effective('B50000')['color']=='#FF0000'
 assert not errors,errors
 print('PASS TASK036: full-sheet fill, column text/align, undo, sparse storage, native and XLSX')
 browser.close()
