import {qwProject,qwTask,qwValidate} from '../../src/core/work-model.js';

/* Original exercises. References inform layout only; none of their tasks or art is copied. */
export function task149PrintSamples(){
 const d=qwProject();Object.assign(d,{title:'Геометрия — короткие задачи',subject:'math',grade:'9',layout:'compact',instructions:'Запишите обоснование и обозначьте используемые величины.'});
 const triangle=(labels=['A','B','C'])=>[{kind:'triangle',x:100,y:65,x2:260,y2:160,label:'',vertices:[{x:100,y:160,label:labels[0]},{x:260,y:160,label:labels[1]},{x:170,y:65,label:labels[2]}],edgeLabels:['','','']}];
 const right=()=>[{kind:'rightTriangle',x:110,y:70,x2:260,y2:170,label:'',vertices:[{x:110,y:170,label:'A'},{x:260,y:170,label:'B'},{x:110,y:70,label:'C'}],edgeLabels:['','','']}];
 const rectangle=()=>[{kind:'quadrilateral',x:110,y:90,x2:290,y2:170,label:'',vertices:[{x:110,y:170,label:'A'},{x:290,y:170,label:'B'},{x:290,y:90,label:'C'},{x:110,y:90,label:'D'}],edgeLabels:['','','','']}];
 const rhombus=()=>[{kind:'quadrilateral',x:90,y:60,x2:270,y2:180,label:'',vertices:[{x:90,y:120,label:'A'},{x:180,y:180,label:'B'},{x:270,y:120,label:'C'},{x:180,y:60,label:'D'}],edgeLabels:['','','','']},{kind:'dashed',x:90,y:120,x2:270,y2:120,label:''},{kind:'dashed',x:180,y:60,x2:180,y2:180,label:''}];
 const add=(part,prompt,answer,diagram)=>{const q=qwTask(diagram?'diagram':'short');Object.assign(q,{part,topic:part,prompt,answer,criteria:'Полный балл — за правильный ответ с обоснованием.',comment:'Допустим другой корректный способ решения.',solutionVisible:false,position:'auto'});if(diagram)q.diagram=diagram;d.tasks.push(q);return q;};
 const angles=[
  ['Два угла треугольника ABC равны \\(47°\\) и \\(68°\\). Найдите третий угол.','65°',triangle()],
  ['Основание равнобедренного треугольника — AB. Угол C равен \\(44°\\). Найдите угол A.','68°',triangle()],
  ['В прямоугольном треугольнике ABC угол A прямой, угол B равен \\(28°\\). Найдите угол C.','62°',right()],
  ['Один из смежных углов равен \\(123°\\). Найдите другой угол.','57°'],
  ['В треугольнике ABC углы A и B равны \\(52°\\) и \\(76°\\). Какие две стороны равны?','AB и BC',triangle()],
  ['В равнобедренном треугольнике угол при основании равен \\(71°\\). Найдите угол при вершине.','38°'],
  ['Внешний угол при вершине C треугольника ABC равен \\(137°\\), угол A равен \\(59°\\). Найдите угол B.','78°',triangle()],
  ['Сумма двух углов треугольника равна \\(126°\\). Найдите третий угол.','54°']
 ];angles.forEach(a=>add('Углы',...a));
 const measures=[
  ['Катеты прямоугольного треугольника равны 9 и 12. Найдите гипотенузу.','15',right()],
  ['Гипотенуза прямоугольного треугольника равна 17, один катет — 8. Найдите второй катет.','15',right()],
  ['Основание треугольника равно 14, высота к нему — 9. Найдите площадь.','63',triangle()],
  ['Периметр равнобедренного треугольника равен 41, основание — 15. Найдите боковую сторону.','13',triangle()],
  ['Стороны прямоугольника равны 7 и 11. Найдите его периметр.','36',rectangle()],
  ['Площадь параллелограмма равна 96, основание — 16. Найдите высоту к этому основанию.','6'],
  ['Основания трапеции равны 8 и 18, высота равна 7. Найдите площадь.','91'],
  ['Диагонали ромба равны 12 и 16. Найдите его площадь.','96',rhombus()]
 ];measures.forEach(a=>add('Длины и площади',...a));
 add('Координаты и окружности','Найдите расстояние между точками A(1; 2) и B(7; 10).','10');
 const graph=add('Координаты и окружности','На рисунке отмечены точки A и B. Найдите длину AB.','5');graph.type='graph';graph.figure='graph';Object.assign(graph.graph,{xmin:0,xmax:5,ymin:0,ymax:5,step:1,xlabel:'x',ylabel:'y',points:[{x:1,y:1,label:'A'},{x:4,y:5,label:'B'}],connected:true});
 add('Координаты и окружности','У прямоугольника ABCD диагональ AC равна 26. Найдите расстояние от точки пересечения диагоналей до вершины B.','13',rectangle());
 add('Координаты и окружности','Радиус окружности равен 6. Найдите её диаметр.','12');
 add('Координаты и окружности','Радиус круга равен 5. Найдите его площадь, разделённую на \\(\\pi\\).','25');
 add('Координаты и окружности','Углы треугольника относятся как 2 : 3 : 4. Найдите наибольший угол.','80°');
 add('Координаты и окружности','Докажите, что треугольник со сторонами 10, 24 и 26 — прямоугольный.','\\(10^{2}+24^{2}=26^{2}\\). По обратной теореме Пифагора треугольник прямоугольный.',right()).type='extended';
 add('Координаты и окружности','Точка M — середина AB, A(−4; 3), B(8; 7). Найдите координаты M и объясните вычисление.','\\(M(2;5)\\): каждая координата равна полусумме соответствующих координат концов отрезка.').type='extended';
 const compact=qwValidate(d);
 const one=structuredClone(compact);Object.assign(one,{id:one.id+'-one',title:'Геометрия — лист для решения',layout:'practice',practice:{perPage:1,grid:'fine'}});one.tasks=one.tasks.slice(8,9);
 const multiple=structuredClone(compact);Object.assign(multiple,{id:multiple.id+'-multiple',title:'Геометрия — три задачи',layout:'practice',practice:{perPage:3,grid:'normal'}});multiple.tasks=[multiple.tasks[0],multiple.tasks[10],multiple.tasks[17]];
 return [{name:'Compact-Geometry',project:compact},{name:'Practice-One-Task',project:qwValidate(one)},{name:'Practice-Multiple-Tasks',project:qwValidate(multiple)}];
}
