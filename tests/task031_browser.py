"""TASK 031: owner-reported grid hairlines, fill undo from formula bar, home rename,
and legible expanded templates in Chromium, with no browser JS errors."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':850})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def select(ref):
  box=page.locator('#name-box');box.fill(ref);box.press('Enter')
 def write(ref,value):
  select(ref);box=page.locator('#formula-input');box.fill(value);box.press('Enter')
 def style(ref):
  return page.locator('.grid-cell[data-ref="'+ref+'"]').evaluate("""e=>({
   fill:e.style.backgroundColor,border:getComputedStyle(e).borderBottomColor,
   width:getComputedStyle(e).borderBottomWidth,
   inset:getComputedStyle(e,'::after').inset,
   selected:e.classList.contains('is-selected')})""")
 write('B2','Документ');select('B2:D4')
 page.get_by_role('button',name='Заливка ячеек').click()
 page.locator('[data-action=palette-pick][data-value="#ffffff"]').click()
 assert style('B2')['fill']=='rgb(255, 255, 255)'
 assert style('C3')['fill']=='rgb(255, 255, 255)'
 assert style('B2')['width']=='1px',style('B2')
 # A white fill and a large selection must not erase row/column hairlines.
 select('A1:CV2000')
 for ref in ['A1','B2','D4']:
  assert style(ref)['width']=='1px',(ref,style(ref))
 assert style('B2')['border']!='rgb(244, 247, 251)',style('B2')
 select('B2')
 # User can undo a formatting operation even when the idle formula bar is focused.
 page.locator('#formula-input').focus()
 page.keyboard.press('Control+z')
 assert style('B2')['fill']=='',style('B2')
 assert page.locator('.grid-cell[data-ref=B2]').inner_text()=='Документ'
 page.locator('#formula-input').focus()
 page.keyboard.press('Control+y')
 assert style('B2')['fill']=='rgb(255, 255, 255)',style('B2')
 page.get_by_role('button',name='Обзор').click()
 assert page.locator('.file-card').count()==1
 page.locator('.file-card [data-action=rename-book]').first.click()
 rename=page.get_by_role('textbox',name='Новое название книги')
 assert rename.is_visible()
 rename.fill('Рабочий график — октябрь')
 rename.press('Enter')
 assert page.locator('.file-card-name').first.inner_text()=='Рабочий график — октябрь'
 assert page.locator('.file-card').count()==1
 page.locator('.file-card [data-action=open]').first.click()
 assert page.locator('#book-name').input_value()=='Рабочий график — октябрь'
 page.get_by_role('button',name='Обзор').click()
 page.get_by_role('button',name='Шаблоны таблиц').click()
 page.get_by_role('button',name='Недельное расписание занятий').click()
 assert page.locator('.sheet-tab').count()==3
 assert page.locator('.grid-cell[data-ref=A4].is-merged').count()==1
 assert page.locator('.grid-cell[data-ref=B2]').inner_text()=='Ученики'
 geometry=page.evaluate("""() => ({width:columnWidth(sheet(),4),height:rowHeight(sheet(),3),
  merges:sheet().merges.length,bands:getCell(sheet(),'A4').style.bg})""")
 assert geometry['width']>=280 and geometry['height']>=32,geometry
 assert geometry['merges']>=9,geometry
 assert geometry['bands']=='#ffca19',geometry
 page.screenshot(path=str(root/'tests/task031-schedule.png'))
 page.get_by_role('button',name='Обзор').click()
 page.get_by_role('button',name='Шаблоны таблиц').click()
 page.get_by_role('button',name='Журнал учеников').click()
 journal=page.evaluate("""() => ({merges:sheet().merges.length,width:columnWidth(sheet(),7),height:rowHeight(sheet(),4),sample:getCell(sheet(),'A5').value})""")
 assert journal['merges']>=4 and journal['width']>=300,journal
 assert journal['height']>=34 and journal['sample'].startswith('Пример'),journal
 page.get_by_role('button',name='Обзор').click()
 page.get_by_role('button',name='Шаблоны таблиц').click()
 page.get_by_role('button',name='Учёт доходов и расходов').click()
 balance=page.evaluate("""() => {const s=sheet(),v=recalculator.view(book(),s);
 return {balance:resultOf(s,'F20',v.raw,v.ctx),width:columnWidth(s,2),merges:s.merges.length};}""")
 assert balance['balance']==4350 and balance['width']>=280 and balance['merges']>=5,balance
 assert not errors,errors
 print('PASS TASK031: selected gridlines with white fill, Ctrl+Z/Y from idle formula bar, inline launcher rename, upgraded 3 templates')
 browser.close()
