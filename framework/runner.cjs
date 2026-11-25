'use strict';
const {setTimeout:sleep}=require('node:timers/promises');
const {fs,path,hash,ensure,readJSON,exists,writeJSON,exclusive}=require('./core.cjs');
const {verify,pngPath,validateGates}=require('./dataset.cjs');
const {getAdapter}=require('./adapters.cjs');
const {PROTOCOL,reportFor}=require('./scoring.cjs');
const {writeReport}=require('./report.cjs');

async function attempt(adapter,sample,timeoutMs){
  const controller=new AbortController();
  let timer;
  const deadline=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      const error=new Error('Model request timed out.');error.retryable=true;
      reject(error);controller.abort();
    },timeoutMs);
  });
  try{
    const raw=await Promise.race([deadline,Promise.resolve().then(()=>adapter.predict(sample,{signal:controller.signal}))]);
    ensure(typeof raw==='string','Adapter predict() must return a string.');
    return raw;
  }finally{clearTimeout(timer);}
}
async function respond(adapter,sample,options){
  const start=Date.now();
  for(let i=0;;i++){
    try{
      const raw=await attempt(adapter,sample,options.timeoutMs);
      return {status:'response',raw,attempts:i+1,elapsedMs:Date.now()-start};
    }catch(error){
      const delay=Math.max(250*2**i,error.retryAfterMs||0);
      if(!error.retryable||i>=options.retries||delay>60000){
        const message=String(error.message||error);
        const key=process.env.OPENAI_API_KEY;
        return {status:'error',error:key?message.split(key).join('[redacted]'):message,
          fatal:!!error.fatal,attempts:i+1,elapsedMs:Date.now()-start};
      }
      await sleep(delay);
    }
  }
}
async function evaluate(dataset,out,options={}){
  dataset=path.resolve(dataset);out=path.resolve(out);
  const concurrency=options.concurrency??1,retries=options.retries??2,timeoutMs=options.timeoutMs??60000;
  ensure(Number.isInteger(concurrency)&&concurrency>=1&&concurrency<=32,'concurrency must be 1–32.');
  ensure(Number.isInteger(retries)&&retries>=0&&retries<=5,'retries must be 0–5.');
  ensure(Number.isInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=600000,'timeout-ms must be 1–600000.');
  const data=await verify(dataset),adapter=await getAdapter({...options,families:data.manifest.suite.families});
  const {manifest,tasks,labels}=data,gates=validateGates(options.gates??manifest.gates);
  ensure(Object.keys(gates).every(k=>!k.includes('.')||manifest.suite.families.includes(k.split('.')[0])),'Gate refers to an absent family.');
  const identity={dataset:manifest.fingerprint,adapter:adapter.identity,scoring:PROTOCOL};
  const signature=hash(JSON.stringify(identity));
  return exclusive(out,async()=>{
    const stateFile=path.join(out,'run.json');
    if(await exists(stateFile)){
      ensure(options.resume,'Run already exists. Use --resume or a new output path.');
      ensure((await readJSON(stateFile)).signature===signature,'Resume rejected: dataset, model, adapter or scoring protocol changed.');
    }else if(await exists(out)){
      ensure((await fs.readdir(out)).length===0,'Output directory has unrelated files.');
    }
    const cache=path.join(out,'responses');await fs.mkdir(cache,{recursive:true});
    const startedAt=new Date().toISOString();
    await writeJSON(stateFile,{...identity,signature,status:'running',startedAt});
    await fs.rm(path.join(out,'report.json'),{force:true});await fs.rm(path.join(out,'report.html'),{force:true});
    let next=0,fatal=false,stop=false;
    const responses=new Array(tasks.length);
    async function worker(){
      while(!stop&&next<tasks.length){
        const i=next++,task=tasks[i],file=path.join(cache,task.id+'.json');
        let previousAttempts=0,previousMs=0;
        if(options.resume && await exists(file)){
          const cached=await readJSON(file);
          ensure(cached.id===task.id&&cached.signature===signature,'Incompatible response checkpoint: '+task.id);
          previousAttempts=cached.attempts||0;previousMs=cached.elapsedMs||0;
          if(cached.status==='response'&&typeof cached.raw==='string'){responses[i]=cached;continue;}
        }
        if(fatal){responses[i]={id:task.id,status:'skipped',error:'Skipped after a fatal provider error.',attempts:0,elapsedMs:0};continue;}
        const png=await fs.readFile(pngPath(dataset,task.id));
        ensure(hash(png)===task.sha256,'Dataset image changed after verification: '+task.id);
        const result=await respond(adapter,{png,question:task.question},{retries,timeoutMs});
        fatal ||= !!result.fatal;
        const row={id:task.id,signature,...result,attempts:previousAttempts+result.attempts,elapsedMs:previousMs+result.elapsedMs};
        await writeJSON(file,row);responses[i]=row;
      }
    }
    const workers=Array.from({length:Math.min(concurrency,tasks.length)},()=>worker().catch(e=>{stop=true;throw e;}));
    const settled=await Promise.allSettled(workers);
    const failure=settled.find(w=>w.status==='rejected');if(failure)throw failure.reason;
    const report=reportFor(manifest,adapter.identity,responses,tasks,labels,gates);
    report.startedAt=startedAt;report.finishedAt=new Date().toISOString();
    await writeReport(out,dataset,report);
    await writeJSON(stateFile,{...identity,signature,status:report.status,startedAt,finishedAt:report.finishedAt});
    return report;
  });
}
module.exports={evaluate};
