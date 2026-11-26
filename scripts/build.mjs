import '../src/vendor/jszip.min.js';
import {qwPrintStyles,QW_PUBLISH_CSS} from '../src/core/work-layout.js';
import {QW_PRINT_FONT_CSS} from '../src/core/work-print-fonts.js';
import {verifyNativeStorageContract} from './native-storage-contract.mjs';
import {readFileSync,mkdirSync,writeFileSync,copyFileSync} from 'node:fs';
import {isAbsolute,relative,resolve,sep} from 'node:path';
const root=resolve(import.meta.dirname,'..');const read=p=>readFileSync(resolve(root,p),'utf8').replace(/\r\n/g,'\n');
const mathFont=readFileSync(resolve(root,'src/vendor/fonts/DejaVuMathTeXGyre.ttf')).toString('base64');
const mathFontCSS='/*!\n'+read('docs/licenses/DejaVu-Math.txt')+'*/\n'+
  '@font-face{font-family:"QO Math";src:url(data:font/ttf;base64,'+mathFont+') format("truetype");font-weight:400;font-display:block}';
function bundleCSS(file, stack = []) {
  if (stack.includes(file)) throw Error('CSS import cycle: ' + file);
  return read(file).replace(/@import\s+"([^"\n]+)";/g, (_, name) => {
    const target=resolve(root, file, '..', name);
    const sourcePath=relative(resolve(root,'src'),target);
    if (isAbsolute(sourcePath)||sourcePath==='..'||sourcePath.startsWith('..'+sep)) throw Error('CSS import outside src');
    return bundleCSS(relative(root,target), [...stack, file]);
  });
}
const styles=bundleCSS('src/styles.css')+QW_PUBLISH_CSS;const sources=['src/vendor/jszip.min.js','src/vendor/pdf-lib.min.js','src/core/dates.js','src/core/formulas.js','src/core/workbook.js','src/core/charts.js','src/core/conditional.js','src/core/validation.js','src/core/data-transform.js','src/core/xlsx-charts.js','src/core/printing.js','src/core/xlsx-print.js','src/core/reference-move.js','src/core/clipboard.js','src/core/structure.js','src/core/store.js','src/core/xlsx.js','src/core/recalculation.js','src/core/direct-file.js','src/core/studio-text.js','src/core/studio-photo.js','src/core/studio-model.js','src/core/diagnostic-presets.js','src/core/diagnostic-question-bank.js','src/core/workspace-icons.js','src/core/diagnostics.js','src/core/diagnostic-media.js','src/core/diagnostic-workbench.js','src/core/writer-navigation.js','src/core/writer-page-layout.js','src/core/writer-docx.js','src/core/writer-paragraph.js','src/core/bank-backup.js','src/core/bank-assets.js','src/core/office-backup.js','src/core/writer-symbols.js','src/core/writer-toc.js','src/core/sheet-mini-toolbar.js','src/core/work-physics.js','src/core/work-text-style.js','src/core/work-model.js','src/core/work-geometry.js','src/core/work-labels.js','src/core/work-content.js','src/core/work-live-editor.js','src/core/work-print-fonts.js','src/core/work-print-theme.js','src/core/work-layout.js','src/core/work-print.js','src/core/bank-repository.js','src/core/sqlite-bank-repository.js','src/core/work-builder.js','src/main.js','src/core/student-hub.js'];
const draftSources=new Set(['src/core/store.js','src/core/diagnostic-question-bank.js','src/core/diagnostics.js','src/core/diagnostic-workbench.js','src/core/work-builder.js','src/main.js','src/core/student-hub.js']);
verifyNativeStorageContract(Object.fromEntries([...draftSources].map(p=>[p,read(p)])),read('src/core/native-drafts-bootstrap.js'),read('src-tauri/src/drafts.rs'));
const bundle=native=>'const QW_MATH_FONT_CSS='+JSON.stringify(mathFontCSS)+';\n'+sources.map(x=>{
 let code=read(x).replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^\n]*\};?\r?\n/gm,'').replace(/^export /gm,'');
 if(native&&draftSources.has(x))code=code.replace(/\bglobalThis\.localStorage\b/g,'globalThis.qoDraftStorage').replace(/(?<![\w.])localStorage(?=\.)/g,'globalThis.qoDraftStorage');
 return code;
}).join('\n\n');
const js=bundle(false);
const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111b31"><meta name="quantum-office-build" content="TASK144"><title>Quantum Office — Таблицы</title><style>${styles}</style></head><body><div id="app"></div><script>${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;
mkdirSync(resolve(root,'dist'),{recursive:true});writeFileSync(resolve(root,'dist/index.html'),html);writeFileSync(resolve(root,'Quantum-Office.html'),html);const zip=new globalThis.JSZip();zip.file('Quantum-Office.html',html,{date:new Date(Date.UTC(1980,0,1))});const zipped=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE',compressionOptions:{level:6}});writeFileSync(resolve(root,'Quantum-Office.zip'),zipped);const verified=await globalThis.JSZip.loadAsync(zipped,{checkCRC32:true});if(await verified.file('Quantum-Office.html').async('string')!==html)throw Error('Offline ZIP roundtrip failed');console.log(`Built offline HTML: ${(Buffer.byteLength(html)/1024).toFixed(1)} KB`);

// The catalog is bundled from the same production CSS, with no external requests.
const catalog=read('docs/components.html').replace('<link rel="stylesheet" href="../src/styles.css">', '<style>'+styles+'</style>');
writeFileSync(resolve(root,'dist/components.html'),catalog);

// Same source bundle; native marker makes unavailable IPC fail closed. External script is CSP-compatible.
mkdirSync(resolve(root,'dist-native'),{recursive:true});writeFileSync(resolve(root,'dist-native/index.html'),html.replace('<style>'+styles+'</style>','<link rel="stylesheet" href="./app.css">').replace('<meta name="quantum-office-build"','<meta name="quantum-office-native" content="true"><meta name="quantum-office-build"').replace(/<script>[\s\S]*<\/script><\/body>/,'<script src="draft-bootstrap.js"></script></body>'));writeFileSync(resolve(root,'dist-native/app.js'),bundle(true));writeFileSync(resolve(root,'dist-native/draft-bootstrap.js'),read('src/core/native-drafts-bootstrap.js'));

// Keep static styles in same-origin assets. Tauri adds a CSP nonce to inline <style>
// in bundled HTML; that nonce disables the configured unsafe-inline for style attributes.
writeFileSync(resolve(root,'dist-native/app.css'),styles+'\n'+QW_PRINT_FONT_CSS+'\n'+mathFontCSS);
for(const orientation of ['portrait','landscape'])writeFileSync(resolve(root,'dist-native/print-'+orientation+'.css'),qwPrintStyles(orientation,'spread',mathFontCSS));

// Standalone print layout executes from a local trusted script in native WebView2.
const printSource=read('src/core/work-layout.js').replace(/^import .*?;\r?\n/gm,'').replace(/^export \{[^\n]*\};?\r?\n/gm,'');
writeFileSync(resolve(root,'dist-native/print.js'),printSource+'\nwindow.qwPrintReady=qwPreparePrintDocument().catch(error=>{window.__qwPrintError=error.message;document.body.textContent=error.message;document.body.className="qw-print-error";return null;});');
