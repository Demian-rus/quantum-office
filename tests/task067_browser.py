"""TASK067 real Chromium: icon-only cosmetic baseline, text-to-columns and dedup with preview, safeguards, undo and XLSX."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1560,'height':960},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.get_by_role('tab',name='Данные').click()
 assert page.locator('.ribbon-group button.tool-btn.is-labeled').count()==0
 widths=page.locator('.ribbon-group button.tool-btn').evaluate_all('(buttons)=>buttons.map(b=>Math.round(b.getBoundingClientRect().width))')
 assert widths and set(widths)=={36},widths
 assert page.locator('.ribbon-group .group-name').count()>=4
 page.evaluate("""()=>{
  for(const [ref,v] of Object.entries({A1:'Контакт',A2:'"Иван; Петров";25;Москва',A3:'Мария;31;Уфа'}))
   setCell(sheet(),ref,v);
  changed();
 }""")
 name=page.locator('#name-box')
 name.fill('A2:A3');name.press('Enter')
 page.locator('[data-action=text-to-columns]').click()
 assert page.locator('#data-tool-panel').count()==1
 assert 'Колонок: 3' in page.locator('.data-tool-summary').inner_text()
 assert 'Иван; Петров' in page.locator('.data-tool-preview').inner_text()
 page.locator('[data-action=data-tool-apply]').click()
 assert page.locator('#data-tool-panel').count()==0
 assert page.evaluate("sheet().cells.B2.value")=='25'
 assert page.evaluate("sheet().cells.C2.value")=='Москва'
 page.locator('[data-action=undo]').first.click()
 assert page.evaluate("sheet().cells.A2.value")=='"Иван; Петров";25;Москва'
 assert page.evaluate("sheet().cells.B2?.value||''")==''
 page.locator('[data-action=redo]').first.click()
 assert page.evaluate("sheet().cells.C3.value")=='Уфа'
 # Existing content must trigger explicit collision opt-in, without touching data.
 page.evaluate("""()=>{
  setCell(sheet(),'E2','x,y');
  setCell(sheet(),'F2','must stay');
  changed();
 }""")
 name=page.locator('#name-box')
 name.fill('E2');name.press('Enter')
 page.locator('[data-action=text-to-columns]').click()
 page.locator('#data-tool-delimiter').select_option(',')
 assert 'заняты ячейки' in page.locator('.data-tool-error').inner_text()
 assert page.locator('[data-action=data-tool-apply]').is_disabled()
 page.locator('#data-tool-overwrite').check()
 assert page.locator('[data-action=data-tool-apply]').is_enabled()
 page.locator('[data-action=data-tool-apply]').click()
 assert page.evaluate("sheet().cells.F2.value")=='y'
 # Dedup only A:B, leave unrelated C preserved, header opt-in, different key comparisons.
 page.evaluate("""()=>{
  for(const [ref,v] of Object.entries({
   A6:'Имя',B6:'Город',C6:'Примечания',A7:'Анна',B7:'Москва',C7:'1',
   A8:'Борис',B8:'Уфа',C8:'2',A9:'АННА',B9:'Москва',C9:'3',
   A10:'Лев',B10:'Пермь',C10:'4'
  }))setCell(sheet(),ref,v);
  changed();
 }""")
 name=page.locator('#name-box');name.fill('A6:B10');name.press('Enter')
 page.locator('[data-action=remove-duplicates]').click()
 assert 'Повторов: 1' in page.locator('.data-tool-summary').inner_text()
 assert '9' in page.locator('.data-tool-preview').inner_text()
 page.locator('[data-action=data-tool-apply]').click()
 assert page.evaluate("sheet().cells.A9.value")=='Лев'
 assert page.evaluate("sheet().cells.A10?.value||''")==''
 assert page.evaluate("sheet().cells.C9.value")=='3'
 page.locator('[data-action=undo]').first.click()
 assert page.evaluate("sheet().cells.A9.value")=='АННА'
 # Re-applying compaction survives XLSX, but not hidden/auto-filter geometry.
 page.locator('[data-action=remove-duplicates]').click()
 page.locator('[data-action=data-tool-apply]').click()
 state=page.evaluate("""async()=>{
  const b=book(),bytes=await exportXLSX(b),report={};
  const restored=await importXLSX(bytes,'Обработка.xlsx',report);
  const s=restored.sheets[0];
  if(s.cells.A9.value!=='Лев'||s.cells.C9.value!=='3')
   throw Error('Data-cleaning XLSX roundtrip changed contents');
  const q=decodeBook(encodeBook(b));
  if(q.sheets[0].cells.A9.value!=='Лев')throw Error('QBOOK data lost');
  return {a:s.cells.A9.value,c:s.cells.C9.value};
 }""")
 assert state=={'a':'Лев','c':'3'}
 assert not errors,errors
 browser.close()
 print('PASS TASK067: compact icon ribbon, preview, explicit overwrite, dedup within selection, Undo/Redo, XLSX and QBOOK')
