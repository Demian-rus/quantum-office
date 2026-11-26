/* BANK-02.1: live editing, comparable screens and vector print on synthetic data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const samples = require('./fixtures/bank021-samples.cjs');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'evidence/bank-02.1');
const candidate = path.join(root, 'Quantum-Office.html');
const baseline = process.env.QO_BANK021_BASELINE || path.join(output, 'before/Quantum-Office.html');
const viewport = { width: 1440, height: 900 };
const action = (page, name) => page.locator(`[data-qw-action="${name}"]`);
const view = (page, num) => page.locator(`[data-bank-view="bank021-${num}"]`);
const live = (page, key = 'prompt') => page.locator(`[data-bank-live="${key}"]`);
const source = (page, key = 'prompt') => page.locator(`[data-bank-task-field="${key}"]`);
const tab = (page, key) => page.locator(`[data-bank-tab="${key}"]`).click();
const format = (page, kind) => page.locator(`[data-bank-format="${kind}"]`).click();
const select = (page, menu, value) => page.locator(`[data-bank-format-select="${menu}"]`).selectOption(value);

async function app(browser, file, errors, seed = true) {
  const context = await browser.newContext({ offline: true, viewport, acceptDownloads: true });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(file).href);
  if (seed) await page.evaluate(async rows => {
    const entries = rows.map(({ type, subject = 'physics', graph, raster, ...fields }, index) => {
      const task = qwTask(type);
      Object.assign(task, fields);
      if (graph) Object.assign(task.graph, graph);
      if (raster) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 160;
        const drawing = canvas.getContext('2d');
        drawing.fillStyle = '#fff'; drawing.fillRect(0, 0, 160, 160);
        drawing.fillStyle = '#41826d'; drawing.fillRect(14, 14, 132, 132);
        drawing.clearRect(62, 62, 55, 55);
        task.figure = 'image'; task.image = canvas.toDataURL('image/png');
        task.figureWidth = 145; task.figureWidthMode = 'manual';
      }
      if (fields.figureWidth) task.figureWidthMode = 'manual';
      task.id = 'fixture-task-' + index;
      return qwBankNormalize({ id: 'bank021-' + (index + 1), bankNumber: 801 + index, subject,
        grade: '11', exam: 'general', part: '1', slot: String(index + 1), topic: fields.topic, origin: 'original', task });
    });
    localStorage.setItem(QW_BANK_KEY, JSON.stringify(entries));
  }, samples);
  await page.locator('[data-action="launcher-bank"]').click();
  if (seed) await view(page, 1).waitFor();
  return { context, page };
}

async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator('#toast.active').waitFor({ state: 'hidden' });
  await page.screenshot({ path: path.join(output, 'screenshots', name + '.png'), animations: 'disabled' });
}

function setTheme(page, theme) {
  return page.evaluate(value => { qoThemePreference = value; qoApplyAppearance(); }, theme);
}

async function capture(page, label) {
  await setTheme(page, 'dark');
  await view(page, 1).click();
  const canvas = page.locator('.qw-bank-video-canvas');
  await canvas.locator('svg').waitFor();
  if (label === 'after') {
    assert.doesNotMatch(await view(page, 9).locator('.qw-bank-summary').textContent(), /\\frac|\\sqrt/);
    assert.doesNotMatch(await view(page, 12).locator('.qw-bank-summary').textContent(), /[*+]/);
  }
  await shot(page, label + '-card');
  await page.locator('[data-bank-enlarge]').click();
  if (label === 'before') await page.locator('[data-bank-zoom]').fill('125');
  else await page.locator('.qw-bank-zoom [data-publish-zoom]').selectOption('125');
  await page.locator('.qw-bank-solution summary').click();
  await shot(page, label + '-enlarged');
  await page.locator('[data-bank-enlarge]').click();
  await page.locator('[data-bank-edit="bank021-1"]').click();
  const editable = label === 'before' ? source(page) : live(page);
  await editable.waitFor();
  await shot(page, label + '-editor');
  if (label === 'after') {
    await setTheme(page, 'light');
    await shot(page, 'after-editor-light');
    await action(page, 'bank-edit-back').click();
    await view(page, 1).click();
    await page.locator('.qw-study-condition').waitFor();
    await shot(page, 'after-card-light');
    await page.locator('[data-bank-enlarge]').click();
    await page.locator('[data-bank-paper]').click();
    await shot(page, 'after-enlarged-paper');
    await page.locator('[data-bank-paper]').click();
    await page.locator('[data-bank-enlarge]').click();
    await view(page, 14).click();
    const image = page.locator('.qw-study-flow img');
    await image.waitFor();
    const raster = () => image.evaluate(node => ({ uri: node.src, filter: getComputedStyle(node).filter }));
    const lightRaster = await raster();
    await setTheme(page, 'dark');
    assert.deepEqual(await raster(), lightRaster);
    assert.equal(lightRaster.filter, 'none');
    assert.notEqual(await canvas.evaluate(node =>
      getComputedStyle(node).backgroundColor), 'rgb(255, 255, 255)');
    await shot(page, 'after-original-image-dark');
    await action(page, 'bank-new').click();
  }
}

async function selectText(surface, selected) {
  await surface.evaluate((editor, text) => {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const start = node.data.indexOf(text);
      if (start < 0 || node.parentElement.closest('[contenteditable=false]')) continue;
      editor.focus();
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, start + text.length);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    throw Error('Отсутствует текст для выделения: ' + text);
  }, selected);
}

async function paste(surface, payload) {
  await surface.evaluate((editor, values) => {
    const data = new DataTransfer();
    for (const [key, value] of Object.entries(values)) data.setData(key, value);
    editor.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  }, payload);
}

async function author(page) {
  const prompt = live(page);
  await prompt.waitFor();
  assert.equal(await source(page).isVisible(), false);
  await prompt.focus();
  await page.keyboard.insertText('Площадь трапеции');
  await selectText(prompt, 'Площадь трапеции');
  await select(page, 'heading', '1');
  assert.equal(await prompt.locator('h3').innerText(), 'Площадь трапеции');
  await prompt.press('End');
  await prompt.press('Enter');
  await page.keyboard.insertText('Найдите площадь фигуры');
  await selectText(prompt, 'площадь');
  await page.keyboard.press('Control+b');
  assert.equal(await prompt.locator('b,strong').first().innerText(), 'площадь');
  await page.keyboard.press('Control+z');
  assert.equal(await prompt.locator('b,strong').count(), 0);
  await page.keyboard.press('Control+y');
  assert.match(await source(page).inputValue(), /__площадь__/);
  await selectText(prompt, 'фигуры');
  await format(page, 'italic');
  await selectText(prompt, 'Найдите');
  await format(page, 'underline');
  await select(page, 'align', 'center');
  assert.match(await source(page).inputValue(), /::center/);
  assert.equal(await prompt.locator('i,em').first().innerText(), 'фигуры');
  assert.equal(await prompt.locator('u').innerText(), 'Найдите');
  await page.keyboard.press('End');
  await page.keyboard.insertText('. ');
  await select(page, 'formula', 'fraction');
  const equation = page.locator('[data-bank-equation-source]');
  await equation.fill(String.raw`\frac{a}{`);
  await page.locator('[data-bank-equation-apply]').click();
  assert.equal(await equation.isVisible(), true);
  await equation.fill(String.raw`S=\frac{a+b}{2}h`);
  await page.locator('[data-bank-equation-apply]').click();
  await prompt.locator('mfrac').waitFor();
  await prompt.locator('[data-qw-live-atom]').first().click();
  assert.equal(await equation.inputValue(), String.raw`S=\frac{a+b}{2}h`);
  await equation.fill(String.raw`S=\frac{a+b}{2}\cdot h`);
  await page.locator('[data-bank-equation-apply]').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await paste(prompt, { 'text/plain': String.raw`Пример **буквально** <img src=x> | \(x\)`, 'text/html': '<img src=x onerror=alert(1)>' });
  assert.equal(await prompt.locator('img').count(), 0);
  assert.match(await prompt.innerText(), /\*\*буквально\*\*/);
  await selectText(prompt, 'Пример');
  const copied = await prompt.evaluate(editor => {
    const data = new DataTransfer();
    editor.dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true }));
    return [data.getData('text/plain'), data.getData('application/x-quantum-task-markdown')];
  });
  assert.deepEqual(copied, ['Пример', 'Пример']);
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await format(page, 'table');
  await prompt.locator('table').waitFor();
  await page.locator('[data-bank-visual="graph"]').click();
  const preset = page.locator('#qw-graph-preset');
  if (!await preset.isVisible()) await page.locator('[data-visual-panel="tools"]').click();
  await preset.selectOption('v');
  await action(page, 'visual-apply').click();
  await prompt.locator('mfrac').waitFor();
  await page.locator('[data-bank-live-figure] svg').waitFor();

  await tab(page, 'comment');
  await live(page, 'comment').focus();
  await select(page, 'formula', 'cases');
  await page.locator('[data-bank-equation-apply]').click();
  await live(page, 'comment').locator('mtable').waitFor();
  assert.match(await source(page, 'comment').inputValue(), /\$\$/);
  await tab(page, 'answer');
  await live(page, 'answer').focus();
  await page.keyboard.insertText('18 см²');
  await tab(page, 'criteria');
  await live(page, 'criteria').focus();
  await page.keyboard.insertText('Верная формула');
  await format(page, 'numbered');
  await live(page, 'criteria').locator('ol').waitFor();
  await tab(page, 'prompt');
  const storedPrompt = await source(page).inputValue();
  await page.locator('[data-bank-source]').click();
  assert.equal(await source(page).isVisible(), true);
  assert.match(storedPrompt, /\\\*\\\*буквально/);
  await page.locator('[data-bank-source]').click();
  await page.locator('[data-bank-preview-toggle]').click();
  const preview = page.frameLocator('[data-bank-publish-frame]').locator('.qw-print-document');
  await preview.locator('.qw-print-page table').waitFor();
  assert.match(await preview.innerText(), /\*\*буквально\*\*/);
  assert.match(await preview.innerText(), /\\\(x\\\)/);
  assert.equal(await preview.locator('img').count(), 0);
  await page.locator('[data-bank-preview-toggle]').click();
  await action(page, 'bank-edit-save').click();
  await page.locator('.qw-bank-edit-dialog').waitFor({ state: 'detached' });
  const saved = await page.evaluate(async () => {
    const result = await qwBankRepository.listTasks({}, { offset: 0, limit: 30 });
    return result.items.find(entry => entry.bankNumber === 815)?.id;
  });
  assert.ok(saved);
  await page.locator(`[data-bank-view="${saved}"]`).click();
  await page.locator(`[data-bank-edit="${saved}"]`).click();
  await live(page).locator('mfrac').waitFor();
  assert.equal(await source(page).inputValue(), storedPrompt.trim());
  await tab(page, 'answer');
  const answer = live(page, 'answer');
  await answer.focus(); await page.keyboard.press('End');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text: ' (уточнено)', selectionStart: 11, selectionEnd: 11 });
  await cdp.send('Input.insertText', { text: ' (уточнено)' });
  await cdp.detach();
  assert.equal(await source(page, 'answer').inputValue(), '18 см² (уточнено)');
  await action(page, 'bank-edit-save').click();
  await page.locator('.qw-bank-edit-dialog').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(async id => (await qwBankRepository.getTask(id)).revision, saved), 2);
  return saved;
}

async function renderPdf(context, appPage, project, orientation, format, errors) {
  const html = await appPage.evaluate(({ project, orientation, format }) => {
    project.printSettings.orientation = orientation;
    return qwPrintDocumentHTML(project, false, { format, includeComments: true, includeCriteria: true });
  }, { project, orientation, format });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent(html);
  await page.evaluate(() => window.qwPrintReady);
  const features = await page.evaluate(() => ({
    error: window.__qwPrintError || null,
    pages: document.querySelectorAll('.qw-print-page').length,
    layout: window.__qwPrintLayout?.layout,
    sheets: window.__qwPrintLayout?.sheets,
    headings: document.querySelectorAll('.qw-print-title').length,
    repeatedTitle: [...document.querySelectorAll('.qw-print-page')].slice(1).some(page => page.innerText.includes('Практикум по физике и математике')),
    ids: [...document.querySelectorAll('[data-qw-bank-number]')].map(node => Number(node.dataset.qwBankNumber)),
    sizes: [...document.querySelectorAll('.qw-print-page')].map(node => [node.clientWidth, node.clientHeight]),
    formulas: document.querySelectorAll('math').length,
    fraction: !!document.querySelector('mfrac'),
    radical: !!document.querySelector('msqrt'),
    system: !!document.querySelector('mtable'),
    tables: document.querySelectorAll('table').length,
    drawings: document.querySelectorAll('figure svg').length,
    images: document.querySelectorAll('figure img').length,
    signatures: document.querySelectorAll('.qw-qx-lettering').length,
    solution: document.body.innerText.includes('Площадь трапеции и итог') || document.body.innerText.includes('Площадь прямоугольника и итог'),
    overflow: [...document.querySelectorAll('.qw-print-page')].some(node => node.scrollWidth > node.clientWidth + 3),
  }));
  assert.equal(features.error, null);
  assert.equal(features.layout, orientation === 'landscape' ? 'spread' : 'portrait');
  assert.ok(features.pages >= 2);
  assert.equal(features.headings, 1);
  assert.equal(features.repeatedTitle, false);
  assert.ok(features.fraction && features.radical && features.tables >= 1, JSON.stringify(features));
  assert.equal(features.overflow, false);
  assert.deepEqual([...new Set(features.ids)], samples.map((_, index) => 801 + index));
  if (format === 'booklet') {
    assert.ok(features.drawings >= 5 && features.images === 1);
    assert.equal(features.signatures, features.sheets);
    assert.equal(features.solution, false);
  } else {
    assert.equal(features.solution, true);
    assert.equal(features.system, true);
  }
  const name = format === 'answers' ? 'study-key' : 'study-' + orientation;
  await page.pdf({ path: path.join(output, name + '.pdf'), preferCSSPageSize: true, printBackground: true });
  await page.close();
  return { name, ...features };
}

async function main() {
  fs.mkdirSync(path.join(output, 'screenshots'), { recursive: true });
  const browser = await chromium.launch();
  const errors = [];
  try {
    if (fs.existsSync(baseline)) {
      const before = await app(browser, baseline, errors);
      await capture(before.page, 'before');
      await before.context.close();
    }
    const { context, page } = await app(browser, candidate, errors);
    await capture(page, 'after');
    const saved = await author(page);
    console.log('PASS Visual editing: real DOM, Cyrillic, shortcut history, formatting, safe clipboard, MathML, graph handoff and reopening');
    const archive = await page.evaluate(() => qwBankRepository.createVerifiedBackup());
    assert.equal(archive.version, 3);
    assert.equal(archive.count, samples.length + 1);
    const sampleArchive = await page.evaluate(async id => {
      const entry = await qwBankRepository.getTask(id);
      await qwBankRepository.deleteTask(id, entry.revision);
      return qwBankRepository.createVerifiedBackup();
    }, saved);
    fs.writeFileSync(path.join(output, 'study.qwbank'), JSON.stringify(sampleArchive));
    const recovery = await app(browser, candidate, errors, false);
    const restore = recovery.page.locator('#qw-bank-restore-file');
    const damaged = structuredClone(sampleArchive);
    damaged.records[0].task.prompt += ' изменено';
    await restore.setInputFiles({ name: 'damaged.qwbank', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(damaged)) });
    await recovery.page.locator('#qw-bank-save-status.qw-error').waitFor();
    assert.equal(await recovery.page.locator('[data-bank-view]').count(), 0);
    await restore.setInputFiles(path.join(output, 'study.qwbank'));
    await recovery.page.locator('#qw-bank-restore-confirm').click();
    await view(recovery.page, 14).waitFor();
    assert.deepEqual(await recovery.page.evaluate(async ids => Promise.all(ids.map(id => qwBankRepository.getTask(id))),
      sampleArchive.records.map(record => record.id)), sampleArchive.records);
    await recovery.context.close();

    const project = await page.evaluate(records => {
      const d = qwProject();
      d.title = 'Практикум по физике и математике'; d.layout = 'booklet';
      d.printSettings = qwPrintSettings({ fontPt: 10, showTitle: true, titleText: d.title, showMeta: false, showVariant: false });
      d.tasks = records.toSorted((a, b) => a.bankNumber - b.bankNumber).map(entry => ({
        ...entry.task, source: { kind: 'bank', id: entry.id, number: entry.bankNumber },
      }));
      return qwValidate(d);
    }, sampleArchive.records);
    assert.deepEqual(await page.evaluate(d => qwValidate(JSON.parse(JSON.stringify(d))), project), project);
    await assert.rejects(page.evaluate(d => qwPDFBytes(d), project), /Оформленные задания печатаются через векторный PDF/);
    fs.writeFileSync(path.join(output, 'study.qwork'), JSON.stringify(project, null, 2));
    const surfaces = await page.evaluate(d => {
      route('work'); qwDoc = d; qwSelected = d.tasks[0].id; qwRender();
      const work = document.querySelector('#qw-task-editor [data-bank-live=prompt]');
      const question = { id: 'bank021-diag', type: 'numeric', points: 2, prompt: d.tasks[0].prompt,
        answer: '18 м', criteria: 'Критерий диагноста' };
      const diag = qdNormalize({ sections: [{ title: 'Раздел', questions: [question] }] });
      const q = diag.sections[0].questions[0];
      const template = document.createElement('template');
      template.innerHTML = qdRunQuestion(q, 0, diag);
      const teacherInitiallyHidden = !template.content.textContent.includes('Критерий диагноста');
      qdRevealed.add(q.id); template.innerHTML = qdRunQuestion(q, 0, diag); qdRevealed.delete(q.id);
      return { constructorMath: !!work.querySelector('math'),
        diagnosticsMath: !!template.content.querySelector('.qw-study-text math'), teacherInitiallyHidden,
        teacherRevealed: template.content.textContent.includes('Критерий диагноста') };
    }, project);
    await page.locator('#qw-task-editor [data-bank-publish-toggle]').click();
    const permanent = page.frameLocator('#qw-task-editor [data-bank-publish-frame]').locator('.qw-print-page .qw-study-id');
    assert.equal(await permanent.textContent(), '№ 00801.');
    assert.deepEqual(surfaces, { constructorMath: true, diagnosticsMath: true,
      teacherInitiallyHidden: true, teacherRevealed: true });
    const print = [];
    for (const orientation of ['portrait', 'landscape']) print.push(await renderPdf(context, page, project, orientation, 'booklet', errors));
    print.push(await renderPdf(context, page, project, 'portrait', 'answers', errors));
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ tasks: sampleArchive.count, surfaces, print }, null, 2));
    console.log('PASS Isolated QWORK/QWBANK round trip and SHA-256 rejection, shared study surfaces, A4 portrait and landscape and teacher key');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
