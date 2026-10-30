"""TASK058 Chromium: real OOXML round-trip for paper setup, sheet-scoped print areas and warnings."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':900},accept_downloads=True)
 page.set_default_timeout(25000)
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 result=page.evaluate("""async()=>{
  const b=book(),first=sheet();
  first.name="План O'Brien";
  setCell(first,'B3','Заголовок');setCell(first,'H22','Последняя ячейка');
  changePrintSettings(first,{paper:'Letter',orientation:'landscape',scale:75,fitWidth:false,area:{from:'B3',to:'H22'}});
  const second=newSheet('Лист 2');b.sheets.push(second);
  setCell(second,'A1','Тест');
  changePrintSettings(second,{paper:'A4',orientation:'portrait',scale:90,fitWidth:true,area:{from:'A1',to:'D15'}});
  const original=JSON.stringify(b),encoded=await exportXLSX(b);
  if(JSON.stringify(b)!==original)throw Error('Print export mutated original workbook');
  const zip=await JSZip.loadAsync(encoded,{checkCRC32:true});
  const one=await zip.file('xl/worksheets/sheet1.xml').async('string');
  const two=await zip.file('xl/worksheets/sheet2.xml').async('string');
  const workbookXml=await zip.file('xl/workbook.xml').async('string');
  if(!one.includes('<pageSetup paperSize="1" orientation="landscape" scale="75" fitToWidth="0" fitToHeight="0"/>')||
     !one.includes('<pageSetUpPr fitToPage="0"/>')||
     !two.includes('<pageSetup paperSize="9" orientation="portrait" scale="90" fitToWidth="1" fitToHeight="0"/>')||
     !two.includes('<pageSetUpPr fitToPage="1"/>')||
     !workbookXml.includes('localSheetId="0"')||
     !workbookXml.includes('localSheetId="1"')||
     !workbookXml.includes('O&apos;&apos;Brien&apos;!$B$3:$H$22')||
     !workbookXml.includes('&apos;Лист 2&apos;!$A$1:$D$15'))
    throw Error('Invalid print OOXML package');
  const counts={},other=await importXLSX(encoded,'Печать.xlsx',counts);
  const f=other.sheets[0].printSettings,sec=other.sheets[1].printSettings;
  if(f.paper!=='Letter'||f.orientation!=='landscape'||f.scale!==75||f.fitWidth!==false||
     f.area.from!=='B3'||f.area.to!=='H22'||sec.paper!=='A4'||sec.scale!==90||
     sec.fitWidth!==true||sec.area.from!=='A1'||sec.area.to!=='D15'||
     counts.importedPrintSettings!==10||counts.skippedPrintSettings!==0)
    throw Error('Print roundtrip differs: '+JSON.stringify({f,sec,counts}));
  const saved=decodeBook(encodeBook(other));
  if(saved.sheets[0].printSettings.area.from!=='B3')throw Error('QBOOK lost imported print area');
  // Unrepresentable paper size & discontiguous area must not silently masquerade as preserved.
  zip.file('xl/worksheets/sheet1.xml',one.replace('paperSize="1"','paperSize="8"'));
  zip.file('xl/workbook.xml',workbookXml.replace('$B$3:$H$22','$B$3:$H$22,$J$1:$K$4'));
  const damaged=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
  const warnings={};
  const partial=await importXLSX(damaged,'Неподдерживаемые параметры.xlsx',warnings);
  if(warnings.skippedPrintSettings!==2||warnings.importedPrintSettings!==8||
     partial.sheets[0].printSettings.area!==null||partial.sheets[0].printSettings.paper!=='A4'||
     partial.sheets[0].printSettings.orientation!=='landscape')
    throw Error('Unsupported print properties were not reported: '+JSON.stringify({warnings,partial:partial.sheets[0].printSettings}));
  const repeated=await exportXLSX(other),twice=await JSZip.loadAsync(repeated);
  if(!(await twice.file('xl/workbook.xml').async('string')).includes('_xlnm.Print_Area'))
   throw Error('Print area disappeared on re-export');
  return {counts,warnings,size:encoded.byteLength,area:f.area,second:sec.area};
 }""")
 assert result['counts']['importedPrintSettings']==10,result
 assert result['warnings']['skippedPrintSettings']==2,result
 # UI print preview must honor data imported from the same model.
 page.evaluate("""()=>{
  const b=book(),s=sheet();
  changePrintSettings(s,{paper:'Letter',orientation:'landscape',scale:75,fitWidth:false,area:{from:'B3',to:'H22'}});
  setCell(s,'B3','Отчёт');setCell(s,'H22','Финал');
 }""")
 page.get_by_role('tab',name='Файл').click()
 page.get_by_role('button',name='Предпросмотр и печать').click()
 assert page.locator('#print-paper').input_value()=='Letter'
 assert page.locator('#print-orientation').input_value()=='landscape'
 assert page.locator('#print-scale').input_value()=='75'
 assert page.locator('#print-view').count()==1
 assert not errors,errors
 browser.close()
 print('PASS TASK058: 2-sheet print area/setup XLSX ↔ QBOOK, unsupported warnings and live print preview')
