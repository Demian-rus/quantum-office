"""Task 030: real UI undo of fill, flex alignment, unmerged outer border, axis contrast."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':880})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box');box.fill(ref);box.press('Enter')
 def write(ref,value):
  select(ref);box=page.locator('#formula-input');box.fill(value);box.press('Enter')
 def bg(ref):
  return page.locator('.grid-cell[data-ref="'+ref+'"]').evaluate('el=>el.style.backgroundColor')
 def justify(ref):
  return page.locator('.grid-cell[data-ref="'+ref+'"]').evaluate('el=>getComputedStyle(el).justifyContent')
 write('B2','Репетитор');select('B2')
 assert bg('B2')=='',bg('B2')
 page.get_by_role('button',name='Заливка ячеек').click()
 page.locator('[data-action=palette-pick][data-value="#facc15"]').click()
 assert bg('B2')=='rgb(250, 204, 21)',bg('B2')
 # Ctrl+Z must work with the name field focused (previously treated as text-edit).
 page.locator('#name-box').focus();page.keyboard.press('Control+z')
 assert bg('B2')=='',bg('B2')
 page.locator('#name-box').focus();page.keyboard.press('Control+y')
 assert bg('B2')=='rgb(250, 204, 21)',bg('B2')
 select('B2')
 offsets=[]
 for label,expected in [('По левому краю','flex-start'),('По центру','center'),('По правому краю','flex-end')]:
  page.get_by_role('button',name=label).click()
  assert justify('B2')==expected,(label,justify('B2'))
  measured=page.locator('.grid-cell[data-ref=B2]').evaluate("""el=>{
   const range=document.createRange();range.selectNodeContents(el);
   const a=range.getBoundingClientRect(), b=el.getBoundingClientRect();
   return (a.left-b.left)/b.width;
  }""")
  offsets.append(measured)
 assert offsets[0]+0.05<offsets[1] and offsets[1]+0.05<offsets[2],offsets
 # Outer borders on normal unmerged cells must not trigger the merge command.
 select('B2:D4')
 page.get_by_role('button',name='Границы').click()
 assert page.get_by_role('menuitem',name='Внешние границы').is_visible()
 page.get_by_role('menuitem',name='Внешние границы').click()
 assert page.locator('.grid-cell.is-merged').count()==0
 assert page.locator('.grid-cell[data-ref=B2]').evaluate('el=>el.style.borderTop')=='1px solid rgb(82, 109, 92)'
 assert page.locator('.grid-cell[data-ref=C3]').evaluate('el=>el.style.borderTop')==''
 assert page.locator('.grid-cell[data-ref=D4]').evaluate('el=>el.style.borderRight')=='1px solid rgb(82, 109, 92)'
 assert page.locator('#toast.bad.active').count()==0
 page.locator('#grid-scroll').focus();page.keyboard.press('Control+z')
 assert page.locator('.grid-cell[data-ref=B2]').evaluate('el=>el.style.borderTop')==''
 assert page.locator('.grid-cell[data-ref=B2]').inner_text()=='Репетитор'
 # Selecting every row and column must not turn headers and cells the same green.
 select('A1:CV2000')
 header=page.locator('.colhead[data-index="1"]')
 rowhead=page.locator('.rowhead[data-index="1"]')
 cell=page.locator('.grid-cell[data-ref=B2]')
 assert 'header-selected' in header.get_attribute('class')
 assert 'header-selected' in rowhead.get_attribute('class')
 colors=page.evaluate("""() => {
  const css=x=>getComputedStyle(x).backgroundColor;
  return {col:css(document.querySelector('.colhead[data-index="1"]')),
          row:css(document.querySelector('.rowhead[data-index="1"]')),
          grid:css(document.querySelector('.grid-cell[data-ref="B2"]')),
          active:css(document.querySelector('.colhead[data-index="0"]'))};
 }""")
 assert colors['col']!=colors['grid'],colors
 assert colors['row']!=colors['grid'],colors
 assert colors['active']!=colors['col'],colors
 assert colors['col']!='rgb(213, 235, 223)',colors
 # Full sheet outer outline must not materialize every selected cell.
 page.get_by_role('button',name='Границы').click()
 page.get_by_role('menuitem',name='Внешние границы').click()
 snapshot=page.evaluate("""() => {
  const s=sheet();
  return {populated:Object.keys(s.cells).length,edge:s.cells.CV2000?.style?.borders,interior:s.cells.C3?.style?.borders||null,merges:s.merges.length};
 }""")
 assert snapshot['populated']>=4196 and snapshot['populated']<=4210,snapshot
 assert snapshot['edge']['bottom'] and snapshot['edge']['right'],snapshot
 assert snapshot['interior'] is None,snapshot
 assert snapshot['merges']==0,snapshot
 page.screenshot(path=str(root/'tests/task030-selection.png'))
 assert not errors,errors
 print('PASS TASK030: fill Undo/Redo in name box, physical alignment, border without merge, distinct axes, 200k range outline')
 browser.close()
