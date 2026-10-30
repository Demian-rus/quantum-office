"""TASK060 Chromium: real chart from A1:D4, multi-line comparison, XLSX roundtrip."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1550,'height':930},accept_downloads=True)
 page.set_default_timeout(25000);errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
  const rows={
   A1:'Период',B1:'План',C1:'Факт',D1:'2025',
   A2:'Январь',B2:'10',C2:'14',D2:'7',
   A3:'Февраль',B3:'12',C3:'=C2+3',D3:'8',
   A4:'Март',B4:'18',C4:'20',D4:'11'
  };
  for(const [ref,value] of Object.entries(rows))setCell(sheet(),ref,value);
  changed();
 }""")
 name=page.locator('#name-box');name.fill('A1:D4');name.press('Enter')
 page.get_by_role('tab',name='Вставка').click()
 page.get_by_role('button',name='Столбчатая диаграмма').click()
 assert page.evaluate('sheet().charts[0].from+":"+sheet().charts[0].to')=='A1:D4'
 assert page.locator('#grid-charts-layer .qo-sheet-chart').count()==1
 assert 'Факт' in page.locator('#chart-preview').inner_text()
 assert page.evaluate('chartData(book(),sheet(),sheet().charts[0]).series.length')==3
 assert page.locator('#grid-charts-layer svg rect').count()>=12
 page.locator('#chart-panel [data-action=chart-type][data-type=line]').click()
 assert page.locator('#grid-charts-layer svg polyline').count()==3
 page.evaluate("setCell(sheet(),'C4','53');changed()")
 assert page.evaluate('chartData(book(),sheet(),sheet().charts[0]).series[1].points[2].value')==53
 assert page.locator('#grid-charts-layer svg polyline').count()==3
 # Change to another 2-series source via the side panel.
 page.locator('#chart-range').fill('A1:C4')
 page.locator('[data-action=chart-source]').click()
 assert page.evaluate('chartData(book(),sheet(),sheet().charts[0]).series.length')==2
 assert page.locator('#grid-charts-layer svg polyline').count()==2
 page.locator('#chart-range').fill('A1:D4')
 page.locator('[data-action=chart-source]').click()
 assert page.evaluate('sheet().charts[0].to')=='D4'
 # Multi-series cannot be silently converted into a pie.
 page.locator('#chart-panel [data-action=chart-type][data-type=pie]').click()
 assert page.evaluate('sheet().charts[0].type')=='line'
 payload=page.evaluate("""async()=>{
  const b=book(),s=sheet(),before=JSON.stringify(b),qbook=decodeBook(encodeBook(b));
  if(qbook.sheets[0].charts[0].to!=='D4')throw Error('QBOOK lost source range');
  const bytes=await exportXLSX(b);
  if(JSON.stringify(b)!==before)throw Error('XLSX export mutated source');
  const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
  const chart=await zip.file('xl/charts/chart1-1.xml').async('string');
  if((chart.match(/<c:ser>/g)||[]).length!==3)throw Error('Excel chart missing series');
  const report={},restored=await importXLSX(bytes,'Сравнение.xlsx',report);
  const c=restored.sheets[0].charts[0];
  if(report.importedCharts!==1||report.skippedCharts!==0||c.from!=='A1'||c.to!=='D4')
   throw Error('Importer did not restore multi-series '+JSON.stringify({c,report}));
  const values=chartData(restored,restored.sheets[0],c).series.map(x=>x.points[2].value);
  if(values.join(',')!=='18,53,11')throw Error('Imported data sources differ '+values);
  setCell(restored.sheets[0],'D3','99');
  if(chartData(restored,restored.sheets[0],c).series[2].points[1].value!==99)
   throw Error('Third series not linked to cells');
  const again=await exportXLSX(restored),zipAgain=await JSZip.loadAsync(again);
  const xmlAgain=await zipAgain.file('xl/charts/chart1-1.xml').async('string');
  if((xmlAgain.match(/<c:ser>/g)||[]).length!==3)throw Error('Re-export lost series');
  // Unsupported disjoint data references must be skipped, not imported as misleading chart.
  zip.file('xl/charts/chart1-1.xml',chart.replace(/\\$D\\$2:\\$D\\$4/g,'$F$2:$F$4'));
  const invalid=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),warn={};
  const partial=await importXLSX(invalid,'Чужие данные.xlsx',warn);
  if(warn.skippedCharts!==1||partial.sheets[0].charts.length!==0)
   throw Error('Unsupported disjoint series was accepted '+JSON.stringify(warn));
  return {report,size:bytes.length,series:values};
 }""")
 assert payload['series']==[18,53,11],payload
 # Selecting a wide range for pie must use only category + one numeric column.
 page.locator('#chart-panel [data-action=chart-close]').click()
 name=page.locator('#name-box');name.fill('A1:D4');name.press('Enter')
 page.get_by_role('button',name='Круговая диаграмма').click()
 assert page.evaluate('sheet().charts.at(-1).type')=='pie'
 assert page.evaluate('sheet().charts.at(-1).from+":"+sheet().charts.at(-1).to')=='A1:B4'
 assert not errors,errors
 browser.close()
 print('PASS TASK060: 3-series grouped/line charts, editable data, live formulas, multi-series OOXML and pie isolation')
