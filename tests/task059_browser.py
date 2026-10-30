"""TASK059 real browser: visible sheet chart, mouse move/resize, undo, QBOOK, XLSX anchors."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':960},accept_downloads=True)
 page.set_default_timeout(25000);errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 page.evaluate("""()=>{
  for(const [ref,v] of Object.entries({A1:'Регион',B1:'Доход',A2:'Север',B2:'20',A3:'Юг',B3:'36',A4:'Восток',B4:'12'}))
   setCell(sheet(),ref,v);
  changed();
 }""")
 page.get_by_role('tab',name='Вставка').click()
 page.get_by_role('button',name='Столбчатая диаграмма').click()
 assert page.locator('#grid-charts-layer .qo-sheet-chart').count()==1
 assert page.locator('#grid-charts-layer svg rect').count()>0
 original=page.evaluate("({layout:{...sheet().charts[0].layout},id:sheet().charts[0].id})")
 assert original['layout']['y']>=40
 bar=page.locator('.qo-chart-move').bounding_box()
 assert bar, 'chart drag handle is not visible'
 start_x=bar['x']+min(90,bar['width']/2);start_y=bar['y']+bar['height']/2
 page.mouse.move(start_x,start_y);page.mouse.down()
 page.mouse.move(start_x+72,start_y+43,steps=7)
 page.mouse.up()
 moved=page.evaluate('({...sheet().charts[0].layout})')
 assert moved['x']==original['layout']['x']+72,(original,moved)
 assert moved['y']==original['layout']['y']+43,(original,moved)
 rect=page.locator('.qo-chart-resize').bounding_box()
 assert rect, 'chart resize handle missing'
 rx,ry=rect['x']+rect['width']/2,rect['y']+rect['height']/2
 page.mouse.move(rx,ry);page.mouse.down()
 page.mouse.move(rx+82,ry+56,steps=7)
 page.mouse.up()
 resized=page.evaluate('({...sheet().charts[0].layout})')
 assert resized['width']==moved['width']+82,(moved,resized)
 assert resized['height']==moved['height']+56,(moved,resized)
 # Undo is a normal atomic workbook transaction, no intermediate per-pixel history.
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+z')
 assert page.evaluate('sheet().charts[0].layout.width')==moved['width']
 assert page.evaluate('sheet().charts[0].layout.height')==moved['height']
 page.locator('#grid-scroll').focus()
 page.keyboard.press('Control+y')
 assert page.evaluate('sheet().charts[0].layout.width')==resized['width']
 # Chart settings must still be accessible from the sheet object.
 page.locator('.qo-sheet-chart [data-action=chart-open]').click()
 assert page.locator('#chart-panel #chart-range').count()==1
 page.locator('#chart-panel [data-action=chart-type][data-type=line]').click()
 assert page.locator('#grid-charts-layer svg polyline').count()==1
 # Chart data edits are reflected in the sheet overlay, not just the sidebar.
 page.evaluate("setCell(sheet(),'B2','65');changed()")
 assert page.evaluate("chartData(book(),sheet(),sheet().charts[0]).points[0].value")==65
 assert page.locator('#grid-charts-layer svg polyline').count()==1
 # Persisted pixels survive both QBOOK and Excel exchange.
 result=page.evaluate("""async()=>{
  const c=sheet().charts[0],position={...c.layout};
  const stored=decodeBook(encodeBook(book()));
  if(JSON.stringify(stored.sheets[0].charts[0].layout)!==JSON.stringify(position))
   throw Error('QBOOK lost chart position');
  const bytes=await exportXLSX(book()),zip=await JSZip.loadAsync(bytes);
  const drawing=await zip.file('xl/drawings/drawing1.xml').async('string');
  if(!drawing.includes('<xdr:colOff>')||!drawing.includes('<xdr:rowOff>'))
   throw Error('XLSX drawing does not preserve subcell offsets');
  const report={},loaded=await importXLSX(bytes,'Проверка.xlsx',report);
  const other=loaded.sheets[0].charts[0];
  if(!other||report.importedCharts!==1||other.type!=='line'||!other.layout)
   throw Error('Imported chart or its layout missing: '+JSON.stringify({other,report}));
  for(const key of ['x','y','width','height'])
   if(Math.abs(other.layout[key]-position[key])>2)
    throw Error('XLSX drawing drift '+key+' '+JSON.stringify({position,loaded:other.layout}));
  return {position,other:other.layout,report};
 }""")
 assert result['report']['importedCharts']==1,result
 # Scrolling should move chart with the sheet, retaining its position in sheet coordinates.
 page.locator('[data-action=chart-close]').click()
 left_before=page.evaluate("sheet().charts[0].layout.x")
 page.locator('#grid-scroll').evaluate('(el)=>{el.scrollLeft=110;el.scrollTop=40;el.dispatchEvent(new Event("scroll"));}')
 assert page.evaluate("sheet().charts[0].layout.x")==left_before
 assert page.locator('#grid-charts-layer .qo-sheet-chart').count()==1
 assert not errors,errors
 browser.close()
 print('PASS TASK059: in-sheet chart, mouse move/resize, Undo/Redo, live values and XLSX layout roundtrip')
