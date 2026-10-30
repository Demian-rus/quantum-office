"""TASK055 Chromium: native conditional rules survive OOXML export/import, foreign rules warn."""
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
  const b=book(),s=sheet();
  for(const [ref,value] of Object.entries({A2:'10',A3:'20',A4:'30',B2:'16',C2:'срок',D2:'Есть ОШИБКА'}))setCell(s,ref,value);
  addConditionalRule(s,'B2','B4','gt','15','#ffdddd');
  addConditionalRule(s,'C2','C4','eq','срок','#00ddff');
  addConditionalRule(s,'D2','D4','contains','ошибка','#ffffaa');
  const scale=addConditionalRule(s,'A2','A4','scale');
  scale.lowColor='#112233';scale.highColor='#445566';
  const bytes=await exportXLSX(b),zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
  const xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
  const st=await zip.file('xl/styles.xml').async('string');
  if((xml.match(/<conditionalFormatting /g)||[]).length!==4||
     !xml.includes('type="colorScale"')||!xml.includes('type="containsText"')||
     !st.includes('<dxfs count="3">')||!st.includes('FF445566'))
    throw Error('XLSX rules or DXF missing');
  const report={},restored=await importXLSX(bytes,'Стили.xlsx',report);
  const rules=restored.sheets[0].conditionalRules;
  if(rules.length!==4||report.importedConditionalFormatting!==4||report.skippedConditionalFormatting!==0||
     rules[0].kind!=='gt'||rules[1].kind!=='eq'||rules[2].kind!=='contains'||rules[3].kind!=='scale'||
     rules[3].lowColor!=='#112233'||rules[3].highColor!=='#445566')
    throw Error('Conditional XLSX roundtrip mismatch: '+JSON.stringify({rules,report}));
  const styles=prepareConditionalScales(restored.sheets[0],rawMap(restored.sheets[0]),formulaContext(restored,restored.sheets[0],rawMap(restored.sheets[0])));
  if(conditionalFill(restored.sheets[0],'A2',10,styles)!=='#112233'||
     conditionalFill(restored.sheets[0],'A4',30,styles)!=='#445566'||
     conditionalFill(restored.sheets[0],'C2','СРОК')!=='#00ddff'||
     conditionalFill(restored.sheets[0],'D2','Ошибка')!=='#ffffaa')
    throw Error('Imported condition not rendered');
  const again=await exportXLSX(restored);
  const zip2=await JSZip.loadAsync(again);
  if(!(await zip2.file('xl/styles.xml').async('string')).includes('<dxfs count="3">'))
    throw Error('Second export lost DXFs');
  const foreign='<conditionalFormatting sqref="E1:E3"><cfRule type="iconSet" priority="1"><iconSet iconSet="3TrafficLights1"><cfvo type="percent" val="0"/><cfvo type="percent" val="33"/><cfvo type="percent" val="67"/></iconSet></cfRule></conditionalFormatting>';
  zip.file('xl/worksheets/sheet1.xml',xml.replace('</worksheet>',foreign+'</worksheet>'));
  const dirty=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}),summary={};
  const partial=await importXLSX(dirty,'Чужой.xlsx',summary);
  if(summary.skippedConditionalFormatting!==1||partial.sheets[0].conditionalRules.length!==4)
    throw Error('Unsupported Excel CF was not counted');
  return {size:bytes.length,report,unsupported:summary,kinds:rules.map(x=>x.kind)};
 }""")
 assert outcome['kinds']==['gt','eq','contains','scale'],outcome
 assert outcome['unsupported']['skippedConditionalFormatting']==1,outcome
 assert not errors,errors
 browser.close()
 print('PASS TASK055: XLSX conditional rules, color scale, DXFs, unsupported warning')
