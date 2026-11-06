import test from 'node:test';
import assert from 'node:assert/strict';
import {qwPrintTheme,qwPrintBrand} from '../src/core/work-print-theme.js';

test('QX export theme rejects unrecognised ids and stays opt-in',()=>{
 assert.equal(qwPrintBrand(qwPrintTheme()),'');
 for(const theme of ['constructor','__proto__','<img src=x>'])assert.throws(()=>qwPrintTheme({theme}),/Неизвестная/);
 const options=Object.freeze({theme:'scientific',monochrome:true}),t=qwPrintTheme(options);
 assert.equal(t.monochrome,true);assert.match(qwPrintBrand(t),/Квант Икс \| QX/);
 assert.equal(qwPrintTheme({theme:'academic',monochrome:'false'}).monochrome,false);
});
