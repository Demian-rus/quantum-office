"""TASK057 UX: a chart must visibly exist before any values are typed."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 page.set_default_timeout(25000)
 errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.get_by_role('tab',name='Вставка').click()
 page.get_by_role('button',name='Столбчатая диаграмма').click()
 assert page.evaluate('sheet().charts.length')==1
 assert page.evaluate('sheet().charts[0].from+":"+sheet().charts[0].to')=='A1:B6'
 assert page.evaluate('Object.keys(sheet().cells).length')==0
 assert page.locator('#chart-panel .qo-chart-svg').count()==1
 assert 'Диаграмма создана' in page.locator('#chart-preview').inner_text()
 outcome=page.evaluate("""async()=>{
  const bytes=await exportXLSX(book()),status={};
  const restored=await importXLSX(bytes,'Пустая диаграмма.xlsx',status);
  if(restored.sheets[0].charts.length!==1||status.importedCharts!==1)throw Error('Blank chart XLSX import lost chart');
  return {size:bytes.length,imported:status.importedCharts};
 }""")
 assert outcome['imported']==1,outcome
 # Changing the range must work even before there is data.
 source=page.locator('#chart-range')
 source.fill('C1:D4')
 page.locator('[data-action=chart-source]').click()
 assert page.evaluate('sheet().charts[0].from+":"+sheet().charts[0].to')=='C1:D4'
 page.evaluate("""()=>{
  const s=sheet();for(const [key,value] of Object.entries({
   C1:'Категория',D1:'Число',C2:'Январь',D2:'5',C3:'Февраль',D3:'15',
   C4:'Март',D4:'25',A1:'Название',B1:'Цена',A2:'Север',B2:'2',
   A3:'Юг',B3:'8',A4:'Восток',B4:'12'
  }))setCell(s,key,value);changed();
 }""")
 assert page.locator('#chart-preview .qo-chart-svg').count()==1
 assert page.evaluate('chartData(book(),sheet(),sheet().charts[0]).points[2].value')==25
 page.locator('#chart-panel [data-action=chart-type][data-type=pie]').click()
 assert page.locator('#chart-panel svg circle').count()>=3
 # Next chart without a range selection should discover adjacent existing data.
 page.evaluate("setSelection('B3')")
 page.get_by_role('button',name='Линейная диаграмма').click()
 assert page.evaluate('sheet().charts.length')==2
 assert page.evaluate('sheet().charts[1].from+":"+sheet().charts[1].to')=='A1:B4'
 assert page.locator('#chart-panel svg polyline').count()==1
 # A malformed source must preserve existing reference and show a useful error.
 page.locator('#chart-range').fill('A1:C3')
 page.locator('[data-action=chart-source]').click()
 assert page.evaluate('sheet().charts[1].from+":"+sheet().charts[1].to')=='A1:B4'
 assert not errors,errors
 browser.close()
 print('PASS TASK057: blank chart, XLSX blank roundtrip, source editing, live data, autodetect and invalid range guard')
