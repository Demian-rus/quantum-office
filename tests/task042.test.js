import test from 'node:test';
import assert from 'node:assert/strict';
import {tintHex,resolveXLSXColor} from '../src/core/xlsx.js';

const node=attributes=>({
 getAttribute:key=>Object.hasOwn(attributes,key)?String(attributes[key]):null,
 hasAttribute:key=>Object.hasOwn(attributes,key)
});

test('SpreadsheetML theme color ordering uses light1 and dark1 correctly',()=>{
 assert.equal(resolveXLSXColor(node({theme:0})),'#ffffff');
 assert.equal(resolveXLSXColor(node({theme:1})),'#000000');
 assert.equal(resolveXLSXColor(node({theme:4})),'#4f81bd');
 const custom=['#ffffff','#111111','#eeece1','#1f497d','#1260a0',
  '#c0504d','#9bbb59','#8064a2','#4bacc6','#f79646','#0000ff','#800080'];
 assert.equal(resolveXLSXColor(node({theme:4}),custom),'#1260a0');
});
test('legacy indexed and explicit RGB colors are resolved, invalid indexes ignored',()=>{
 assert.equal(resolveXLSXColor(node({indexed:10})),'#ff0000');
 assert.equal(resolveXLSXColor(node({indexed:63})),'#333333');
 assert.equal(resolveXLSXColor(node({rgb:'FFFEDCBA'})),'#fedcba');
 assert.equal(resolveXLSXColor(node({indexed:64})),undefined);
 assert.equal(resolveXLSXColor(node({theme:12})),undefined);
 assert.equal(resolveXLSXColor(node({theme:'NaN'})),undefined);
});
test('Excel tint adjusts HLS lightness, preserving grayscale and stable bases',()=>{
 assert.equal(tintHex('#000000',0.5),'#808080');
 assert.equal(tintHex('#ffffff',-0.5),'#808080');
 assert.equal(tintHex('#1260a0',0),'#1260a0');
 assert.equal(tintHex('#1260a0',1),'#ffffff');
 assert.equal(tintHex('#1260a0',-1),'#000000');
 assert.equal(tintHex('#1260a0',2),'#1260a0');
 assert.equal(resolveXLSXColor(node({theme:4,tint:0.5}),[
  '#ffffff','#000000','#eeece1','#1f497d','#1260a0',
  '#c0504d','#9bbb59','#8064a2','#4bacc6','#f79646','#0000ff','#800080'
 ]),tintHex('#1260a0',0.5));
});
