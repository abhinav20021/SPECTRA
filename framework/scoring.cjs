'use strict';
const {ensure}=require('./core.cjs');
const {skills}=require('./runtime.cjs');
function inspectionRisk(rows) {
  const panel=rows.filter(r=>r.family.startsWith('panel_'));
  if(!panel.length)return null;
  let defective=0, conforming=0, falseClear=0, falseAlarm=0, abstained=0;
  for(const row of panel){
    const required=row.family==='panel_pins'?'4':'Yes';
    const good=row.expected===required;
    if(good)conforming++;else defective++;
    if(row.answer===null){abstained++;continue;}
    if(!good&&row.answer===required)falseClear++;
    if(good&&row.answer!==required)falseAlarm++;
  }
  return {defective,conforming,falseClear,falseAlarm,abstained};
}
const PROTOCOL='vtf-exact-label-pairs/1';

function normalize(raw,family) {
  const token=raw.trim().replace(/^[\s"'*`]+|[\s"'*`.!]+$/g,'').toLowerCase();
  if(family==='panel_pins')return /^[0-6]$/.test(token)?token:null;
  if(family==='counting')return /^\d{1,3}$/.test(token)?String(Number(token)):null;
  return skills.families[family].choices.find(label=>label.toLowerCase()===token)||null;
}
function metrics(rows){
  const correct=rows.filter(r=>r.correct).length,total=rows.length;
  const responded=rows.filter(r=>r.status==='response').length;
  const invalid=rows.filter(r=>r.status==='response'&&r.answer===null).length;
  const group=new Map();
  for(const r of rows){
    if(!group.has(r.group))group.set(r.group,[]);
    group.get(r.group)[r.index]=r.correct;
  }
  const triples=[...group.values()].filter(g=>g.length===3&&[0,1,2].every(i=>typeof g[i]==='boolean'));
  const pairs=triples.length, styleCorrect=triples.filter(t=>t[0]&&t[1]).length, changeCorrect=triples.filter(t=>t[0]&&t[2]).length;
  return {total,correct,responded,invalid,errors:rows.filter(r=>r.status==='error').length,
    skipped:rows.filter(r=>r.status==='skipped').length,accuracy:correct/total,coverage:responded/total,
    pairs,styleCorrect,changeCorrect,style:pairs?styleCorrect/pairs:null,change:pairs?changeCorrect/pairs:null};
}
function slices(rows,field) {
  const keys=[...new Set(rows.map(row=>row[field]))];
  return Object.fromEntries(keys.map(k=>[k,metrics(rows.filter(r=>r[field]===k))]));
}
function reportFor(manifest,adapter,responses,tasks,labels,gates){
  const results=responses.map((r,i)=>{
    const label=labels[i],task=tasks[i],answer=r.status==='response'?normalize(r.raw,label.family):null;
    return {...r,group:label.group,index:label.index,family:label.family,questionType:label.question,
      difficulty:label.difficulty,variant:label.variant,prompt:task.question,image:task.image,
      expected:label.answer,answer,correct:r.status==='response'&&answer===label.answer};
  });
  const overall=metrics(results),byFamily=slices(results,'family');
  const checks=Object.entries(gates).map(([metric,min])=>{
    const parts=metric.split('.'),actual=parts.length===1?overall[metric]:byFamily[parts[0]][parts[1]];
    return {metric,min,actual,passed:actual>=min};
  });
  return {format:'vtf-report/1',scoring:PROTOCOL,suite:manifest.suite.name,dataset:manifest.fingerprint,adapter,
    status:overall.coverage<1?'incomplete':checks.every(c=>c.passed)?'passed':'failed',
    overall,byFamily,byQuestion:slices(results,'questionType'),byDifficulty:slices(results,'difficulty'),
    byVariant:slices(results,'variant'),inspectionRisk:inspectionRisk(results),checks,results};
}
function comparison(base,candidate,maxDrop){
  ensure(base.format==='vtf-report/1' && candidate.format===base.format &&
    base.scoring===PROTOCOL && candidate.scoring===PROTOCOL,'Incompatible scoring protocol.');
  ensure(base.dataset===candidate.dataset,'Reports use different frozen datasets.');
  ensure([base,candidate].every(r=>r.overall.coverage===1),'Compare requires two complete evaluations.');
  const previous=new Map(base.results.map(r=>[r.id,r]));
  ensure(previous.size===candidate.results.length && new Set(candidate.results.map(r=>r.id)).size===previous.size,'Sample IDs do not align.');
  const changed={regressions:[],improvements:[]};
  for(const r of candidate.results){
    const old=previous.get(r.id);ensure(old&&old.expected===r.expected,'Reference sample mismatch.');
    if(old.correct!==r.correct)changed[old.correct?'regressions':'improvements'].push(r.id);
  }
  const changes=[];
  for(const scope of ['overall',...Object.keys(base.byFamily)]){
    const before=scope==='overall'?base.overall:base.byFamily[scope],after=scope==='overall'?candidate.overall:candidate.byFamily[scope];
    for(const metric of ['accuracy','style','change']){
      const delta=after[metric]-before[metric];
      changes.push({scope,metric,before:before[metric],after:after[metric],delta,passed:delta+1e-12>=-maxDrop});
    }
  }
  return {dataset:base.dataset,baseline:base.adapter,candidate:candidate.adapter,maxDrop,changes,...changed,
    passed:changes.every(c=>c.passed)};
}
module.exports={PROTOCOL,normalize,metrics,reportFor,comparison};
