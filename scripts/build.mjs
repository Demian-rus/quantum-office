import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'..'),read=p=>readFileSync(resolve(root,p),'utf8');
const css=read('src/styles.css');
const modules=['src/core/formulas.js','src/core/workbook.js','src/core/store.js','src/main.js'];
const js=modules.map(p=>read(p)
  .replace(/^import .*?;\s*$/gm,'')
  .replace(/^export \{[^}]+\};?\s*$/gm,'')
  .replace(/^export /gm,'')).join('\n\n');
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quantum Office — Таблицы</title><style>${css}</style></head><body><div id="app"></div><script>${js.replace(/<\\/script/gi,'<\\/script')}</script></body></html>`;
mkdirSync(resolve(root,'dist'),{recursive:true});
writeFileSync(resolve(root,'dist/index.html'),html);
console.log('Built dist/index.html');
