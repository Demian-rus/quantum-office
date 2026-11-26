/* Portable, allowlisted author formatting. Values never contain raw CSS. */
const QW_TEXT_FONTS={
 serif:['Книжный', '"QO Print Serif",Georgia,serif'],
 sans:['Без засечек', '"QO Print Sans",Arial,sans-serif'],
 mono:['Моноширинный','Consolas,"Courier New",monospace']
};
const QW_TEXT_RULES={
 font:{property:'font-family',choices:Object.keys(QW_TEXT_FONTS)},
 size:{property:'font-size',min:6,max:48,unit:'pt'},
 color:{property:'color',color:true},
 highlight:{property:'background-color',color:true},
 weight:{property:'font-weight',choices:['bold']},
 slant:{property:'font-style',choices:['italic']},
 decoration:{property:'text-decoration-line',choices:['underline','line-through','underline-line-through']},
 line:{property:'line-height',min:1,max:3,unit:''},
 before:{property:'margin-block-start',min:0,max:48,unit:'pt'},
 after:{property:'margin-block-end',min:0,max:48,unit:'pt'},
 align:{property:'text-align',choices:['left','center','right','justify']}
};
const QW_PARAGRAPH_STYLES=new Set(['line','before','after','align']);
const QW_CALLOUTS={
 info:['Информация','ℹ','blue'],theory:['Теория','§','blue'],
 definition:['Определение','≡','green'],formula:['Формула','∑','blue'],
 example:['Пример','◇','purple'],important:['Важно','!','amber'],
 warning:['Предупреждение','△','red'],note:['Примечание','✎','gray'],
 solution:['Решение','✓','green'],answer:['Ответ','→','green'],
 conclusion:['Вывод','∴','purple'],quote:['Цитата','❝','gray']
};
const QW_CALLOUT_TONES={
 blue:['#1d4f91','#edf5fc'],green:['#166047','#edf7f1'],purple:['#60338f','#f5effa'],
 amber:['#7e4e11','#fff7e8'],red:['#9b3038','#fff0f0'],gray:['#4b5563','#f3f5f7']
};
const QW_PUBLISH_PROFILES={
 exam:['Экзаменационный сборник','booklet'],practice:['Лист практики','worksheet'],notes:['Теория и конспект','worksheet']
};
const qwStyleColor=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
function qwTextStyle(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||raw.version!==1)throw Error('Неизвестная версия оформления текста');
 const result={version:1};
 for(const [key,value] of Object.entries(raw)){
  if(key==='version')continue;
  if(!Object.hasOwn(QW_TEXT_RULES,key))throw Error('Неизвестный параметр оформления');
  const {choices,color,min,max}=QW_TEXT_RULES[key];
  if(color? !qwStyleColor(value):choices? !choices.includes(value): !Number.isFinite(value)||value<min||value>max)
   throw Error('Недопустимое значение оформления текста');
  result[key]=color?value.toLowerCase():value;
 }
 return result;
}
function qwReadTextStyle(source){
 const values={version:1};
 for(const declaration of source.trim().split(/\s+/)){
  const match=declaration.match(/^([a-z]+)=([a-z0-9#.-]+)$/i);
  if(!match||!Object.hasOwn(QW_TEXT_RULES,match[1])||Object.hasOwn(values,match[1]))return null;
  const [,key,raw]=match;
  values[key]=QW_TEXT_RULES[key].min===undefined?raw:Number(raw);
 }
 try{return qwTextStyle(values);}catch{return null;}
}
function qwStyleSource(style){
 return Object.keys(QW_TEXT_RULES).filter(key=>style?.[key]!==undefined).map(key=>key+'='+style[key]).join(' ');
}
function qwTextStyleCSS(style,defaults=false){
 return Object.entries(QW_TEXT_RULES).map(([key,rule])=>{
  const value=style?.[key];
  if(value===undefined)return '';
  const spacing=defaults&&(key==='before'||key==='after'),property=spacing?'--qw-default-'+key:rule.property;
  const css=key==='font'?QW_TEXT_FONTS[value][1]:key==='decoration'&&value==='underline-line-through'?'underline line-through':value+(rule.unit||'');
  return property+':'+css+';';
 }).join('');
}
function qwDefaultSpacing(style){
 return ['before','after'].filter(key=>style?.[key]!==undefined).join(' ');
}
function qwTextStyleAttrs(style,defaults=false){
 const spec=qwStyleSource(style);
 const spacing=defaults?qwDefaultSpacing(style):'';
 return spec?' data-qw-text-style="'+spec+'" style="'+qwTextStyleCSS(style,defaults).replace(/"/g,'&quot;')+'"'+
  (spacing?' data-qw-default-spacing="'+spacing+'"':''):'';
}
function qwCalloutOptions(type,source=''){
 if(!Object.hasOwn(QW_CALLOUTS,type))return null;
 const result={};
 if(!source.trim())return result;
 for(const token of source.trim().split(/\s+/)){
  const match=token.match(/^([a-z]+)=([a-z0-9#.]+)$/i);
  if(!match||Object.hasOwn(result,match[1]))return null;
  const [,key,value]=match;
  if(key==='icon'&&/^[01]$/.test(value))result.icon=value;
  else if(key==='tone'&&Object.hasOwn(QW_CALLOUT_TONES,value))result.tone=value;
  else if((key==='color'||key==='background'||key==='border')&&qwStyleColor(value))result[key]=value.toLowerCase();
  else if(key==='border'&&value==='none')result.border=value;
  else if(key==='pad'&&/^\d{1,2}$/.test(value)&&+value>=2&&+value<=24)result.pad=+value;
  else return null;
 }
 return result;
}
function qwCalloutOptionSource(options){
 return ['icon','tone','color','background','border','pad']
  .filter(key=>options[key]!==undefined).map(key=>key+'='+options[key]).join(' ');
}
function qwCalloutLook(type,options){
 const [label,icon,defaultTone]=QW_CALLOUTS[type];
 const tone=options.tone||defaultTone;
 const [ink,paper]=QW_CALLOUT_TONES[tone];
 const line=options.border==='none'?'transparent':options.border||options.color||ink;
 const css='--qw-callout-color:'+(options.color||ink)+';--qw-callout-fill:'+(options.background||paper)+';--qw-callout-border:'+line+';--qw-callout-pad:'+(options.pad||9)+'pt';
 return {label,icon:options.icon==='0'?'':icon,tone,css};
}
const QW_EDUCATION_TEXT_CSS=
 '.qw-callout{margin:.65em 0;padding:var(--qw-callout-pad);background:var(--qw-callout-fill);color:#151d2a;border:1px solid var(--qw-callout-border);border-inline-start-width:3px;border-radius:4px;overflow-wrap:anywhere;print-color-adjust:exact}'+
 '.qw-callout-title{display:flex;align-items:baseline;gap:.55em;font-weight:700;color:#172333;margin:0 0 .35em}'+
 '.qw-callout-icon{color:var(--qw-callout-color);user-select:none;flex:none}'+
 '.qw-callout-body>:first-child{margin-block-start:0!important}.qw-callout-body>:last-child{margin-block-end:0!important}'+
 '.qw-format-block{display:flow-root}.qw-format-block>:first-child{margin-block-start:0}.qw-format-block>:last-child{margin-block-end:0}'+
 '.qw-format-block :is(p,ul,ol,blockquote,h3,h4,h5,h6){line-height:inherit}'+
 '[data-qw-default-spacing~=before] :is(p,ul,ol,blockquote,h3,h4,h5,h6,.qw-rich-equation):not([data-qw-text-style],.qw-local-format *){margin-block-start:var(--qw-default-before)}'+
 '[data-qw-default-spacing~=after] :is(p,ul,ol,blockquote,h3,h4,h5,h6,.qw-rich-equation):not([data-qw-text-style],.qw-local-format *){margin-block-end:var(--qw-default-after)}'+
 'body[data-qw-profile=practice] .qw-topic-title{margin:2mm 0 1mm;font-weight:700}'+
 'body[data-qw-profile=notes] .qw-task-text{line-height:1.45}'+
 'body[data-qw-profile=notes] .qw-task-text :is(h3,h4,h5,h6){font-size:revert;margin-block-start:.6em}'+
 'body[data-qw-monochrome=true] :is(.qw-format-block,[data-qw-text-style]){color:#000!important;background-color:transparent!important}'+
 'body[data-qw-monochrome=true] .qw-callout{background:#fff;color:#000;border-color:#777}'+
 'body[data-qw-monochrome=true] .qw-callout :is(.qw-callout-title,.qw-callout-icon){color:#000}'+
 '.qw-print-document[data-qw-numbering=none] .qw-paper-task > header:not(.qw-print-header){display:none}'+
 '.qw-print-document[data-qw-numbering=none] .qw-paper-task.qw-standard-task{grid-template-columns:minmax(0,1fr)}'+
 '.qw-print-document[data-qw-numbering=none] .qw-paper-task.qw-standard-task > *{grid-column:1}';

export {QW_TEXT_FONTS,QW_TEXT_RULES,QW_PARAGRAPH_STYLES,QW_CALLOUTS,QW_CALLOUT_TONES,QW_PUBLISH_PROFILES,
 qwStyleColor,qwTextStyle,qwReadTextStyle,qwStyleSource,qwTextStyleCSS,qwTextStyleAttrs,qwDefaultSpacing,qwCalloutOptions,
 qwCalloutOptionSource,qwCalloutLook,QW_EDUCATION_TEXT_CSS};
