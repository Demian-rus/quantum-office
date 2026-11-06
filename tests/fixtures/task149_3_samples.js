import {qwProject,qwTask,qwValidate} from '../../src/core/work-model.js';
import {task149Sample} from './task149_2_sample.js';

export function task149CompactSamples(){
 const previous=task149Sample(),a=qwProject();
 Object.assign(a,{title:previous.title,grade:previous.grade,subject:previous.subject,instructions:previous.instructions});
 // These are newly authored layouts. The TASK149.2 source and its explicit break stay intact.
 a.tasks=previous.tasks.map(source=>({...structuredClone(source),id:qwTask().id,position:'right',figureWidth:246,pageBreak:false}));
 const b=qwProject();Object.assign(b,{title:'Самостоятельная работа · Пять задач',grade:'8',instructions:'Запишите вычисления и краткие ответы. Используйте данные на рисунках.'});
 const add=(type,prompt,answer)=>{const q=qwTask(type);Object.assign(q,{prompt,answer,solutionVisible:false,figureWidth:246,part:''});b.tasks.push(q);return q;};
 const q1=add('diagram','Тело массой 3 кг покоится на горизонтальной опоре. Примите \\(g=10\\) м/с². Найдите силу реакции опоры N.','30 Н.');
 q1.diagram=[{kind:'ground',x:80,y:246,x2:440,y2:246,label:''},{kind:'block',x:205,y:160,x2:315,y2:246,label:'m'},{kind:'arrow',x:260,y:160,x2:260,y2:65,label:'N'}];
 const q2=add('diagram','Пружину жёсткостью 100 Н/м растянули на 2 см. Найдите модуль силы упругости. Ответ дайте в ньютонах.','2 Н.');
 q2.diagram=[{kind:'rect',x:60,y:110,x2:76,y2:230,label:''},{kind:'spring',x:76,y:190,x2:295,y2:190,label:'k'},{kind:'block',x:295,y:155,x2:370,y2:230,label:''},{kind:'doubleArrow',x:80,y:260,x2:295,y2:260,label:'Δl = 2 см'}];
 const q3=add('graph','По графику скорости определите путь тела за первые 5 с. Движение происходит вдоль прямой без изменения направления.','16 м.');
 Object.assign(q3.graph,{xmin:0,xmax:5,ymin:0,ymax:5,xlabel:'t, с',ylabel:'v, м/с',step:1,points:[{x:0,y:0,label:''},{x:2,y:4,label:''},{x:5,y:4,label:''}]});
 const q4=add('diagram','В прямоугольном треугольнике катеты равны 6 см и 8 см. Найдите его площадь.','24 см².');q4.diagram=structuredClone(previous.tasks[3].diagram);
 const q5=add('graph','На рисунке приведён график линейной функции \\(y=2x-1\\). Найдите значение функции при \\(x=3\\).','5.');
 Object.assign(q5.graph,{xmin:-1,xmax:4,ymin:-3,ymax:7,xlabel:'x',ylabel:'y',step:1,coordinateMode:'math',curveFamily:'quadratic'});Object.assign(q5.graph.curve,{a:0,b:2,c:-1});
 const c=qwProject();Object.assign(c,{title:'Математические примеры',subject:'math',grade:'8',instructions:'Вычислите значения выражений или найдите неизвестное. Запишите краткие ответы.'});
 const examples=[
  ['Найдите значение \\(x^{2}-4x+3\\) при \\(x=2\\).','−1.'],
  ['Найдите сумму углов \\(30^{°}\\) и \\(45°\\).','75°.'],
  ['Вычислите \\(\\frac{3}{4}+\\frac{1}{8}\\).','7/8.'],
  ['Найдите \\(\\sqrt{81}\\).','9.'],
  ['Если \\(a_{1}=3\\) и \\(a_{2}=5\\), найдите \\(a_{1}+a_{2}\\).','8.'],
  ['Если \\(F_{1}=6\\) и \\(F_{2}=8\\), найдите \\(F_{1}+F_{2}\\).','14.'],
  ['Вычислите \\(\\frac{2^{3}-5}{3}\\).','1.'],
  ['Найдите \\(\\sqrt{49}+\\sqrt{16}\\).','11.'],
  ['Вычислите \\(\\frac{5}{6}-\\frac{1}{3}\\).','1/2.'],
  ['Решите уравнение \\(2x+7=15\\).','4.'],
  ['Вычислите \\((-3)^{2}\\).','9.'],
  ['Вычислите \\(0{,}25\\cdot8\\).','2.'],
  ['Найдите x из равенства \\(\\frac{x}{3}=5\\).','15.'],
  ['Найдите значение \\(\\frac{\\sqrt{144}}{3}\\).','4.']
 ];
 c.tasks=examples.map(([prompt,answer])=>Object.assign(qwTask('short'),{prompt,answer,part:'',solutionVisible:false}));
 return [['Compact-Physics-Math',a],['Five-Illustrated-Tasks',b],['Math-Examples',c]].map(([name,project])=>({name,project:qwValidate(project)}));
}
