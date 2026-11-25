(() => {
'use strict';
const $=id=>document.getElementById(id), E=window.VTF, S=window.VisualSkills;
const paths={
 layout:'M3 4h18v16H3z M3 9h18 M9 9v11',history:'M3 11a9 9 0 1 1 2.6 7 M3 4v7h7 M12 7v6l4 2',book:'M3 5c4-1 6-1 9 1 3-2 5-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1z M12 6v14',
 shuffle:'M3 6h3c4 0 7 12 11 12h4 M17 14l4 4-4 4 M3 18h3c2 0 3-2 5-5 M14 8c1-2 2-2 4-2h3 M17 2l4 4-4 4',
 scan:'M8 3H4v4 M16 3h4v4 M4 17v4h4 M20 17v4h-4 M7 15l3-4 3 2 4-6',hash:'M10 3 7 21 M17 3l-3 18 M4 9h16 M3 15h16',edit:'m15 5 4 4 M4 20l4-1 12-12-3-3L5 16z',
 download:'M12 3v12 M7 11l5 5 5-5 M4 16v4h16v-4',message:'M4 4h16v13H9l-5 4z M8 9h8 M8 12h5',sliders:'M4 6h8m5 0h3 M4 12h2m5 0h9 M4 18h10m5 0h1 M12 4v4 M6 10v4 M14 16v4',
 chip:'M6 6h12v12H6z M9 3v3 M15 3v3 M9 18v3 M15 18v3 M3 9h3 M3 15h3 M18 9h3 M18 15h3 M10 10h4v4h-4z',
 chart:'M4 4v16h16 M8 16v-5 M12 16V7 M16 16v-8',layers:'m3 8 9-5 9 5-9 5z M3 12l9 5 9-5 M3 16l9 5 9-5',play:'m7 4 13 8-13 8z',shield:'M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5z M8 12l3 3 5-6',chevron:'m9 5 7 7-7 7',gauge:'M3 17a9 9 0 1 1 18 0 M12 15l4-5 M6 16h1 M7 9l1 1 M12 6v1',x:'m6 6 12 12 M18 6 6 18'
};
document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML='<svg class="ico" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[el.dataset.icon]+'"/></svg>'});
const safe=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let family='charts',comparison=false;
let seed=82041, active=0, challenge=null, runState=null, sceneIndex=0, control=null, runError='', guesses={};
let history=[],memory=new Map(),db=null,noticeTimer;
const pct=(n,d)=>d?Math.round(n/d*100)+'%':'—';
const pad=n=>String(n).padStart(6,'0');
const formatDate=t=>new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
function selectFamily(value,key){
  family=value;
  const def=S.families[family];
  $('question').innerHTML=Object.entries(def.types).map(([id,label])=>'<option value="'+id+'">'+label+'</option>').join('');
  if(key&&Object.hasOwn(def.types,key))$('question').value=key;
  document.querySelectorAll('.skillcard').forEach(b=>{const chosen=b.dataset.family===family;b.classList.toggle('is-active',chosen);b.setAttribute('aria-pressed',String(chosen));});
  $('difficulty').options[1].textContent=family==='charts'?'Close call':'Fine detail';
}
document.querySelectorAll('.skillcard').forEach(button=>{
  const g=button.querySelector('canvas').getContext('2d'),skill=button.dataset.family;
  const poly=(pts,color)=>{g.fillStyle=color;g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();};
  const dot=(x,y,r,color)=>{g.fillStyle=color;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();};
  if(skill==='charts'){
    [25,40,31,52].forEach((h,i)=>{g.fillStyle=['#8271cf','#68ab9c','#dfa16b','#7898ce'][i];g.fillRect(14+i*25,68-h,16,h);});
  }else if(skill==='counting'){
    dot(28,23,11,'#5d8ed4');dot(62,55,11,'#5d8ed4');dot(98,22,11,'#5d8ed4');g.fillStyle='#80af9b';g.fillRect(20,47,20,20);
    poly([[61,11],[75,34],[47,34]],'#d78e56');poly([[100,42],[114,64],[86,64]],'#d78e56');
  }else{
    poly(Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,r=i%2?8:19;return [61+Math.cos(a)*r,39+Math.sin(a)*r];}),'#cf9c34');
    dot(21,40,10,'#6292ce');poly([[103,30],[114,41],[103,52],[92,41]],'#9b75ce');
  }
  button.onclick=()=>{if(family!==skill){selectFamily(skill);setSeed(seed);}};
});
function note(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,3700);}
function showDialog(title,html){$('dialogTitle').textContent=title;$('dialogBody').innerHTML=html;if(!$('dialog').open)$('dialog').showModal();}
$('closeDialog').onclick=()=>$('dialog').close();
$('dialog').addEventListener('click',e=>{if(e.target===$('dialog')){const r=$('dialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('dialog').close();}});
function mode(view){
  $('studio').hidden=view!=='studio';$('history').hidden=view!=='history';
  $('navStudio').classList.toggle('active',view==='studio');$('navHistory').classList.toggle('active',view==='history');
  if(view==='history') renderHistory();window.scrollTo(0,0);
}
$('navStudio').onclick=$('back').onclick=()=>mode('studio');
document.querySelector('.brand').onclick=e=>{e.preventDefault();mode('studio');};
$('navHistory').onclick=()=>mode('history');
function setSeed(n){comparison=false;seed=n>>>0;active=0;sceneIndex=0;guesses={};runState=null;runError='';regenerate();}
function draw(){
  const t=challenge.tasks[active],c=$('chart');c.getContext('2d').drawImage(t.canvas,0,0);
  const def=S.families[challenge.family];
  c.setAttribute('aria-label',t.variant+' image for '+def.name+'. Measurements are available under Inspect checks.');
  $('variantNote').textContent=def.notes[active];$('questionText').textContent=challenge.prompt;$('seedText').textContent=pad(challenge.seed);
  document.querySelectorAll('.variant').forEach((b,i)=>{
    b.lastChild.textContent=def.variants[i];b.classList.toggle('selected',i===active);b.setAttribute('aria-pressed',String(i===active));
  });
  $('compare').textContent=comparison?'Single image':'Compare images';$('compare').setAttribute('aria-pressed',String(comparison));
  $('comparison').hidden=!comparison;document.querySelector('.paper').hidden=comparison;
  const item=runState?.items?.[sceneIndex];
  $('tourReview').hidden=runState?.config.mode!=='tour';
  if(!$('tourReview').hidden){
    $('tourPosition').textContent='Demo review · '+(sceneIndex+1)+' of '+runState.items.length+' · '+def.name;
    $('nextSkill').textContent=sceneIndex+1<runState.items.length?'Next skill':'See scorecard';
  }
  if(comparison){
    const j=active||2;
    const panels=$('comparison').querySelectorAll('canvas');
    panels[0].getContext('2d').drawImage(challenge.tasks[0].canvas,0,0);
    panels[1].getContext('2d').drawImage(challenge.tasks[j].canvas,0,0);
    $('compareTitle').textContent=def.variants[j];
    for(const [id,index] of [['compareOriginalScore',0],['compareEditScore',j]]){
      const el=$(id);el.hidden=!item;
      if(item){
        const answer=item.answers[index].answer||'Unrecognized',key=item.keys[index];
        el.textContent='Model: '+answer+' · Verified: '+key;
        el.className=answer===key?'match':'miss';
      }
    }
  }
}
$('compare').onclick=()=>{comparison=!comparison;if(comparison&&!active)active=2;draw();};
function regenerate(){challenge=S.create(family,seed,$('question').value,$('difficulty').value);draw();results();}
document.querySelectorAll('.variant').forEach((b,i)=>b.onclick=()=>{active=i;if(!i)comparison=false;draw();});
$('generate').onclick=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);setSeed(a[0]);$('live').textContent='New verified challenge generated.';};
$('seedEdit').onclick=()=>{showDialog('Replay a challenge','<form id="seedForm"><label for="seedInput">Challenge seed</label><input id="seedInput" required inputmode="numeric" pattern="[0-9]{1,10}" maxlength="10" value="'+seed+'"><p class="fieldnote">Use the same skill, seed, question type and difficulty to reproduce a challenge.</p><div class="dialogbuttons"><button class="btn primary">Load challenge</button></div></form>');
 $('seedForm').onsubmit=e=>{e.preventDefault();const n=Number($('seedInput').value);if(!Number.isInteger(n)||n<0||n>4294967295){$('seedInput').setCustomValidity('Enter a whole number from 0 to 4294967295.');$('seedInput').reportValidity();return;}$('dialog').close();setSeed(n);};$('seedInput').oninput=()=>$('seedInput').setCustomValidity('');};
function saveFile(href,name){const a=document.createElement('a');a.href=href;a.download=name;document.body.append(a);a.click();a.remove();}
$('downloadImg').onclick=()=>saveFile(challenge.tasks[active].canvas.toDataURL('image/png'),challenge.family+'-'+challenge.seed+'-'+active+'.png');
$('verify').onclick=()=>{
 const t=challenge.tasks[active],def=S.families[challenge.family];let rows,header;
 if(challenge.family==='charts'){
   const reads=new Map(t.check.readings.map(r=>[r.label,r.pixels]));
   header=['Region','Source units','Measured height'];rows=t.rows.map(r=>[r.label,r.value,reads.get(r.label)+' px']);
 }else{
   header=['Detected object','Center (px)','Area (px²)'];
   rows=t.check.readings.map(o=>[o.color+' '+o.shape.toLowerCase(),o.x+', '+o.y,o.area]);
 }
 showDialog('Independent answer checks','<div class="helpblock"><h3>'+safe(t.variant)+' · '+def.name+'</h3><p>'+def.method+'</p></div><details style="margin-top:12px"><summary>Reveal the answer and measurements</summary><div class="dialogpair"><span>Source answer <strong>'+safe(t.key)+'</strong></span><span class="chip good">Pixel answer '+safe(t.check.answer)+'</span></div><canvas id="pixelOverlay" width="820" height="356" aria-label="Detected image elements with relevant measurements outlined in green"></canvas><p class="fieldnote">Green outlines mark the measurements used for this answer.</p><div class="answerlist"><table class="checktable"><tr>'+header.map(x=>'<th>'+x+'</th>').join('')+'</tr>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+safe(v)+'</td>').join('')+'</tr>').join('')+'</table></div></details>');
 const overlay=$('pixelOverlay').getContext('2d');overlay.drawImage(t.canvas,0,0);
 for(const reading of t.check.readings){
   const [x,y,w,h]=reading.bounds;
   const selected=challenge.family==='charts'?reading.label===t.key:reading.selected;
   overlay.strokeStyle=selected?'#087750':'#8e8d9977';overlay.lineWidth=selected?3:1;
   overlay.setLineDash(selected?[]:[4,4]);overlay.strokeRect(x-3,y-3,w+6,h+6);
 }

};
const guessButton=document.createElement('button');guessButton.className='guessbtn';guessButton.textContent='Try it yourself';document.querySelector('.prompt').append(guessButton);
guessButton.onclick=()=>{
 const t=challenge.tasks[active],guessKey=[challenge.family,challenge.seed,challenge.question,active].join('-');
 const form=challenge.choices?'<div class="choices">'+challenge.choices.map(s=>'<button class="btn white" data-guess="'+s+'">'+s+'</button>').join('')+'</div>':'<form id="numGuess" class="numguess"><input type="number" min="0" max="99" step="1" required id="guessN" aria-label="Object count" placeholder="Your count"><button class="btn primary">Check guess</button></form>';
 showDialog('Your prediction','<div class="helpblock"><h3>'+safe(challenge.prompt)+'</h3><p>'+t.variant+' · seed '+pad(challenge.seed)+'</p></div>'+form+'<p id="guessFeedback" class="fieldnote" role="status"></p>');
 const compare=v=>{guesses[guessKey]=v;$('guessFeedback').textContent=v===t.key?'Correct. Both checks confirm '+t.key+'.':'You picked '+v+'. The verified answer is '+t.key+'.';};
 if(guesses[guessKey]!==undefined)compare(guesses[guessKey]);
 if($('numGuess'))$('numGuess').onsubmit=e=>{e.preventDefault();compare(String(Number($('guessN').value)));};
 document.querySelectorAll('[data-guess]').forEach(b=>b.onclick=()=>compare(b.dataset.guess));
};
$('method').onclick=()=>showDialog('How the evaluation works','<div class="helpblock"><h3>Try the three-skill demo</h3><p>One click runs three questions across nine images. Explore a single skill with the question and batch controls, or make your own prediction in the viewer.</p></div><div class="helpblock"><h3>Make one controlled change</h3><p>Each question gets an original, a restyled image with the same answer, and an edit with a different answer. The edit swaps two values, adds a matching object, or exchanges two neighbors.</p></div><div class="helpblock"><h3>Verify the rendered pixels</h3><p>The chart reader measures bar heights. The scene reader isolates colored objects and measures their silhouettes and positions. Each pixel answer must match the answer computed from the source.</p></div><div class="helpblock"><h3>Evaluate independently</h3><p>The local baseline uses coarse images, nearest-neighbor ranking for charts, and shape-template matching for scenes. Live vision models receive only one question and PNG per request. Pair scores require both responses to be correct.</p></div>');
function updateConfig(){
 const remote=$('model').value==='openai',n=Number($('size').value)*3;
 $('tourLabel').textContent=remote?'Run demo · 9 requests':'Run three-skill demo';
 $('remoteControls').hidden=!remote;$('runSummary').textContent=remote?n+' images · '+n+' API requests':n+' images per run';
}
$('model').onchange=$('size').onchange=updateConfig;
$('question').onchange=$('difficulty').onchange=()=>setSeed(seed);
function lock(busy){
 document.querySelectorAll('.skillcard').forEach(b=>b.disabled=busy);
 ['tour','generate','seedEdit','model','question','difficulty','size','apiKey','modelName','run','navHistory'].forEach(id=>$(id).disabled=busy);
 $('cancel').hidden=!busy;$('runLabel').textContent=busy?'Evaluating…':'Run evaluation';
}
async function remoteAnswer(image,c,settings,signal) {
 const request=new AbortController(),onStop=()=>request.abort();
 signal.addEventListener('abort',onStop,{once:true});if(signal.aborted)request.abort();
 const timer=setTimeout(()=>request.abort('timeout'),60000);
 try{
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal:request.signal,
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+settings.key},
   body:JSON.stringify({model:settings.name,messages:[{role:'user',content:[
    {type:'text',text:c.prompt+(c.family==='counting'?' Reply with one whole number in digits.':c.family==='spatial'?' Reply with one shape name.':' Reply with one region label.')},
    {type:'image_url',image_url:{url:image}}
   ]}]})});
  if(!r.ok)throw Error('OpenAI returned HTTP '+r.status+'. '+({401:'Check the API key.',403:'Check project and model access.',404:'Check the model ID.',429:'Check request limits and available credit.'}[r.status]||'Check the model and try again.'));
  const json=await r.json(),raw=json.choices?.[0]?.message?.content;
  if(typeof raw!=='string'||!raw.trim())throw Error('The provider returned no text response.');
  const clean=raw.trim().replace(/^[\s"'*`]+|[\s"'*`.!]+$/g,'').toLowerCase();
  return {raw,answer:c.family==='counting'?(/^\d{1,3}$/.test(clean)?String(Number(clean)):null):(c.choices.find(s=>s.toLowerCase()===clean)||null)};
 }catch(error){if(!signal.aborted&&request.signal.aborted)throw Error('OpenAI did not respond within 60 seconds.');throw error;}
 finally{clearTimeout(timer);signal.removeEventListener('abort',onStop);}
}
async function evaluate(tour=false){
 const config={seed,family,mode:tour?'tour':'single',question:$('question').value,difficulty:$('difficulty').value,size:tour?3:Number($('size').value),batchSize:Number($('size').value),evaluator:$('model').value};
 const settings={name:$('modelName').value.trim(),key:$('apiKey').value.trim()};
 if(config.evaluator==='openai'&&(!settings.key||!settings.name)){note('Enter a model ID and API key to run the live evaluation.');(!settings.name?$('modelName'):$('apiKey')).focus();return;}
 const current=new AbortController();control=current;lock(true);runError='';runState=null;sceneIndex=0;active=0;
 const plan=tour?S.tourPlan(seed,family,config.question):Array.from({length:config.size},(_,i)=>({family,seed:E.nextSeed(seed,i),key:config.question}));
 comparison=false;
 const model=config.evaluator==='openai'?settings.name:'Local vision baseline',items=[];
 let done=0,phase='';
 function progress(){$('resultState').textContent='Running';$('resultState').className='state';$('resultBody').innerHTML='<div class="resultmeta">Evaluating image '+Math.min(done+1,config.size*3)+' of '+config.size*3+' · '+safe(model)+'</div><div class="progress"><span style="width:'+done/(config.size*3)*100+'%"></span></div>'; }
 try {
  challenge=S.create(family,seed,config.question,config.difficulty);draw();progress();
  for(let i=0;i<config.size;i++){
   const step=plan[i];
   const c=i===0?challenge:S.create(step.family,step.seed,step.key,config.difficulty);
   const item={family:c.family,type:c.question,seed:c.seed,question:c.prompt,keys:[],answers:[],images:[],evidence:[]};
   for(const [variant,t] of c.tasks.entries()){
    phase=S.families[c.family].name+' · '+t.variant;
    if(tour){challenge=c;active=variant;draw();}
    progress();
    await new Promise(ok=>setTimeout(ok,12));current.signal.throwIfAborted();
    const image=t.canvas.toDataURL('image/png');
    const started=performance.now();
    const raw=config.evaluator==='local'?S.predict(t.canvas,c.prompt):null;
    const response=raw?{raw,answer:raw}:await remoteAnswer(image,c,settings,current.signal);
    current.signal.throwIfAborted();response.latencyMs=Math.round(performance.now()-started);
    item.answers.push(response);item.keys.push(t.key);item.images.push(image);
    item.evidence.push({variant:t.variant,source:t.rows,pixels:t.check.readings,pixelAnswer:t.check.answer});
    done++;
   }
   items.push(item);
  }
  const record={version:2,id:crypto.randomUUID(),time:Date.now(),config,model,items,stats:E.score(items),skills:S.skillScores(items)};
  await remember(record);runState=record;
  inspect(0,tour);$('live').textContent='Evaluation complete. '+record.stats.correct+' of '+record.stats.total+' correct.';
  (tour?document.querySelector('.preview'):$('results')).scrollIntoView({behavior:'smooth',block:tour?'center':'nearest'});
 }catch(err){
  if(tour){challenge=S.create(config.family,config.seed,config.question,config.difficulty);active=0;draw();}
  runError=current.signal.aborted?'Run canceled after '+done+' of '+config.size*3+' images.':('Run stopped after '+done+' of '+config.size*3+' images. '+(err.message||'Request failed.'));results();$('live').textContent=runError;}
 finally{control=null;lock(false);}
}
$('run').onclick=()=>evaluate(false);$('tour').onclick=()=>evaluate(true);$('cancel').onclick=()=>control?.abort();
function metrics(s){
 return '<div class="metrics">'+[
 ['Answer accuracy',s?pct(s.correct,s.total):'—',s?s.correct+' / '+s.total+' images correct':'Across all images'],
 ['Style robustness',s?pct(s.style,s.pairs):'—',s?s.style+' / '+s.pairs+' pairs correct':'Original + restyled'],
 ['Change sensitivity',s?pct(s.change,s.pairs):'—',s?s.change+' / '+s.pairs+' pairs correct':'Original + edited']
 ].map(([name,value,detail])=>'<div class="metric"><div class="statname">'+name+'</div><b>'+value+'</b><small>'+detail+'</small></div>').join('')+'</div>';
}
function inspect(index,compare=runState.config.mode==='tour'){
 const r=runState,it=r.items[index],skill=it.family||'charts',key=it.type||r.config.question;
 sceneIndex=index;active=compare?2:0;comparison=compare;seed=it.seed;guesses={};
 selectFamily(skill,key);$('difficulty').value=r.config.difficulty;
 challenge=S.create(skill,seed,key,r.config.difficulty);draw();results();
}
$('nextSkill').onclick=()=>{
 if(!runState)return;
 if(sceneIndex+1<runState.items.length)inspect(sceneIndex+1,true);
 else $('results').scrollIntoView({behavior:'smooth',block:'start'});
};
function results(){
 const r=runState,box=$('resultBody'),state=$('resultState');state.className='state'+(runError?' bad':r?' good':'');
 state.textContent=runError?'Incomplete':r?'Completed':'Awaiting run';
 if(!r){box.innerHTML=(runError?'<div class="error">'+safe(runError)+'</div>':'')+metrics(null)+'<div class="resultmeta empty">Run an evaluation to compare model responses with the verified answers.</div>';return;}
 const item=r.items[sceneIndex],s=r.stats;
 const insights=[];
 if(s.correct===s.total)insights.push('Every response matched the verified answer in this run.');
 else {
  const styleErrors=r.items.filter(i=>i.answers[0].answer===i.keys[0]&&i.answers[1].answer!==i.keys[1]).length;
  const changeErrors=r.items.filter(i=>i.answers[0].answer===i.keys[0]&&i.answers[2].answer!==i.keys[2]).length;
  if(styleErrors)insights.push('Restyling changed a correct response into an error on '+styleErrors+' of '+s.pairs+' challenges.');
  if(changeErrors)insights.push('The model missed the changed answer after a correct original response on '+changeErrors+' of '+s.pairs+' challenges.');
  if(!insights.length)insights.push('The model missed the original image on '+r.items.filter(i=>i.answers[0].answer!==i.keys[0]).length+' of '+s.pairs+' challenges.');
 }
 const scores=r.skills||S.skillScores(r.items);
 const breakdown='<div class="skillreport"><h3>Results by skill</h3><div class="resulttable"><table><thead><tr><th>Inspect skill</th><th>Correct images</th><th>Restyled pairs</th><th>Edited pairs</th></tr></thead><tbody>'+scores.map(g=>'<tr class="'+((item.family||'charts')===g.family?'selectedrow':'')+'"><td><button data-inspect="'+g.family+'">'+g.name+'</button></td><td>'+g.correct+' / '+g.total+'</td><td>'+g.style+' / '+g.pairs+'</td><td>'+g.change+' / '+g.pairs+'</td></tr>').join('')+'</tbody></table></div></div>';
 box.innerHTML=metrics(s)+breakdown+'<div class="resultcopy">'+insights.join(' ')+'</div><div class="tableactions"><label class="sceneidx">Challenge <select id="scenePick">'+r.items.map((it,i)=>'<option value="'+i+'" '+(i===sceneIndex?'selected':'')+'>'+S.families[it.family||'charts'].name+' · #'+pad(it.seed)+'</option>').join('')+'</select></label><button class="btn white" id="export">Export run</button></div><div class="resulttable"><table><thead><tr><th>Image variant</th><th>Model answer</th><th>Verified answer</th><th>Outcome</th></tr></thead><tbody>'+item.answers.map((a,i)=>'<tr><td>'+safe(item.evidence[i].variant)+'</td><td>'+safe(a.answer||'Unrecognized')+(a.answer?'':'<span class="raw">'+safe(a.raw)+'</span>')+'</td><td>'+item.keys[i]+'</td><td><span class="chip '+(a.answer===item.keys[i]?'good">Correct':'bad">Incorrect')+'</span></td></tr>').join('')+'</tbody></table></div><div class="resultmeta"><span>'+safe(r.model)+' · '+safe(r.config.difficulty==='close'?'Close call':'Standard')+'</span><span>'+formatDate(r.time)+'</span></div>';
 $('scenePick').onchange=()=>inspect(Number($('scenePick').value));
 box.querySelectorAll('[data-inspect]').forEach(b=>b.onclick=()=>{inspect(r.items.findIndex(i=>(i.family||'charts')===b.dataset.inspect));document.querySelector('.preview').scrollIntoView({behavior:'smooth',block:'center'});});
 $('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(r,null,2)],{type:'application/json'}));saveFile(url,'visual-task-run-'+r.config.seed+'.json');setTimeout(()=>URL.revokeObjectURL(url),1000);};
}
function request(req){return new Promise((ok,no)=>{req.onsuccess=()=>ok(req.result);req.onerror=()=>no(req.error);});}
async function initHistory(){
 try{
  const req=indexedDB.open('vtf-evaluations',1);
  req.onupgradeneeded=()=>{req.result.createObjectStore('runs',{keyPath:'id'});req.result.createObjectStore('summaries',{keyPath:'id'});};
  db=await request(req);history=(await request(db.transaction('summaries').objectStore('summaries').getAll())).sort((a,b)=>b.time-a.time);renderHistory();
 }catch{db=null;}
}
const storageReady=initHistory();
async function remember(r){
 await storageReady;
 const summary={id:r.id,time:r.time,config:r.config,model:r.model,stats:r.stats};
 const updated=[summary,...history].sort((a,b)=>b.time-a.time);
 if(db)try{
  const tx=db.transaction(['runs','summaries'],'readwrite'),runs=tx.objectStore('runs'),summaries=tx.objectStore('summaries');
  const complete=new Promise((ok,no)=>{tx.oncomplete=ok;tx.onabort=()=>no(tx.error);tx.onerror=()=>no(tx.error);});
  runs.put(r);summaries.put(summary);
  updated.slice(25).forEach(old=>{runs.delete(old.id);summaries.delete(old.id);});
  await complete;
 }catch{memory.set(r.id,r);note('Browser storage is full or unavailable. Export this run to keep it.');}
 else{memory.set(r.id,r);note('History is available in this tab. Export to keep this run.');}
 history=updated.slice(0,25);updated.slice(25).forEach(old=>memory.delete(old.id));
}
function renderHistory(){
 const el=$('historyBody');
 if(!history.length){el.innerHTML='<div class="panel emptyhistory"><h2>No completed runs yet</h2><p>Run your first challenge in the studio to see the results here.</p><button class="btn white" id="startHistory">Open studio</button></div>';$('startHistory').onclick=()=>mode('studio');return;}
 el.innerHTML='<div class="panel">'+history.map(r=>'<div class="historyrow"><div class="historyitem"><span class="chip good">'+pct(r.stats.correct,r.stats.total)+'</span><div><strong>'+safe(r.model)+'</strong><p>#'+pad(r.config.seed)+' · '+r.stats.total+' images · '+(r.config.mode==='tour'?'Three-skill demo':S.families[r.config.family||'charts'].name)+' · '+formatDate(r.time)+'</p></div></div><button class="btn white" data-open="'+safe(r.id)+'">Inspect run</button></div>').join('')+'</div>';
 el.querySelectorAll('[data-open]').forEach(b=>b.onclick=async()=>{
  try{
   const id=b.dataset.open,r=memory.get(id)||await request(db.transaction('runs').objectStore('runs').get(id));
   seed=r.config.seed;guesses={};sceneIndex=0;active=0;runError='';runState=r;
   comparison=false;selectFamily(r.config.family||'charts',r.config.question);$('difficulty').value=r.config.difficulty;$('size').value=r.config.batchSize||(r.config.mode==='tour'?1:r.config.size);$('model').value=r.config.evaluator;if(r.config.evaluator==='openai')$('modelName').value=r.model;
   updateConfig();inspect(0);mode('studio');$('results').scrollIntoView({behavior:'smooth'});
  }catch{note('This saved run could not be loaded.');}
 });
}
updateConfig();regenerate();
})();
