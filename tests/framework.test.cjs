'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const os=require('node:os');
const http=require('node:http');
const {once}=require('node:events');
const {fs,path,hash,readJSON,writeJSON}=require('../framework/core.cjs');
const {generate,verify}=require('../framework/dataset.cjs');
const {evaluate}=require('../framework/runner.cjs');
const {normalize,comparison}=require('../framework/scoring.cjs');
const {scorePredictions}=require('../framework/import.cjs');

test('frozen datasets, checkpoint recovery and regression gates',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'vtf-test-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const dir=path.join(root,'frozen'),suite={name:'test',seed:17,repeats:1,families:['charts'],difficulties:['standard'],gates:{accuracy:0}};
  const manifest=await generate(suite,dir);
  assert.equal(manifest.count,6);
  const duplicate=await generate(suite,path.join(root,'again'));
  assert.equal(duplicate.fingerprint,manifest.fingerprint);
  await assert.rejects(generate(suite,dir),/already exists/);
  const {tasks,labels}=await verify(dir);
  const task=tasks[0],file=path.join(dir,'public',task.image);
  assert.deepEqual(Object.keys(task).sort(),['id','image','question','sha256']);
  const bytes=await fs.readFile(file);await fs.writeFile(file,Buffer.concat([bytes,Buffer.from('bad')]));
  await assert.rejects(verify(dir),/Image checksum mismatch/);await fs.writeFile(file,bytes);
  const privateFile=path.join(dir,'private/answers.jsonl'),manifestFile=path.join(dir,'dataset.json');
  const originalText=await fs.readFile(privateFile,'utf8'),rows=originalText.trim().split('\n').map(s=>JSON.parse(s));
  rows[0].answer='Unknown';
  const altered=rows.map(x=>JSON.stringify(x)).join('\n')+'\n';await fs.writeFile(privateFile,altered);
  const {fingerprint,gates,...meta}=manifest;
  meta.answersHash=hash(altered);await writeJSON(manifestFile,{...meta,fingerprint:hash(JSON.stringify(meta)),gates});
  await assert.rejects(verify(dir),/Source \/ pixel answer mismatch/);
  await fs.writeFile(privateFile,originalText);await writeJSON(manifestFile,manifest);

  const answers=new Map(tasks.map((r,i)=>[r.sha256,labels[i].answer]));
  let calls=0,mode='partial';const seen=new Set();
  const server=http.createServer(async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);
    const body=JSON.parse(Buffer.concat(chunks));calls++;
    assert.equal(body.messages.length,1);assert.equal(body.messages[0].role,'user');
    const [q,png]=body.messages[0].content;assert(q.text.includes('Which region'));assert.equal(body.messages[0].content.length,2);
    const id=hash(Buffer.from(png.image_url.url.split(',')[1],'base64'));assert(answers.has(id));
    if(mode==='partial'&&id===task.sha256){res.writeHead(429);res.end();return;}
    if(mode==='retry'&&!seen.has(id)){seen.add(id);res.writeHead(503);res.end();return;}
    if(mode==='fatal'){res.writeHead(401);res.end();return;}
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({choices:[{message:{content:mode==='invalid'?'maybe':answers.get(id)}}]}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.close());
  const previous=process.env.OPENAI_BASE_URL,oldKey=process.env.OPENAI_API_KEY;
  process.env.OPENAI_BASE_URL='http://127.0.0.1:'+server.address().port+'/v1';process.env.OPENAI_API_KEY='fixture-only';
  t.after(()=>{if(previous===undefined)delete process.env.OPENAI_BASE_URL;else process.env.OPENAI_BASE_URL=previous;
    if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;});
  const run=path.join(root,'run'),opts={adapter:'openai',model:'controlled-server',retries:0,concurrency:2};
  const bad=await evaluate(dir,run,opts);assert.equal(bad.status,'incomplete');assert.equal(bad.overall.errors,1);assert.equal(calls,6);
  mode='retry';const good=await evaluate(dir,run,{...opts,retries:1,resume:true});
  assert.equal(calls,8);assert.equal(good.status,'passed');assert.equal(good.overall.correct,6);
  assert.equal(good.overall.style,1);assert.equal(good.overall.change,1);
  await evaluate(dir,run,{...opts,resume:true});assert.equal(calls,8);
  await assert.rejects(evaluate(dir,run,{...opts,resume:true,model:'changed'}),/Resume rejected/);
  await assert.rejects(evaluate(dir,run,opts),/already exists/);
  mode='invalid';const invalid=await evaluate(dir,path.join(root,'invalid'),{...opts,gates:{'charts.accuracy':.5}});
  assert.equal(invalid.status,'failed');assert.equal(invalid.overall.invalid,6);assert.equal(invalid.overall.coverage,1);
  const comparisonResult=comparison(good,invalid,0);assert(!comparisonResult.passed);assert.equal(comparisonResult.regressions.length,6);
  assert.throws(()=>comparison(good,{...good,dataset:'other'},0),/different frozen datasets/);
  assert.throws(()=>comparison(good,bad,0),/complete evaluations/);
  mode='fatal';const fatal=await evaluate(dir,path.join(root,'fatal'),{...opts,concurrency:1});
  assert.equal(fatal.status,'incomplete');assert.equal(fatal.overall.errors,1);assert.equal(fatal.overall.skipped,5);
  assert.equal(normalize('03.','counting'),'3');assert.equal(normalize('3 or 4','counting'),null);
  const tmpAdapter=path.join(root,'adapter.cjs');await fs.writeFile(tmpAdapter,
    "exports.id='input-check';exports.predict=async s=>{if(Object.keys(s).sort().join(',')!=='png,question')throw Error('leak');return 'West';};");
  const custom=await evaluate(dir,path.join(root,'custom'),{adapter:tmpAdapter});
  assert.equal(custom.overall.responded,6);assert.equal((await readJSON(path.join(run,'report.json'))).dataset,manifest.fingerprint);
  const predFile=path.join(root,'predictions.jsonl');
  const predictions=tasks.map((sample,i)=>JSON.stringify({id:sample.id,response:labels[i].answer})).reverse();
  await fs.writeFile(predFile,predictions.join('\n'));
  const imported=await scorePredictions(dir,predFile,'external',path.join(root,'imported'));
  assert.equal(imported.overall.correct,6);assert(comparison(good,imported,0).passed);
  await fs.writeFile(predFile,predictions.slice(1).join('\n'));
  const partial=await scorePredictions(dir,predFile,'external',path.join(root,'partial'));
  assert.equal(partial.status,'incomplete');assert.equal(partial.overall.skipped,1);
  await fs.writeFile(predFile,[...predictions,predictions[0]].join('\n'));
  await assert.rejects(scorePredictions(dir,predFile,'external',path.join(root,'duplicate')),/duplicate prediction/);
  const hanging=path.join(root,'timeout.cjs');await fs.writeFile(hanging,"exports.id='slow';exports.predict=async()=>new Promise(()=>{});");
  const timedOut=await evaluate(dir,path.join(root,'timeouts'),{adapter:hanging,timeoutMs:5,retries:0});
  assert.equal(timedOut.overall.errors,6);assert.match(timedOut.results[0].error,/timed out/);
  assert(!(await fs.readFile(path.join(run,'report.json'),'utf8')).includes('fixture-only'));
});
