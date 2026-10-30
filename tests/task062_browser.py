"""TASK062 Chromium: stacked/percent column charts, UI switch, formula links and XLSX roundtrips."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1560,'height':950},accept_downloads=True)
 page.set_default_timeout(25000);errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
  for(const [ref,value] of Object.entries({
   A1:'Квартал',B1:'2024',C1:'2025',D1:'2026',
   A2:'Первый',B2:'20',C2:'30',D2:'50',
   A3:'Второй',B3:'10',C3:'=B3*3',D3:'60',
   A4:'Третий',B4:'40',C4:'20',D4:'40'
  }))setCell(sheet(),ref,value);
  changed();
 }""")
 page.locator('#name-box').fill('A1:D4');page.locator('#name-box').press('Enter')
 page.get_by_role('tab',name='Вставка').click()
 page.locator('[data-action=chart-stacked]').click()
 assert page.evaluate('sheet().charts[0].type')=='stacked'
 assert page.locator('#grid-charts-layer svg rect').count()>=9
 assert page.locator('#chart-panel [data-action=chart-type][data-type=stacked100]').count()==1
 page.locator('#chart-panel [data-action=chart-type][data-type=stacked100]').click()
 assert page.evaluate('sheet().charts[0].type')=='stacked100'
 assert page.locator('#chart-axis-min').count()==0
 assert '100%' in page.locator('#grid-charts-layer svg').text_content()
 assert page.locator('#grid-charts-layer svg rect').count()>=9
 # Source changes still recalculate the percentages and keep Excel refs live.
 page.evaluate("setCell(sheet(),'D2','70');changed()")
 assert page.evaluate('chartData(book(),sheet(),sheet().charts[0]).series[2].points[0].value')==70
 # Negative values in 100% mode must never silently be treated as positive.
 page.evaluate("setCell(sheet(),'C3','-5');changed()")
 assert '100% с накоплением' in page.locator('.qo-sheet-chart .chart-error').inner_text()
 page.evaluate("setCell(sheet(),'C3','=B3*3');changed()")
 assert page.locator('#grid-charts-layer svg').count()==1
 # Excel export, imported type, raw series and QBOOK durability.
 result=page.evaluate("""async()=>{
  const bookBefore=JSON.stringify(book()),c=sheet().charts[0];
  const saved=decodeBook(encodeBook(book()));
  if(saved.sheets[0].charts[0].type!=='stacked100')throw Error('QBOOK lost chart type');
  const xlsx=await exportXLSX(book());
  if(JSON.stringify(book())!==bookBefore)throw Error('Export mutated workbook');
  const zip=await JSZip.loadAsync(xlsx,{checkCRC32:true});
  const xml=await zip.file('xl/charts/chart1-1.xml').async('string');
  for(const needle of ['<c:grouping val="percentStacked"/>','<c:overlap val="100"/>',
    '<c:numFmt formatCode="0%" sourceLinked="0"/>']){
   if(!xml.includes(needle))throw Error('Missing native percent chart tag '+needle);
  }
  if((xml.match(/<c:ser>/g)||[]).length!==3)throw Error('Wrong series count');
  const report={},restored=await importXLSX(xlsx,'Проценты.xlsx',report),got=restored.sheets[0].charts[0];
  if(got?.type!=='stacked100'||report.importedCharts!==1||report.skippedCharts!==0)
   throw Error('XLSX lost stacked type '+JSON.stringify({got,report}));
  const points=chartData(restored,restored.sheets[0],got);
  if(points.series[2].points[0].value!==70)throw Error('XLSX source values changed');
  setCell(restored.sheets[0],'D2','110');
  if(chartData(restored,restored.sheets[0],got).series[2].points[0].value!==110)
   throw Error('Imported chart is no longer live');
  const again=await exportXLSX(restored),z2=await JSZip.loadAsync(again),xml2=await z2.file('xl/charts/chart1-1.xml').async('string');
  if(!xml2.includes('percentStacked'))throw Error('Re-export lost stacked kind');
  // Mixed or unsupported chart variant must report skipped rather than relabeling.
  zip.file('xl/charts/chart1-1.xml',xml.replace('grouping val="percentStacked"','grouping val="standard"'));
  const hostile=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),warnings={};
  const unsupported=await importXLSX(hostile,'Unsupported.xlsx',warnings);
  if(warnings.skippedCharts!==1||unsupported.sheets[0].charts.length!==0)
   throw Error('Unsupported grouping was not reported '+JSON.stringify(warnings));
  return {report};
 }""")
 assert result['report']['importedCharts']==1,result
 # Switching types is undoable, including ordinary clustered mode.
 page.locator('#chart-panel [data-action=chart-type][data-type=bar]').click()
 assert page.evaluate('sheet().charts[0].type')=='bar'
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert page.evaluate('sheet().charts[0].type')=='stacked100'
 page.locator('#chart-panel [data-action=chart-type][data-type=stacked]').click()
 assert page.evaluate('sheet().charts[0].type')=='stacked'
 # A newly inserted 100%-stacked chart works from a wide selection too.
 page.locator('[data-action=chart-close]').click()
 page.locator('#name-box').fill('A1:D4');page.locator('#name-box').press('Enter')
 page.locator('[data-action=chart-stacked100]').click()
 assert page.evaluate('sheet().charts.at(-1).type')=='stacked100'
 assert page.evaluate('sheet().charts.at(-1).to')=='D4'
 assert not errors,errors
 browser.close()
 print('PASS TASK062: grouped/stacked/percent type UI, percent axis, negative guard and native XLSX roundtrip')
