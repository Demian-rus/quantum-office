import test from 'node:test';
import assert from 'node:assert/strict';
import {qlValidate,qlSample,qlParse,qlSerialize} from '../src/core/lecture-model.js';
import {QL_RADIATION} from '../src/core/lecture-radiation.js';
test('lecture seed has 13 unique scenes and round-trips',()=>{
 const v=qlValidate(QL_RADIATION);assert.equal(v.scenes.length,13);
 assert.deepEqual(qlParse(qlSerialize(v)),v);
 assert.equal(v.scenes.filter(x=>x.demo).length,3);
});
test('mean radioactive decay at 0, 1 and 6 half lives',()=>{
 const d={kind:'decay',params:{n0:64,halfLife:10}};
 assert.equal(qlSample(d,0).expected,64);assert.equal(qlSample(d,1/6).expected,32);
 assert.equal(qlSample(d,1).expected,1);assert.equal(qlSample(d,1).time,60);
});
test('attenuation at 0, 1 and 8 half-value layers',()=>{
 const d={kind:'attenuation',params:{halfLayer:2}};
 assert.equal(qlSample(d,0).fraction,1);assert.equal(qlSample(d,1/8).fraction,.5);
 assert.equal(qlSample(d,1).fraction,1/256);assert.equal(qlSample(d,1).thickness,16);
});
test('photon energy in electron volts from SI definitions',()=>{
 const d={kind:'photon',params:{minNm:1,maxNm:1000}};
 assert.ok(Math.abs(qlSample(d,0).energyEv-1.239841984)<1e-8);
 assert.ok(Math.abs(qlSample(d,1).energyEv-1239.841984)<1e-5);
});
test('invalid versions, duplicates, nonfinite parameters and unknown kinds rejected',()=>{
 const v=structuredClone(QL_RADIATION);v.version=2;assert.throws(()=>qlValidate(v));
 const w=structuredClone(QL_RADIATION);w.scenes.push(w.scenes[0]);assert.throws(()=>qlValidate(w));
 assert.throws(()=>qlSample({kind:'decay',params:{n0:1,halfLife:NaN}},0));
 assert.throws(()=>qlSample({kind:'attenuation',params:{halfLayer:1}},1.1));
 assert.throws(()=>qlSample({kind:'unknown',params:{}},0));
 assert.throws(()=>qlParse('{'));
});
test('validation does not mutate input and strips unrecognized executable-like data',()=>{
 const v=structuredClone(QL_RADIATION);v.scenes[0].script='alert(1)';
 const before=structuredClone(v);const clean=qlValidate(v);
 assert.deepEqual(v,before);assert.ok(!Object.hasOwn(clean.scenes[0],'script'));
});
