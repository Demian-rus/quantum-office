"""TASK073 owner regression: toolbar never resets scroll, font controls do not overlap, Ctrl click toggles."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1365,'height':820})
 page.set_default_timeout(25000)
 failures=[];page.on('pageerror',lambda error:failures.append(str(error)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 view=page.locator('#grid-scroll')
 view.evaluate('(el)=>el.scrollTop=9500')
 page.wait_for_timeout(150)
 def keep():
  assert abs(view.evaluate('(el)=>el.scrollTop')-9500)<3
 keep()
 page.locator('[data-action=border-menu]').first.click();keep()
 page.locator('[data-action=border-mode][data-value=outline]').click();keep()
 page.locator('[data-action=fill-palette]').first.click();keep()
 page.locator('[data-action=palette-pick]').first.click();keep()
 page.locator('[data-action=text-palette]').first.click();keep()
 page.locator('[data-action=popup-close]').first.click();keep()
 page.locator('[data-action=bold]').first.click();keep()
 page.locator('[data-action=align][data-value=center]').first.click();keep()
 page.locator('#font-family-select').select_option('PT Sans');keep()
 page.locator('#font-size-select').select_option('16');keep()
 name=page.locator('#name-box')
 name.fill('B330:C330');name.press('Enter')
 page.locator('[data-action=merge-cells]').first.click();keep()
 page.locator('[data-action=unmerge-cells]').first.click();keep()
 for tab in ['edit','insert','view','home']:
  page.locator('[data-action=ribbon][data-target='+tab+']').first.click();keep()
 group=page.locator('.ribbon-group.font-group')
 box=group.bounding_box()
 controls=[group.locator('#font-family-select'),group.locator('#font-size-select')]+group.locator('button.tool-btn').all()
 rects=[control.bounding_box() for control in controls]
 assert all(a['x']>=box['x']-2 and a['x']+a['width']<=box['x']+box['width']+2 for a in rects)
 for i,a in enumerate(rects):
  for b in rects[:i]:
   overlap=max(0,min(a['x']+a['width'],b['x']+b['width'])-max(a['x'],b['x']))*max(0,min(a['y']+a['height'],b['y']+b['height'])-max(a['y'],b['y']))
   assert overlap<1,overlap
 name.fill('B330');name.press('Enter')
 first=page.locator('.grid-cell[data-ref="B330"]').first
 other=page.locator('.grid-cell[data-ref="D330"]').first
 first.click();other.click(modifiers=['Control'])
 first.click(modifiers=['Control'])
 assert not first.evaluate("e=>e.classList.contains('is-selected')")
 assert other.evaluate("e=>e.classList.contains('is-selected')")
 first.click(modifiers=['Control'])
 assert first.evaluate("e=>e.classList.contains('is-selected')")
 name.fill('B332:D333');name.press('Enter')
 middle=page.locator('.grid-cell[data-ref="C332"]').first
 middle.click(modifiers=['Control'])
 assert not middle.evaluate("e=>e.classList.contains('is-selected')")
 assert page.locator('.grid-cell[data-ref="D333"]').first.evaluate("e=>e.classList.contains('is-selected')")
 assert page.locator('.grid-cell[data-ref="D333"]').first.evaluate("e=>getComputedStyle(e).color")=='rgb(16, 16, 16)'
 assert not failures,failures
 browser.close()
 print('PASS TASK073: stable toolbar scroll, grouped Cyrillic fonts, Ctrl toggle, black text')
