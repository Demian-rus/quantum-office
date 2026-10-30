"""TASK061: chart formatting UI, Undo, QBOOK, XLSX and full roundtrip in Chromium."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1580,'height':1000},accept_downloads=True)
 page.set_default_timeout(25000)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
  for(const [ref,value] of Object.entries({A1:'Месяц',B1:'План',C1:'Факт',
  A2:'Январь',B2:'10',C2:'17',A3:'Февраль',B3:'20',C3:'25',A4:'Март',B4:'15',C4:'30'}))
   setCell(sheet(),ref,value);
  changed();
 }""")
 page.locator('#name-box').fill('A1:C4')
 page.locator('#name-box').press('Enter')
 page.get_by_role('tab',name='Вставка').click()
 page.get_by_role('button',name='Линейная диаграмма').click()
 assert page.locator('#grid-charts-layer svg polyline').count()==2
 assert page.locator('#chart-labels').count()==1
 page.locator('#chart-labels').check()
 assert page.evaluate('sheet().charts[0].options.labels') is True
 page.locator('#chart-legend').select_option('right')
 assert page.evaluate('sheet().charts[0].options.legend')=='right'
 page.locator('#chart-grid').uncheck()
 assert page.evaluate('sheet().charts[0].options.grid') is False
 page.locator('#chart-axis-min').fill('0')
 page.locator('#chart-axis-max').fill('50')
 page.locator('[data-action=chart-axis-save]').click()
 assert page.evaluate('sheet().charts[0].options.max')==50
 page.locator('[data-chart-color="0"]').fill('#aa2233')
 page.locator('[data-chart-color="1"]').fill('#3366cc')
 assert page.evaluate('sheet().charts[0].options.colors[1]')=='#3366cc'
 assert page.locator('#grid-charts-layer svg polyline[stroke="#aa2233"]').count()==1
 assert page.locator('#grid-charts-layer svg polyline[stroke="#3366cc"]').count()==1
 assert page.locator('#grid-charts-layer svg line[stroke="#e3eaf0"]').count()==0
 saved=page.evaluate("""async()=>{
  const b=book(),s=sheet(),original=JSON.stringify(b),opts=chartOptions(s.charts[0]);
  const packed=decodeBook(encodeBook(b));
  if(JSON.stringify(chartOptions(packed.sheets[0].charts[0]))!==JSON.stringify(opts))throw Error('QBOOK chart style lost');
  const xlsx=await exportXLSX(b);
  if(JSON.stringify(b)!==original)throw Error('export mutated chart model');
  const zip=await JSZip.loadAsync(xlsx,{checkCRC32:true});
  const xml=await zip.file('xl/charts/chart1-1.xml').async('string');
  for(const fragment of ['<c:legendPos val="r"/>','<c:showVal val="1"/>','<c:max val="50"/>',
   '<c:min val="0"/>','<a:srgbClr val="AA2233"/>','<a:srgbClr val="3366CC"/>'])
   if(!xml.includes(fragment))throw Error('Missing styled OOXML: '+fragment);
  if(xml.includes('<c:majorGridlines/>'))throw Error('Gridlines should be hidden');
  const report={},again=await importXLSX(xlsx,'Диаграмма.xlsx',report);
  const actual=chartOptions(again.sheets[0].charts[0]);
  for(const key of ['labels','legend','grid','min','max','colors'])
   if(JSON.stringify(actual[key])!==JSON.stringify(opts[key]))
    throw Error('XLSX lost chart style '+key+' '+JSON.stringify({opts,actual}));
  return {report,actual};
 }""")
 assert saved['report']['importedCharts']==1,saved
 # Reset is one undoable user action.
 page.locator('[data-action=chart-style-reset]').click()
 assert page.evaluate('sheet().charts[0].options.labels') is False
 assert page.evaluate('sheet().charts[0].options.max') is None
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert page.evaluate('sheet().charts[0].options.labels') is True
 assert page.evaluate('sheet().charts[0].options.max')==50
 page.get_by_role('tab',name='Вставка').click()
 assert not errors,errors
 browser.close()
 print('PASS TASK061: chart labels, legends, colors, axes, Undo, QBOOK, XLSX roundtrip')
