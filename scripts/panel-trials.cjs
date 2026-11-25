'use strict';
// Export a verified frozen set and its completed runs for offline browser replay.
const {fs,path,readJSON,atomic,ensure}=require('../framework/core.cjs');
const {verify,pngPath}=require('../framework/dataset.cjs');
const {decode}=require('../framework/runtime.cjs');
const changeBounds=require('../dist/panel-diff.js');
async function main([dataset,...runs]) {
  ensure(dataset&&runs.length,'Usage: node scripts/panel-trials.cjs DATASET RUN [RUN...]');
  const {manifest,tasks,labels}=await verify(dataset);
  const dest=path.resolve(__dirname,'../dist/downloads/inspection');
  await fs.mkdir(dest,{recursive:true});
  const models=[],groups=new Map();
  for(let i=0;i<tasks.length;i++){
    const {id,question}=tasks[i], row=labels[i];
    if(!groups.has(row.group))groups.set(row.group,{group:row.group,key:row.question,difficulty:row.difficulty,seed:row.seed,question,images:[]});
    const name=id+'.png';await fs.copyFile(pngPath(dataset,id),path.join(dest,name));
    groups.get(row.group).images.push({id,image:name,answer:row.answer,evidence:row.pixels[0]});
  }
  for(const group of groups.values()){
    const pair=await Promise.all([0,2].map(async i=>decode(await fs.readFile(path.join(dest,group.images[i].image)))));
    try {group.changeBounds=changeBounds(...pair);ensure(group.changeBounds,'Expected visible change.');}
    finally {pair.forEach(canvas=>canvas.width=1);}
  }
  for(const run of runs){
    const r=await readJSON(path.join(run,'report.json'));
    ensure(r.dataset===manifest.fingerprint&&r.overall.coverage===1,'Model report is incomplete or uses a different dataset.');
    const blind=r.adapter.id==='always-clear-control';
    const protocol=blind?'image-blind control':r.adapter.kind==='module'?'closed choice':r.adapter.kind==='openai'?'free response':'fixed probe';
    const name=blind?'Always clear':r.adapter.kind==='local'?'Fixed-probe baseline':r.adapter.model;
    const slug=(r.adapter.kind==='local'?name:name+'-'+protocol).toLowerCase().replace(/[^a-z0-9-]/g,'-');
    const file=slug+'.html';
    for(const ext of ['html','json'])await fs.copyFile(path.join(run,'report.'+ext),path.join(dest,slug+'.'+ext));
    models.push({name,protocol,file,overall:r.overall,risk:r.inspectionRisk,byFamily:r.byFamily,
      predictions:Object.fromEntries(r.results.map(x=>[x.id,{raw:x.raw,answer:x.answer}]))});
  }
  const payload={fingerprint:manifest.fingerprint,groups:[...groups.values()],models};
  const script='window.PanelTrials='+JSON.stringify(payload).replace(/</g,'\\u003c')+';\n';
  await atomic(path.resolve(dest,'../../panel-trials.js'),script);
}
main(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
