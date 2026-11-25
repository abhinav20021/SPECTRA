(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const skills=window.VisualSkills, live=window.LiveLab;
  const python=!!document.querySelector('meta[name="vtf-runtime"][content="python"]');
  const stages={scene:'Sample scene data',image:'Render PNG',question:'Build questions',verify:'Check PNG against source',predict:'Get prediction',score:'Score response'};
  const steps={},controls=['family','task','difficulty','evaluator','endpoint','model','token','run','generate','step'];
  let current=null,active='direct',busy=false,attempts=[];
  const generationStages=['scene','image','question','verify'];
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
  let preferredProbe=urlParams.get('probe')==='swap'?'swap':'direct';
  const latest=()=>attempts.filter(a=>a.probe===active).at(-1);
  function nextStage(){
    const generation=generationStages.find(id=>!Object.hasOwn(current?.times||{},id));
    if(generation)return generation;
    const attempt=latest();
    if(!attempt||attempt.error)return 'predict';
    return Object.hasOwn(attempt,'correct')?null:'score';
  }
  function controlsState(){
    controls.forEach(id=>el(id).disabled=busy);
    const verified=!!current?.pixels;
    probes.forEach(b=>b.disabled=busy||!verified);
    el('evaluate').disabled=el('export').disabled=busy||!verified;
    const next=nextStage();
    el('step').textContent=current&&next?'Next · '+stages[next]:current?'Step through a new case':'Step through';
    el('evaluate').textContent=next==='score'?'Score this prediction':'Evaluate this question';
  }
  function reset(){
    current=null;active=preferredProbe;attempts=[];
    el('case-title').textContent=skills.families[el('family').value].types[el('task').value];
    el('picture').hidden=true;el('picture').removeAttribute('src');
    el('save-image').hidden=true;el('save-image').removeAttribute('href');
    el('empty-image').hidden=false;el('empty-image').textContent='Start a run to generate an image.';
    el('prompt').textContent='The question will appear after the image is rendered.';
    el('prediction').textContent='Waiting for a verified question.';
    el('verdict').className='';
    for(const id of ['source','pixels','keys','verdict','announce','live-error'])el(id).textContent='';
    el('live-error').hidden=el('evidence').hidden=el('pixel-detail').hidden=true;
    el('evidence').open=false;
    el('evidence').querySelectorAll('details').forEach(d=>d.open=false);
    for(const b of probes)b.setAttribute('aria-pressed',String(b.dataset.probe===active));
    for(const id of Object.keys(stages))status(id,'waiting');
    controlsState();
  }
  function displayPrediction(){
    el('verdict').textContent='';el('verdict').className='';
    status('predict','waiting');status('score','waiting');
    const a=latest();
    if(!a){
      el('prediction').textContent=active==='swap'?'The second question uses the same verified PNG.':'PNG verified. Ready to evaluate.';
      return;
    }
    if(a.error){
      el('prediction').textContent=a.error;status('predict','failed','Prediction failed');return;
    }
    measured('predict','done',a.predictionMs);
    el('prediction').textContent=a.model+' replied “'+a.raw+'”.';
    if(Object.hasOwn(a,'correct')){
      measured('score','done',a.scoringMs);
      el('prediction').textContent+=' Verified answer: '+current.questions[active].reference+'.';
      el('verdict').textContent=a.correct?'Correct':'Incorrect';
      el('verdict').className=a.correct?'hit':'miss';
    }
  }
  function displayQuestion(){
    const q=current.questions[active];
    for(const b of probes)b.setAttribute('aria-pressed',String(b.dataset.probe===active));
    el('prompt').textContent=q.text;
    el('source').textContent=JSON.stringify({scene:current.source.scene||current.source,questionParameters:q.parameters},null,2);
    if(current.pixels){
      el('keys').textContent='Source answer: '+q.reference+' · PNG answer: '+q.pixelAnswer;
      el('pixel-detail').hidden=false;
      el('pixels').textContent=JSON.stringify(current.pixels[active],null,2);
      displayPrediction();
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
  const io={encode:c=>c.toDataURL('image/png'),decode};
  async function generateStage(stage){
    if(!current){
      const family=el('family').value,task=el('task').value,difficulty=el('difficulty').value;
      current={family,task,difficulty,times:{},runtime:python?'Python server':'Browser',generatedAt:new Date().toISOString()};
      if(!python)current.id=crypto.randomUUID();
    }
    const {family,task,difficulty}=current;
    const result=python?await api('step',stage==='scene'?{stage,family,task,difficulty}:{stage,id:current.id}):
      await live.advance(stage,current,io);
    if(python)current.id=result.id;
    Object.assign(current,result.patch);
    current.times[stage]=result.ms;
    if(stage==='scene'){
      el('evidence').hidden=false;
      el('source').textContent=JSON.stringify(current.source.scene||current.source,null,2);
      el('empty-image').textContent='Scene sampled. Ready to render the PNG.';
    }else if(stage==='image'){
      el('picture').src=current.image;el('picture').alt='Fresh '+el('case-title').textContent+' task';
      el('picture').hidden=false;el('empty-image').hidden=true;
      el('save-image').href=current.image;el('save-image').download='case-'+current.id+'.png';el('save-image').hidden=false;
      window.FactoryActivity.generated(1,0);
    }else{
      displayQuestion();
      if(stage==='question')window.FactoryActivity.generated(0,Object.keys(current.questions).length);
    }
    return result.ms;
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
  async function predict(){
    const evaluator=el('evaluator').value,q=current.questions[active];
    el('verdict').textContent='';
    el('prediction').textContent='Waiting for '+(evaluator==='local'?'the local baseline':'the vision model')+'…';
    let result;
    try{
      if(python){
        result=await api('predict',{id:current.id,probe:active,evaluator});
      }else{
        const start=performance.now(),config=evaluator==='openai'?settings():null;
        const raw=config?await vision(current.image,q,config):(await live.baseline(current.image,q,decode)).raw;
        result={model:config?config.name:'Local image baseline',raw,predictionMs:Math.round(performance.now()-start)};
      }
    }catch(error){
      attempts.push({probe:active,evaluator,error:error.message,at:new Date().toISOString()});displayPrediction();throw error;
    }
    attempts.push({...result,probe:active,evaluator,at:new Date().toISOString()});
    displayPrediction();return result.predictionMs;
  }
  async function score(){
    const a=latest(),q=current.questions[active];
    if(python){
      Object.assign(a,await api('score',{predictionId:a.predictionId}));
    }else{
      const start=performance.now();
      a.answer=live.normalize(a.raw,q.choices);a.correct=a.answer===q.reference;
      a.scoringMs=Math.round((performance.now()-start)*100)/100;
    }
    window.FactoryActivity.scored(1,Number(a.correct));
    displayPrediction();return a.scoringMs;
  }

  // Yield before CPU-heavy rendering and pixel reads so the trace can paint.
  function repaint(){
    return new Promise(resolve=>{
      if(document.visibilityState==='visible'&&window.requestAnimationFrame){
        requestAnimationFrame(()=>setTimeout(resolve,0));
      }else setTimeout(resolve,0);
    });
  }
  async function run(mode){
    if(busy)return;
    if(mode==='full'||mode==='generate'||(mode==='step'&&!nextStage()))reset();
    busy=true;controlsState();el('live-error').hidden=true;
    let stage=mode==='evaluate'?(nextStage()==='score'?'score':'predict'):nextStage();
    try{
      while(stage){
        if(stage==='predict')status('score','waiting');
        status(stage,'running');
        await repaint();
        const ms=stage==='predict'?await predict():stage==='score'?await score():await generateStage(stage);
        measured(stage,'done',ms);
        el('announce').textContent=stages[stage]+' complete.';
        if(mode==='step'||(mode==='generate'&&stage==='verify'))break;
        stage=nextStage();
      }
    }catch(error){
      status(stage,'failed','Failed');
      el('live-error').textContent=error.message||'The operation failed.';el('live-error').hidden=false;
    }finally{busy=false;controlsState();}
  }
  function changeSelection(){
    preferredProbe='direct';reset();
  }
  el('family').onchange=()=>{selectTask();changeSelection();};
  el('task').onchange=el('difficulty').onchange=changeSelection;
  el('evaluator').onchange=evaluatorNote;
  el('run').onclick=()=>run('full');el('generate').onclick=()=>run('generate');
  el('step').onclick=()=>run('step');el('evaluate').onclick=()=>run('evaluate');
  probes.forEach(b=>b.onclick=()=>{
    active=b.dataset.probe;el('live-error').hidden=true;displayQuestion();controlsState();
  });
  el('export').onclick=()=>{
    const report={format:'vtf-live-case/1',...current,attempts};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'})),a=document.createElement('a');
    a.href=url;a.download='live-'+current.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  evaluatorNote();reset();
})();
