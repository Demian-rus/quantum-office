from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
  b=p.chromium.launch(**({'executable_path':which('chromium')} if which('chromium') else {}),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  pg=b.new_page(viewport={'width':1366,'height':768})
  errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
  pg.set_content((root/'dist/index.html').read_text(),wait_until='load')
  pg.get_by_role('button',name='Открыть пример таблицы').click()
  pg.locator('#name-box').fill('A1:D6');pg.locator('#name-box').press('Enter')
  pg.get_by_role('tab',name='Данные').click()
  pg.get_by_role('button',name='Автофильтр').click()
  assert pg.locator('.filter-head').count()==4,pg.locator('.filter-head').count()
  pg.locator('.filter-head[data-col="0"]').click()
  assert pg.locator('.filter-popup').is_visible()
  choices=pg.locator('.filter-choices label').all_text_contents()
  assert 'Транспорт' in choices,choices
  pg.get_by_role('button',name='Снять найденные').click()
  assert pg.locator('.filter-choices input:checked').count()==0
  pg.locator('.filter-choices label',has_text='Транспорт').locator('input').check()
  pg.locator('.filter-choices label',has_text='Оборудование').locator('input').check()
  pg.locator('[data-action=filter-apply]').click()
  assert pg.locator('.rowhead').get_by_text('4',exact=True).count()==1
  assert pg.locator('.rowhead').get_by_text('2',exact=True).count()==1
  assert pg.locator('.rowhead').get_by_text('3',exact=True).count()==0
  # A selected range containing hidden rows must not be cleared.
  pg.locator('#name-box').fill('A1:B6');pg.locator('#name-box').press('Enter')
  pg.get_by_role('tab',name='Правка').click()
  pg.get_by_role('button',name='Очистить содержимое').click()
  assert pg.locator('.grid-cell[data-ref="A4"]').inner_text()=='Транспорт'
  pg.get_by_role('tab',name='Вид').click()
  pg.get_by_role('button',name='Верхняя строка').click()
  pg.locator('#grid-scroll').evaluate('(e)=>{e.scrollTop=300;e.scrollLeft=250;e.dispatchEvent(new Event("scroll"))}')
  assert pg.locator('.grid-cell.frozen-row[data-ref="A1"]').count()==1
  assert pg.locator('.rowhead.frozen-row').count()==1
  pg.get_by_role('button',name='Первый столбец').click()
  pg.locator('#grid-scroll').evaluate('(e)=>{e.scrollTop=300;e.scrollLeft=250;e.dispatchEvent(new Event("scroll"))}')
  assert pg.locator('.grid-cell.frozen-row.frozen-col[data-ref="A1"]').count()==1
  assert not errors,errors
  print('PASS browser: filter dropdown / visibility / freeze rows and cols / scroll')
  b.close()
