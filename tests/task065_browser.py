"""TASK065 Chromium: polynomial XY trend, per-series R² comparison and XLSX poly2 roundtrip."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':1000},accept_downloads=True)
 page.set_default_timeout(25000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
  for(const [ref,value] of Object.entries({
   A1:'X',B1:'Парабола',C1:'Линия',
   A2:'-2',B2:'9',C2:'-3',A3:'-1',B3:'2',C3:'-1',
   A4:'0',B4:'1',C4:'1',A5:'1',B5:'6',C5:'3',
   A6:'2',B6:'17',C6:'=C5+2'
  }))setCell(sheet(),ref,value);
  changed();
 }""")
 page.locator('#name-box').fill('A1:C6')
 page.locator('#name-box').press('Enter')
 page.get_by_role('tab',name='Вставка').click()
 page.locator('[data-action=chart-scatter]').click()
 assert page.locator('#chart-trend-type').count()==1
 assert page.locator('#chart-trend-type').input_value()=='linear'
 page.locator('#chart-trendline').check()
 assert page.locator('#grid-charts-layer svg line.qo-xy-trendline').count()==2
 page.locator('#chart-trend-type').select_option('quadratic')
 assert page.evaluate('sheet().charts[0].options.trendType')=='quadratic'
 assert page.locator('#grid-charts-layer svg path.qo-xy-quadratic').count()==2
 assert page.locator('#grid-charts-layer svg line.qo-xy-trendline').count()==0
 page.locator('#chart-trend-equation').check()
 page.locator('#chart-trend-r2').check()
 assert 'x²' in page.locator('.chart-regression-results').inner_text()
 stats=page.locator('.chart-regression-results').inner_text()
 assert 'R² линейный' in stats and 'R² квадратичный' in stats and 'ΔR²' in stats,stats
 fit=page.evaluate("quadraticRegression(chartData(book(),sheet(),sheet().charts[0]).series[0].points)")
 for key,value in [('a',3),('b',2),('c',1),('r2',1)]:
  assert abs(fit[key]-value)<1e-8,(key,fit)
 assert page.locator('#grid-charts-layer svg path.qo-xy-quadratic').count()==2
 report=page.evaluate("""async()=>{
  const before=JSON.stringify(book()),b=book(),chart=sheet().charts[0];
  const saved=decodeBook(encodeBook(b));
  if(saved.sheets[0].charts[0].options.trendType!=='quadratic')throw Error('QBOOK poly2 lost');
  const bytes=await exportXLSX(b);
  if(JSON.stringify(book())!==before)throw Error('Excel export mutated source');
  const zip=await JSZip.loadAsync(bytes,{checkCRC32:true}),xml=await zip.file('xl/charts/chart1-1.xml').async('string');
  if((xml.match(/<c:trendlineType val="poly"\\/>/g)||[]).length!==2)throw Error('Missing poly OOXML');
  if((xml.match(/<c:order val="2"\\/>/g)||[]).length!==2)throw Error('Missing order 2');
  const changes={},restored=await importXLSX(bytes,'Полиномы.xlsx',changes);
  const target=restored.sheets[0].charts[0],opts=chartOptions(target);
  if(changes.importedCharts!==1||target.type!=='scatter'||opts.trendType!=='quadratic'||
     !opts.trendline||!opts.trendEquation||!opts.trendR2)
   throw Error('Poly2 XLSX roundtrip lost '+JSON.stringify({changes,opts}));
  const vals=chartData(restored,restored.sheets[0],target),
   fit2=quadraticRegression(vals.series[0].points);
  if(Math.abs(fit2.a-3)>1e-8||fit2.r2<.99999)throw Error('Imported fit mismatch');
  const replay=await exportXLSX(restored),z2=await JSZip.loadAsync(replay),x2=await z2.file('xl/charts/chart1-1.xml').async('string');
  if(!x2.includes('<c:order val="2"/>'))throw Error('Second export lost polynomial degree');
  zip.file('xl/charts/chart1-1.xml',xml.replaceAll('<c:order val="2"/>','<c:order val="3"/>'));
  const bad=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),warnings={};
  const skipped=await importXLSX(bad,'Unsupported.xlsx',warnings);
  if(warnings.skippedCharts!==1||skipped.sheets[0].charts.length!==0)
   throw Error('Unsupported poly3 silently converted '+JSON.stringify(warnings));
  return {changes,opts};
 }""")
 assert report['changes']['importedCharts']==1
 page.evaluate("setCell(sheet(),'B6','18');changed()")
 altered=page.evaluate("quadraticRegression(chartData(book(),sheet(),sheet().charts[0]).series[0].points).r2")
 assert altered<1 and altered>.95,altered
 page.locator('#chart-trend-type').select_option('linear')
 assert page.locator('#grid-charts-layer svg line.qo-xy-trendline').count()==2
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert page.evaluate("sheet().charts[0].options.trendType")=='quadratic'
 assert page.locator('#grid-charts-layer svg path.qo-xy-quadratic').count()==2
 page.locator('#chart-panel [data-action=chart-type][data-type=bar]').click()
 assert page.locator('#chart-trend-type').count()==0
 assert page.evaluate("sheet().charts[0].options.trendType")=='linear'
 assert not errors,errors
 browser.close()
 print('PASS TASK065: curved polynomial, R² comparison, live recompute, Undo, QBOOK and Excel poly2 roundtrip')
