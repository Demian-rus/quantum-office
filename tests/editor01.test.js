import assert from 'node:assert/strict';
import test from 'node:test';
import {qwProject,qwTask,qwValidate,qwPrintSettings} from '../src/core/work-model.js';
import {qwPrintFieldHTML,qwRichMarkdownHTML} from '../src/core/work-content.js';
import {qwTextStyle,qwReadTextStyle,qwTextStyleAttrs,qwCalloutOptions} from '../src/core/work-text-style.js';

test('EDITOR-01 round trips versioned text defaults and leaves legacy projects untouched',()=>{
 const legacy=qwValidate({...qwProject(),tasks:[{...qwTask(),prompt:'Обычный текст'}]});
 assert.equal(legacy.printSettings,undefined);
 assert.equal(legacy.tasks[0].publishing,undefined);
 const prompt='::format line=1.5 after=9\n[[style font=serif size=14 color=#1f445f]]\\(a_x\\)[[/style]]\n\n> [!note icon=0] Примечание\n> Текст блока';
 const doc=qwValidate({...legacy,printSettings:qwPrintSettings({profile:'notes',numbering:'none',
  text:{version:1,font:'sans',size:12,align:'left',before:5,after:4}}),
  tasks:[{...legacy.tasks[0],prompt,publishing:{text:{version:1,color:'#aabbcc',weight:'bold'}}}]});
 assert.deepEqual(qwValidate(JSON.parse(JSON.stringify(doc))),doc);
 assert.equal(doc.tasks[0].prompt,prompt);
 assert.throws(()=>qwValidate({...doc,printSettings:{...doc.printSettings,text:{version:2,font:'serif'}}}),/версия/);
 assert.throws(()=>qwValidate({...doc,tasks:[{...doc.tasks[0],publishing:{text:{version:1,size:100}}}]}),/Недопустимое/);
 assert.throws(()=>qwPrintSettings({...doc.printSettings,profile:'unknown'}),/профиль/);
});

test('EDITOR-01 shared markup renders nested formatting, safe options and MathML',()=>{
 const source='::format line=1.5 after=7\n### Пружина и [[style font=serif size=16]]амплитуда[[/style]]\n\n'+
  '> [!theory icon=0 tone=green pad=12] **Период**\n> Для [[style highlight=#fff0a1]]\\(T=\\frac1{\\nu}\\)[[/style]].\n>\n> - Первый шаг\n> - Второй шаг';
 const html=qwPrintFieldHTML(source);
 assert.match(html,/<h5>/);
 assert.match(html,/margin-block-end:7pt/);
 assert.match(html,/<aside[^>]*data-qw-callout="theory"/);
 assert.doesNotMatch(html,/class="qw-callout-icon"/);
 assert.match(html,/<strong>Период<\/strong>/);
 assert.match(html,/<mfrac>/);
 assert.match(html,/<ul><li>Первый шаг<\/li><li>Второй шаг<\/li><\/ul>/);
 assert.match(qwTextStyleAttrs({version:1,before:6,after:5},true),/data-qw-default-spacing="before after"/);
 const nested=qwRichMarkdownHTML('**[[style font=sans]]A [[style color=#222222]]B[[/style]][[/style]]**');
 assert.match(nested,/<strong><span[^>]+>A <span[^>]+>B<\/span><\/span><\/strong>/);
});

test('EDITOR-01 allowlist rejects unknown directives and never interpolates user HTML or CSS',()=>{
 assert.equal(qwReadTextStyle('color=#123456 opacity=2'),null);
 assert.equal(qwReadTextStyle('font=serif font=sans'),null);
 assert.equal(qwCalloutOptions('note','pad=999'),null);
 assert.throws(()=>qwTextStyle({version:1,font:'Custom User Font'}),/Недопустимое/);
 const html=qwRichMarkdownHTML('[[style color=blue;position=fixed]]<img src="x">[[/style]]\n\n> [!note icon=0] <b>Заголовок</b>\n> <iframe src="x">');
 assert.doesNotMatch(html,/<img|<iframe|<b>Заголовок|style="color:blue/);
 assert.match(html,/&lt;img/);
 assert.match(html,/&lt;b&gt;Заголовок&lt;\/b&gt;/);
 assert.match(html,/&lt;iframe/);
});
