import {qwProject,qwTask,qwValidate} from '../../src/core/work-model.js';
export function task149LabelCases(){
 const d=qwProject();Object.assign(d,{title:'Проверка подписей чертежей',subject:'math',layout:'compact'});
 const graph=(name,points,elements=[],range={xmin:0,xmax:10,ymin:0,ymax:10})=>{const q=qwTask('graph');q.prompt=name;Object.assign(q.graph,range,{xlabel:'x',ylabel:'y',points,elements,connected:elements.length===0});d.tasks.push(q);return q;};
 graph('A должна находиться вне AB; положение B сохранено.',[{x:1,y:1,label:'A'},{x:4,y:5,label:'B'}],[],{xmin:0,xmax:5,ymin:0,ymax:5});
 graph('Убывающий отрезок.',[{x:2,y:8,label:'A'},{x:8,y:2,label:'B'}]);
 graph('Три отрезка выходят из A.',[{x:4,y:4,label:'A'},{x:1,y:7,label:'B'},{x:8,y:8,label:'C'},{x:7,y:1,label:'D'}],[{kind:'line',x:4,y:4,x2:1,y2:7,label:''},{kind:'line',x:4,y:4,x2:8,y2:8,label:''},{kind:'line',x:4,y:4,x2:7,y2:1,label:''}]);
 graph('Две очень близкие точки.',[{x:3,y:3,label:'A'},{x:3.15,y:3.1,label:'B'}]);
 graph('Точки возле осей.',[{x:-3,y:-2,label:'A'},{x:2,y:4,label:'B'},{x:0,y:0,label:'C'}],[],{xmin:-5,xmax:5,ymin:-5,ymax:5});
 graph('Индексы в обозначениях.',[{x:2,y:2,label:'A₁'},{x:7,y:7,label:'B₂'}]);
 const scheme=(name,diagram)=>{const q=qwTask('diagram');q.prompt=name;q.diagram=diagram;d.tasks.push(q);};
 const triangle=rotation=>({kind:'triangle',x:130,y:80,x2:330,y2:230,rotation,label:'',vertices:[{x:130,y:230,label:'A'},{x:330,y:230,label:'B'},{x:220,y:80,label:'C'}],edgeLabels:['','','']});
 scheme('Треугольник.',[triangle(0)]);scheme('Поворот треугольника на 25°.',[triangle(25)]);scheme('Поворот треугольника на −45°.',[triangle(-45)]);
 scheme('Стороны прямоугольника.',[{kind:'quadrilateral',x:120,y:90,x2:350,y2:220,label:'',vertices:[{x:120,y:220,label:'A'},{x:350,y:220,label:'B'},{x:350,y:90,label:'C'},{x:120,y:90,label:'D'}],edgeLabels:['8 см','5 см','','']}]);
 scheme('Окружность и радиус.',[{kind:'circle',x:150,y:60,x2:350,y2:260,label:''},{kind:'point',x:250,y:160,x2:250,y2:160,label:'O'},{kind:'point',x:350,y:160,x2:350,y2:160,label:'A'},{kind:'line',x:250,y:160,x2:350,y2:160,label:'r'}]);
 scheme('Наклонный отрезок и его длина.',[{kind:'polyline',x:100,y:80,x2:380,y2:240,label:'5 см',vertices:[{x:100,y:240,label:'A'},{x:380,y:80,label:'B'}]}]);
 scheme('Вектор и его наконечник.',[{kind:'arrow',x:120,y:230,x2:350,y2:90,label:'F'},{kind:'point',x:120,y:230,x2:120,y2:230,label:'A'},{kind:'point',x:350,y:90,x2:350,y2:90,label:'B'}]);
 scheme('Повернутый размер.',[{kind:'dimension',x:130,y:140,x2:330,y2:140,rotation:35,label:'12 см',labelOffset:22}]);
 scheme('Свободный текст сохраняет место.',[{kind:'line',x:80,y:200,x2:420,y2:80,label:'AB'},{kind:'text',x:25,y:290,x2:25,y2:290,label:'Единицы — см'}]);
 scheme('Несколько фигур.',[triangle(0),{kind:'circle',x:360,y:120,x2:460,y2:220,label:'O'},{kind:'arrow',x:340,y:260,x2:450,y2:260,label:'F'}]);
 scheme('Прямоугольный треугольник с длинами.',[{kind:'rightTriangle',x:120,y:80,x2:340,y2:220,label:'',vertices:[{x:120,y:220,label:'A'},{x:340,y:220,label:'B'},{x:120,y:80,label:'C'}],edgeLabels:['6 см','10 см','8 см']}]);
 graph('Длинное обозначение у границы сетки.',[{x:0,y:0,label:'Начало'},{x:8,y:8,label:'Конец'}]);
 return qwValidate(d);
}
