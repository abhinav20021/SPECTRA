'use strict';
const {fs,path,hash,ensure,readJSON,exists,atomic,writeJSON,exclusive}=require('./core.cjs');
const {skills,engine,revisionFor,decode}=require('./runtime.cjs');

const FORMAT='vtf-dataset/1';
const METRICS=['accuracy','style','change'];
function validateGates(gates={}) {
  ensure(gates && typeof gates==='object' && !Array.isArray(gates),'gates must be an object');
  for(const [key,threshold] of Object.entries(gates)){
    const parts=key.split('.');
    const valid=parts.length===1?METRICS.includes(key):
      parts.length===2 && Object.hasOwn(skills.families,parts[0]) && METRICS.includes(parts[1]);
    ensure(valid && Number.isFinite(threshold) && threshold>=0 && threshold<=1, 'Invalid gate: '+key);
  }
  return gates;
}
function validateSuite(suite) {
  ensure(suite && typeof suite.name==='string' && suite.name.trim(),'Suite needs a name.');
  ensure(Number.isInteger(suite.seed)&&suite.seed>=0&&suite.seed<=0xffffffff,'seed must be a uint32.');
  ensure(Number.isSafeInteger(suite.repeats)&&suite.repeats>0,'repeats must be a positive integer.');
  for(const [key,allowed] of [['families',Object.keys(skills.families)],['difficulties',['standard','close']]]){
    const values=suite[key];
    ensure(Array.isArray(values)&&values.length&&new Set(values).size===values.length&&values.every(v=>allowed.includes(v)), 'Invalid '+key);
  }
  validateGates(suite.gates);
  for(const key of Object.keys(suite.gates||{})){
    if(key.includes('.'))ensure(suite.families.includes(key.split('.')[0]), 'Gate refers to an omitted family: '+key);
  }
  return {name:suite.name,seed:suite.seed,repeats:suite.repeats,families:suite.families,difficulties:suite.difficulties};
}
function* groups(spec) {
  for(const family of spec.families)for(const question of Object.keys(skills.families[family].types)){
    for(const difficulty of spec.difficulties)for(let repeat=0;repeat<spec.repeats;repeat++){
      const group=hash(JSON.stringify([spec.seed,family,question,difficulty,repeat])).slice(0,24);
      yield {group,seed:parseInt(group.slice(0,8),16),family,question,difficulty,repeat};
    }
  }
}
const sampleId=(group,index)=>hash(group+'-'+index).slice(0,24);
const jsonLines=rows=>rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
const pngPath=(dir,id)=>path.join(dir,'public','images',id+'.png');
function checkPixels(canvas,meta) {
  return meta.family==='charts'?engine.verifyImage(canvas,meta.question):skills.pixelCheck(canvas,meta.family,meta.question);
}
async function generate(suite,out) {
  const spec=validateSuite(suite);out=path.resolve(out);
  return exclusive(out,async()=>{
    ensure(!await exists(out),'Dataset directory already exists. Use verify or choose a new directory.');
    const staging=await fs.mkdtemp(path.join(path.dirname(out),'.vtf-dataset-'));
    try {
      await fs.mkdir(path.join(staging,'public/images'),{recursive:true});
      await fs.mkdir(path.join(staging,'private'));
      const tasks=[],labels=[];
      for(const meta of groups(spec)){
        const challenge=skills.create(meta.family,meta.seed,meta.question,meta.difficulty);
        for(const [index,t] of challenge.tasks.entries()){
          const id=sampleId(meta.group,index),png=t.canvas.toBuffer('image/png');
          await fs.writeFile(pngPath(staging,id),png);
          tasks.push({id,image:'images/'+id+'.png',question:challenge.prompt,sha256:hash(png)});
          labels.push({...meta,id,index,variant:t.variant,answer:t.key,source:t.rows,pixels:t.check.readings});
          t.canvas.width=1;
        }
      }
      const taskText=jsonLines(tasks),labelText=jsonLines(labels);
      await atomic(path.join(staging,'public/tasks.jsonl'),taskText);
      await atomic(path.join(staging,'private/answers.jsonl'),labelText);
      const content={format:FORMAT,generatorVersion:revisionFor(spec.families),suite:spec,count:tasks.length,tasksHash:hash(taskText),answersHash:hash(labelText)};
      await writeJSON(path.join(staging,'dataset.json'),{...content,fingerprint:hash(JSON.stringify(content)),gates:suite.gates||{}});
      const verified=await verify(staging);
      await fs.rename(staging,out);
      return verified.manifest;
    } finally { await fs.rm(staging,{recursive:true,force:true}); }
  });
}
function parseLines(text){return text.trimEnd().split('\n').map(line=>JSON.parse(line));}
async function verify(dir) {
  const manifest=await readJSON(path.join(dir,'dataset.json'));
  const {fingerprint,gates,...content}=manifest;
  ensure(content.format===FORMAT && fingerprint===hash(JSON.stringify(content)),'Dataset manifest fingerprint mismatch.');
  validateSuite({...content.suite,gates});
  const [taskText,labelText]=await Promise.all(['public/tasks.jsonl','private/answers.jsonl'].map(f=>fs.readFile(path.join(dir,f),'utf8')));
  ensure(hash(taskText)===content.tasksHash && hash(labelText)===content.answersHash,'Dataset index checksum mismatch.');
  const tasks=parseLines(taskText),labels=parseLines(labelText);
  ensure(tasks.length===manifest.count && labels.length===tasks.length,'Dataset length mismatch.');
  let i=0;
  for(const meta of groups(content.suite)){
    const answers=[];
    for(let k=0;k<3;k++,i++){
      const task=tasks[i],label=labels[i],id=sampleId(meta.group,k);
      ensure(task?.id===id && label?.id===id && task.image==='images/'+id+'.png','Missing or misplaced sample: '+id);
      ensure(Object.entries(meta).every(([key,v])=>label[key]===v) && label.index===k &&
        label.variant===skills.families[meta.family].variants[k],'Invalid sample metadata: '+id);
      ensure(task.question===skills.promptFor(meta.family,meta.question),'Question does not match its task: '+id);
      const png=await fs.readFile(pngPath(dir,id));
      ensure(hash(png)===task.sha256,'Image checksum mismatch: '+id);
      const canvas=await decode(png);
      let observed;
      try {observed=checkPixels(canvas,meta);} finally {canvas.width=1;}
      const sourceAnswer=skills.sourceAnswer(meta.family,meta.question,label.source);
      ensure(label.answer===sourceAnswer && label.answer===observed.answer,'Source / pixel answer mismatch: '+id);
      ensure(JSON.stringify(label.pixels)===JSON.stringify(observed.readings),'Pixel evidence mismatch: '+id);
      answers.push(label.answer);
    }
    ensure(answers[0]===answers[1] && answers[0]!==answers[2], 'Variant invariant failed: '+meta.group);
  }
  ensure(i===tasks.length,'Unexpected samples beyond suite coverage.');
  return {manifest,tasks,labels};
}
module.exports={validateSuite,validateGates,generate,verify,pngPath};
