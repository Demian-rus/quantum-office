import test from 'node:test';
import assert from 'node:assert/strict';
import {qwMath,qwMathML,qwHasRichSyntax,qwPrintFieldHTML,qwRichMarkdownHTML} from '../src/core/work-content.js';
import {qwProject,qwTask,qwValidate} from '../src/core/work-model.js';

test('BANK-02 safe markup is interpreted consistently in rich content and print',()=>{
 const text=String.raw`# Движение
## Параметры
::center Скорость ++постоянна++

Текст **с формулой \(\frac{v}{t}\)**, *пояснение*, индекс x~{0}, степень t^{2}.

- Первый пункт

1. Шаг

| Величина | Значение |
| --- | --- |
| Ускорение | \(\sqrt{4}\) |`;
 const html=qwRichMarkdownHTML(text);
 assert.equal(qwPrintFieldHTML(text),html);
 for(const part of ['<h3>Движение</h3>','<h4>Параметры</h4>','<p style="text-align:center">',
  '<u>постоянна</u>','<strong>с формулой <math','<mfrac>','<em>пояснение</em>',
  'x<sub>0</sub>','t<sup>2</sup>','<ul>','<ol>','<table>','<msqrt class="qw-radical">'])assert.ok(html.includes(part),part);
 assert.equal(qwHasRichSyntax(String.raw`\(t^{2}\)`),false);
 assert.match(qwRichMarkdownHTML('++<span>Текст</span>++'),/<u>&lt;span&gt;/);
 assert.doesNotMatch(qwRichMarkdownHTML('::url текст'),/style=/);
 assert.match(qwRichMarkdownHTML('`$F=ma$`'),/<code>\$F=ma\$<\/code>/);
});

test('BANK-02 systems share a bounded math tree with screen and PDF',()=>{
 const source=String.raw`\begin{cases}x+y=5\\x-y=1\end{cases}`;
 const ast=qwMath(source);
 assert.equal(ast.t,'cases');
 const html=qwMathML(ast);
 assert.match(html,/<mo fence="true" stretchy="true">\{<\/mo><mtable/);
 assert.equal((html.match(/<mtr>/g)||[]).length,2);
 assert.match(qwPrintFieldHTML('$$\n'+source+'\n$$'),/<mtable/);
 for(const bad of [String.raw`\begin{cases}x=1\end{cases}`,String.raw`\begin{cases}x=1\\\end{cases}`,
  String.raw`\begin{cases}x=1\\y=2`])assert.throws(()=>qwMath(bad),/Система/);
});

test('BANK-02 formatted fields survive QWORK v1 round-trip',()=>{
 const task=qwTask('graph');
 Object.assign(task,{prompt:'## Условие\n::right ++Скорость++',answer:'**30 м**',
  comment:'### Решение\n1. x~{0}',criteria:'| Шаг | Балл |\n| --- | --- |\n| График | 1 |'});
 const work=qwValidate({...qwProject(),tasks:[task]});
 const restored=qwValidate(JSON.parse(JSON.stringify(work)));
 assert.equal(restored.version,1);
 assert.deepEqual(restored.tasks,[work.tasks[0]]);
 assert.throws(()=>qwValidate({...work,tasks:[{...task,prompt:'x'.repeat(20000)}]}),/Повреждено задание/);
});
