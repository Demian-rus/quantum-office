/* Isolated lecture model. No DOM, storage, network, or existing editor mutations. */
const QL_DEMOS=Object.freeze({
  decay:Object.freeze({duration:60,defaults:Object.freeze({n0:64,halfLife:10})}),
  attenuation:Object.freeze({duration:8,defaults:Object.freeze({halfLayer:1})}),
  photon:Object.freeze({duration:1,defaults:Object.freeze({minNm:0.001,maxNm:1000})})
});
function qlFail(message){throw new Error('QLECTURE: '+message);}
function qlNumber(v,min,max){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)qlFail('недопустимый параметр');return v;}
function qlString(v,max){if(typeof v!=='string'||!v.trim()||v.length>max)qlFail('недопустимый текст');return v;}
function qlList(v,max){if(!Array.isArray(v)||v.length>max)qlFail('недопустимый список');return v;}
function qlRecord(v){if(!v||typeof v!=='object'||Array.isArray(v))qlFail('ожидается объект');return v;}
function qlDemo(raw){
  qlRecord(raw);
  if(!Object.hasOwn(QL_DEMOS,raw.kind))qlFail('неизвестная демонстрация');
  const p=qlRecord(raw.params);
  if(raw.kind==='decay'){
    const n0=qlNumber(p.n0,1,1000000);if(!Number.isInteger(n0))qlFail('число ядер должно быть целым');
    return {kind:raw.kind,params:{n0,halfLife:qlNumber(p.halfLife,.001,1e9)}};
  }
  if(raw.kind==='attenuation')return {kind:raw.kind,params:{halfLayer:qlNumber(p.halfLayer,.001,1e6)}};
  const minNm=qlNumber(p.minNm,1e-9,1e9),maxNm=qlNumber(p.maxNm,1e-9,1e9);
  if(maxNm<=minNm)qlFail('проверьте диапазон длин волн');
  return {kind:raw.kind,params:{minNm,maxNm}};
}
function qlSample(raw,progress){
  const {kind,params:p}=qlDemo(raw),u=qlNumber(progress,0,1);
  if(kind==='decay'){
    const periods=6*u,time=periods*p.halfLife,fraction=2**(-periods);
    return {kind,time,periods,fraction,expected:p.n0*fraction};
  }
  if(kind==='attenuation'){
    const layers=8*u,thickness=layers*p.halfLayer,fraction=2**(-layers);
    return {kind,layers,thickness,fraction,attenuated:1-fraction};
  }
  const wavelengthNm=p.maxNm*(p.minNm/p.maxNm)**u;
  // Exact SI-defined h, c, e; conversion nm to m and joules to eV.
  const energyEv=6.62607015e-34*299792458/(wavelengthNm*1e-9*1.602176634e-19);
  return {kind,wavelengthNm,energyEv};
}
function qlValidate(raw){
  qlRecord(raw);
  if(raw.format!=='QLECTURE'||raw.version!==1)qlFail('неподдерживаемый формат');
  const ids=new Set(),scenes=qlList(raw.scenes,200).map(s=>{
    qlRecord(s);const id=qlString(s.id,100);
    if(ids.has(id))qlFail('повтор идентификатора сцены');ids.add(id);
    const result={id,title:qlString(s.title,200),narration:qlString(s.narration,30000),
      board:qlList(s.board,40).map(x=>qlString(x,2000)),
      figures:qlList(s.figures,30).map(x=>qlString(x,300)),
      durationSec:qlNumber(s.durationSec,1,7200)};
    if(s.demo!==undefined)result.demo=qlDemo(s.demo);
    return result;
  });
  if(!scenes.length)qlFail('лекция не содержит сцен');
  return {format:'QLECTURE',version:1,title:qlString(raw.title,200),subject:qlString(raw.subject,100),audience:qlString(raw.audience,100),scenes};
}
function qlSerialize(raw){return JSON.stringify(qlValidate(raw),null,2);}
function qlParse(text){if(typeof text!=='string'||text.length>8000000)qlFail('файл слишком большой');return qlValidate(JSON.parse(text));}
export {QL_DEMOS,qlDemo,qlSample,qlValidate,qlSerialize,qlParse};
