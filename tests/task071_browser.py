"""TASK071: physical four-way fill, calendar values, edge scrolling and cancellation."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=which('chromium') or None, headless=True,
                                args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 1580, 'height': 960})
    page.set_default_timeout(20000)
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.set_content((root / 'dist/index.html').read_text(encoding='utf-8'), wait_until='load')
    page.locator('[data-action=new]').first.click()
    page.evaluate("""()=>{transact(()=>{
      for(const [r,v] of Object.entries({D6:'8',D7:'11',G8:'10',H8:'15',J9:'=I9+$B$1',
        B50:'100',B51:'102',R10:'20',S10:'23'}))setCell(sheet(),r,v);
      setTypedCell(sheet(),'F12','28.02.2024');
    });}""")

    def select(a, b=None):
        box = page.locator('#name-box')
        box.fill(a + (':' + b if b else ''))
        box.press('Enter')
        page.evaluate("r=>{const p=parseCell(r);ensureVisible(p.row,p.col);drawGrid();}", b or a)
        page.wait_for_function("!document.getElementById('grid-fill-handle').hidden")

    def start():
        h = page.locator('#grid-fill-handle').bounding_box()
        assert h
        page.mouse.move(h['x'] + h['width']/2, h['y'] + h['height']/2)
        page.mouse.down()
        assert page.evaluate("fillDrag!==null"), "Fill handle did not receive pointerdown"

    def drag(ref):
        target = page.locator('.grid-cell[data-ref="' + ref + '"]').first
        r = target.bounding_box()
        assert r
        start()
        page.mouse.move(r['x'] + r['width']/2, r['y'] + r['height']/2, steps=8)
        assert target.evaluate("e=>e.classList.contains('fill-preview')")
        page.mouse.up()

    select('D6', 'D7')
    drag('D3')
    assert page.evaluate("['D3','D4','D5'].map(r=>getCell(sheet(),r).value)") == ['-1', '2', '5']
    page.keyboard.press('Control+z')
    assert page.evaluate("getCell(sheet(),'D3').value") == ''
    page.keyboard.press('Control+y')
    assert page.evaluate("getCell(sheet(),'D3').value") == '-1'
    select('G8', 'H8')
    drag('E8')
    assert page.evaluate("getCell(sheet(),'E8').value") == '0'
    select('J9')
    drag('H9')
    assert page.evaluate("getCell(sheet(),'H9').value") == '=G9+$B$1'
    select('F12')
    drag('F15')
    assert page.locator('.grid-cell[data-ref=F13]').inner_text() == '29.02.2024'
    assert page.locator('.grid-cell[data-ref=F15]').inner_text() == '02.03.2024'

    # A stationary pointer past each viewport edge must keep scrolling and
    # keep preview on the recycled DOM, then commit the actual final target.
    def edge_drag(a, b, direction):
        select(a, b)
        view = page.locator('#grid-scroll')
        rect = view.bounding_box()
        dims = view.evaluate('e=>({w:e.clientWidth,h:e.clientHeight,x:e.scrollLeft,y:e.scrollTop})')
        start()
        coords = {
            'down': (rect['x']+190, rect['y']+dims['h']+22),
            'up': (rect['x']+190, rect['y']-22),
            'right': (rect['x']+dims['w']+22, rect['y']+200),
            'left': (rect['x']+30, rect['y']+200)
        }
        page.mouse.move(*coords[direction], steps=5)
        axis, sign = ('y', 1) if direction == 'down' else ('y', -1) if direction == 'up' else (
                     'x', 1) if direction == 'right' else ('x', -1)
        page.wait_for_function("""a=>{
          const v=document.getElementById('grid-scroll');
          return a.sign*((a.axis==='y'?v.scrollTop:v.scrollLeft)-a.old)>220;
        }""", arg={'axis': axis, 'sign': sign, 'old': dims[axis]})
        state = page.evaluate("""()=>({direction:fillDrag.direction,target:fillDrag.target,
          preview:document.querySelectorAll('.fill-preview').length})""")
        assert state['direction'] == direction, state
        assert state['preview'] > 0, state
        page.mouse.up()
        assert page.evaluate("fillDrag===null")
        scroll = view.evaluate('e=>[e.scrollLeft,e.scrollTop]')
        page.evaluate("()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
        assert view.evaluate('e=>[e.scrollLeft,e.scrollTop]') == scroll
        return state['target']

    target = edge_drag('B50', 'B51', 'up')
    assert page.evaluate('r=>getCell(sheet(),cellName(r,1)).value', target) == str(100+2*(target-49))
    page.keyboard.press('Control+z')
    assert page.evaluate('r=>getCell(sheet(),cellName(r,1)).value', target) == ''
    target = edge_drag('B50', 'B51', 'down')
    assert page.evaluate('r=>getCell(sheet(),cellName(r,1)).value', target) == str(100+2*(target-49))
    page.keyboard.press('Control+z')
    target = edge_drag('R10', 'S10', 'left')
    assert page.evaluate('c=>getCell(sheet(),cellName(9,c)).value', target) == str(20+3*(target-17))
    page.keyboard.press('Control+z')
    target = edge_drag('R10', 'S10', 'right')
    assert page.evaluate('c=>getCell(sheet(),cellName(9,c)).value', target) == str(20+3*(target-17))

    # Frozen geometry still maps pointer coordinates to the real sheet cells.
    page.evaluate("()=>{transact(()=>setFreeze(sheet(),1,1));scrollLeft=0;scrollTop=0;render();}")
    select('D6', 'D7')
    drag('D2')
    assert page.evaluate("getCell(sheet(),'D2').value") == '-4'
    # Escape / pointer cancellation must not create data or an Undo entry.
    for cancel in ['escape', 'pointercancel', 'blur']:
        select('F12')
        before = page.evaluate('JSON.stringify(book())')
        history = page.evaluate('JSON.stringify([[...undoStacks],[...redoStacks]])')
        start()
        r = page.locator('.grid-cell[data-ref=F16]').bounding_box()
        page.mouse.move(r['x']+20, r['y']+10, steps=5)
        if cancel == 'escape':
            page.keyboard.press('Escape')
        elif cancel == 'pointercancel':
            page.evaluate("window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:fillDrag.pointerId}))")
        else:
            page.evaluate("window.dispatchEvent(new Event('blur'))")
        page.mouse.up()
        assert page.evaluate('JSON.stringify(book())') == before
        assert page.evaluate("fillDrag===null&&document.querySelectorAll('.fill-preview').length===0")
        assert page.evaluate('JSON.stringify([[...undoStacks],[...redoStacks]])') == history

    assert page.evaluate("""async()=>{
      const b=book(),before=JSON.stringify(b),native=decodeBook(encodeBook(b));
      if(native.sheets[0].cells.F13.style.format!=='date')throw Error('QBOOK date format lost');
      const again=await importXLSX(await exportXLSX(b),'Fill.xlsx',{});
      if(again.sheets[0].cells.F13.value!==String(dateSerial(2024,2,29))||
         again.sheets[0].cells.F13.style.format!=='date'||
         again.sheets[0].cells.H9.value!=='=G9+$B$1')throw Error('XLSX fill roundtrip lost values');
      if(before!==JSON.stringify(b))throw Error('Export mutated book');
      return true;
    }""")
    assert not errors, errors
    browser.close()
    print('PASS TASK071: four-way physical fill, leap date, stationary edge scroll, frozen panes, cancellation, Undo, QBOOK/XLSX')
