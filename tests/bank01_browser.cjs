/* BANK-01: real catalogue interactions and screen geometry on disposable profiles. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence/bank-01/screenshots');
const baseline = process.env.QO_BANK01_BASELINE;
const candidate = path.join(root, 'Quantum-Office.html');
const graphId = 'fixture-71';
const sizes = [[1920, 1080], [1440, 900], [1366, 768], [1024, 768], [800, 900]];
const row = id => '[data-bank-view="' + id + '"]';

async function openBank(browser, html, errors) {
  const context = await browser.newContext({ offline: true, viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(html).href);
  await page.evaluate(async () => {
    await qwBankOpen();
    const items = Array.from({ length: 72 }, (_, index) => {
      const graph = index === 1;
      const task = qwTask(graph ? 'graph' : 'short');
      task.prompt = graph
        ? 'На графике показана скорость тележки. Вычислите путь за первые 6 с по формуле \\(s=v t\\) для равномерного участка.'
        : 'Найдите значение ' + (index + 1) + ' по данным измерения. Запишите ответ с единицей измерения.';
      if (graph) {
        Object.assign(task.graph, {
          xmin: 0, xmax: 8, ymin: 0, ymax: 8, xlabel: 't, с', ylabel: 'v, м/с',
          points: [{ x: 0, y: 0 }, { x: 2, y: 6 }, { x: 6, y: 6 }]
        });
        task.answer = '30 м';
        task.comment = '1. Площадь треугольника за первые 2 с равна 6 м.\n2. Площадь прямоугольника от 2 до 6 с равна 24 м.\n3. Суммарный путь равен 30 м.';
        task.criteria = '- 1 балл за определение площадей.\n- 1 балл за ответ с единицей измерения.';
      }
      return {
        id: 'fixture-' + (72 - index), task, subject: index % 15 === 8 ? 'math' : 'physics',
        grade: index % 15 === 8 ? '9' : '11', exam: index % 15 === 8 ? 'oge' : 'ege',
        topic: index % 15 === 8 ? 'Алгебра' : 'Механика', subtopic: index % 2 ? 'Кинематика' : 'Динамика',
        year: '2018', origin: 'original'
      };
    });
    await qwBankRepository.importBank({ format: 'quantum-work-bank', version: 1, items });
  });
  await page.locator('[data-action="launcher-bank"]').click();
  await page.locator(row(graphId)).click();
  await page.locator('#qw-bank-preview svg[viewBox]').first().waitFor();
  await page.locator('#qw-bank-preview math').first().waitFor();
  return { context, page };
}

function appearance(page, theme) {
  return page.evaluate(value => { qoThemePreference = value; qoApplyAppearance(); }, theme);
}

function screenshot(page, name) {
  return page.screenshot({ path: path.join(out, name + '.png'), animations: 'disabled' });
}

async function checkGeometry(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('.qw-bank-navigation').getBoundingClientRect();
    const catalogue = document.querySelector('.qw-bank-catalogue-results').getBoundingClientRect();
    const preview = document.querySelector('.qw-bank-catalogue-preview').getBoundingClientRect();
    const list = document.querySelector('#qw-bank-list').getBoundingClientRect();
    const visible = [...document.querySelectorAll('[data-bank-entry]')].filter(row => {
      const box = row.getBoundingClientRect();
      return box.top >= list.top && box.bottom <= list.bottom;
    }).length;
    return {
      nav: nav.width, catalogue: catalogue.width, preview: preview.width, visible,
      aligned: Math.abs(nav.right - catalogue.left) < 1 && Math.abs(catalogue.right - preview.left) < 1,
      overflow: document.documentElement.scrollWidth > innerWidth || preview.right > innerWidth
    };
  });
}

async function checkPagination(page) {
  const cases = [{}, { subject: 'physics' }, { subject: 'physics', topic: 'Механика', grade: '11' },
    { subject: 'physics', search: 'значение' }, { search: 'тележки' }, { exam: 'oge' }];
  return page.evaluate(async cases => {
    const reference = await qwBankRepository.listTasks({}, { limit: 80, includeImages: false });
    return Promise.all(cases.map(async filters => {
      const expected = reference.items.filter(item => bankSearchMatch(item, filters)).map(item => item.bankNumber);
      const actual = [];
      let total;
      for (let offset = 0; ; offset += 7) {
        const page = await qwBankRepository.listTasks(filters, { offset, limit: 7, includeImages: false });
        total = page.total;
        actual.push(...page.items.map(item => item.bankNumber));
        if (!page.hasMore) break;
      }
      return { filters, actual, expected, total };
    }));
  }, cases);
}

async function checkAsync(page) {
  const search = page.locator('#qw-bank-search');
  await page.evaluate(() => {
    const original = qwBankRepository.listTasks.bind(qwBankRepository);
    const read = qwBankRepository.getTask.bind(qwBankRepository);
    let releaseList, releasePreview;
    const staleList = new Promise(resolve => { releaseList = resolve; });
    const stalePreview = new Promise(resolve => { releasePreview = resolve; });
    window.bankCheck = { queries: [], releaseList, releasePreview, previewWaiting: false,
      restore() { qwBankRepository.listTasks = original; qwBankRepository.getTask = read; } };
    qwBankRepository.listTasks = async (filters, options) => {
      bankCheck.queries.push(filters.search);
      if (filters.search === 'отказ чтения') throw Error('Тест чтения');
      const result = await original(filters, options);
      if (filters.search === 'измерения') await staleList;
      return result;
    };
    qwBankRepository.getTask = async id => {
      if (id === 'fixture-70') { bankCheck.previewWaiting = true; await stalePreview; }
      return read(id);
    };
  });
  await page.locator(row('fixture-70')).click();
  await page.waitForFunction(() => bankCheck.previewWaiting);
  await page.locator(row(graphId)).click();
  await page.locator('[data-bank-edit="' + graphId + '"]').waitFor();
  await page.evaluate(() => bankCheck.releasePreview());
  await search.fill('измерения');
  await page.waitForFunction(() => bankCheck.queries.length === 1);
  await search.evaluate(input => {
    for (const value of ['те', 'теле', 'тележки']) {
      input.value = value;
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }
  });
  await page.waitForFunction(() => document.querySelector('#qw-bank-count').textContent === 'Найдено: 1 / 72');
  await page.evaluate(() => bankCheck.releaseList());
  await page.locator('[data-bank-edit="' + graphId + '"]').waitFor();
  assert.deepEqual(await page.evaluate(() => bankCheck.queries), ['измерения', 'тележки']);
  assert.equal(await page.locator('[data-bank-entry]').count(), 1);
  await search.fill('отказ чтения');
  await page.getByText('Ошибка чтения', { exact: true }).waitFor();
  assert.equal(await page.locator('.qw-bank-query-pending, [aria-busy=true]').count(), 0);
  assert.equal(await page.locator('[data-bank-entry], [data-bank-edit]').count(), 0);
  await search.fill('');
  await page.locator('[data-bank-entry]').nth(29).waitFor();
  await page.evaluate(() => bankCheck.restore());
}

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  try {
    if (baseline) {
      const { context, page } = await openBank(browser, baseline, errors);
      await appearance(page, 'dark');
      await screenshot(page, 'before-1920-dark');
      await page.setViewportSize({ width: 1366, height: 768 });
      await appearance(page, 'light');
      await screenshot(page, 'before-1366-light');
      await context.close();
    }
    const { context, page } = await openBank(browser, candidate, errors);
    const fixtures = await page.evaluate(() => qwBankRepository.exportBank());
    fs.writeFileSync(path.join(out, '..', 'fixture.qwbank'), JSON.stringify(fixtures, null, 2));
    let acceptDiscard = true;
    page.on('dialog', dialog => acceptDiscard ? dialog.accept() : dialog.dismiss());
    const matrix = [];
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const theme of ['light', 'dark']) {
        await appearance(page, theme);
        const geometry = await checkGeometry(page);
        assert.ok(geometry.aligned && !geometry.overflow && geometry.preview > geometry.catalogue, JSON.stringify({ width, theme, ...geometry }));
        if (width === 1366) assert.ok(geometry.visible >= 10, 'at least 10 full rows at 1366×768');
        matrix.push({ width, height, theme, ...geometry });
        await screenshot(page, 'after-' + width + '-' + theme);
      }
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await appearance(page, 'dark');
    await page.locator('.qw-bank-solution summary').click();
    assert.match(await page.locator('.qw-bank-solution-body').innerText(), /30 м/);
    await screenshot(page, 'after-solution');
    await page.locator('[data-bank-enlarge]').click();
    assert.equal(await page.locator('.qw-bank-navigation').isVisible(), false);
    assert.equal(await page.locator('.qw-bank-toolbar').isVisible(), false);
    await screenshot(page, 'after-enlarged');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.qw-bank-navigation').isVisible(), true);

    const dock = side => page.locator('.qw-bank-toolbar [data-qw-dock-toggle="' + side + '"]');
    const resize = side => page.locator('.qw-bank-catalogue [data-qw-dock-resize="' + side + '"]');
    await resize('left').press('Shift+ArrowRight');
    await resize('right').press('Shift+ArrowRight');
    const expanded = await checkGeometry(page);
    assert.equal(expanded.nav, 240);
    assert.equal(expanded.catalogue, 382);
    await screenshot(page, 'after-wide-panels');
    await dock('left').click();
    await dock('right').click();
    assert.equal((await checkGeometry(page)).preview, 1366);
    await screenshot(page, 'after-collapsed-panels');
    await page.reload();
    await page.locator('[data-action="launcher-bank"]').click();
    await dock('left').waitFor();
    assert.equal(await dock('left').getAttribute('aria-expanded'), 'false');
    assert.equal(await dock('right').getAttribute('aria-expanded'), 'false');
    await dock('left').click();
    await dock('right').click();
    assert.equal((await checkGeometry(page)).catalogue, 382);
    await page.locator('[data-qw-dock-reset="bank"]').click();
    assert.equal((await checkGeometry(page)).catalogue, 350);

    for (const result of await checkPagination(page)) {
      assert.equal(result.actual.length, result.total);
      assert.deepEqual(result.actual, result.expected, JSON.stringify(result.filters));
    }
    await checkAsync(page);

    await page.locator('[data-bank-subject="math"]').click();
    await page.locator('[data-bank-edit="fixture-64"]').waitFor();
    assert.equal(await page.locator(row(graphId)).count(), 0);
    await page.locator('[data-bank-subject="physics"]').click();
    await page.locator('#qw-bank-topic').selectOption('Механика');
    await page.locator('#qw-bank-search').fill('измерения');
    await page.waitForFunction(() => document.querySelector('#qw-bank-count').textContent === 'Найдено: 67 / 72');
    await page.locator('[data-bank-page="next"]').click();
    await page.locator('#qw-bank-page').getByText(/31–60/).waitFor();
    const index = page.locator('[data-bank-view]').nth(23);
    const id = await index.getAttribute('data-bank-view');
    await index.click();
    const listState = () => page.locator('#qw-bank-list').evaluate(list => ({ top: list.scrollTop, height: list.clientHeight, content: list.scrollHeight }));
    const before = await listState();
    assert.ok(before.top > 0);
    const edit = page.locator('[data-bank-edit="' + id + '"]');
    await edit.click();
    const prompt = page.locator('[data-bank-task-field="prompt"]');
    const original = await prompt.inputValue();
    await prompt.fill(original + ' Уточнение.');
    await page.locator('[data-qw-action="bank-edit-save"]').click();
    await edit.waitFor();
    assert.equal(await page.locator('#qw-bank-topic').inputValue(), 'Механика');
    assert.equal(await page.locator('#qw-bank-search').inputValue(), 'измерения');
    assert.equal(await page.locator('[data-bank-subject="physics"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator(row(id)).getAttribute('aria-current'), 'true');
    const after = await listState();
    assert.equal(after.top, before.top, JSON.stringify({ before, after }));
    await edit.click();
    await prompt.fill('Несохранённое условие');
    acceptDiscard = false;
    await page.locator('[data-qw-action="bank-edit-back"]').click();
    assert.ok(await prompt.isVisible());
    acceptDiscard = true;
    await page.locator('[data-qw-action="bank-edit-back"]').click();
    await edit.waitFor();
    assert.match(await page.locator('#qw-bank-preview').innerText(), /Уточнение/);

    await page.locator('[data-bank-reset]').click();
    await page.locator(row(graphId)).click();
    await page.locator('[data-bank-select]').nth(0).check();
    await page.locator('[data-bank-select]').nth(1).check();
    await page.locator('#qw-bank-selected-count').getByText(/2/).waitFor();
    await screenshot(page, 'after-multi-selection');
    await page.locator('[data-qw-action="bank-add-selection"]').click();
    await page.waitForFunction(() => qwDoc.tasks.length === 2);

    await page.evaluate(() => {
      qdBankWrite([{ id: 'bank01-diagnostic', subject: 'physics', grade: '11',
        question: { type: 'short', prompt: 'Диагностический образец для поиска', answer: '10' } }]);
    });
    await page.locator('.modules [data-target=bank]').click();
    await page.locator('#qw-bank-search').fill('диагностический образец');
    await page.waitForFunction(() => document.querySelector('#qw-bank-count').textContent === 'Найдено: 0 / 72');
    await page.locator('[data-diag-bank="bank01-diagnostic"]').click();
    await page.waitForFunction(() => qwDoc.tasks.length === 3);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'matrix.json'), JSON.stringify(matrix, null, 2));
    await context.close();
    console.log('PASS BANK-01: 10 theme/viewport cases, preview, selection, panels/reload, page ordering, debounce, stale queries, read-error recovery, edit return and diagnostics.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
