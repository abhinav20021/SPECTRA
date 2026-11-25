(() => {
  'use strict';
  const L=window.ReasoningLab,{E,catalog,range,painter,pixels,same}=L;
  const groupInfo={
    geometry:['Geometric reasoning','Measure, rank and match geometric figures.'],
    quantities:['Counting & measurement','Locate marks, trace grid edges and compare paired boards.'],
    patterns:['Symmetry & patterns','Test visible repetitions and reflections.'],
    sequences:['Sequences & transforms','Infer an operation from the visible figures and apply it to the next panel.']
  };
  const families=Object.fromEntries(Object.entries(groupInfo).map(([id,[name,method]])=>[id,{name,method,
    variants:['Original','Restyled','Changed scene'],notes:['Generated source scene','New palette · same question and answer','New scene · same question, different answer'],
    types:Object.fromEntries(Object.values(catalog).filter(d=>d.family===id).map(d=>[d.id,d.name]))}]));
  const prompts=new Map();
  for(const d of Object.values(catalog))for(const q of d.queries)prompts.set(q.text,[d,q]);
  function query(d,seed,difficulty){
    return sampleQuery(d,E.random((seed^0x9e3779b9)>>>0),difficulty);
  }
  function sampleQuery(d,rng,difficulty){
    const q=L.pick(rng,d.queries);
    if(d.id!=='recolor')return q;
    const n=difficulty==='close'?6:5,first=L.int(rng,1,n-2),last=L.int(rng,first+1,n);
    return {...q,first,last,text:q.text+' Inspect rows '+first+' through '+last+' from the top.'};
  }
  function decodeQuestion(text){
    if(prompts.has(text))return prompts.get(text);
    const match=/^(.*) Inspect rows ([1-6]) through ([1-6]) from the top\.$/.exec(text);
    if(!match)return null;
    const base=prompts.get(match[1]);if(base?.[0].id!=='recolor')return null;
    return [base[0],{...base[1],first:+match[2],last:+match[3],text}];
  }
  function render(d,scene,q,style,seed){
    const g=painter(style,d.title,String(seed>>>0).padStart(6,'0'));d.draw(g,scene,q);return g.c;
  }
  function create(family,seed,id,difficulty){
    const d=catalog[id];if(d?.family!==family)throw Error('Unknown task for this vertical.');
    const q=query(d,seed,difficulty),r=E.random((seed^0x5f356495)>>>0),hard=difficulty==='close';
    const original=d.make(r,q,hard),expected=d.solve(original,q);
    let edited;
    for(let attempt=0;attempt<160;attempt++){
      const candidate=d.edit?d.edit(r,original,q,hard):d.make(r,q,hard);if(d.solve(candidate,q)!==expected){edited=candidate;break;}
    }
    if(!edited)throw Error('Could not construct an answer-changing scene for '+id+'.');
    const tasks=[original,original,edited].map((s,i)=>{
      const canvas=render(d,s,q,i===1?1:0,seed);
      const key=String(d.solve(s,q)),check=d.read(pixels(canvas),q);
      if(key!==check.answer)throw Error(id+' source / pixel disagreement at seed '+seed+': '+key+' versus '+check.answer);
      return {canvas,key,check,rows:{scene:s,query:q},variant:families[family].variants[i]};
    });
    return {family,seed,question:id,difficulty,prompt:q.text,choices:d.choices,tasks};
  }
  // This image-only baseline compares coarse color thumbnails to separately generated
  // calibration examples. It never opens the evaluation scene or calls a pixel verifier.
  const cache=new Map();
  function thumbnail(canvas){
    const small=E.surface(36,15),g=small.getContext('2d');g.drawImage(canvas,20,56,780,287,0,0,36,15);
    const p=g.getImageData(0,0,36,15).data,a=new Int16Array(36*15*3);
    for(let i=0,j=0;i<p.length;i+=4){a[j++]=p[i]-p[i+1];a[j++]=p[i+2]-p[i+1];a[j++]=255-(p[i]+p[i+1]+p[i+2])/3;}
    small.width=1;return a;
  }
  function predict(canvas,d,q){
    const id=q.text;
    if(!cache.has(id)){
      const samples=[];
      for(let i=0;i<24;i++){
        const r=E.random((0xc417102b+Math.imul(i,7919))>>>0);
        const s=d.make(r,q,i%2===1 || q.last===6),c=render(d,s,q,i%2,i);
        samples.push({a:thumbnail(c),label:String(d.solve(s,q))});c.width=1;
      }
      if(cache.size>=20)cache.delete(cache.keys().next().value);
      cache.set(id,samples);
    }
    const f=thumbnail(canvas);let best=Infinity,answer;
    for(const {a,label} of cache.get(id)){let sum=0;for(let j=0;j<f.length;j++)sum+=(a[j]-f[j])**2;
      if(sum<best){best=sum;answer=label;}}
    return answer;
  }
  function normalize(raw,id){
    const t=raw.trim().replace(/^["'*`\s]+|["'*`.!\s]+$/g,'').toLowerCase();
    const choices=catalog[id]?.choices;
    if(!choices)return /^\d{1,4}$/.test(t)?String(Number(t)):null;
    const order=s=>s.toLowerCase().replace(/[\s,>→]+/g,' ').trim();
    return choices.find(c=>order(c)===order(t))||null;
  }
  function register(old){
    const all={...old.families,...families},is=id=>Object.hasOwn(families,id);
    return {...old,families:all,labFamilies:families,labNormalize:normalize,labQuery:(id,seed,difficulty)=>query(catalog[id],seed,difficulty),
      create:(f,s,k,d)=>is(f)?create(f,s,k,d):old.create(f,s,k,d),
      sourceAnswer:(f,k,row)=>is(f)?String(catalog[k].solve(row.scene,row.query)):old.sourceAnswer(f,k,row),
      promptFor:(f,k,s,d)=>is(f)?query(catalog[k],s,d).text:old.promptFor(f,k),
      pixelCheck:(c,f,k,p)=>{if(!is(f))return old.pixelCheck(c,f,k);
        const found=decodeQuestion(p);if(found?.[0].id!==k)throw Error('Question does not match its pixel check.');return found[0].read(pixels(c),found[1]);},
      predict:(c,p)=>{const found=decodeQuestion(p);return found?predict(c,...found):old.predict(c,p);},
      tourPlan:(seed,first,selected)=>{const ids=Object.keys(all),offset=ids.indexOf(first);return ids.map((_,i)=>{const family=ids[(i+offset)%ids.length],s=E.nextSeed(seed,i),types=Object.keys(all[family].types);return {family,seed:s,key:i===0?selected||types[0]:types[s%types.length]};});},
      skillScores:items=>Object.entries(all).flatMap(([family,def])=>{const rows=items.filter(i=>(i.family||'charts')===family);return rows.length?[{family,name:def.name,...E.score(rows)}]:[];})
    };
  }
  window.StudioLab={register,families,catalog,normalize,decodeQuestion,query,sampleQuery};
  window.VisualSkills=register(window.VisualSkills);
})();
