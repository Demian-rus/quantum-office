"""Cross-sheet calculations are visible on grid, update after editing and export unchanged."""
from pathlib import Path
from shutil import which
from io import BytesIO
from playwright.sync_api import sync_playwright
from openpyxl import load_workbook
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1366,'height':768},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
 page.locator('[data-action=new]').first.click()
 def write(ref,val):
  page.locator('#name-box').fill(ref);page.locator('#name-box').press('Enter')
  page.locator('#formula-input').fill(val);page.locator('#formula-input').press('Enter')
 write('A1','1250');write('A2','750')
 page.locator('.sheet-menu').click()
 write('B2',"=SUM('Лист 1'!A1:A2)")
 assert page.locator('.grid-cell[data-ref="B2"]').inner_text()=='2000'
 page.locator('.sheet-tab').first.click()
 write('A2','1000')
 page.locator('.sheet-tab').nth(1).click()
 assert page.locator('.grid-cell[data-ref="B2"]').inner_text()=='2250'
 page.get_by_role('tab',name='Файл').click()
 with page.expect_download() as dl:page.locator('[data-action=xlsx]').first.click()
 book=load_workbook(BytesIO(Path(dl.value.path()).read_bytes()),data_only=False)
 assert book.worksheets[1]['B2'].value=="=SUM('Лист 1'!A1:A2)"
 assert not errors,errors
 print('PASS cross-sheet editing, automatic display update, XLSX Excel formula')
 browser.close()
