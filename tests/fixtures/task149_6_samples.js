import {qwProject,qwTask,qwValidate,qwCoordinatePreset} from '../../src/core/work-model.js';
import {task149PrintSamples} from './task149_4_samples.js';
export function task149ImprovedSamples(){
 const old=task149PrintSamples(),compact=old[0].project;
 const practice=qwProject();Object.assign(practice,{title:'Тренировочные задания — математика и физика',subject:'mixed',grade:'8–9',layout:'practice',practice:{perPage:1,grid:'fine'}});
 const triangle=qwTask('diagram');Object.assign(triangle,{part:'Геометрия',prompt:'В прямоугольном треугольнике ABC катеты равны 6 см и 8 см. Найдите гипотенузу и площадь треугольника.',answer:'10 см; 24 см²',diagram:[{kind:'rightTriangle',x:130,y:60,x2:350,y2:230,label:'',vertices:[{x:130,y:230,label:'A'},{x:350,y:230,label:'B'},{x:130,y:60,label:'C'}],edgeLabels:['8 см','','6 см']}]});
 const algebra=qwTask('graph');Object.assign(algebra,{part:'Алгебра',prompt:'На рисунке изображён график функции \\(y=x^{2}-4\\). Найдите её нули и промежуток, на котором функция принимает отрицательные значения.',answer:'−2 и 2; (−2; 2)'});Object.assign(algebra.graph,qwCoordinatePreset('math'),{coordinateMode:'math',xlabel:'x',ylabel:'y',curveFamily:'quadratic'});algebra.graph.curve.c=-4;
 const slope=Math.tan(Math.PI/6),blockY=260-180*slope-20*Math.cos(Math.PI/6);
 const physics=qwTask('diagram');Object.assign(physics,{part:'Физика',prompt:'Брусок массой 2 кг лежит на гладкой наклонной плоскости с углом 30°. Примите \\(g=10\\) м/с². Найдите составляющую силы тяжести вдоль плоскости и ускорение бруска.',answer:'10 Н; 5 м/с²',diagram:[{kind:'incline',x:80,y:260-320*slope,x2:400,y2:260,label:''},{kind:'block',x:220,y:blockY-20,x2:280,y2:blockY+20,label:'m',rotation:-30},{kind:'arrow',x:250,y:blockY,x2:250,y2:240,label:'mg'},{kind:'text',x:150,y:250,x2:150,y2:250,label:'30°'}]});practice.tasks=[triangle,algebra,physics];
 const multiple=structuredClone(practice);multiple.id+='multi';multiple.title='Тренировочные задания — три на странице';multiple.practice={perPage:3,grid:'normal'};
 const comparison=qwProject();Object.assign(comparison,{title:'Координатные системы — единая область построения',subject:'mixed',layout:'compact'});
 for(const [mode,prompt] of [['first','Физический график: X от 0 до 10, Y от 0 до 10.'],['positiveX','Положительное X: X от 0 до 10, Y от −5 до 5.'],['math','Математический график: обе оси от −5 до 5.'],['custom','Ручной диапазон: обе оси от −10 до 10, шаг сетки 1.']]){
  const q=qwTask('graph');q.prompt=prompt;Object.assign(q.graph,qwCoordinatePreset(mode)||{xmin:-10,xmax:10,ymin:-10,ymax:10},{coordinateMode:mode,xlabel:mode==='first'?'t, с':'x',ylabel:mode==='first'?'v, м/с':'y'});comparison.tasks.push(q);
 }
 return [['Compact-Geometry-Improved',compact],['Practice-One-Per-Page-Three-Tasks',practice],['Practice-Multiple-Tasks-Improved',multiple],['Physics-Graph-Comparison',comparison]].map(([name,project])=>({name,project:qwValidate(project)}));
}
