import test from 'node:test';
import assert from 'node:assert/strict';
import {qwRichMarkdownHTML,qwContentHTML} from '../src/core/work-content.js';

test('TASK164 renders structured notes, formulas and tables without external HTML',()=>{
 const source='### Решение\n1. **Применим закон**: \\(F=ma\\).\n2. *Подставим* значения.\n\n| Этап | Баллы |\n| --- | --- |\n| Обоснование | 1 |\n\n> Проверить единицы';
 const html=qwRichMarkdownHTML(source);
 assert.match(html,/<h5>Решение<\/h5>/);
 assert.match(html,/<ol>/);assert.match(html,/<strong>Применим закон<\/strong>/);
 assert.match(html,/<em>Подставим<\/em>/);
 assert.match(html,/<math/);assert.match(html,/<table>/);assert.match(html,/<th>Баллы<\/th>/);
 assert.match(html,/<blockquote>/);
});

test('TASK164 escapes HTML, malicious links, scripts and user-controlled attributes',()=>{
 const input='## <img src=x onerror=alert(1)>\n\n**<script>alert(1)</script>**\n\n| A | B |\n| --- | --- |\n| <svg onload=1> | <iframe src=evil> |';
 const html=qwRichMarkdownHTML(input);
 assert.doesNotMatch(html,/<script|<iframe|<svg|<img/i);
 assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;iframe/);
 assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'),'malicious attributes are visible only as escaped text');
});

test('TASK164 plain QWORK renderer is unchanged for PDF and old material',()=>{
 assert.ok(qwContentHTML('**Жирный**').includes('**Жирный**'));
 assert.ok(qwRichMarkdownHTML('**Жирный**').includes('<strong>Жирный</strong>'));
});

test('TASK164 Markdown block math and code snippets are escaped',()=>{
 const source='$$\n\\\\frac{m}{t}\n$$\n\n```js\n<script>bad</script>\n```';
 const html=qwRichMarkdownHTML(source);
 assert.match(html,/<math/);assert.match(html,/<pre><code/);
 assert.doesNotMatch(html,/<script>/);
});
