"""TASK 035: Russian keyboard undo and redo, user edits, scrollbar and readable status."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1470,'height':875})
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box');box.fill(ref);box.press('Enter')
 def write(ref,val):
  select(ref);v=page.locator('#formula-input');v.fill(val);v.press('Enter')
 def cell(ref):
  return page.evaluate("(ref)=>getCell(sheet(),ref)",ref)
 def shortcut(cyrillic,code,shift=False):
  # Real Russian keyboard produces a Cyrillic .key but the same physical .code.
  page.evaluate("""args=>{
   const ev=new KeyboardEvent('keydown',{key:args.key,code:args.code,ctrlKey:true,
     shiftKey:args.shift,bubbles:true,cancelable:true});
   document.getElementById('grid-scroll').dispatchEvent(ev);
   if(!ev.defaultPrevented)throw Error('Shortcut was not handled: '+args.code);
  }""",{'key':cyrillic,'code':code,'shift':shift})
 write('A1','Исходное значение')
 assert cell('A1')['value']=='Исходное значение'
 page.get_by_role('button',name='Заливка ячеек').click()
 page.locator('[data-action=palette-pick][data-value="#FFFF00"]').click()
 assert cell('A1')['style']['bg']=='#FFFF00'
 shortcut('я','KeyZ')
 assert cell('A1')['style']=={},cell('A1')
 assert cell('A1')['value']=='Исходное значение'
 assert 'отменено' in page.locator('#toast').inner_text().lower()
 shortcut('н','KeyY')
 assert cell('A1')['style']['bg']=='#FFFF00'
 # Physical keyboard and clipboard editing must share the same workbook history.
 select('A1');page.locator('#grid-scroll').focus();page.keyboard.press('Delete')
 assert cell('A1')['value']==''
 page.keyboard.press('Control+z')
 assert cell('A1')['value']=='Исходное значение'
 page.keyboard.press('Control+Shift+z')
 assert cell('A1')['value']==''
 shortcut('я','KeyZ')
 assert cell('A1')['value']=='Исходное значение'
 # Idle formula field routes Undo to workbook; an actively typed input does not.
 page.locator('#formula-input').focus()
 shortcut('я','KeyZ')
 assert cell('A1')['style']=={},cell('A1')
 page.locator('#formula-input').fill('Редактируется')
 count=page.evaluate("undoStacks.get(book().id).length")
 page.locator('#formula-input').dispatch_event('keydown',{'key':'z','code':'KeyZ','ctrlKey':True})
 assert page.evaluate("undoStacks.get(book().id).length")==count
 # The vertical scrollbar starts exactly below the fixed letter headings.
 page.locator('#grid-scroll').focus()
 pos=page.evaluate("""()=>{
  const box=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right}};
  const scroll=document.getElementById('grid-scroll');
  return {scroll:box(scroll),headers:box(document.getElementById('grid-col-overlay')),
    frame:box(document.getElementById('grid-frame')),reserve:scroll.offsetWidth-scroll.clientWidth};
 }""")
 assert abs(pos['scroll']['top']-pos['headers']['bottom'])<1.1,pos
 assert pos['reserve']>=12,pos
 # At zero scroll, A1 begins precisely below the letter header.
 page.locator('#formula-input').fill('Исходное значение')
 page.locator('#formula-input').press('Enter')
 page.locator('#grid-scroll').evaluate('(el)=>{el.scrollTop=0;el.scrollLeft=0}')
 first=page.locator('.grid-cell[data-ref="A1"]').first.bounding_box()
 assert abs(first['y']-pos['headers']['bottom'])<1.1,(first,pos)
 # Check the actual scroll slider is below the overlay even in a frozen template.
 page.get_by_role('button',name='Обзор').click()
 page.get_by_role('button',name='Шаблоны таблиц').click()
 page.get_by_role('button',name='Учёт доходов и расходов').click()
 header=page.locator('#grid-frozen-rows .grid-cell[data-ref="A1"]')
 y=header.bounding_box()['y']
 page.locator('#grid-scroll').evaluate('(el)=>{el.scrollTop=600;el.dispatchEvent(new Event("scroll"))}')
 assert abs(header.bounding_box()['y']-y)<1.1
 status=page.evaluate("""()=>{const el=document.querySelector('.sheet-status');
  return {text:el.innerText,spans:el.querySelectorAll('span').length,
    color:getComputedStyle(document.getElementById('selection-stats')).color,
    px:parseFloat(getComputedStyle(el).fontSize)};
 }""")
 assert status['spans']==2,status
 assert 'Quantum Sheets' not in status['text'] and 'строк ×' not in status['text'],status
 # TASK096: status follows the semantic text role, rather than a historical RGB.
 assert status['color']==page.evaluate("()=>{const e=document.createElement('i');e.style.color='var(--qo-text)';document.body.append(e);const c=getComputedStyle(e).color;e.remove();return c}") and status['px']>=11,status
 assert not errors,errors
 print('PASS TASK035: Russian/Latin Ctrl+Z/Y, fill/delete, dirty formula guard, slider below headings, status contrast')
 browser.close()
