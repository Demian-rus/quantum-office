"""Real UI conditional formulas and XLSX preservation in Chromium."""
from pathlib import Path
from shutil import which
from io import BytesIO
from playwright.sync_api import sync_playwright
from openpyxl import load_workbook
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=which('chromium') or None,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1366,'height':768},accept_downloads=True)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.set_content((root/'dist/index.html').read_text(encoding='utf-8'),wait_until='load')
    page.locator('[data-action=new]').first.click()
    def write(ref,value):
        field=page.locator('#name-box');field.fill(ref);field.press('Enter')
        formula=page.locator('#formula-input');formula.fill(value);formula.press('Enter')
    for r,v in [('A1','Мария'),('A2','Данила'),('A3','Мария'),('B1','1500'),('B2','2000'),('B3','1500'),('C1','Оплачено'),('C2','Не оплачено'),('C3','Оплачено')]:write(r,v)
    write('D1','=IF(B1>=1500,"Принято","Проверить")')
    write('D2','=COUNTIF(C1:C3,"Оплачено")')
    write('D3','=SUMIF(C1:C3,"Оплачено",B1:B3)')
    write('D4','=IFERROR(1/0,"Без ошибки")')
    write('D5','=IF(TRUE,1,1/0)')
    for ref,expected in [('D1','Принято'),('D2','2'),('D3','3000'),('D4','Без ошибки'),('D5','1')]:
        assert page.locator(f'.grid-cell[data-ref="{ref}"]').inner_text()==expected,(ref,page.locator(f'.grid-cell[data-ref="{ref}"]').inner_text())
    # XLSX retains unmodified text formulas for Excel's independent recalculation.
    page.get_by_role('tab',name='Файл').click()
    with page.expect_download() as event:page.locator('[data-action=xlsx]').first.click()
    file=event.value
    stream=BytesIO(Path(file.path()).read_bytes())
    sheet=load_workbook(stream,data_only=False).active
    assert sheet['D1'].value=='=IF(B1>=1500,"Принято","Проверить")',sheet['D1'].value
    assert sheet['D2'].value=='=COUNTIF(C1:C3,"Оплачено")'
    assert sheet['D3'].value=='=SUMIF(C1:C3,"Оплачено",B1:B3)'
    assert not errors,errors
    print('PASS formula UI: IF, COUNTIF, SUMIF, IFERROR, lazy evaluation, XLSX formulas')
    browser.close()
