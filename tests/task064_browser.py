"""TASK064 Chromium: regression toggles, live OLS/R², QBOOK and native XLSX."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1560,'height':1000},accept_downloads=True)
 page.set_default_timeout(25000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
  for(const [ref,value] of Object.entries({A1:'X',B1:'Идеал',C1:'Шум',
   A2:'-2',B2:'-1',C2:'0',A3:'0',B3:'3',C3:'2',
   A4:'2',B4:'7',C4:'=B4-2',A5:'4',B5:'11',C5:'11'}))
    setCell(sheet(),ref,value);
  changed();
 }""")
 page.locator('#name-box').fill('A1:C5');page.locator('#name-box').press('Enter')
 page.get_by_role('tab',name='Вставка').click()
 page.locator('[data-action=chart-scatter]').click()
 assert page.locator('#chart-trendline').count()==1
 assert page.locator('#grid-charts-layer svg .qo-xy-trendline').count()==0
 page.locator('#chart-trendline').check()
 assert page.evaluate('sheet().charts[0].options.trendline') is True
 assert page.locator('#grid-charts-layer svg .qo-xy-trendline').count()==2
 assert 'y = 2x + 3' in page.locator('.chart-regression-results').inner_text()
 page.locator('#chart-trend-equation').check()
 page.locator('#chart-trend-r2').check()
 assert 'R² = 1' in page.locator('#grid-charts-layer svg').text_content()
 first=page.evaluate('linearRegression(chartData(book(),sheet(),sheet().charts[0]).series[0].points).slope')
 assert abs(first-2)<1e-12,first
 page.locator('[data-chart-color="0"]').fill('#aa2244')
 assert page.locator('#grid-charts-layer svg .qo-xy-trendline[stroke="#aa2244"]').count()==1
 page.evaluate("setCell(sheet(),'B5','15');changed()")
 changed=page.evaluate('linearRegression(chartData(book(),sheet(),sheet().charts[0]).series[0].points).slope')
 assert abs(changed-first)>0.1,(first,changed)
 roundtrip=page.evaluate("""async()=>{
  const b=book(),before=JSON.stringify(b),c=sheet().charts[0];
  const saved=decodeBook(encodeBook(b));
  if(!saved.sheets[0].charts[0].options.trendR2)throw Error('QBOOK lost trend style');
  const bytes=await exportXLSX(b);
  if(JSON.stringify(b)!==before)throw Error('XLSX export mutated source');
  const zip=await JSZip.loadAsync(bytes,{checkCRC32:true}),xml=await zip.file('xl/charts/chart1-1.xml').async('string');
  for(const part of ['<c:trendlineType val="linear"/>','<c:dispRSqr val="1"/>','<c:dispEq val="1"/>'])
   if(!xml.includes(part))throw Error('Missing trendline XML '+part);
  if((xml.match(/<c:trendline>/g)||[]).length!==2)throw Error('Expected 2 native trendlines');
  const report={},again=await importXLSX(bytes,'Регрессия.xlsx',report);
  const chart=again.sheets[0].charts[0],o=chartOptions(chart);
  if(report.importedCharts!==1||chart.type!=='scatter'||!o.trendline||!o.trendEquation||!o.trendR2)
   throw Error('Trendline roundtrip lost '+JSON.stringify({report,o}));
  const points=chartData(again,again.sheets[0],chart);
  if(Math.abs(linearRegression(points.series[0].points).slope-2)<0.1)throw Error('Latest values not retained');
  const againBytes=await exportXLSX(again);
  const againZip=await JSZip.loadAsync(againBytes);
  if(!(await againZip.file('xl/charts/chart1-1.xml').async('string')).includes('<c:trendline>'))
   throw Error('Second XLSX export lost regression');
  zip.file('xl/charts/chart1-1.xml',xml.replace('trendlineType val="linear"','trendlineType val="poly"'));
  const unsupported=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),warn={};
  const skipped=await importXLSX(unsupported,'Polynomial.xlsx',warn);
  if(warn.skippedCharts!==1||skipped.sheets[0].charts.length!==0)
   throw Error('Unsupported trendline was silently converted '+JSON.stringify(warn));
  return report;
 }""")
 assert roundtrip['importedCharts']==1
 page.locator('#chart-trendline').uncheck()
 assert page.locator('#grid-charts-layer svg .qo-xy-trendline').count()==0
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert page.evaluate('sheet().charts[0].options.trendline') is True
 assert page.locator('#grid-charts-layer svg .qo-xy-trendline').count()==2
 page.locator('#chart-panel [data-action=chart-type][data-type=bar]').click()
 assert page.evaluate('sheet().charts[0].options.trendline') is False
 assert page.locator('#chart-trendline').count()==0
 assert not errors,errors
 browser.close()
 print('PASS TASK064: OLS, R2, SVG trend lines, undo, QBOOK and native Excel roundtrip')
