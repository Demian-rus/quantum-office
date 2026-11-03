import test from 'node:test';
import assert from 'node:assert/strict';
import {newWorkbook,setCell} from '../src/core/workbook.js';
import {newWorkspace,encodeWorkspace} from '../src/core/store.js';
import {encodeOfficeBackup,decodeOfficeBackup,OFFICE_BACKUP_V2} from '../src/core/office-backup.js';

const fixture=()=>{
 const workspace=newWorkspace(),book=newWorkbook('QX Контент');
 setCell(book.sheets[0],'A1','QX-001');
 workspace.books.push(book);workspace.active=book.id;
 const writer={name:'Сценарий',html:'<h1>Логика</h1><p>Тезис</p>',layout:{paper:'A4'},updated:123};
 const slides={name:'Доклад',slides:[{id:'s1',bg:'#ffffff',items:[{id:'t',kind:'text',text:'Тезис'}]}],active:0,selected:'t',updated:123};
 const studio={version:1,name:'Обложка',width:1280,height:720,bg:'#000000',transparent:false,strokes:[],adjust:{brightness:100,contrast:100,saturation:100},imageSrc:''};
 return {workspace,writer,slides,studio};
};
test('TASK134: all editor drafts survive portable v2 serialization',()=>{
 const x=fixture(),raw=encodeOfficeBackup(x.workspace,x.writer,x.slides,x.studio);
 const restored=decodeOfficeBackup(raw);
 assert.equal(restored.legacy,false);
 assert.equal(JSON.parse(raw).format,OFFICE_BACKUP_V2);
 assert.equal(restored.workspace.books[0].sheets[0].cells.A1.value,'QX-001');
 assert.equal(restored.writer.html,x.writer.html);
 assert.equal(restored.slides.slides[0].items[0].text,'Тезис');
 assert.equal(restored.studio.width,1280);
});
test('TASK134: legacy backups restore only workbooks and remain readable',()=>{
 const x=fixture(),old=encodeWorkspace(x.workspace),v1=decodeOfficeBackup(old);
 assert.equal(v1.legacy,true);
 assert.equal(v1.workspace.books.length,1);
 assert.equal(v1.writer,undefined);
 assert.equal(v1.slides,undefined);
});
test('TASK134: corrupt writer is rejected before any application',()=>{
 const x=fixture(),raw=JSON.parse(encodeOfficeBackup(x.workspace,x.writer,x.slides,x.studio));
 raw.writer.html=7;
 assert.throws(()=>decodeOfficeBackup(JSON.stringify(raw)),/«Тексты»/);
});
test('TASK134: invalid studio and slides are rejected',()=>{
 const x=fixture(),raw=JSON.parse(encodeOfficeBackup(x.workspace,x.writer,x.slides,x.studio));
 raw.studio.width=-7;
 assert.throws(()=>decodeOfficeBackup(JSON.stringify(raw)),/QSTUDIO/);
 raw.studio=x.studio;raw.slides.slides=[];
 assert.throws(()=>decodeOfficeBackup(JSON.stringify(raw)),/презентация/);
});
test('TASK134: unknown archive version rejected without guessing',()=>{
 assert.throws(()=>decodeOfficeBackup('{"format":"quantum-office-backup-v3"}'),/Неподдерживаемый формат/);
});
