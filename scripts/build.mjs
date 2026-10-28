import {readFileSync,mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');const read=p=>readFileSync(resolve(root,p),'utf8');
const styles=read('src/styles.css');const js=['src/vendor/jszip.min.js','src/core/formulas.js','src/core/workbook.js','src/core/clipboard.js','src/core/structure.js','src/core/store.js','src/core/xlsx.js','src/main.js'].map(x=>read(x).replace(/^import .*?;\s*$/gm,'').replace(/^export /gm,'')).join('\n\n');
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111b31"><title>Quantum Office — Таблицы</title><style>${styles}</style></head><body><div id="app"></div><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
mkdirSync(resolve(root,'dist'),{recursive:true});writeFileSync(resolve(root,'dist/index.html'),html);writeFileSync(resolve(root,'Quantum-Office.html'),html);console.log(`Built offline HTML: ${(Buffer.byteLength(html)/1024).toFixed(1)} KB`);
