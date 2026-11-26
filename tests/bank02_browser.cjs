/* BANK-02: author, reopen, print and recover formatted tasks in disposable profiles. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'evidence/bank-02');
const url = pathToFileURL(path.join(root, 'Quantum-Office.html')).href;
const viewport = { width: 1440, height: 900 };
const archivePath = path.join(out, 'examples.qwbank');
const workPath = path.join(out, 'examples.qwork');

function field(page, key) {
  return page.locator('[data-bank-task-field="' + key + '"]');
}

function action(page, name) {
  return page.locator('[data-qw-action="' + name + '"]');
}

function section(page, key) {
  return page.locator('[data-bank-tab="' + key + '"]').click();
}

function toolbar(page, name) {
  return page.locator('[data-bank-format="' + name + '"]');
}

function choose(page, menu, option) {
  return page.locator('[data-bank-format-select="' + menu + '"]').selectOption(option);
}

function screenshot(page, name) {
  return page.screenshot({ path: path.join(out, 'screenshots', name + '.png'), animations: 'disabled' });
}

function appearance(page, theme) {
  return page.evaluate(value => { qoThemePreference = value; qoApplyAppearance(); }, theme);
}

async function selectText(input, selected) {
  await input.evaluate((control, text) => {
    const index = text ? control.value.indexOf(text) : control.value.length;
    if (index === -1) throw Error('Missing text: ' + text);
    control.focus();
    control.setSelectionRange(index, index + text.length);
  }, selected);
}

async function startBank(context, errors) {
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(url);
  await page.locator('[data-action="launcher-bank"]').click();
  await page.locator('#qw-bank-search').waitFor();
  return page;
}

async function authorGraphTask(page) {
  await action(page, 'bank-new').click();
  await page.locator('[data-bank-source]').click();
  const prompt = field(page, 'prompt');
  await prompt.fill('Движение тележки\nНайдите путь за 6 с по графику скорости.');
  await selectText(prompt, 'Движение тележки');
  await choose(page, 'heading', '1');
  await selectText(prompt, 'путь');
  await prompt.press('Control+b');
  assert.match(await prompt.inputValue(), /\*\*путь\*\*/);
  await prompt.press('Control+z');
  assert.doesNotMatch(await prompt.inputValue(), /\*\*путь\*\*/);
  await prompt.press('Control+y');
  assert.match(await prompt.inputValue(), /\*\*путь\*\*/);
  await selectText(prompt, 'графику скорости');
  await prompt.press('Control+i');
  await selectText(prompt, '6 с');
  await prompt.press('Control+u');
  assert.match(await prompt.inputValue(), /\+\+6 с\+\+/);
  const previous = await prompt.inputValue();
  await selectText(prompt, '');
  await choose(page, 'formula', 'fraction');
  assert.match(await prompt.inputValue(), /\\frac\{a\}\{b\}/);
  await toolbar(page, 'undo').click();
  assert.equal(await prompt.inputValue(), previous);
  await toolbar(page, 'redo').click();
  assert.match(await prompt.inputValue(), /\\frac\{a\}\{b\}/);
  await toolbar(page, 'undo').click();
  for (const [kind, expression] of [['root', /\\sqrt\{x\}/], ['power', /x\^\{2\}/]]) {
    await selectText(prompt, '');
    await choose(page, 'formula', kind);
    assert.match(await prompt.inputValue(), expression);
    await toolbar(page, 'undo').click();
  }

  await prompt.fill(previous + '\n\n::center Для линейного участка \\(s=\\frac{v_1+v_2}{2}\\Delta t\\).');
  await selectText(prompt, '::center Для линейного участка');
  await choose(page, 'align', 'right');
  assert.match(await prompt.inputValue(), /::right Для/);
  await toolbar(page, 'undo').click();
  const condition = await prompt.inputValue();
  await page.locator('[data-bank-visual="graph"]').click();
  const preset = page.locator('#qw-graph-preset');
  if (!await preset.isVisible()) await page.locator('[data-visual-panel="tools"]').click();
  await preset.selectOption('v');
  await action(page, 'visual-apply').click();
  await prompt.waitFor();
  assert.equal(await prompt.inputValue(), condition);
  assert.equal(await toolbar(page, 'undo').isEnabled(), true, 'formatting history survives graph editing');
  assert.equal(await field(page, 'figure').inputValue(), 'graph');
  await appearance(page, 'dark');
  await screenshot(page, 'editor-dark');
  const preview = page.locator('[data-bank-preview-toggle="prompt"]');
  await preview.click();
  const rendered = page.frameLocator('[data-bank-publish-frame]').locator('.qw-print-document');
  await rendered.locator('svg[viewBox]').first().waitFor();
  assert.equal(await rendered.locator('strong').innerText(), 'путь');
  assert.equal(await rendered.locator('u').innerText(), '6 с');
  assert.ok(await rendered.locator('mfrac').count());
  await screenshot(page, 'editor-dark-preview');
  await preview.click();

  const metadata = page.locator('.qw-bank-edit-side');
  const toggle = page.locator('.qw-bank-edit-top [data-qw-dock-toggle=right]');
  await toggle.click();
  assert.equal(await metadata.isVisible(), false);
  await toggle.click();
  await page.locator('[data-bank-edit-field=topic]').fill('Кинематика');

  await section(page, 'answer');
  await field(page, 'answer').fill('**30 м**.');
  await section(page, 'comment');
  const solution = field(page, 'comment');
  await solution.fill('### Площадь под графиком\n1. От 0 до 2 с тележка разгоняется от v~{0} = 0 до 6 м/с. Площадь треугольника равна 6 м.\n2. От 2 до 6 с скорость постоянна. Площадь прямоугольника равна 24 м.\n3. Путь равен 6 + 24 = 30 м.\n\nУскорение на первом участке равно 3 м/с^{2}.');
  await appearance(page, 'light');
  await screenshot(page, 'editor-light');
  await page.setViewportSize({ width: 800, height: 900 });
  const narrow = await page.locator('.qw-bank-edit-layout').evaluate(el => ({
    right: el.getBoundingClientRect().right,
    width: el.querySelector('.qw-bank-rich-editor:not([hidden]) textarea').clientWidth,
    viewport: innerWidth
  }));
  assert.ok(narrow.right <= narrow.viewport && narrow.width > 360);
  await screenshot(page, 'editor-800-light');
  await page.setViewportSize(viewport);
  await section(page, 'criteria');
  await field(page, 'criteria').fill('');
  await toolbar(page, 'table').click();
  assert.match(await field(page, 'criteria').inputValue(), /\| Величина \| Значение \|/);
  await field(page, 'criteria').fill('| Шаг | Балл |\n| --- | --- |\n| Выбраны участки графика | 1 |\n| Обоснован способ вычисления площади | 1 |');
  await action(page, 'bank-edit-save').click();
  await page.locator('[data-bank-entry]').first().waitFor();
}

async function authorSystemTask(page) {
  await action(page, 'bank-new').click();
  await page.locator('[data-bank-source]').click();
  const prompt = field(page, 'prompt');
  await prompt.fill('## Линейная система\nРешите систему сложением уравнений.');
  await selectText(prompt, '');
  await choose(page, 'formula', 'cases');
  assert.match(await prompt.inputValue(), /\\begin\{cases\}/);
  await page.locator('[data-bank-edit-field=subject]').selectOption('algebra');
  await page.locator('[data-bank-edit-field=topic]').fill('Системы уравнений');
  await section(page, 'answer');
  await field(page, 'answer').fill('**Ответ**: \\(x=3\\), \\(y=2\\).');
  await section(page, 'comment');
  await field(page, 'comment').fill('1. Сложите уравнения и получите \\(2x=6\\).\n2. Подставьте \\(x=3\\) в первое уравнение.');
  await action(page, 'bank-edit-save').click();
  await page.locator('[data-bank-entry]').nth(1).waitFor();
}

async function printPdf(context, app, project, format) {
  const page = await context.newPage();
  try {
    const html = await app.evaluate(({ project, format }) => qwPrintDocumentHTML(project, false, {
      format, includeComments: true, includeCriteria: true
    }), { project, format });
    await page.setContent(html);
    await page.evaluate(() => window.qwPrintReady);
    assert.equal(await page.evaluate(() => window.__qwPrintError || null), null);
    if (format === 'booklet') {
      for (const selector of ['mfrac', 'mtable', 'u', '[style*="text-align"]', 'figure svg']) {
        assert.ok(await page.locator(selector).count(), selector + ' in student PDF');
      }
      assert.doesNotMatch(await page.locator('body').innerText(), /Обоснован способ/);
    } else {
      for (const selector of ['strong', 'table', 'sub', 'sup', 'ol']) {
        assert.ok(await page.locator(selector).count(), selector + ' in teacher key');
      }
    }
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({ path: path.join(out, format === 'answers' ? 'examples-key.pdf' : 'examples.pdf'),
      preferCSSPageSize: true, printBackground: true });
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(path.join(out, 'screenshots'), { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  try {
    const context = await browser.newContext({ offline: true, acceptDownloads: true, viewport });
    const page = await startBank(context, errors);
    await authorGraphTask(page);
    await authorSystemTask(page);
    await page.reload();
    await page.locator('[data-action="launcher-bank"]').click();
    await page.locator('[data-bank-view]').nth(1).waitFor();
    await page.locator('[data-bank-view]').first().click();
    await page.locator('.qw-bank-video-canvas svg[viewBox]').first().waitFor();
    const edit = page.locator('[data-bank-edit]');
    await edit.click();
    await page.locator('[data-bank-source]').click();
    await section(page, 'comment');
    const solution = field(page, 'comment');
    assert.match(await solution.inputValue(), /Площадь треугольника/);
    await selectText(solution, '');
    await choose(page, 'symbol', 'Δ');
    assert.match(await solution.inputValue(), /Δ$/);
    await toolbar(page, 'undo').click();
    assert.doesNotMatch(await solution.inputValue(), /Δ$/);
    await solution.fill(await solution.inputValue() + '\n\nПроверка: сравните результат с оценкой сверху.');
    await solution.press('Control+s');
    await page.locator('.qw-bank-solution').waitFor();
    await page.locator('.qw-bank-solution summary').click();
    assert.match(await page.locator('.qw-bank-solution').innerText(), /с оценкой сверху/);

    await appearance(page, 'dark');
    const canvas = page.locator('.qw-bank-video-canvas');
    const background = () => canvas.evaluate(el => getComputedStyle(el).backgroundColor);
    assert.notEqual(await background(), 'rgb(255, 255, 255)');
    await page.locator('[data-bank-paper]').click();
    assert.equal(await background(), 'rgb(255, 255, 255)');
    await page.locator('[data-bank-enlarge]').click();
    const zoom = page.locator('.qw-bank-zoom [data-publish-zoom]');
    await zoom.selectOption('125');
    assert.equal(await page.locator('.qw-bank-study-page').evaluate(el => getComputedStyle(el).zoom), '1.25');
    await screenshot(page, 'bank-enlarged-paper');
    await zoom.press('Escape');
    assert.equal(await zoom.isVisible(), false);

    await page.locator('.qw-bank-operations summary').click();
    const archiveDownload = page.waitForEvent('download');
    await action(page, 'bank-backup').click();
    await (await archiveDownload).saveAs(archivePath);
    const archive = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
    assert.equal(archive.count, 2);
    assert.equal(archive.version, 3);
    assert.equal(archive.records.find(entry => entry.bankNumber === 1).revision, 2);

    await page.locator('[data-bank-select]').first().check();
    await page.locator('[data-bank-select]').nth(1).check();
    await action(page, 'bank-add-selection').click();
    await page.waitForFunction(() => qwDoc.tasks.length === 2);
    await page.evaluate(() => qwChange(() => {
      qwDoc.title = 'Движение и линейная система';
      qwDoc.subject = 'mixed';
      qwDoc.printSettings = qwPrintSettings({ ...qwDoc.printSettings, showTitle: true, titleText: qwDoc.title,
        showMeta: false, showVariant: false });
    }));
    const work = await page.evaluate(() => qwDoc);
    assert.equal(work.tasks[0].source.number, 1);
    assert.equal(work.tasks[1].source.number, 2);
    const workDownload = page.waitForEvent('download');
    await page.evaluate(() => qwSaveFile());
    await (await workDownload).saveAs(workPath);
    assert.deepEqual(JSON.parse(fs.readFileSync(workPath, 'utf-8')), work);
    await printPdf(context, page, work, 'booklet');
    await printPdf(context, page, work, 'answers');

    const recovery = await browser.newContext({ offline: true, viewport });
    const restore = await startBank(recovery, errors);
    const upload = restore.locator('#qw-bank-restore-file');
    const damaged = structuredClone(archive);
    damaged.records[0].task.comment += ' повреждено';
    await upload.setInputFiles({ name: 'damaged.qwbank', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(damaged)) });
    await restore.locator('#qw-bank-save-status.qw-error').waitFor();
    assert.equal(await restore.locator('[data-bank-entry]').count(), 0);
    await upload.setInputFiles(archivePath);
    await restore.locator('#qw-bank-restore-confirm').click();
    await restore.locator('[data-bank-entry]').nth(1).waitFor();
    const restored = await restore.evaluate(async ids => Promise.all(ids.map(id => qwBankRepository.getTask(id))),
      archive.records.map(record => record.id));
    assert.deepEqual(restored, archive.records);
    const raster = await restore.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 24; canvas.height = 18;
      const drawing = canvas.getContext('2d');
      drawing.fillStyle = '#447a64'; drawing.fillRect(0, 0, 24, 18);
      return canvas.toDataURL('image/png');
    });
    await restore.locator('[data-bank-view]').nth(1).click();
    await restore.locator('[data-bank-edit]').click();
    await restore.locator('#qw-bank-edit-image').setInputFiles({
      name: 'isolated-image.png', mimeType: 'image/png', buffer: Buffer.from(raster.split(',')[1], 'base64')
    });
    await restore.waitForFunction(() => document.querySelector('[data-bank-task-field="figure"]')?.value === 'image');
    await action(restore, 'bank-edit-save').click();
    const image = restore.locator('.qw-bank-video-canvas img');
    await image.waitFor();
    assert.equal(await image.getAttribute('src'), raster);
    assert.deepEqual(errors, []);
    await recovery.close();
    await context.close();
    console.log('PASS BANK-02: authoring, keyboard and toolbar undo/redo, graph, zoom, both themes, QWORK, real PDF and QWBANK corruption/restore');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
