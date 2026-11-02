import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/core/diagnostics.js',import.meta.url),'utf8');
function ctx(){
 const doc={name:'Мой документ',html:'<p>Сохранить существующий текст</p>'};
 const context={qoWriter:doc,qoPersistWriter:()=>{},download:()=>{},safeFile:x=>x,confirm:()=>true,status:()=>{},console};
 runInNewContext(source+'\nthis.api={qdDoc,qdDefault,qdBulkPlan,qdBulkCommit,qdAudit,qdBuilder,qdQuestionList,qdNewId};',context);
 return {...context.api,doc};
}
test('TASK104 bulk plan creates sections, handles practice and skips duplicate prompts',()=>{
 const h=ctx(),d=h.qdDoc();
 d.sections[0].questions[0].prompt='Вопрос из документа';
 const text=['[Тема А]','Что такое плотность? | Масса единицы объёма',
 ' ! Вычисли скорость при 120 км за 2 часа | 60 км/ч',
 'Что такое плотность? | Повтор','[Тема Б]','Почему солнце греет землю? | Излучение',
 'Вопрос из документа | Повтор старого'].join('\n');
 const plan=h.qdBulkPlan(d,text,d.sections[0].id);
 assert.equal(plan.ok,true);
 assert.equal(plan.items.length,3);
 assert.equal(plan.items[1].type,'practice');
 assert.equal(plan.newSections,2);
 assert.equal(plan.skipped,2);
 assert.equal(h.qdBulkCommit(d,plan),true);
 assert.equal(d.sections.length,3);
 assert.equal(h.qdQuestionList(d).length,4);
 assert.equal(d.sections[1].questions[1].answer,'60 км/ч');
 assert.equal(h.qdBulkPlan(d,text,d.sections[0].id).ok,false,'same rows are duplicates now');
 assert.equal(h.doc.html,'<p>Сохранить существующий текст</p>');
});
test('TASK104 bulk plan is atomic for size and section limits',()=>{
 const h=ctx(),d=h.qdDoc(),start=JSON.stringify(d);
 const huge='Что случилось? | Ответ\n'.repeat(401);
 assert.equal(h.qdBulkPlan(d,huge,d.sections[0].id).ok,false);
 assert.equal(JSON.stringify(d),start);
 const full=Array.from({length:240},(_,i)=>({id:'id'+i,type:'question',prompt:'Вопрос '+i,answer:'Ответ'}));
 d.sections[0].questions=full;
 const blocked=h.qdBulkPlan(d,'Ещё один вопрос? | Ответ',d.sections[0].id);
 assert.equal(blocked.ok,false);
 assert.equal(d.sections[0].questions.length,240);
 const invalid=h.qdBulkPlan(d,'[Только заголовок]',d.sections[0].id);
 assert.equal(invalid.ok,false);
});
test('TASK104 audit flags blanks, repeated prompts and invalid answer keys',()=>{
 const h=ctx(),d=h.qdDoc();
 d.sections[0].questions=[
 {id:'a',type:'question',prompt:'',answer:''},
 {id:'b',type:'practice',prompt:'Плотность тела',answer:''},
 {id:'c',type:'question',prompt:'  ПЛОТНОСТЬ   ТЕЛА ',answer:'Вопрос с дублем'},
 {id:'d',type:'single',prompt:'Варианты',choices:[{text:'Да',correct:true},{text:'',correct:false}],answer:''},
 {id:'e',type:'multiple',prompt:'Много',choices:[{text:'Да',correct:false},{text:'Нет',correct:false}]},
 {id:'f',type:'numeric',prompt:'Число',numericAnswer:'два'},
 ];
 const issues=h.qdAudit(d);
 assert.ok(issues.some(x=>x.qid==='a'&&x.field==='prompt'));
 assert.ok(issues.some(x=>x.qid==='b'&&x.field==='answer'));
 assert.ok(issues.some(x=>x.qid==='c'&&x.text.includes('Повторяет')));
 assert.ok(issues.some(x=>x.qid==='d'&&x.field==='choice-text'));
 assert.ok(issues.some(x=>x.qid==='e'&&x.field==='choice-correct'));
 assert.ok(issues.some(x=>x.qid==='f'&&x.field==='numericAnswer'));
 const html=h.qdBuilder();
 assert.match(html,/Массовое добавление вопросов/);
 assert.match(html,/Компактный список/);
 assert.match(html,/Проверка заданий/);
});
