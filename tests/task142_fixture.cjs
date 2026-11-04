module.exports=async function seed(page){await page.evaluate(()=>{
 qdBlank();const d=qdWorkingDoc();Object.assign(d,{title:'Физика · 8 класс · Тепловые явления',grade:'8',description:'Понимание процессов теплопередачи и расчёт количества теплоты.',sections:[
 {id:'s1',title:'Теплопередача',questions:[
 {id:'q1',type:'question',prompt:'Почему металлическая ложка нагревается в горячем чае?',answer:'Благодаря теплопроводности энергия передаётся от горячей части ложки к холодной.',points:2,partialCredit:50,criteria:'1 балл за понятие, 1 — за объяснение.'},
 {id:'q2',type:'numeric',prompt:'Сколько килоджоулей необходимо для нагрева 2 кг воды от 20 до 30 °C?',answer:'Q = cmΔt = 84 кДж',numericAnswer:'84',tolerance:0.5,points:4,partialCredit:50}]},
 {id:'s2',title:'Практическое применение',questions:[{id:'q3',type:'practice',prompt:'Опишите опыт, который показывает различие теплопроводности дерева и металла. Укажите условия сравнения, ожидаемый результат и объясните, почему нельзя ограничиваться только ощущением температуры рукой.',answer:'Нужны одинаковые условия и независимый контроль температуры.',points:4,partialCredit:50}]}]});
 qoWorkspaceTab.writer='diagnostic';qdStore();render();
});};
