(() => {
  'use strict';
  const S=window.PanelScene, I=window.PanelInspection, release=window.PanelTrials;
  const get=id=>document.getElementById(id);
  const tag=(type,text,cls)=>{const e=document.createElement(type);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
  const base='downloads/inspection/';
  const imageCache=new Map();
  let key='net',variant=2,revealed=false,human=null,epoch=0,current,generated;
  function loadImage(file){
    if(!imageCache.has(file))imageCache.set(file,new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Could not load the recorded panel.'));img.src=base+file;
    }).catch(error=>{imageCache.delete(file);throw error;}));
    return imageCache.get(file);
  }
  function evidence(k,e){
    switch(k){
      case 'seat':return 'Minimum window clearance: '+e.minimumClearancePx+' px. A negative value means the plug overhangs.';
      case 'pins':return 'The PNG contains '+e.count+' separate gold contact marks in J2. The assembly specification calls for four.';
      case 'mirror':return e.leftCount+' contacts on the left, '+e.rightCount+' on the right. '+e.unmatchedLeft.length+' left contact(s) have no reflected match.';
      case 'keys':return 'Measured key directions, left to right: '+e.directions.join(', ')+'.';
      case 'net':return 'The gold pixels form '+e.copperComponents+' connected region(s). '+(e.sameComponent?'Both terminals belong to the same region.':'The terminals lie in different regions.');
    }
  }
  function selectedModel(){return release.models[Number(get('model').value)||0];}
  function sourceChanged(){return get('source').value==='generated';}
  function activeSeed(){return Number(get('seed').value);}
  function missedPairs(model){
    const failures=[];
    for(const g of release.groups){
      const pair=[g.images[0],g.images[2]];
      const defect=pair.find(i=>!S.nominal(g.key,i.answer));
      const control=pair.find(i=>S.nominal(g.key,i.answer));
      const prediction=model.predictions[defect.id].answer;
      if(prediction!==null&&S.nominal(g.key,prediction)){
        failures.push({group:g,alsoCleared:S.nominal(g.key,model.predictions[control.id].answer)});
      }
    }
    return failures.sort((a,b)=>Number(b.alsoCleared)-Number(a.alsoCleared)).map(x=>x.group);
  }
  let missIndex=0;
  async function pairData(){
    const d=get('difficulty').value;
    if(sourceChanged()){
      const seed=activeSeed(),sig=[key,d,seed].join('/');
      if(generated?.sig!==sig) {
        if(generated)generated.challenge.tasks.forEach(t=>t.canvas.width=1);
        const challenge=I.create(key,seed,d);
        generated={sig,challenge,changeBounds:window.panelChangeBounds(challenge.tasks[0].canvas,challenge.tasks[2].canvas)};
      }
      return {seed,changeBounds:generated.changeBounds,records:[0,variant].map(i=>{
        const t=generated.challenge.tasks[i],raw=I.predict(t.canvas,key);
        return {image:t.canvas,answer:t.key,evidence:t.check.readings[0],raw,parsed:raw};
      })};
    }
    const group=release.groups.find(t=>t.key===key&&t.difficulty===d);
    const model=selectedModel();
    return {seed:group.seed,changeBounds:group.changeBounds,records:await Promise.all([0,variant].map(async i=>{
      const t=group.images[i],p=model.predictions[t.id];
      return {image:await loadImage(t.image),answer:t.answer,evidence:t.evidence,raw:p.raw,parsed:p.answer};
    }))};
  }
  const crops={seat:[26,63,241,134],pins:[278,63,257,134],mirror:[546,63,248,134],keys:[26,207,405,118],net:[442,207,352,118]};
  function figure(rec,i){
    const fig=tag('figure'),title=i?(variant===1?'Style control':'Single edit'):'Reference panel';
    const cap=tag('figcaption');cap.append(tag('span',title),tag('span',S.stations[key]));fig.append(cap);
    const view=tag('canvas');view.width=820;view.height=326;
    view.setAttribute('role','img');view.setAttribute('aria-label',title+' showing '+S.defs[key][1].toLowerCase()+'.');
    const g=view.getContext('2d'),crop=get('zoom').checked?crops[key]:[0,0,820,356];
    const scale=Math.min(view.width/crop[2],view.height/crop[3]);
    g.fillStyle='#162f33';g.fillRect(0,0,view.width,view.height);
    g.drawImage(rec.image,...crop,(view.width-crop[2]*scale)/2,(view.height-crop[3]*scale)/2,crop[2]*scale,crop[3]*scale);
    if(i===1&&variant===2&&revealed&&get('mark').checked&&current?.changeBounds){
      const [x,y,w,h]=current.changeBounds;
      const px=(view.width-crop[2]*scale)/2+(x-crop[0])*scale,py=(view.height-crop[3]*scale)/2+(y-crop[1])*scale;
      g.strokeStyle='#ff9fd9';g.lineWidth=3;g.setLineDash([8,4]);g.strokeRect(px-5,py-5,w*scale+10,h*scale+10);
    }
    fig.append(view);return fig;
  }
  function showFindings(){
    const out=get('verdicts');out.replaceChildren();
    get('markLabel').hidden=!revealed||variant!==2||!current;
    if(current)get('pair').replaceChildren(...current.records.map(figure));
    get('reveal').textContent=revealed?'Hide inspection results':'Reveal inspection results';
    get('reveal').setAttribute('aria-expanded',String(revealed));
    get('humanClear').setAttribute('aria-pressed',String(human==='clear'));
    get('humanHold').setAttribute('aria-pressed',String(human==='hold'));
    if(!revealed||!current)return;
    if(human){
      const expected=S.nominal(key,current.records[1].answer)?'clear':'hold';
      out.append(tag('p','Your call: '+human+'. Verified decision: '+expected+'.', 'humancall'));
    }
    const grid=tag('div',undefined,'findings');
    current.records.forEach((r,i)=>{
      const ok=r.parsed===r.answer,good=S.nominal(key,r.answer);
      let verdict=ok?'Correct':r.parsed===null?'Unusable response':(!good&&S.nominal(key,r.parsed))?'False clear':(good&&!S.nominal(key,r.parsed))?'False alarm':'Incorrect answer';
      const card=tag('div',undefined,'finding'+(ok?'':' miss'));
      card.append(tag('strong',(i?'Comparison':'Reference')+' · '+verdict),tag('p','Model: '+(r.raw||'(empty)')+'  ·  Verified: '+r.answer),
        tag('small',(good?'Conforming station. ':'Defective station. ')+evidence(key,r.evidence)));
      grid.append(card);
    });
    out.append(grid);
  }
  async function refresh(reset=true){
    const ticket=++epoch;
    if(reset){revealed=false;human=null;}
    get('seedLabel').hidden=get('newPanel').hidden=!sourceChanged();
    get('modelLabel').hidden=get('findMiss').hidden=sourceChanged();
    if(!sourceChanged()){
      const count=missedPairs(selectedModel()).length;
      get('findMiss').disabled=!count;
      get('findMiss').textContent=count?'Find a false clear':'No explicit false clears in pairs';
    }
    for(const b of get('stations').children)b.setAttribute('aria-pressed',String(b.dataset.key===key));
    get('edit').setAttribute('aria-pressed',String(variant===2));get('style').setAttribute('aria-pressed',String(variant===1));
    get('question').textContent=S.defs[key][2].split(' Answer')[0];
    get('impact').textContent=S.defs[key][3];
    current=null;get('reveal').disabled=true;showFindings();
    try{
      const data=await pairData();if(ticket!==epoch)return;
      current=data;
      get('context').textContent=(sourceChanged()?'Generated now · fixed-probe baseline':'Recorded inference · '+modelLabel(selectedModel()))+' · Seed '+data.seed;
      const route=new URL(window.location.href);route.search='';route.hash='';
      route.searchParams.set('station',key);route.searchParams.set('detail',get('difficulty').value);
      route.searchParams.set('pair',variant===1?'style':'edit');
      if(sourceChanged())route.searchParams.set('seed',String(data.seed));
      else route.searchParams.set('trial',selectedModel().file.replace(/\.html$/,''));
      get('caseLink').href=route.href;
      get('reveal').disabled=false;showFindings();
    }catch(e){if(ticket===epoch){get('pair').replaceChildren(tag('p',e.message));get('context').textContent='';}}
  }
  for(const [k,d] of Object.entries(S.defs)){
    const b=tag('button');b.dataset.key=k;b.append(tag('small',d[0]),tag('strong',d[1]));
    b.onclick=()=>{key=k;refresh();};get('stations').append(b);
  }
  const modelLabel=m=>m.protocol==='fixed probe'?m.name:m.name+' · '+m.protocol;
  for(const [i,m] of release.models.entries()){
    const opt=tag('option',modelLabel(m));opt.value=i;get('model').append(opt);
    const row=tag('tr');row.append(tag('th',modelLabel(m)),tag('td',m.overall.correct+' / '+m.overall.total),tag('td',m.overall.changeCorrect+' / '+m.overall.pairs),
      tag('td',m.risk.falseClear+' / '+m.risk.defective),tag('td',m.risk.falseAlarm+' / '+m.risk.conforming),tag('td',m.risk.abstained));
    const cell=tag('td'),a=tag('a','Inspect run');a.href=base+m.file;cell.append(a);row.append(cell);get('records').append(row);
  }
  get('source').onchange=get('model').onchange=get('difficulty').onchange=()=>refresh();
  get('findMiss').onclick=async()=>{
    const matches=missedPairs(selectedModel());if(!matches.length)return;
    const g=matches[missIndex++%matches.length];key=g.key;get('difficulty').value=g.difficulty;
    const ticket=epoch+1;variant=2;await refresh();if(ticket!==epoch||!current)return;revealed=true;showFindings();
    get('question').scrollIntoView?.({block:'nearest'});
  };
  get('seed').onchange=()=>{if(!get('seed').value||!get('seed').checkValidity()){get('seed').value=current?.seed??28;}refresh();};
  get('newPanel').onclick=()=>{get('seed').value=crypto.getRandomValues(new Uint32Array(1))[0];refresh();};
  get('style').onclick=()=>{variant=1;refresh();};get('edit').onclick=()=>{variant=2;refresh();};
  get('zoom').onchange=()=>refresh(false);get('mark').onchange=showFindings;
  for(const [id,choice] of [['humanClear','clear'],['humanHold','hold']])get(id).onclick=()=>{
    if(!current)return;
    human=choice;revealed=true;showFindings();
  };
  get('reveal').onclick=()=>{revealed=!revealed;showFindings();};
  const params=new URLSearchParams(window.location.search);
  if(Object.hasOwn(S.defs,params.get('station')))key=params.get('station');
  if(params.get('detail')==='close')get('difficulty').value='close';
  if(params.get('pair')==='style')variant=1;
  const seed=params.get('seed');
  if(seed!==null&&/^\d{1,10}$/.test(seed)&&Number(seed)<=4294967295){
    get('source').value='generated';get('seed').value=Number(seed);
  }else{
    const modelIndex=release.models.findIndex(m=>m.file===params.get('trial')+'.html');
    if(modelIndex>=0)get('model').value=String(modelIndex);
  }
  refresh();
})();
