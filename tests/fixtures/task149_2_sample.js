/* A reproducible teaching work, authored with the app's own QWORK models. */
import {qwProject,qwTask,qwValidate} from '../../src/core/work-model.js';
export function task149Sample(){
 const d=qwProject();Object.assign(d,{title:'Контрольная работа · Математика и физика',subject:'physics',grade:'8',topic:'Силы, графики и геометрия',variant:'1',instructions:'Выполните четыре задания. Запишите формулы и краткий ход решения. Схемы не требуют измерений линейкой.',layout:'worksheet'});
 const q1=qwTask('diagram'),q2=qwTask('diagram'),q3=qwTask('graph'),q4=qwTask('diagram');
 for(const q of [q1,q2,q3,q4])Object.assign(q,{part:'',position:'below',figureWidth:360,solutionVisible:false,answerVisible:true});
 Object.assign(q1,{prompt:'Брусок массой 2 кг находится на гладкой наклонной плоскости с углом \\(30^{°}\\). Примите \\(g=10\\) м/с². Определите составляющую силы тяжести, направленную вдоль плоскости.',answer:'10 Н.',criteria:'\\(F_{∥}=mg\\sin 30^{°}=2\\cdot10\\cdot\\frac{1}{2}=10\\) Н.',points:2});
 const rise=340/Math.sqrt(3),contact={x:80+340*.52,y:270-rise*.52},center={x:contact.x-10.5,y:contact.y-21*Math.sqrt(3)/2};
 q1.diagram=[
  {kind:'incline',x:80,y:270-rise,x2:420,y2:270,label:''},
  {kind:'block',x:center.x-35,y:center.y-21,x2:center.x+35,y2:center.y+21,rotation:-30,label:''},
  {kind:'text',x:center.x-30,y:center.y-23,x2:center.x-30,y2:center.y-23,label:'m'},
  {kind:'arrow',x:center.x,y:center.y,x2:center.x,y2:center.y+105,label:'mg',style:{stroke:'#dc2626',width:2.2}},
  {kind:'arc',x:36,y:226,x2:124,y2:314,startAngle:0,endAngle:30,label:'30°'}
 ];
 Object.assign(q2,{prompt:'Груз весом 100 Н удерживается идеальным подвижным блоком. Трением и массой блока пренебрегите. Какую силу F нужно приложить к свободному концу нити? Неподвижный блок на рисунке только меняет направление нити.',answer:'50 Н.',criteria:'Две несущие ветви нити: \\(2F=P\\), \\(F=\\frac{100}{2}=50\\) Н.',points:2});
 q2.diagram=[
  {kind:'ground',x:430,y:42,x2:140,y2:42,label:''},
  {kind:'movablePulley',x:204,y:139,x2:276,y2:211,label:''},
  {kind:'pulley',x:276,y:57,x2:320,y2:101,label:''},
  {kind:'rope',x:204,y:42,x2:204,y2:107,label:''},
  {kind:'polyline',x:276,y:79,x2:276,y2:107,vertices:[{x:276,y:107,label:''},{x:276,y:94,label:''},{x:276,y:79,label:''}],label:''},
  {kind:'arc',x:276,y:57,x2:320,y2:101,startAngle:180,endAngle:0,label:''},
  {kind:'rope',x:320,y:79,x2:320,y2:190,label:''},
  {kind:'arrow',x:320,y:190,x2:320,y2:252,label:'F',style:{stroke:'#2563eb',width:2.2}},
  {kind:'rope',x:240,y:229,x2:240,y2:244,label:''},
  {kind:'block',x:206,y:244,x2:274,y2:284,label:'Груз'},
  {kind:'text',x:200,y:309,x2:200,y2:309,label:'P = 100 Н'}
 ];
 Object.assign(q3,{pageBreak:true,figureWidth:470,prompt:'Постройте график функции \\(y=x^{2}-4x+3\\). По графику найдите нули функции и координаты вершины параболы.',answer:'\\(x_{1}=1\\), \\(x_{2}=3\\); вершина \\((2;-1)\\).',criteria:'\\(x^{2}-4x+3=(x-1)(x-3)\\); \\(x_{в}=2\\), \\(y_{в}=-1\\).',points:3});
 Object.assign(q3.graph,{xmin:-1,xmax:5,ymin:-2,ymax:8,step:1,xlabel:'x',ylabel:'y',coordinateMode:'math',curveFamily:'quadratic',connected:false});
 Object.assign(q3.graph.curve,{a:1,b:-4,c:3});
 Object.assign(q4,{figureWidth:360,prompt:'В прямоугольном треугольнике катеты равны 6 см и 8 см. Найдите гипотенузу. Приведите вычисление по теореме Пифагора.',answer:'10 см.',criteria:'\\(c=\\sqrt{6^{2}+8^{2}}=\\sqrt{100}=10\\) см.',points:2});
 q4.diagram=[
  {kind:'rightTriangle',x:180,y:30,x2:360,y2:270,vertices:[{x:180,y:270,label:'A'},{x:360,y:270,label:'B'},{x:180,y:30,label:'C'}],edgeLabels:['','',''],label:''},
  {kind:'dimension',x:142,y:270,x2:142,y2:30,label:'8 см',labelOffset:-20},
  {kind:'doubleArrow',x:180,y:298,x2:360,y2:298,label:'6 см'}
 ];
 d.tasks=[q1,q2,q3,q4];return qwValidate(d);
}
