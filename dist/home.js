(() => {
  'use strict';
  const el=id=>document.getElementById(id);
  const snapshot=window.FactorySnapshot;
  const format=new Intl.NumberFormat();
  if(snapshot?.case){
    const record=snapshot.case, before=record.boards.a, after=record.boards.b;
    const colors=['','blue','orange','teal'];
    for(const [target,board] of [['before-board',before],['after-board',after]]){
      const matrix=el(target);
      matrix.setAttribute('role','img');
      matrix.setAttribute('aria-label',board.map((row,i)=>'Row '+(i+1)+': '+row.map(v=>colors[v]).join(', ')).join('. '));
      for(const [r,row] of board.entries())for(const [c,ink] of row.entries()){
        const cell=document.createElement('i');
        cell.dataset.ink=ink;
        if(target==='after-board'&&ink!==before[r][c])cell.dataset.changed='true';
        matrix.append(cell);
      }
    }
    el('bay-name').textContent=record.bay+' bay · Tested PNG';
    el('case-fallback').hidden=true;el('board-set').hidden=false;el('reveal').hidden=false;
    el('reveal').onclick=()=>{
      const shown=el('after-board').classList.toggle('revealed');
      el('reveal').setAttribute('aria-pressed',String(shown));
      el('reveal').textContent=shown?'Hide edits':'Reveal edits';
      el('case-question').textContent=shown?record.verified+' bins changed.':'How many bins changed?';
      el('case-proof').textContent=shown?'Verified from pixels. Qwen answered '+record.modelAnswer+'.':'Compare the before and after plans.';
    };
  }
  let preferred=null;
  try{preferred=sessionStorage.getItem('vtf-overview-source');}catch{/* Storage may be disabled. */}
  let local=null;
  const buttons=[...document.querySelectorAll('[data-scope]')];
  function display(){
    const hasActivity=local&&(local.images>0||local.responses>0);
    const scope=preferred==='browser'||preferred==='published'?preferred:(hasActivity?'browser':'published');
    const totals=scope==='browser'?local:snapshot?.published;
    for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.scope===scope));
    for(const id of ['images','questions','responses'])el(id).textContent=totals?format.format(totals[id]):'—';
    el('accuracy').textContent=totals?.responses?Math.round(totals.correct/totals.responses*100)+'%':'—';
    el('view-report').hidden=scope!=='published';
    if(scope==='published'){
      el('metric-source').textContent=totals?totals.model.split('-Instruct')[0]+' pilot · One question per case, tested on three images. '+totals.correct+' of '+totals.responses+' responses correct.':'The published figures are unavailable. See the benchmark report.';
    }else{
      el('metric-source').textContent=local?'Studio and Live Demo on this browser. Scores include local baseline and model responses.':'Browser activity is unavailable. Allow local storage to record pipeline counts.';
    }
  }
  async function refresh(){
    try{local=await window.FactoryActivity.read();}catch{local=null;}
    display();
  }
  for(const button of buttons)button.onclick=()=>{
    preferred=button.dataset.scope;
    try{sessionStorage.setItem('vtf-overview-source',preferred);}catch{/* The selection still applies on this page. */}
    display();
    if(preferred==='browser')refresh();
  };
  display();refresh();
  window.addEventListener('storage',e=>{if(e.key===window.FactoryActivity.signal||e.key===null)refresh();});
  window.addEventListener(window.FactoryActivity.signal,refresh);
  window.addEventListener('pageshow',refresh);
  window.addEventListener('focus',refresh);
})();
