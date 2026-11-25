import test from 'node:test';
import assert from 'node:assert/strict';
import {qwPrintTheme,qwPrintBrand} from '../src/core/work-print-theme.js';

test('QX signature is shared by all export themes and theme ids are validated',()=>{
 assert.match(qwPrintBrand(),/QX \/ Квант Икс/);
 for(const theme of ['constructor','__proto__','<img src=x>'])assert.throws(()=>qwPrintTheme({theme}),/Неизвестная/);
 const options=Object.freeze({theme:'scientific',monochrome:true}),t=qwPrintTheme(options);
 assert.equal(t.monochrome,true);assert.equal(t.id,'scientific');
 assert.equal(qwPrintTheme({theme:'academic',monochrome:'false'}).monochrome,false);
});
