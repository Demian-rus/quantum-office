/* BANK-02.2: compare the same 14 tasks in clean Chromium profiles. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const oldSamples = require('./fixtures/bank021-samples.cjs');
const samples = require('./fixtures/bank022-samples.cjs');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence/bank-02.2');
const baseline = process.env.QO_BANK022_BASELINE || path.join(out, 'baseline.html');
const candidate = path.join(root, 'Quantum-Office.html');
const action = (page, name) => page.locator(`[data-qw-action="${name}"]`);
const itemId = number => `bank022-${String(number).padStart(2, '0')}`;
const row = (page, number) => page.locator(`[data-bank-view="${itemId(number)}"]`);

async function setup(browser, file, errors, rows) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, colorScheme: 'dark', offline: true });
  const page = await context.newPage();
  page.on('dialog', dialog => dialog.accept());
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(file).href);
  assert.equal(await page.locator('html').getAttribute('data-qo-theme'), 'light');
  if (rows) await page.evaluate(items => {
    const entries = items.map(({ type, subject = 'physics', graph, raster, ...fields }, i) => {
      const task = qwTask(type); Object.assign(task, fields); task.id = 'bank022-task-' + (i + 1);
      if (graph) Object.assign(task.graph, graph);
      if (fields.figureWidth) task.figureWidthMode = 'manual';
      if (raster) {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 160;
        const pen = canvas.getContext('2d'); pen.fillStyle = '#fff'; pen.fillRect(0, 0, 160, 160);
        pen.fillStyle = '#41826d'; pen.fillRect(14, 14, 132, 132); pen.clearRect(62, 62, 55, 55);
        Object.assign(task, { figure: 'image', image: canvas.toDataURL(), figureWidth: 145, figureWidthMode: 'manual' });
      }
      return qwBankNormalize({ id: 'bank022-' + String(i + 1).padStart(2, '0'), bankNumber: 801 + i, subject,
        grade: '11', exam: 'general', part: '1', slot: String(i + 1), topic: fields.topic, origin: 'original', task });
    });
    localStorage.setItem(QW_BANK_KEY, JSON.stringify(entries));
  }, rows);
  await page.locator('[data-action=launcher-bank]').click();
  if (rows) await row(page, 1).waitFor();
  return { context, page };
}

async function screenshot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#toast.active').waitFor({ state: 'hidden' });
  await page.screenshot({ path: path.join(out, 'screenshots', name + '.png'), animations: 'disabled' });
}

async function selectTask(page, n) {
  await row(page, n).click();
  await page.locator(`[data-bank-edit="${itemId(n)}"]`).waitFor();
}

async function editTask(page, n) {
  await selectTask(page, n);
  await page.locator(`[data-bank-edit="${itemId(n)}"]`).click();
  await page.locator('.qw-bank-edit-dialog').waitFor();
}

async function compareScreens(page, prefix) {
  await selectTask(page, 1);
  await screenshot(page, prefix + '-card');
  await page.locator('[data-bank-enlarge]').click();
  await page.locator('.qw-bank-solution summary').click();
  await screenshot(page, prefix + '-enlarged');
  await page.locator('[data-bank-enlarge]').click();
  await editTask(page, 1);
  await screenshot(page, prefix + '-editor');
  await action(page, 'bank-edit-back').click();
}

async function ready(page, selector, match = {}) {
  return page.waitForFunction(({ selector, match }) => {
    const frame = document.querySelector(selector);
    const print = frame?.contentDocument;
    if (!frame?.dataset.ready || frame.dataset.ready !== print?.documentElement?.dataset.qwRender || !print.body?.dataset.qwLayoutReady) return false;
    if (match.layout && frame.contentWindow.__qwPrintLayout.layout !== match.layout) return false;
    const figure = print.querySelector('figure');
    if (match.position && figure?.dataset.printPosition !== match.position) return false;
    if (match.width && figure?.dataset.publishWidth !== match.width) return false;
    if (match.tableWidth && print.querySelector('table')?.style.width !== match.tableWidth) return false;
    const size = figure?.getBoundingClientRect().width;
    return { size: size || 0, report: frame.contentWindow.__qwPrintLayout };
  }, { selector, match }).then(value => value.jsonValue());
}

async function project(page) {
  return page.evaluate(async () => {
    const saved = await qwBankRepository.createVerifiedBackup();
    const d = qwProject(); d.layout = 'booklet'; d.title = 'Практикум по физике и математике';
    d.printSettings = qwPrintSettings({ fontPt: 10, showTitle: true, showMeta: false, showVariant: false });
    d.tasks = saved.records.toSorted((a, b) => a.bankNumber - b.bankNumber).map(record => ({
      ...record.task, source: { kind: 'bank', id: record.id, number: record.bankNumber },
    }));
    return { work: qwValidate(d), archive: saved };
  });
}

async function render(context, page, work, name, orientation, options, baselinePrint = false) {
  const doc = await context.newPage();
  const html = await page.evaluate(({ work, orientation, options }) => {
    work.printSettings.orientation = orientation; return qwPrintDocumentHTML(work, false, options);
  }, { work, orientation, options });
  await doc.setContent(html);
  await doc.evaluate(() => window.qwPrintReady);
  const proof = await doc.evaluate(() => {
    const pages = [...document.querySelectorAll('.qw-print-page')];
    const sections = [...document.querySelectorAll('.qw-print-section')];
    return { layout: window.__qwPrintLayout, error: window.__qwPrintError || null,
      number: sections.flatMap(section => [...section.querySelectorAll('[data-qw-bank-number]')].map(el => +el.dataset.qwBankNumber)),
      answerLabels: sections.flatMap(section => [...section.querySelectorAll('.qw-answer-caption')].map(el => el.innerText)),
      title: document.querySelector('.qw-print-title')?.innerText, headings: document.querySelectorAll('.qw-print-title').length,
      staffHeading: document.body.innerText.includes('Скорость тележки'), intendedHeading: document.body.innerText.includes('Проверьте единицы'),
      solution: document.body.innerText.includes('За первые 4 с путь'), rubric: document.body.innerText.includes('Площадь прямоугольника и итог'),
      figures: document.querySelectorAll('figure').length, text: document.body.innerText,
      overflow: pages.some(element => element.scrollWidth > element.clientWidth + 3),
      positions: sections.flatMap(section => [...section.querySelectorAll('figure')].map(figure => ({
        task: +section.dataset.task, side: figure.dataset.printPosition, width: figure.getBoundingClientRect().width * 25.4 / 96,
      }))),
    };
  });
  assert.equal(proof.error, null, `${name}: ${proof.error}`);
  assert.equal(proof.headings, 1);
  assert.equal(proof.overflow, false);
  assert.equal(proof.layout.layout, orientation === 'landscape' ? 'spread' : 'portrait');
  if (!baselinePrint) {
    assert.equal(proof.staffHeading, false);
    if (options.includeNumbers === false) assert.equal(proof.number.length, 0);
    else assert.deepEqual([...new Set(proof.number)], samples.map((_, i) => 801 + i));
    const detailed = options.keyMode === 'detailed';
    assert.equal(proof.solution, detailed);
    assert.equal(proof.rubric, detailed && options.includeCriteria === true);
    assert.equal(proof.intendedHeading, options.format === 'booklet' || options.includePrompt === true);
    assert.equal(proof.figures > 0, options.format === 'booklet' || options.includePrompt === true);
    assert.equal(proof.answerLabels.length, detailed ? 14 : 0);
    if (detailed) assert.ok(proof.text.indexOf('За первые 4 с путь') < proof.text.indexOf('Ответ: 18 м'));
  }
  await doc.emulateMedia({ media: 'print' });
  await doc.pdf({ path: path.join(out, name + '.pdf'), preferCSSPageSize: true, printBackground: true });
  await doc.close();
  delete proof.text;
  return { name, ...proof };
}

async function main() {
  fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  try {
    const prints = [];
    if (fs.existsSync(baseline)) {
      const before = await setup(browser, baseline, errors, oldSamples);
      await compareScreens(before.page, 'before');
      const { work } = await project(before.page);
      prints.push(await render(before.context, before.page, work, 'baseline-pupil-portrait', 'portrait', { format: 'booklet' }, true));
      prints.push(await render(before.context, before.page, work, 'baseline-pupil-landscape', 'landscape', { format: 'booklet' }, true));
      await before.context.close();
    }
    const { context, page } = await setup(browser, candidate, errors, samples);
    await compareScreens(page, 'after');
    await page.locator('#qw-bank-search').fill('равноускоренное движение');
    await page.waitForFunction(() => document.querySelectorAll('[data-bank-view]').length === 1);
    assert.equal(await row(page, 1).count(), 1);
    await page.locator('#qw-bank-search').fill(''); await row(page, 13).waitFor();

    await editTask(page, 13);
    await page.locator('[data-bank-move-title]').click();
    assert.equal(await page.locator('[data-bank-task-field=title]').inputValue(), 'Проверьте единицы');
    assert.doesNotMatch(await page.locator('[data-bank-task-field=prompt]').inputValue(), /^###/);
    await action(page, 'bank-edit-back').click();
    await editTask(page, 1);
    const bankFrame = '[data-bank-publish-frame]';
    await page.locator('[data-bank-publish-toggle]').click();
    const side = await ready(page, bankFrame, { layout: 'portrait', width: '34', position: 'right' });
    const width = page.locator('[data-bank-publishing] [data-style-field=width]');
    const maximum = page.locator('[data-bank-publishing] [data-style-field=maxMm]');
    await width.fill('25');
    const compact = await ready(page, bankFrame, { width: '25', position: 'right' });
    assert.ok(compact.size < side.size - 10);
    await screenshot(page, 'figure-resized');
    await maximum.fill('80');
    await width.fill('52');
    await page.locator('[data-bank-publishing] [data-style-field=position]').selectOption('below');
    const below = await ready(page, bankFrame, { width: '52', position: 'below' });
    assert.ok(below.size > side.size + 20);
    await screenshot(page, 'figure-moved-below');
    await page.locator('[data-bank-publish-orientation]').selectOption('landscape');
    const landscape = await ready(page, bankFrame, { layout: 'spread', position: 'below' });
    await page.locator('[data-bank-publishing] [data-publish-zoom]').fill('65');
    assert.ok(Math.abs((await ready(page, bankFrame, { layout: 'spread' })).size-landscape.size)<.03);
    await screenshot(page, 'layout-landscape');
    await width.fill('34');
    await maximum.fill('56');
    await page.locator('[data-bank-publishing] [data-style-field=position]').selectOption('right');
    await page.locator('[data-bank-publish-orientation]').selectOption('portrait');
    await page.locator('[data-bank-publishing] [data-publish-zoom]').fill('85');
    await ready(page, bankFrame, { width: '34', position: 'right', layout: 'portrait' });
    await screenshot(page, 'layout-portrait');
    await action(page, 'bank-edit-back').click();

    await editTask(page, 6);
    await page.locator('[data-bank-publish-toggle]').click();
    const baseTable = await ready(page, bankFrame, { tableWidth: '64%' });
    await width.fill('56');
    await page.locator('[data-bank-publishing] [data-style-field=columns]').fill('20 30 50');
    await page.locator('[data-bank-publishing] [data-style-field=columns]').press('Tab');
    await ready(page, bankFrame, { tableWidth: '56%' });
    const table = page.frameLocator(bankFrame).locator('table');
    assert.equal(await table.locator('col').count(), 3);
    assert.ok(await table.evaluate(node => Math.abs(node.clientWidth/node.parentElement.clientWidth-.56)<.04));
    await screenshot(page, 'table-width');
    await action(page, 'bank-edit-save').click();
    await page.locator('.qw-bank-edit-dialog').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(async id => (await qwBankRepository.getTask(id)).task.publishing.tables.prompt[0].width, itemId(6)), 56);
    assert.ok(baseTable.report.pages.length);
    await selectTask(page, 5); await screenshot(page, 'physical-ground');
    await selectTask(page, 1);
    await page.evaluate(() => { qoThemePreference='dark'; qoApplyAppearance(); });
    assert.equal(await page.locator('html').getAttribute('data-qo-theme'), 'dark');
    assert.equal(await page.locator('.qw-study-flow svg').evaluate(svg => getComputedStyle(svg).backgroundColor), 'rgba(0, 0, 0, 0)');
    await page.evaluate(() => localStorage.setItem('quantum-office-theme-v1','dark'));
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-qo-theme'), 'dark');
    await page.evaluate(() => { localStorage.removeItem('quantum-office-theme-v1'); qoThemePreference='light'; qoApplyAppearance(); });
    await page.locator('[data-action=launcher-bank]').click(); await row(page, 1).waitFor();

    const { work, archive } = await project(page);
    assert.equal(archive.count, 14);
    assert.deepEqual(await page.evaluate(source => qwValidate(JSON.parse(JSON.stringify(source))), work), work);
    fs.writeFileSync(path.join(out, 'study.qwork'), JSON.stringify(work, null, 2));
    fs.writeFileSync(path.join(out, 'study.qwbank'), JSON.stringify(archive));
    const recovery = await setup(browser, candidate, errors);
    const file = recovery.page.locator('#qw-bank-restore-file'), damaged = structuredClone(archive);
    damaged.records[0].task.publishing.figure.width = 42;
    await file.setInputFiles({ name: 'damaged.qwbank', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(damaged)) });
    await recovery.page.locator('#qw-bank-save-status.qw-error').waitFor();
    assert.equal(await recovery.page.locator('[data-bank-view]').count(), 0);
    await file.setInputFiles(path.join(out, 'study.qwbank'));
    await recovery.page.locator('#qw-bank-restore-confirm').click();
    await row(recovery.page, 14).waitFor();
    assert.deepEqual(await recovery.page.evaluate(id => qwBankRepository.getTask(id), itemId(6)), archive.records.find(r=>r.id===itemId(6)));
    await recovery.context.close();

    await page.evaluate(d => { route('work'); qwDoc=d; qwSelected=d.tasks[0].id; qwRender(); }, structuredClone(work));
    await action(page, 'preview').click();
    const workFrame = '#qw-print-preview-frame';
    const docPreview = await ready(page, workFrame, { layout: 'portrait', width: '34' });
    await page.locator('.qw-pdf-design [data-style-field=width]').fill('39');
    await ready(page, workFrame, { width: '39' });
    assert.equal(await page.evaluate(async id => (await qwBankRepository.getTask(id)).task.publishing.figure.width, itemId(1)), 34);
    await page.locator('.qw-pdf-design [data-style-field=width]').fill('34');
    await ready(page, workFrame, { width: '34' });
    await action(page, 'preview-answers').click(); await ready(page, workFrame);
    const key = page.frameLocator(workFrame);
    assert.equal(await key.locator('.qw-answer-caption').count(), 0);
    await page.locator('[data-key-option=includeComments]').check();
    await key.locator('.qw-answer-caption').first().waitFor();
    await page.locator('[data-key-option=includePrompt]').check();
    await key.locator('[data-qw-key-condition] figure').first().waitFor();
    const pupil = await render(context, page, work, 'pupil-portrait', 'portrait', { format: 'booklet' });
    assert.deepEqual(pupil.layout, docPreview.report, 'constructor preview has export geometry');
    prints.push(pupil);
    prints.push(await render(context, page, work, 'pupil-landscape', 'landscape', { format: 'booklet' }));
    prints.push(await render(context, page, work, 'key-brief', 'portrait', { format: 'answers', keyMode: 'brief', includeNumbers: false }));
    prints.push(await render(context, page, work, 'key-detailed', 'portrait', { format: 'answers', keyMode: 'detailed', includeCriteria: true }));
    prints.push(await render(context, page, work, 'tasks-and-solutions', 'landscape', { format: 'answers', keyMode: 'detailed', includePrompt: true, includeCriteria: true }));
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(prints, null, 2));
    console.log('PASS light baseline, catalogue title/tags, object sizing and placement, table width, both A4 modes, preview/export parity, QWORK and QWBANK, five vector PDFs');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode=1; });
