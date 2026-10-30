"""TASK056 real Chromium: 3 chart types, editable OOXML parts, source references and partial import."""
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
 result=page.evaluate("""async()=>{
  const b=book(),s=sheet();
  for(const [k,v] of Object.entries({
    A1:'Регион',B1:'План',A2:'Север',B2:'10',A3:'Юг',B3:'20',A4:'Восток',B4:'=B2+B3'
  }))setCell(s,k,v);
  for(const type of ['bar','line','pie']){
   const chart=addChart(b,s,type,'A1','B4');
   chart.title='Тест & диаграмма '+type;
  }
  const old=JSON.stringify(b);
  const xlsx=await exportXLSX(b);
  if(JSON.stringify(b)!==old)throw Error('Export unexpectedly mutated workbook');
  const zip=await JSZip.loadAsync(xlsx,{checkCRC32:true});
  const paths=['xl/charts/chart1-1.xml','xl/charts/chart1-2.xml','xl/charts/chart1-3.xml',
    'xl/drawings/drawing1.xml','xl/drawings/_rels/drawing1.xml.rels',
    'xl/worksheets/_rels/sheet1.xml.rels'];
  if(paths.some(path=>!zip.file(path)))throw Error('Missing chart OOXML parts');
  const sheetXml=await zip.file('xl/worksheets/sheet1.xml').async('string');
  const typeXml=await zip.file('[Content_Types].xml').async('string');
  const chart1=await zip.file('xl/charts/chart1-1.xml').async('string');
  if(!sheetXml.includes('r:id="rIdDrawing"')||!typeXml.includes('drawingml.chart+xml')||
     !chart1.includes('<c:barChart>')||!chart1.includes('<c:numCache>')||
     !chart1.includes('<c:v>30</c:v>')||!chart1.includes('Тест &amp; диаграмма bar'))
    throw Error('Unexpected chart OOXML');
  const report={},restored=await importXLSX(xlsx,'Диаграммы.xlsx',report);
  const list=restored.sheets[0].charts;
  if(list.length!==3||list.some(x=>x.from!=='A1'||x.to!=='B4')||
     list.map(x=>x.type).join(',')!=='bar,line,pie'||
     list[0].title!=='Тест & диаграмма bar'||
     report.importedCharts!==3||report.skippedCharts!==0)
    throw Error('Chart importer mismatch: '+JSON.stringify({list,report}));
  setCell(restored.sheets[0],'B2','50');
  const latest=chartData(restored,restored.sheets[0],list[0]).points.map(x=>x.value);
  if(latest.join(',')!=='50,20,70')throw Error('Restored chart not linked to data: '+latest);
  const twice=await exportXLSX(restored);
  const again=await JSZip.loadAsync(twice);
  if(!again.file('xl/charts/chart1-3.xml'))throw Error('Chart disappeared after re-export');
  // Unsupported Excel horizontal chart should be counted, not relabeled as vertical.
  zip.file('xl/charts/chart1-1.xml',chart1.replace('barDir val="col"','barDir val="bar"'));
  const modified=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),warnings={};
  const partial=await importXLSX(modified,'Чужой график.xlsx',warnings);
  if(warnings.skippedCharts!==1||warnings.importedCharts!==2||partial.sheets[0].charts.length!==2)
    throw Error('Unsupported chart was not reported: '+JSON.stringify(warnings));
  return {size:xlsx.length,report,partial:warnings,kinds:list.map(c=>c.type),latest};
 }""")
 assert result['kinds']==['bar','line','pie'],result
 assert result['report']['importedCharts']==3,result
 assert result['partial']['skippedCharts']==1,result
 assert result['latest']==[50,20,70],result
 assert not errors,errors
 browser.close()
 print('PASS TASK056: XLSX bar/line/pie export-import, drawing parts, source links, unsupported-warning')
