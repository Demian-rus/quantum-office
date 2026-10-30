"""TASK063 Chromium: true XY scatter, non-uniform X positions, live formulas, Excel roundtrip."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1560,'height':1000},accept_downloads=True)
 page.set_default_timeout(25000);errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
  for(const [ref,value] of Object.entries({
   A1:'Время',B1:'Сила',C1:'Ускорение',
   A2:'-5',B2:'3',C2:'6',
   A3:'1',B3:'8',C3:'=B3*2',
   A4:'13',B4:'20',C4:'10',
   A5:'1',B5:'13',C5:'7'
  }))setCell(sheet(),ref,value);
  changed();
 }""")
 name=page.locator('#name-box');name.fill('A1:C5');name.press('Enter')
 page.get_by_role('tab',name='Вставка').click()
 page.locator('[data-action=chart-scatter]').click()
 assert page.evaluate('sheet().charts[0].type')=='scatter'
 assert page.locator('#grid-charts-layer svg .qo-scatter-point').count()==8
 assert page.locator('#grid-charts-layer svg polyline').count()==0
 # Numeric XY spacing, not categorical indices: X values -5, 1 and 13 give gaps 6 and 12.
 xs=page.locator('#grid-charts-layer svg .qo-scatter-point').evaluate_all(
  "(elements)=>elements.slice(0,4).map(el=>Number(el.getAttribute('cx')))")
 assert xs[0]<xs[1]<xs[2] and abs(xs[1]-xs[3])<0.001,xs
 assert abs((xs[2]-xs[1])/(xs[1]-xs[0])-2)<0.01,xs
 page.locator('#chart-labels').check()
 page.locator('#chart-legend').select_option('right')
 page.locator('#chart-axis-min').fill('-10')
 page.locator('#chart-axis-max').fill('40')
 page.locator('[data-action=chart-axis-save]').click()
 page.locator('[data-chart-color="0"]').fill('#aa2244')
 page.locator('[data-chart-color="1"]').fill('#3366cc')
 assert page.locator('#grid-charts-layer svg .qo-scatter-point[fill="#aa2244"]').count()==4
 assert page.locator('#grid-charts-layer svg .qo-scatter-point[fill="#3366cc"]').count()==4
 page.evaluate("setCell(sheet(),'A4','25');setCell(sheet(),'C3','=B3*3');changed()")
 assert page.evaluate('chartData(book(),sheet(),sheet().charts[0]).series[0].points[2].x')==25
 assert page.evaluate('chartData(book(),sheet(),sheet().charts[0]).series[1].points[1].value')==24
 result=page.evaluate("""async()=>{
  const b=book(),before=JSON.stringify(b),c=sheet().charts[0];
  const local=decodeBook(encodeBook(b));
  if(local.sheets[0].charts[0].type!=='scatter')throw Error('QBOOK lost XY type');
  const bytes=await exportXLSX(b);
  if(JSON.stringify(b)!==before)throw Error('Exporter changed workbook');
  const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
  const xml=await zip.file('xl/charts/chart1-1.xml').async('string');
  for(const fragment of ['<c:scatterStyle val="marker"/>','<c:xVal>','<c:yVal>',
    '<c:min val="-10"/>','<c:max val="40"/>','<a:srgbClr val="AA2244"/>',
    '<a:srgbClr val="3366CC"/>']){
   if(!xml.includes(fragment))throw Error('Missing scatter OOXML '+fragment);
  }
  if((xml.match(/<c:valAx>/g)||[]).length!==2)throw Error('XY needs two numeric axes');
  if((xml.match(/<c:xVal>/g)||[]).length!==2)throw Error('XY needs X refs for all series');
  const report={},again=await importXLSX(bytes,'Измерения.xlsx',report),ac=again.sheets[0].charts[0];
  if(report.importedCharts!==1||report.skippedCharts!==0||ac?.type!=='scatter')
   throw Error('Scatter not imported '+JSON.stringify({ac,report}));
  if(ac.from!=='A1'||ac.to!=='C5')throw Error('Wrong chart source '+ac.from+':'+ac.to);
  const points=chartData(again,again.sheets[0],ac);
  if(points.series[0].points[2].x!==25||points.series[1].points[1].value!==24)
   throw Error('Imported numeric data changed');
  const opts=chartOptions(ac);
  if(opts.legend!=='right'||opts.min!==-10||opts.max!==40||
    opts.colors[0]!=='#aa2244'||opts.colors[1]!=='#3366cc')
   throw Error('Imported XY formatting changed '+JSON.stringify(opts));
  setCell(again.sheets[0],'A4','51');
  if(chartData(again,again.sheets[0],ac).series[0].points[2].x!==51)
   throw Error('Imported XY does not track numeric X cells');
  const round=await exportXLSX(again),z2=await JSZip.loadAsync(round);
  const chart2=await z2.file('xl/charts/chart1-1.xml').async('string');
  if(!chart2.includes('<c:scatterChart>'))throw Error('Re-export changed type');
  zip.file('xl/charts/chart1-1.xml',xml.replace('scatterStyle val="marker"','scatterStyle val="line"'));
  const invalid=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),warn={};
  const skipped=await importXLSX(invalid,'Unsupported.xlsx',warn);
  if(warn.skippedCharts!==1||skipped.sheets[0].charts.length!==0)
   throw Error('Unsupported XY line wrongly imported '+JSON.stringify(warn));
  return {report,opts};
 }""")
 assert result['report']['importedCharts']==1,result
 # Invalid X must show a visible error, never draw a fake category.
 page.evaluate("setCell(sheet(),'A3','unknown');changed()")
 assert 'числа по обеим осям' in page.locator('.qo-sheet-chart .chart-error').inner_text()
 page.evaluate("setCell(sheet(),'A3','1');changed()")
 assert page.locator('#grid-charts-layer svg .qo-scatter-point').count()==8
 page.locator('#chart-panel [data-action=chart-type][data-type=line]').click()
 assert page.evaluate('sheet().charts[0].type')=='line'
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert page.evaluate('sheet().charts[0].type')=='scatter'
 assert not errors,errors
 browser.close()
 print('PASS TASK063: true XY spacing, editable X and Y formulas, legend/colors, QBOOK and XLSX roundtrip')
