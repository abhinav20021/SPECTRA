'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const os=require('node:os');
const {fs,path}=require('../framework/core.cjs');
const {generate,verify,validateSuite}=require('../framework/dataset.cjs');
const {skills,decode}=require('../framework/runtime.cjs');
const {normalize}=require('../framework/scoring.cjs');
const full=require('../suites/studio.json'),demo=require('../suites/studio-demo.json');

test('all twenty live task types survive PNG encoding with both difficulties and all three variants',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vtf-reasoning-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const location=path.join(root,'frozen'),m=await generate(full,location);
  const {tasks,labels}=await verify(location);assert.equal(m.count,120);assert.equal(new Set(labels.map(r=>r.question)).size,20);
  for(const [i,record] of labels.entries()){
    assert.equal(record.source.query.text,tasks[i].question);
    assert.equal(normalize(record.answer,record.family,record.question),record.answer);
  }
  assert.throws(()=>validateSuite({...demo,tasks:{geometry:['typo']}}),/Invalid task/);
  const small=await generate(demo,path.join(root,'pilot'));assert.equal(small.count,12);
});

test('the same warehouse seed reproduces a generated row query and changes exactly one relevant bin',async()=>{
  const prompts=new Set();
  for(let seed=0;seed<20;seed++){
    const c=skills.create('quantities',seed,'recolor','close'),[a,b,d]=c.tasks;
    assert.equal(c.prompt,skills.promptFor('quantities','recolor',seed,'close'));prompts.add(c.prompt);
    assert.equal(b.key,a.key);assert.equal(Math.abs(Number(a.key)-Number(d.key)),1);
    const original=a.rows.scene,edited=d.rows.scene,q=a.rows.query;assert.deepEqual(original.a,edited.a);
    const changes=[];for(let y=0;y<6;y++)for(let x=0;x<6;x++)if(original.b[y][x]!==edited.b[y][x])changes.push([x,y]);
    assert.equal(changes.length,1);const [x,y]=changes[0];
    assert.ok(y+1>=q.first&&y+1<=q.last);assert.ok(!q.ink||q.ink===original.a[y][x]);
    if(seed===0){
      const decoded=await decode(a.canvas.toBuffer('image/png')),g=decoded.getContext('2d'),pitch=Math.floor(211/6);
      g.drawImage(d.canvas,493+x*pitch,107+y*pitch,pitch,pitch,493+x*pitch,107+y*pitch,pitch,pitch);
      assert.equal(skills.pixelCheck(decoded,'quantities','recolor',c.prompt).answer,d.key);
      assert.equal(skills.sourceAnswer('quantities','recolor',a.rows),a.key);decoded.width=1;
    }
    c.tasks.forEach(t=>t.canvas.width=1);
  }
  assert.ok(prompts.size>10);
});
test('raster readers distinguish the edited answer across all task types and keep order meaningful',()=>{
  for(const [family,v] of Object.entries(skills.labFamilies))for(const type of Object.keys(v.types)){
    const c=skills.create(family,4294967295,type,'standard');
    const [a,b,d]=c.tasks;
    assert.equal(skills.pixelCheck(d.canvas,family,type,c.prompt).answer,d.key);
    assert.equal(a.key,b.key);assert.notEqual(a.key,d.key);
    c.tasks.forEach(t=>t.canvas.width=1);
  }
  assert.equal(normalize(' B, C, A. ','geometry','sorting'),'B C A');
  assert.equal(normalize('A B C','geometry','sorting'),'A B C');
  assert.equal(normalize('41','patterns','wallpaper'),null);
});
