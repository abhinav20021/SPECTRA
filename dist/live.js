(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const skills=window.VisualSkills, live=window.LiveLab;
  const python=!!document.querySelector('meta[name="vtf-runtime"][content="python"]');
  const stages={scene:'Sample scene data',image:'Render PNG',question:'Build questions',verify:'Check PNG against source',predict:'Get prediction',score:'Score response'};
  const steps={},controls=['family','task','difficulty','evaluator','endpoint','model','token','run','generate'];
  let current=null,active='direct',busy=false,attempts=[];
  const probes=[...document.querySelectorAll('[data-probe]')];

  function status(id,state,detail){
    const step=steps[id];
    step.dataset.state=state;
    step.lastChild.textContent=detail||(state==='running'?'Running…':state==='done'?'Complete':'Waiting');
  }
  for(const [id,title] of Object.entries(stages)){
    const step=document.createElement('li'),name=document.createElement('b');
    name.textContent=title;step.append(name,document.createElement('small'));el('steps').append(step);
    steps[id]=step;status(id,'waiting');
  }
  function measured(id,state,ms){
    status(id,state,state==='done'?'Complete · '+ms+' ms':undefined);
  }
  function selectTask(){
    const family=skills.families[el('family').value];
    el('task').replaceChildren(...Object.entries(family.types).map(([id,name])=>new Option(name,id)));
  }
  for(const [id,f] of Object.entries(skills.families))el('family').add(new Option(f.name,id));
  const urlParams=new URLSearchParams(location.search),requestedFamily=urlParams.get('skill');
  const initialFamily=Object.hasOwn(skills.families,requestedFamily)?requestedFamily:'quantities';
  el('family').value=initialFamily;selectTask();
  const requestedTask=urlParams.get('task');
  if(Object.hasOwn(skills.families[initialFamily].types,requestedTask))el('task').value=requestedTask;
  else if(initialFamily==='quantities')el('task').value='recolor';
  if(urlParams.get('difficulty')==='close')el('difficulty').value='close';
  el('runtime').textContent=python?'Python backend':'Browser runtime';
  function evaluatorNote(){
    const remote=el('evaluator').value==='openai';
    el('api-fields').hidden=!remote||python;
    el('model-note').textContent=remote?(python?'Uses the vision model configured on your Python server.':'Sends this PNG and its question to your endpoint. The key stays in this tab.'):'An image-based algorithm runs locally. Choose Live vision model to test an AI model.';
  }
  function setBusy(value){
    busy=value;
    controls.forEach(id=>el(id).disabled=value);
    probes.forEach(b=>b.disabled=value||!current);
    el('evaluate').disabled=value||!current;el('export').disabled=value||!current;
  }
  function showError(error){
    el('live-error').textContent=error.message||'The operation failed.';el('live-error').hidden=false;
  }
  function updateProbe(){
    if(!current)return;
    const q=current.questions[active];
    for(const b of probes)b.setAttribute('aria-pressed',String(b.dataset.probe===active));
    el('prompt').textContent=q.text;
    el('keys').textContent='Source answer: '+q.reference+' · PNG answer: '+q.pixelAnswer;
    el('source').textContent=JSON.stringify({scene:current.source.scene||current.source,questionParameters:q.parameters},null,2);
    el('pixels').textContent=JSON.stringify(current.pixels[active],null,2);
    const previous=attempts.filter(a=>a.probe===active).at(-1);
    el('verdict').className='';el('verdict').textContent='';
    if(previous?.error){
      el('prediction').textContent=previous.error;
      status('predict','failed','Request failed');status('score','waiting');
    }else if(previous){
      el('verdict').textContent=previous.correct?'Correct':'Incorrect';el('verdict').className=previous.correct?'hit':'miss';
      el('prediction').textContent=previous.model+' replied “'+previous.raw+'”. Verified answer: '+q.reference+'.';
      measured('predict','done',previous.predictionMs);measured('score','done',previous.scoringMs);
    }else{
      el('prediction').textContent=active==='swap'?'Same PNG · '+q.kind+'. Ready for a separate prediction.':'PNG verified. Ready to evaluate.';
      status('predict','waiting');status('score','waiting');
    }
  }
  async function api(route,data){
    const r=await fetch('/api/live/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(160000)});
    const body=await r.json();if(!r.ok)throw Error(body.error||'Python backend returned HTTP '+r.status+'.');
    return body;
  }
  async function decode(image){
    const img=new Image();
    await new Promise((ok,no)=>{img.onload=ok;img.onerror=()=>no(Error('Could not decode the generated PNG.'));img.src=image;});
    const c=window.VTF.surface(img.naturalWidth||window.VTF.W,img.naturalHeight||window.VTF.H);
    c.getContext('2d').drawImage(img,0,0);return c;
  }
  async function generate(){
    current=null;active='direct';attempts=[];
    el('live-error').hidden=true;el('evidence').open=false;
    el('picture').hidden=true;el('save-image').hidden=true;el('empty-image').hidden=false;
    el('empty-image').textContent='Generating image…';el('prompt').textContent='Building the question…';
    el('source').textContent=el('pixels').textContent=el('keys').textContent=el('verdict').textContent='';
    el('prediction').textContent='Waiting for the verified PNG.';
    for(const id of Object.keys(stages))status(id,'waiting');
    status('scene','running');
    const family=el('family').value,task=el('task').value,difficulty=el('difficulty').value;
    const sample=python?await api('new',{family,task,difficulty}):await live.generate(family,task,difficulty,{
      encode:c=>c.toDataURL('image/png'),decode
    },measured);
    current={...sample,id:sample.id||crypto.randomUUID(),runtime:python?'Python server':'Browser',generatedAt:new Date().toISOString()};
    window.FactoryActivity.generated(1,Object.keys(current.questions).length);
    Object.entries(current.times).forEach(([id,ms])=>measured(id,'done',ms));
    el('case-title').textContent=skills.families[family].types[task];
    el('picture').src=current.image;el('picture').alt='Fresh '+el('case-title').textContent+' task';
    el('picture').hidden=false;el('empty-image').hidden=true;
    el('save-image').href=current.image;el('save-image').download='case-'+current.id+'.png';el('save-image').hidden=false;
    updateProbe();el('announce').textContent='Fresh image and questions verified.';
  }
  function settings(){
    const base=new URL(el('endpoint').value.trim()),name=el('model').value.trim(),token=el('token').value.trim();
    const local=['127.0.0.1','localhost','[::1]'].includes(base.hostname);
    if(base.username||base.password||base.search||base.hash||!(base.protocol==='https:'||local&&base.protocol==='http:'))throw Error('Use an HTTPS endpoint or a local HTTP server.');
    if(!name||base.hostname==='api.openai.com'&&!token)throw Error('Enter the model ID and provider key.');
    return {url:base.href.replace(/\/$/,'')+'/chat/completions',name,token};
  }
  async function vision(image,q,config){
    const headers={'Content-Type':'application/json'};
    if(config.token)headers.Authorization='Bearer '+config.token;
    const content=[{type:'image_url',image_url:{url:image}},{type:'text',text:q.text+' Reply only with one allowed answer: '+q.choices.join(' / ')+'.'}];
    const r=await fetch(config.url,{method:'POST',redirect:'error',headers,signal:AbortSignal.timeout(120000),
      body:JSON.stringify({model:config.name,messages:[{role:'user',content}]})});
    if(!r.ok)throw Error('Vision endpoint returned HTTP '+r.status+'.');
    const raw=(await r.json()).choices?.[0]?.message?.content;
    if(typeof raw!=='string'||!raw.trim())throw Error('The endpoint returned no text prediction.');
    return raw;
  }
  async function evaluate(){
    const evaluator=el('evaluator').value,q=current.questions[active],probe=active;
    status('predict','running');status('score','waiting');
    el('prediction').textContent='Waiting for '+(evaluator==='local'?'the local baseline':'the vision model')+'…';
    el('verdict').textContent='';
    try{
      let result;
      if(python){
        result=await api('evaluate',{id:current.id,probe,evaluator});
      }else{
        const start=performance.now();
        const config=evaluator==='openai'?settings():null;
        const raw=config?await vision(current.image,q,config):(await live.baseline(current.image,q,decode)).raw;
        const t=performance.now(),answer=live.normalize(raw,q.choices),correct=answer===q.reference;
        result={model:config?config.name:'Local image baseline',raw,answer,correct,
          predictionMs:Math.round(t-start),scoringMs:Math.round((performance.now()-t)*100)/100};
      }
      window.FactoryActivity.scored(1,Number(result.correct));
      attempts.push({...result,probe,evaluator,at:new Date().toISOString()});updateProbe();
      el('announce').textContent='Evaluation complete. '+(result.correct?'Correct.':'Incorrect.');
    }catch(e){
      attempts.push({probe,evaluator,error:e.message,at:new Date().toISOString()});updateProbe();throw e;
    }
  }
  async function run(fresh,predict){
    if(busy)return;
    setBusy(true);el('live-error').hidden=true;
    try{
      if(fresh)await generate();
      if(predict)await evaluate();
    }catch(e){
      if(!current){
        const step=Object.entries(steps).find(([,li])=>li.dataset.state==='running');
        if(step)status(step[0],'failed','Generation failed');
        el('empty-image').textContent='Could not generate the case.';el('prompt').textContent='';
      }
      showError(e);
    }finally{setBusy(false);}
  }
  el('family').onchange=()=>{selectTask();run(true,false);};
  el('task').onchange=el('difficulty').onchange=()=>run(true,false);
  el('evaluator').onchange=evaluatorNote;
  el('run').onclick=()=>run(true,true);el('generate').onclick=()=>run(true,false);el('evaluate').onclick=()=>run(false,true);
  probes.forEach(b=>b.onclick=()=>{active=b.dataset.probe;el('live-error').hidden=true;updateProbe();});
  el('export').onclick=()=>{
    const report={format:'vtf-live-case/1',...current,attempts};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');
    a.href=url;a.download='live-'+current.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  evaluatorNote();
  run(true,false).then(()=>{
    if(current&&urlParams.get('probe')==='swap'){active='swap';updateProbe();}
  });
})();
