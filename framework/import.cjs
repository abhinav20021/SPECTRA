'use strict';
const {fs,path,hash,ensure,exists,writeJSON,exclusive}=require('./core.cjs');
const {verify}=require('./dataset.cjs');
const {reportFor}=require('./scoring.cjs');
const {writeReport}=require('./report.cjs');

async function scorePredictions(dataset,file,model,out){
  const {manifest,tasks,labels}=await verify(dataset);
  const content=await fs.readFile(file,'utf8');
  const ids=new Set(tasks.map(t=>t.id)),predictions=new Map();
  for(const [i,line] of content.split(/\r?\n/).entries()){
    if(!line.trim())continue;
    const row=JSON.parse(line);
    ensure(ids.has(row.id) && !predictions.has(row.id),'Unknown or duplicate prediction ID on line '+(i+1));
    ensure(typeof row.response==='string','Prediction needs a text response on line '+(i+1));
    predictions.set(row.id,row.response);
  }
  const responses=tasks.map(({id})=>predictions.has(id)?{id,status:'response',raw:predictions.get(id)}:
    {id,status:'skipped',error:'Missing prediction.'});
  const adapter={kind:'import',model,revision:hash(content)};
  const report=reportFor(manifest,adapter,responses,tasks,labels,manifest.gates||{});
  report.finishedAt=new Date().toISOString();
  return exclusive(path.resolve(out),async()=>{
    ensure(!await exists(out),'Output exists. Choose a new directory for the imported predictions.');
    const staging=await fs.mkdtemp(path.join(path.dirname(path.resolve(out)),'.vtf-score-'));
    try{
      await writeReport(staging,dataset,report);
      await writeJSON(path.join(staging,'run.json'),{dataset:manifest.fingerprint,adapter,status:report.status});
      await fs.rename(staging,out);
    }finally{await fs.rm(staging,{recursive:true,force:true});}
    return report;
  });
}
module.exports={scorePredictions};
