"""TASK076: premium Lucide toolbar, real pressed states, calm hover feedback and color icons."""
from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1550,'height':940})
 page.set_default_timeout(25000)
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 view=page.locator('#grid-scroll')
 view.evaluate('(el)=>el.scrollTop=9500')
 page.wait_for_timeout(120)
 def scroll():
  value=view.evaluate('(el)=>el.scrollTop')
  assert abs(value-9500)<=2,value
 scroll()
 def icon(action):
  return page.locator('.ribbon .tool-btn[data-action="'+action+'"]').first
 # A freshly selected cell shows real accessible pressed state, not mere CSS focus.
 bold=icon('bold')
 assert bold.get_attribute('aria-pressed')=='false'
 assert bold.locator('.font-letter').inner_text()=='Ж'
 normal_bg=bold.evaluate("e=>getComputedStyle(e).backgroundColor")
 bold.hover();page.wait_for_timeout(190)
 assert bold.evaluate("e=>getComputedStyle(e).transform")=='none'
 assert bold.evaluate("e=>getComputedStyle(e).backgroundColor")!=normal_bg
 assert bold.evaluate("e=>getComputedStyle(e).backgroundImage")=='none'
 assert bold.get_attribute('title')=='Жирный'
 bold.click();scroll()
 assert bold.get_attribute('aria-pressed')=='true'
 assert 'is-active' in bold.get_attribute('class')
 selected_bg=bold.evaluate("e=>getComputedStyle(e).backgroundColor")
 assert selected_bg!=normal_bg
 assert bold.evaluate("e=>getComputedStyle(e).backgroundImage")=='none'
 bold.click();scroll()
 assert bold.get_attribute('aria-pressed')=='false'
 for act in ['italic','underline','strike']:
  btn=icon(act);btn.click();scroll();assert btn.get_attribute('aria-pressed')=='true'
  btn.click();scroll();assert btn.get_attribute('aria-pressed')=='false'
 # Text A has a high-contrast bar; paint fill uses the real tilted bucket outline.
 ink=icon('text-palette')
 assert ink.locator('.qo-text-color strong').inner_text()=='А'
 ink_bar=ink.locator('.qo-swatch').bounding_box()
 assert ink_bar and ink_bar['width']>=16 and ink_bar['height']>=3
 bucket=icon('fill-palette')
 assert bucket.locator('.qo-paint-icon svg.qo-lucide path').count()>=2
 assert bucket.locator('.qo-swatch').count()==1
 assert bucket.locator('svg.qo-lucide').get_attribute('viewBox')=='0 0 24 24'
 assert icon('undo').locator('svg.qo-lucide').count()==1
 assert icon('copy').locator('svg.qo-lucide').count()==1
 assert icon('paste-values').locator('svg.qo-lucide').count()==1
 assert icon('copy').locator('svg').inner_html()!=icon('paste-values').locator('svg').inner_html()
 assert icon('merge-cells').locator('svg').inner_html()!=icon('border-menu').locator('svg').inner_html()
 # Alignment and number format buttons must expose pressed value state.
 center=page.locator('.ribbon [data-action=align][data-value=center]')
 center.click();scroll()
 assert center.get_attribute('aria-pressed')=='true'
 assert page.locator('.ribbon [data-action=align][data-value=left]').get_attribute('aria-pressed')=='false'
 percent=page.locator('.ribbon [data-action=format][data-value=percent]')
 percent.click();scroll()
 assert percent.get_attribute('aria-pressed')=='true'
 assert percent.locator('svg.qo-lucide').count()==1
 page.get_by_role('tab',name='Вставка').click();scroll()
 assert icon('chart-pie').locator('svg.qo-lucide').count()==1
 assert icon('chart-line').locator('svg.qo-lucide').count()==1
 assert icon('chart-pie').locator('svg').inner_html()!=icon('chart-line').locator('svg').inner_html()
 assert icon('chart-stacked100').locator('.qo-chart-100 i').inner_text()=='100%'
 page.get_by_role('tab',name='Главная').click();scroll()
 page.emulate_media(reduced_motion='reduce')
 bold=icon('bold')
 assert '0s' in bold.evaluate("e=>getComputedStyle(e).transitionDuration")
 assert not errors,errors
 print('PASS TASK076: Lucide SVGs, rich color controls, hover and pressed styles, scroll stability, reduced motion')
 browser.close()
