'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {skills}=require('../framework/runtime.cjs');
const {normalize,reportFor}=require('../framework/scoring.cjs');
const path=require('node:path');
const fs=require('node:fs');
const suite=require('../suites/inspection.json');
const zones={seat:[34,98,224,91],pins:[283,100,240,90],mirror:[553,100,228,90],keys:[33,231,382,82],net:[456,220,322,94]};
test('each one-edit pair changes visible pixels only at its named station',()=>{
  for(const family of suite.families){
    const key=Object.keys(skills.families[family].types)[0],seen=new Set();
    for(const difficulty of suite.difficulties)for(let seed=0;seed<12;seed++){
      const c=skills.create(family,seed,key,difficulty),[a,b,d]=c.tasks;
      assert.equal(a.key,b.key);assert.notEqual(a.key,d.key);seen.add(a.key);
      const [x,y,w,h]=zones[key];
      const ac=a.canvas.getContext('2d'),dc=d.canvas.getContext('2d');
      const source=ac.getImageData(0,0,820,356).data,edited=dc.getImageData(0,0,820,356).data;
      let changed=0;
      for(let row=0;row<356;row++){
        const pixels=820*4, offset=row*pixels;
        const orig=Buffer.from(source.buffer,source.byteOffset+offset,pixels);
        const other=Buffer.from(edited.buffer,edited.byteOffset+offset,pixels);
        if(row<y||row>=y+h)assert.ok(orig.equals(other));
        else{
          assert.ok(orig.subarray(0,x*4).equals(other.subarray(0,x*4)));
          assert.ok(orig.subarray((x+w)*4).equals(other.subarray((x+w)*4)));
          if(!orig.equals(other))changed++;
        }
      }
      assert.ok(changed>0);
      if(key==='mirror')assert.equal(d.check.readings[0].leftCount,d.check.readings[0].rightCount);
      for(const t of c.tasks)t.canvas.width=1;
    }
    assert.equal(seen.size,2);
  }
});
test('an independently inserted cut disconnects the raster without changing the source truth',()=>{
  const c=skills.create('panel_net',3,'net','close');
  const t=c.tasks.find(i=>i.key==='Yes');
  t.canvas.getContext('2d').clearRect(498,259,5,14);
  assert.equal(skills.pixelCheck(t.canvas,'panel_net','net').answer,'No');
  assert.equal(skills.sourceAnswer('panel_net','net',t.rows),'Yes');
});
test('risk separates a missed defect, false alarm and abstention',()=>{
  const labels=['No','No','Yes','Yes'].map((answer,i)=>({family:'panel_net',question:'net',answer,group:'g'+i,index:0,difficulty:'close',variant:'Original'}));
  const tasks=labels.map((_,i)=>({id:String(i),image:'i',question:'q'}));
  const predictions=['Yes','No','No','uncertain'].map(raw=>({raw,status:'response'}));
  const risk=reportFor({suite:{name:'test'},fingerprint:'x'}, {}, predictions,tasks,labels,{}).inspectionRisk;
  assert.deepEqual(risk,{defective:2,conforming:2,falseClear:1,falseAlarm:1,abstained:1});
  assert.equal(normalize('9','panel_pins'),null);
});
test('shipped replay cases match public images and report answers',()=>{
  const base=path.resolve(__dirname,'../dist'),win={};
  require('node:vm').runInNewContext(fs.readFileSync(path.join(base,'panel-trials.js'),'utf8'),{window:win});
  const {groups,models,fingerprint}=win.PanelTrials;
  assert.equal(groups.length,10);let total=0;
  for(const g of groups){
    const [x,y,w,h]=g.changeBounds, [ox,oy,ow,oh]=zones[g.key];
    assert.ok(w>0&&h>0&&x>=ox&&y>=oy&&x+w<=ox+ow&&y+h<=oy+oh);
    assert.equal(g.images[0].answer,g.images[1].answer);
    assert.notEqual(g.images[0].answer,g.images[2].answer);
    for(const i of g.images){
      assert.ok(fs.existsSync(path.join(base,'downloads/inspection',i.image)));
      for(const m of models)assert.equal(typeof m.predictions[i.id].raw,'string');
      total++;
    }
  }
  for(const m of models){
    const report=JSON.parse(fs.readFileSync(path.join(base,'downloads/inspection',m.file.replace('.html','.json'))));
    assert.equal(report.dataset,fingerprint);assert.equal(report.overall.total,total);
    for(const r of report.results)assert.equal(m.predictions[r.id].raw,r.raw);
  }
});
