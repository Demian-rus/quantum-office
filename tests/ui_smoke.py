from pathlib import Path
from shutil import which
from playwright.sync_api import sync_playwright

def run():
    html=Path(__file__).parents[1] / "dist" / "index.html"
    with sync_playwright() as p:
        options={"headless": True, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}
        if which("chromium"):
            options["executable_path"]=which("chromium")
        browser=p.chromium.launch(**options)
        page=browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(8000)
        errors=[]
        page.on("pageerror", lambda exc: errors.append(str(exc)))
        page.set_content(html.read_text(encoding="utf-8"), wait_until="load")
        assert page.locator("h1").count() == 1
        page.get_by_role("button", name="Открыть демонстрацию").click()
        assert page.locator('.grid-cell[data-ref="A1"]').count()==1
        assert page.locator('.grid-cell[data-ref="B6"]').inner_text().strip()
        page.locator('.grid-cell[data-ref="A8"]').dblclick()
        page.locator(".cell-editor").fill("Проверка текста")
        page.locator(".cell-editor").press("Enter")
        assert page.locator('.grid-cell[data-ref="A8"]').inner_text()=="Проверка текста"
        page.locator(".sheet-menu").click()
        assert page.locator(".sheet-tab").count()==3
        page.locator(".sheet-tab").last.click()
        page.get_by_role("button", name="Обзор").click()
        assert page.locator(".file-card").count()==1
        assert not errors,errors
        browser.close()
        print("Browser smoke passed: navigation, formulas, editing, multi-sheet and no JS errors")

if __name__ == "__main__":
    run()
