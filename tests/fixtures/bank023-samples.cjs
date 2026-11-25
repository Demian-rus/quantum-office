const fixture = structuredClone(require('./bank022-samples.cjs'));

// Keep the same 14 exercises and their numbering. These edits are limited
// to this demonstration fixture and never rewrite a user's bank.
fixture[6].graph.ymin = 0;
fixture[6].graph.step = 5;
fixture[8].prompt = String.raw`Вычислите \(\frac{\sqrt{81}+3^2}{2}\).`;
fixture[11].prompt = fixture[11].prompt.replace(/\n\n::center a~\{1\} = 4$/, '');
const square = (x, y, side, fill) => ({
  kind: 'rect', x, y, x2: x + side, y2: y + side, label: '',
  style: { stroke: '#1c1c1c', fill, width: 2 },
});
delete fixture[13].raster;
Object.assign(fixture[13], {
  type: 'diagram', figure: 'diagram',
  diagram: [square(140, 40, 240, '#ffffff'), square(210, 110, 100, '#e9e9e9')],
  publishing: { figure: { width: 25, maxMm: 36, position: 'right', align: 'center', gapMm: 2 } },
});

module.exports = fixture;
