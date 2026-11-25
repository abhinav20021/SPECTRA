(() => {
'use strict';
const $=id=>document.getElementById(id), E=window.VTF;
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
let seed=82041, active=0, challenge=null, runState=null, sceneIndex=0, control=null, runError='', guesses={};
let history=[],memory=new Map(),db=null,noticeTimer;
const pct=(n,d)=>d?Math.round(n/d*100)+'%':'—';
const pad=n=>String(n).padStart(6,'0');
const formatDate=t=>new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const notes=['Reference image','New colors and bar order · same values','Two values exchanged · same styling'];
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
function setSeed(n){seed=n>>>0;active=0;sceneIndex=0;guesses={};runState=null;runError='';regenerate();}
function draw(){
  const t=challenge.tasks[active],c=$('chart');c.getContext('2d').drawImage(t.canvas,0,0);
  c.setAttribute('aria-label',t.variant+' bar chart showing sales for four regions. The source values are available under Inspect checks.');
  $('variantNote').textContent=notes[active];$('questionText').textContent=challenge.prompt;$('seedText').textContent=pad(challenge.seed);
  document.querySelectorAll('.variant').forEach((b,i)=>{b.classList.toggle('selected',i===active);b.setAttribute('aria-pressed',String(i===active));});
}
function regenerate(){challenge=E.create(seed,$('question').value,$('difficulty').value);draw();results();}
document.querySelectorAll('.variant').forEach((b,i)=>b.onclick=()=>{active=i;draw();});
$('generate').onclick=()=>{const a=new Uint32Array(1);crypto.getRandomValues(a);setSeed(a[0]);$('live').textContent='New verified challenge generated.';};
$('seedEdit').onclick=()=>{showDialog('Replay a challenge','<form id="seedForm"><label for="seedInput">Challenge seed</label><input id="seedInput" required inputmode="numeric" pattern="[0-9]{1,10}" maxlength="10" value="'+seed+'"><p class="fieldnote">Use the same seed, question type and difficulty to reproduce a challenge.</p><div class="dialogbuttons"><button class="btn primary">Load challenge</button></div></form>');
 $('seedForm').onsubmit=e=>{e.preventDefault();const n=Number($('seedInput').value);if(!Number.isInteger(n)||n<0||n>4294967295){$('seedInput').setCustomValidity('Enter a whole number from 0 to 4294967295.');$('seedInput').reportValidity();return;}$('dialog').close();setSeed(n);};$('seedInput').oninput=()=>$('seedInput').setCustomValidity('');};
function saveFile(href,name){const a=document.createElement('a');a.href=href;a.download=name;document.body.append(a);a.click();a.remove();}
$('downloadImg').onclick=()=>saveFile(challenge.tasks[active].canvas.toDataURL('image/png'),'chart-'+challenge.seed+'-'+active+'.png');
$('verify').onclick=()=>{
 const t=challenge.tasks[active],reads=new Map(t.check.readings.map(r=>[r.label,r.pixels]));
 showDialog('Independent answer checks','<div class="helpblock"><h3>'+t.variant+' · seed '+pad(challenge.seed)+'</h3><p>The generator ranks the source values. A separate pixel reader locates colored bars, measures their heights and recognizes the printed region labels.</p></div><details style="margin-top:12px"><summary>Reveal the answer and measurements</summary><table class="checktable"><tr><th>Region</th><th>Source units</th><th>Bar height</th></tr>'+t.rows.map(r=>'<tr><td>'+r.label+'</td><td>'+r.value+'</td><td>'+reads.get(r.label)+' px</td></tr>').join('')+'</table><div class="dialogpair"><strong>Verified answer</strong><span class="chip good">'+t.key+'</span></div></details>');
};
const guessButton=document.createElement('button');guessButton.className='guessbtn';guessButton.textContent='Try it yourself';document.querySelector('.prompt').append(guessButton);
guessButton.onclick=()=>{const t=challenge.tasks[active];const prev=guesses[challenge.seed+'-'+active];showDialog('Your prediction','<div class="helpblock"><h3>'+safe(challenge.prompt)+'</h3><p>'+t.variant+' chart · seed '+pad(challenge.seed)+'</p></div><div class="choices">'+E.REGIONS.map(s=>'<button class="btn white" data-guess="'+s+'">'+s+'</button>').join('')+'</div><p id="guessFeedback" class="fieldnote" role="status"></p>');const compare=v=>$('guessFeedback').textContent=v===t.key?'Correct. Both checks confirm '+t.key+'.':'You picked '+v+'. The verified answer is '+t.key+'.';if(prev)compare(prev);document.querySelectorAll('[data-guess]').forEach(b=>b.onclick=()=>{guesses[challenge.seed+'-'+active]=b.dataset.guess;compare(b.dataset.guess);});};
$('method').onclick=()=>showDialog('How the evaluation works','<div class="helpblock"><h3>Generate three related charts</h3><p>A seed sets the source values. Restyling reorders the regions and changes their colors. The value swap exchanges the leading two values for the selected question. Close call puts them one unit apart.</p></div><div class="helpblock"><h3>Cross-check the answer</h3><p>The source answer must match a second answer recovered from the final pixels. Ambiguous labels, ties and disagreements block the challenge.</p></div><div class="helpblock"><h3>Evaluate each image independently</h3><p>The local baseline uses a 24-row image sample and a nearest-neighbor classifier trained on 1,800 synthetic examples. It recognizes the winning region from its printed label. A live OpenAI vision model can also answer each PNG in a separate request.</p></div><div class="helpblock"><h3>Score the pairs</h3><p>Style robustness requires correct answers on both the original and restyled chart. Change sensitivity requires correct answers on both the original and value swap. History and exported reports preserve the exact images and responses.</p></div>');
function updateConfig(){
 const remote=$('model').value==='openai',n=Number($('size').value)*3;
 $('remoteControls').hidden=!remote;$('runSummary').textContent=remote?n+' images · '+n+' API requests':n+' images per run';
}
$('model').onchange=$('size').onchange=updateConfig;
$('question').onchange=$('difficulty').onchange=()=>setSeed(seed);
function lock(busy){
 ['generate','seedEdit','model','question','difficulty','size','apiKey','modelName','run','navHistory'].forEach(id=>$(id).disabled=busy);
 $('cancel').hidden=!busy;$('runLabel').textContent=busy?'Evaluating…':'Run evaluation';
}
async function remoteAnswer(image,prompt,settings,signal) {
 const request=new AbortController(),onStop=()=>request.abort();
 signal.addEventListener('abort',onStop,{once:true});if(signal.aborted)request.abort();
 const timer=setTimeout(()=>request.abort('timeout'),60000);
 try{
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal:request.signal,
   headers:{'Content-Type':'application/json','Authorization':'Bearer '+settings.key},
   body:JSON.stringify({model:settings.name,messages:[{role:'user',content:[
    {type:'text',text:prompt+' Reply with exactly one region label, without explanation.'},
    {type:'image_url',image_url:{url:image}}
   ]}]})});
  if(!r.ok)throw Error('OpenAI returned HTTP '+r.status+'. '+({401:'Check the API key.',403:'Check project and model access.',404:'Check the model ID.',429:'Check request limits and available credit.'}[r.status]||'Check the model and try again.'));
  const json=await r.json(),raw=json.choices?.[0]?.message?.content;
  if(typeof raw!=='string'||!raw.trim())throw Error('The provider returned no text response.');
  const clean=raw.trim().replace(/^[\s"'*`]+|[\s"'*`.!]+$/g,'').toLowerCase();
  return {raw,answer:E.REGIONS.find(s=>s.toLowerCase()===clean)||null};
 }catch(error){if(!signal.aborted&&request.signal.aborted)throw Error('OpenAI did not respond within 60 seconds.');throw error;}
 finally{clearTimeout(timer);signal.removeEventListener('abort',onStop);}
}
async function evaluate(){
 const config={seed,question:$('question').value,difficulty:$('difficulty').value,size:Number($('size').value),evaluator:$('model').value};
 const settings={name:$('modelName').value.trim(),key:$('apiKey').value.trim()};
 if(config.evaluator==='openai'&&(!settings.key||!settings.name)){note('Enter a model ID and API key to run the live evaluation.');(!settings.name?$('modelName'):$('apiKey')).focus();return;}
 const current=new AbortController();control=current;lock(true);runError='';runState=null;sceneIndex=0;active=0;
 challenge=E.create(seed,config.question,config.difficulty);draw();
 const model=config.evaluator==='openai'?settings.name:'Local vision baseline',items=[];
 let done=0;
 function progress(){$('resultState').textContent='Running';$('resultState').className='state';$('resultBody').innerHTML='<div class="resultmeta">Evaluating image '+Math.min(done+1,config.size*3)+' of '+config.size*3+' · '+safe(model)+'</div><div class="progress"><span style="width:'+done/(config.size*3)*100+'%"></span></div>'; }
 try {
  progress();
  for(let i=0;i<config.size;i++){
   const c=i===0?challenge:E.create(E.nextSeed(config.seed,i),config.question,config.difficulty);
   const item={seed:c.seed,question:c.prompt,keys:[],answers:[],images:[],evidence:[]};
   for(const t of c.tasks){
    await new Promise(ok=>setTimeout(ok,12));current.signal.throwIfAborted();
    const image=t.canvas.toDataURL('image/png');
    const started=performance.now();
    const raw=config.evaluator==='local'?E.localAnswer(t.canvas,c.prompt):null;
    const response=raw?{raw,answer:raw}:await remoteAnswer(image,c.prompt,settings,current.signal);
    current.signal.throwIfAborted();response.latencyMs=Math.round(performance.now()-started);
    item.answers.push(response);item.keys.push(t.key);item.images.push(image);
    item.evidence.push({variant:t.variant,source:t.rows,pixels:t.check.readings,pixelAnswer:t.check.answer});
    done++;progress();
   }
   items.push(item);
  }
  const record={version:1,id:crypto.randomUUID(),time:Date.now(),config,model,items,stats:E.score(items)};
  await remember(record);runState=record;results();$('live').textContent='Evaluation complete. '+record.stats.correct+' of '+record.stats.total+' correct.';
  $('results').scrollIntoView({behavior:'smooth',block:'nearest'});
 }catch(err){runError=current.signal.aborted?'Run canceled after '+done+' of '+config.size*3+' images.':('Run stopped after '+done+' of '+config.size*3+' images. '+(err.message||'Request failed.'));results();$('live').textContent=runError;}
 finally{control=null;lock(false);}
}
$('run').onclick=evaluate;$('cancel').onclick=()=>control?.abort();
function metrics(s){
 return '<div class="metrics">'+[
 ['Answer accuracy',s?pct(s.correct,s.total):'—',s?s.correct+' / '+s.total+' images correct':'Across all images'],
 ['Style robustness',s?pct(s.style,s.pairs):'—',s?s.style+' / '+s.pairs+' pairs correct':'Original + restyled'],
 ['Change sensitivity',s?pct(s.change,s.pairs):'—',s?s.change+' / '+s.pairs+' pairs correct':'Original + value swap']
 ].map(([name,value,detail])=>'<div class="metric"><div class="statname">'+name+'</div><b>'+value+'</b><small>'+detail+'</small></div>').join('')+'</div>';
}
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
  if(changeErrors)insights.push('The model missed the new winner after a correct original response on '+changeErrors+' of '+s.pairs+' challenges.');
  if(!insights.length)insights.push('The model missed the original chart on '+r.items.filter(i=>i.answers[0].answer!==i.keys[0]).length+' of '+s.pairs+' challenges.');
 }
 box.innerHTML=metrics(s)+'<div class="resultcopy">'+insights.join(' ')+'</div><div class="tableactions"><label class="sceneidx">Challenge <select id="scenePick">'+r.items.map((it,i)=>'<option value="'+i+'" '+(i===sceneIndex?'selected':'')+'>#'+pad(it.seed)+'</option>').join('')+'</select></label><button class="btn white" id="export">Export run</button></div><div class="resulttable"><table><thead><tr><th>Image variant</th><th>Model answer</th><th>Verified answer</th><th>Outcome</th></tr></thead><tbody>'+item.answers.map((a,i)=>'<tr><td>'+E.VARIANTS[i]+'</td><td>'+safe(a.answer||'Unrecognized')+(a.answer?'':'<span class="raw">'+safe(a.raw)+'</span>')+'</td><td>'+item.keys[i]+'</td><td><span class="chip '+(a.answer===item.keys[i]?'good">Correct':'bad">Incorrect')+'</span></td></tr>').join('')+'</tbody></table></div><div class="resultmeta"><span>'+safe(r.model)+' · '+safe(r.config.difficulty==='close'?'Close call':'Standard')+'</span><span>'+formatDate(r.time)+'</span></div>';
 $('scenePick').onchange=()=>{sceneIndex=Number($('scenePick').value);active=0;seed=r.items[sceneIndex].seed;challenge=E.create(seed,r.config.question,r.config.difficulty);draw();results();};
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
 el.innerHTML='<div class="panel">'+history.map(r=>'<div class="historyrow"><div class="historyitem"><span class="chip good">'+pct(r.stats.correct,r.stats.total)+'</span><div><strong>'+safe(r.model)+'</strong><p>#'+pad(r.config.seed)+' · '+r.stats.total+' images · '+formatDate(r.time)+'</p></div></div><button class="btn white" data-open="'+safe(r.id)+'">Inspect run</button></div>').join('')+'</div>';
 el.querySelectorAll('[data-open]').forEach(b=>b.onclick=async()=>{
  try{
   const id=b.dataset.open,r=memory.get(id)||await request(db.transaction('runs').objectStore('runs').get(id));
   seed=r.config.seed;guesses={};sceneIndex=0;active=0;runError='';runState=r;
   $('question').value=r.config.question;$('difficulty').value=r.config.difficulty;$('size').value=r.config.size;$('model').value=r.config.evaluator;if(r.config.evaluator==='openai')$('modelName').value=r.model;
   updateConfig();challenge=E.create(seed,r.config.question,r.config.difficulty);draw();results();mode('studio');$('results').scrollIntoView({behavior:'smooth'});
  }catch{note('This saved run could not be loaded.');}
 });
}
updateConfig();regenerate();
})();
