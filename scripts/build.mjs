import '../src/vendor/jszip.min.js';
import {readFileSync,mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');const read=p=>readFileSync(resolve(root,p),'utf8');
function bundleCSS(file, stack = []) {
  if (stack.includes(file)) throw Error('CSS import cycle: ' + file);
  return read(file).replace(/@import\s+"([^"\n]+)";/g, (_, name) => {
    const target=resolve(root, file, '..', name);
    if (!target.startsWith(root + '/src/')) throw Error('CSS import outside src');
    return bundleCSS(target.slice(root.length + 1), [...stack, file]);
  });
}
const styles=bundleCSS('src/styles.css');const js=['src/vendor/jszip.min.js','src/core/dates.js','src/core/formulas.js','src/core/workbook.js','src/core/charts.js','src/core/conditional.js','src/core/validation.js','src/core/data-transform.js','src/core/xlsx-charts.js','src/core/printing.js','src/core/xlsx-print.js','src/core/reference-move.js','src/core/clipboard.js','src/core/structure.js','src/core/store.js','src/core/xlsx.js','src/core/recalculation.js','src/core/direct-file.js','src/core/studio-model.js','src/main.js'].map(x=>read(x).replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^\n]*\};?\r?\n/gm,'').replace(/^export /gm,'')).join('\n\n');
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111b31"><meta name="quantum-office-build" content="TASK096"><title>Quantum Office — Таблицы</title><style>${styles}</style></head><body><div id="app"></div><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
mkdirSync(resolve(root,'dist'),{recursive:true});writeFileSync(resolve(root,'dist/index.html'),html);writeFileSync(resolve(root,'Quantum-Office.html'),html);const zip=new globalThis.JSZip();zip.file('Quantum-Office.html',html);const zipped=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});writeFileSync(resolve(root,'Quantum-Office.zip'),zipped);const verified=await globalThis.JSZip.loadAsync(zipped,{checkCRC32:true});if(await verified.file('Quantum-Office.html').async('string')!==html)throw Error('Offline ZIP roundtrip failed');console.log(`Built offline HTML: ${(Buffer.byteLength(html)/1024).toFixed(1)} KB`);

// The catalog is bundled from the same production CSS, with no external requests.
const catalog=read('docs/components.html').replace('<link rel="stylesheet" href="../src/styles.css">', '<style>'+styles+'</style>');
writeFileSync(resolve(root,'dist/components.html'),catalog);
