const baseline = require('./bank021-samples.cjs');

const fixture = structuredClone(baseline).map(task => {
  const heading = task.prompt.match(/^#{1,4} ([^\n]+)\n/);
  if (!heading || heading[1] === 'Проверьте единицы') return task;
  return { ...task, title: heading[1], prompt: task.prompt.slice(heading[0].length) };
});
fixture[0].publishing = { figure: { width: 34, maxMm: 56, align: 'center', position: 'right', gapMm: 2 } };
fixture[0].tags = ['равноускоренное движение', 'скорость'];
fixture[4].publishing = { figure: { width: 34, maxMm: 55, align: 'center', position: 'right', gapMm: 2 } };
fixture[4].diagram = [
  { kind: 'block', x: 152, y: 108, x2: 275, y2: 183, label: 'm' },
  { kind: 'ground', x: 52, y: 183, x2: 397, y2: 183, label: '' },
  { kind: 'forceVector', x: 275, y: 141, x2: 382, y2: 141, label: 'F' },
  { kind: 'forceVector', x: 152, y: 141, x2: 88, y2: 141, label: 'Fтр' },
];
fixture[5].publishing = { tables: { prompt: [{ width: 64, columns: [20, 40, 40], align: 'center', fontPt: 9, padMm: 1, borderPt: .5, header: 'shade' }] } };
fixture[6].publishing = { figure: { width: 63, maxMm: 84, align: 'center', position: 'below', gapMm: 2 } };
fixture[10].publishing = { figure: { width: 29, maxMm: 43, align: 'center', position: 'right', gapMm: 2 } };
fixture[10].diagram = [
  { id: 'cell', kind: 'cell', x: 113, y: 162, x2: 376, y2: 210, label: '12 В' },
  { id: 'resistor', kind: 'resistor', x: 113, y: 62, x2: 376, y2: 110, label: '6 Ом' },
  { kind: 'wireOrth', x: 113, y: 86, x2: 113, y2: 186, label: '', bend: 113, links: { start: { id: 'resistor', port: 'L' }, end: { id: 'cell', port: 'L' } } },
  { kind: 'wireOrth', x: 376, y: 86, x2: 376, y2: 186, label: '', bend: 376, links: { start: { id: 'resistor', port: 'R' }, end: { id: 'cell', port: 'R' } } },
];
module.exports = fixture;
