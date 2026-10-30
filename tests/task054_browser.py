"""TASK054 Chromium: OOXML list/decimal validation import-export roundtrip."""
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
 outcome=page.evaluate("""async()=>{
  const s=sheet(),b=book();
  setCell(s,'A1','Статус');setCell(s,'B2','Готово');
  addDataRule(s,'B2','B4','list','Готово;В работе;Нет & да');
  addDataRule(s,'D2','D4','number','-2.5;50.5');
  const bytes=await exportXLSX(b),zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
  const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
  if(!xml.includes('<dataValidations count="2">')||
    !xml.includes('type="list"')||!xml.includes('type="decimal"')||
    !xml.includes('&amp;'))throw Error('XLSX XML missing validation rules');
  const report={},restored=await importXLSX(bytes,'Проверка.xlsx',report);
  const rules=restored.sheets[0].validations;
  if(rules.length!==2||rules[0].kind!=='list'||rules[1].kind!=='number'||
     rules[0].options[2]!=='Нет & да'||rules[1].min!==-2.5||rules[1].max!==50.5||
     report.importedDataValidations!==2||report.skippedDataValidations!==0)
    throw Error('XLSX validation roundtrip lost rules: '+JSON.stringify({rules,report}));
  try{setCell(restored.sheets[0],'B2','Неизвестно');throw Error('rule bypassed');}
  catch(err){if(!err.message.includes('Выберите вариант'))throw err;}
  try{setCell(restored.sheets[0],'D2','99');throw Error('range bypassed');}
  catch(err){if(!err.message.includes('разрешены числа'))throw err;}
  const copied=await exportXLSX(restored);
  const zip2=await JSZip.loadAsync(copied);
  const xml2=await zip2.file('xl/worksheets/sheet1.xml').async('string');
  if(!xml2.includes('<dataValidations count="2">'))throw Error('second export missing validations');
  const unsupported='<dataValidation type="whole" operator="between" sqref="F1:F3"><formula1>1</formula1><formula2>3</formula2></dataValidation>';
  zip.file('xl/worksheets/sheet1.xml',xml.replace('<dataValidations count="2">','<dataValidations count="3">'+unsupported));
  const dirty=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),summary={};
  const partial=await importXLSX(dirty,'Foreign.xlsx',summary);
  if(summary.skippedDataValidations!==1||partial.sheets[0].validations.length!==2)
    throw Error('Unsupported Excel validation not reported');
  return {size:bytes.length,types:rules.map(r=>r.kind),report,unsupported:summary};
 }""")
 assert outcome['types']==['list','number'],outcome
 assert outcome['unsupported']['skippedDataValidations']==1
 assert not errors,errors
 browser.close()
 print('PASS TASK054: XLSX OOXML list & numeric roundtrip, active constraints, unsupported warning and re-export')
