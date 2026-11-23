import test from 'node:test';
import assert from 'node:assert/strict';
import {qwContentHTML,qwHasRichSyntax,qwPrintFieldHTML} from '../src/core/work-content.js';

test('TASK165 plain legacy conditions are not reformatted when printed',()=>{
 const cases=['Вычислите скорость тела за 7 секунд.','1 — вертикальный импульс, 2 — скорость','\\(F=ma\\)','x² + 2y = 10','Строка 1\nСтрока 2'];
 for(const source of cases){assert.equal(qwHasRichSyntax(source),false,source);assert.equal(qwPrintFieldHTML(source),qwContentHTML(source),source);}
});
test('TASK165 authored Markdown is rendered in print with formula and actual table',()=>{
 const source='### Решение\n1. **Запишем** закон \\(F=ma\\).\n2. Подставим числа.\n\n| Дано | Значение |\n| --- | --- |\n| Масса | 2 кг |';
 const out=qwPrintFieldHTML(source);
 assert.equal(qwHasRichSyntax(source),true);assert.match(out,/<h5>Решение<\/h5>/);
 assert.match(out,/<strong>Запишем<\/strong>/);assert.match(out,/<math/);
 assert.match(out,/<ol>/);assert.match(out,/<table>/);assert.match(out,/<th>Дано<\/th>/);
});
test('TASK165 print escapes malicious markup in Markdown answer',()=>{
 const html=qwPrintFieldHTML('### Ответ\n<script>alert(1)</script>\n\n| A | B |\n| --- | --- |\n| <iframe src=x> | <svg onload=1> |');
 assert.doesNotMatch(html,/<script|<iframe|<svg/i);
 assert.match(html,/&lt;iframe/);assert.match(html,/&lt;script/);
});
test('TASK165 opt-in recognises lists, quotes, bold, maths and simple tables',()=>{
 for(const value of ['- текст','1. Закон Ньютона','> обоснование','**вывод**','$F=ma$','| x | y |\n| --- | --- |'])assert.equal(qwHasRichSyntax(value),true,value);
});
