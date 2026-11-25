const assert=require('node:assert/strict'), {createCanvas}=require('@napi-rs/canvas');
global.window=global;global.document={createElement:()=>createCanvas(1,1)};
const dist=require('node:path').resolve(__dirname,'../dist');
require(dist+'/engine.js');require(dist+'/skills.js');
const S=VisualSkills;let tested=0;const stats={};
for(const seed of [0,1,7,25,82041,4294967295,947321,33111,28901,13,4629,8367]){
 for(const [id,def] of Object.entries(S.families))for(const key of Object.keys(def.types))for(const d of ['standard','close']){
  let c;
  try{c=S.create(id,seed,key,d);}catch(e){console.error({id,seed,key,d});throw e;}
  assert.equal(c.tasks[0].key,c.tasks[1].key);
  assert.notEqual(c.tasks[0].key,c.tasks[2].key);
  for(const t of c.tasks){
   assert.equal(t.check.answer,t.key);
   const pred=S.predict(t.canvas,c.prompt);
   const record=stats[id+' '+d]??=[0,0];record[0]+=+(pred===t.key);record[1]++;
   tested++;
  }
 }
}
for(const family of ['counting','spatial']){
 const c=S.create(family,42,Object.keys(S.families[family].types)[0],'standard');
 const task=c.tasks[0],g=task.canvas.getContext('2d');
 if(family==='spatial'){
  const obj=task.rows.find(o=>o.shape==='Star');g.fillStyle='#fff';g.fillRect(obj.x-35,obj.y-35,70,70);
  assert.throws(()=>S.pixelCheck(task.canvas,family,c.question));
 }else{
  const o=task.rows.find(o=>o.shape==='Circle'&&o.color==='Blue');g.fillStyle='#fff';g.fillRect(o.x-31,o.y-31,62,62);
  assert.equal(Number(S.pixelCheck(task.canvas,family,c.question).answer),Number(task.key)-1);
 }
}
const tour=S.tourPlan(82041,'counting','orange');assert.equal(tour[0].key,'orange');assert.equal(new Set(tour.map(x=>x.family)).size,3);
console.log('Verified image count:',tested,stats);
