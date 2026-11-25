#!/usr/bin/env node
'use strict';
const {parseArgs}=require('node:util');
const {fs,path,ensure,readJSON,exists,writeJSON}=require('./core.cjs');
const {validateSuite,generate,verify}=require('./dataset.cjs');
const {evaluate}=require('./runner.cjs');
const {comparison}=require('./scoring.cjs');
const {scorePredictions}=require('./import.cjs');
const {percent}=require('./report.cjs');

const help=`Visual Task Factory · automated visual evaluation

  vtf pipeline [--suite suites/smoke.json] [--out artifacts/smoke] [model options]
  vtf generate --suite SUITE --out DATASET
  vtf verify --dataset DATASET
  vtf evaluate --dataset DATASET --out RUN [model options]
  vtf score --dataset DATASET --predictions FILE.jsonl --model NAME --out RUN
  vtf compare --baseline REPORT --candidate REPORT [--max-drop 0.02] [--out FILE]

Model options: --adapter local|openai|./adapter.cjs  --model MODEL
               --concurrency N  --retries N  --timeout-ms N  --resume

The default adapter runs locally. For remote inference set OPENAI_API_KEY.
OPENAI_BASE_URL may point to a compatible service. --max-drop is an absolute
fraction and applies to overall and per-skill accuracy and both pair scores.
Exit codes: 0 passed, 1 quality regression, 2 invalid input or incomplete run.`;
const modelFlags=['adapter','model','concurrency','retries','timeout-ms','resume'];
const allowed={pipeline:['suite','out',...modelFlags],generate:['suite','out'],verify:['dataset'],
  evaluate:['dataset','out',...modelFlags],score:['dataset','predictions','model','out'],compare:['baseline','candidate','max-drop','out']};
function showReport(r,out){
  console.log(r.status.toUpperCase()+' · '+r.overall.correct+'/'+r.overall.total+' correct · '+percent(r.overall.coverage)+' response coverage');
  for(const [name,g] of Object.entries(r.byFamily))console.log('  '+name+': '+g.correct+'/'+g.total+' correct, '+g.styleCorrect+'/'+g.pairs+' restyled pairs, '+g.changeCorrect+'/'+g.pairs+' edited pairs');
  console.log('Report: '+path.resolve(out,'report.html'));
  return r.status==='incomplete'?2:r.status==='failed'?1:0;
}
async function main(args){
  const [command,...rest]=args;
  if(!command||['help','--help','-h'].includes(command)||rest.includes('--help')){console.log(help);return 0;}
  ensure(Object.hasOwn(allowed,command),'Unknown command: '+command);
  const opts=Object.fromEntries(allowed[command].map(key=>[key,{type:key==='resume'?'boolean':'string'}]));
  const {values:v}=parseArgs({args:rest,options:opts,strict:true});
  const required=(key)=>{ensure(v[key],'Missing --'+key);return v[key];};
  if(command==='verify'){
    const {manifest:m}=await verify(required('dataset'));
    console.log('Verified '+m.count+' encoded PNGs · '+m.fingerprint);return 0;
  }
  if(command==='score'){
    const out=required('out');
    return showReport(await scorePredictions(required('dataset'),required('predictions'),required('model'),out),out);
  }
  if(command==='compare'){
    const maxDrop=Number(v['max-drop']??0);
    ensure(Number.isFinite(maxDrop)&&maxDrop>=0&&maxDrop<=1,'max-drop must be 0–1.');
    const result=comparison(await readJSON(required('baseline')),await readJSON(required('candidate')),maxDrop);
    if(v.out){await fs.mkdir(path.dirname(path.resolve(v.out)),{recursive:true});await writeJSON(v.out,result);}
    console.log(JSON.stringify(result,null,2));return result.passed?0:1;
  }
  const optsModel={adapter:v.adapter,model:v.model,resume:v.resume};
  for(const [key,name] of [['retries','retries'],['concurrency','concurrency'],['timeout-ms','timeoutMs']]){
    if(v[key]!==undefined)optsModel[name]=Number(v[key]);
  }
  if(command==='evaluate'){
    const out=required('out');
    return showReport(await evaluate(required('dataset'),out,optsModel),out);
  }
  const suite=await readJSON(v.suite||path.join(__dirname,'../suites/smoke.json'));
  const spec=validateSuite(suite);
  if(command==='generate'){
    const m=await generate(suite,required('out'));console.log('Generated and verified '+m.count+' images · '+m.fingerprint);return 0;
  }
  const out=path.resolve(v.out||'artifacts/smoke'),dataset=path.join(out,'dataset'),run=path.join(out,'run');
  if(v.resume&&await exists(path.join(dataset,'dataset.json'))){
    const manifest=await readJSON(path.join(dataset,'dataset.json'));
    ensure(JSON.stringify(manifest.suite)===JSON.stringify(spec),'Requested suite differs from the frozen dataset.');
  }else{
    const m=await generate(suite,dataset);console.log('Generated and verified '+m.count+' images.');
  }
  return showReport(await evaluate(dataset,run,{...optsModel,gates:suite.gates||{}}),run);
}
main(process.argv.slice(2)).then(code=>{process.exitCode=code;}).catch(error=>{console.error('VTF: '+error.message);process.exitCode=2;});
