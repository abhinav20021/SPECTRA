(() => {
  'use strict';
  const scene=window.PanelScene;
  const yes=b=>b?'Yes':'No';
  const isGold=(r,g,b)=>r>164&&r-g>22&&g-b>42;
  const isCyan=(r,g,b)=>g-r>58&&b-r>58;
  function readInk(canvas,key,test=isGold) {
    const [ox,oy,w,h]=scene.zone[key];
    const pixels=canvas.getContext('2d',{willReadFrequently:true}).getImageData(ox,oy,w,h).data;
    const mask=new Uint8Array(w*h);
    for(let i=0;i<mask.length;i++)mask[i]=+test(pixels[4*i],pixels[4*i+1],pixels[4*i+2]);
    const objects=[],queue=new Int32Array(mask.length);
    for(let i=0;i<mask.length;i++)if(mask[i]){
      let head=0,tail=1; queue[0]=i;mask[i]=0;
      let x0=w,x1=0,y0=h,y1=0,sumX=0,sumY=0;
      while(head<tail) {
        const v=queue[head++],x=v%w,y=(v-x)/w;
        x0=Math.min(x,x0);x1=Math.max(x,x1);y0=Math.min(y,y0);y1=Math.max(y,y1);
        sumX+=x;sumY+=y;
        for(const n of [x>0?v-1:-1,x+1<w?v+1:-1,y>0?v-w:-1,y+1<h?v+w:-1]) {
          if(n>=0&&mask[n]){queue[tail++]=n;mask[n]=0;}
        }
      }
      if(tail<6)continue;
      objects.push({x:Math.round(ox+sumX/tail),y:Math.round(oy+sumY/tail),left:ox+x0,right:ox+x1,
        top:oy+y0,bottom:oy+y1,area:tail, touchesS:false,touchesT:false});
      if(key==='net'){
        const obj=objects[objects.length-1];
        for(let k=0;k<tail;k++){
          const v=queue[k],x=v%w+ox,y=Math.floor(v/w)+oy;
          if(x===477&&y===265)obj.touchesS=true;
          if(x===756&&y===265)obj.touchesT=true;
        }
      }
    }
    return objects;
  }
  function bounds(objects) {
    if(!objects.length)throw Error('Missing visible inspection mark.');
    return {left:Math.min(...objects.map(o=>o.left)),right:Math.max(...objects.map(o=>o.right)),
      top:Math.min(...objects.map(o=>o.top)),bottom:Math.max(...objects.map(o=>o.bottom))};
  }
  const box=e=>[e.left,e.top,e.right-e.left+1,e.bottom-e.top+1];
  function direction(o,centerX){
    const dx=o.x-centerX,dy=o.y-272;
    if(Math.max(Math.abs(dx),Math.abs(dy))<9)throw Error('Unreadable key orientation.');
    return Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?2:0);
  }
  function pixelCheck(canvas,key) {
    const marks=readInk(canvas,key);
    let answer, evidence;
    switch(key) {
      case 'seat': {
        const frame=bounds(readInk(canvas,key,isCyan)),plug=bounds(marks);
        const clearance=Math.min(plug.left-frame.left,frame.right-plug.right,plug.top-frame.top,frame.bottom-plug.bottom);
        answer=yes(clearance>=0);evidence={window:box(frame),plug:box(plug),minimumClearancePx:clearance};break;
      }
      case 'pins': {
        if(marks.length>6)throw Error('Unexpected contact count.');
        answer=String(marks.length);evidence={goldContacts:marks.map(o=>[o.x,o.y]),count:marks.length};break;
      }
      case 'mirror': {
        const left=marks.filter(o=>o.x<670),right=marks.filter(o=>o.x>670);
        const unmatched=left.filter(a=>!right.some(b=>Math.abs(1340-a.x-b.x)<=2&&Math.abs(a.y-b.y)<=2));
        answer=yes(left.length===right.length && !unmatched.length);
        evidence={leftCount:left.length,rightCount:right.length,unmatchedLeft:unmatched.map(o=>[o.x,o.y]),axisX:670};break;
      }
      case 'keys': {
        if(marks.length!==4)throw Error('Expected four visible connector keys.');
        const dirs=marks.sort((a,b)=>a.x-b.x).map((o,i)=>direction(o,78+i*92));
        const turns=dirs.slice(1).map((v,i)=>(4+v-dirs[i])%4);
        answer=yes(turns.every(t=>t===1));evidence={directions:dirs.map(i=>['up','right','down','left'][i]),clockwiseQuarterTurns:turns};break;
      }
      case 'net': {
        if(!marks.some(o=>o.touchesS)||!marks.some(o=>o.touchesT))throw Error('A trace terminal is missing.');
        answer=yes(marks.some(o=>o.touchesS&&o.touchesT));
        evidence={copperComponents:marks.length,reachableFromS:marks.find(o=>o.touchesS).area,sameComponent:answer==='Yes'};break;
      }
      default:throw Error('Unknown panel check.');
    }
    return {answer,readings:[evidence]};
  }
  // An inexpensive fixed-probe baseline uses nominal positions and a few samples.
  // It never sees the scene, the independently measured regions, or the answer.
  function predict(canvas,key) {
    const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const gold=(x,y)=>{const i=4*(x+canvas.width*y);return isGold(data[i],data[i+1],data[i+2]);};
    if(key==='seat')return yes(![65,73,219,228].some(x=>gold(x,145)));
    if(key==='pins')return String(Array.from({length:6},(_,i)=>gold(310+i*38,145)).filter(Boolean).length);
    if(key==='mirror')return yes([116,144,172].every(y=>[28,70].reduce((n,d)=>n+gold(670-d,y)-gold(670+d,y),0)===0));
    if(key==='keys'){
      const dx=[0,17,0,-17],dy=[-17,0,17,0];
      const read=x=>dx.findIndex((v,i)=>gold(x+v,272+dy[i]));
      return yes((read(78)+3)%4===read(354));
    }
    return yes([237,296].some(y=>[560,630,691].every(x=>gold(x,y))));
  }
  function create(key,seed,difficulty) {
    const def=scene.families['panel_'+key];
    const tasks=scene.scenes(seed,key,difficulty).map((rows,i)=>{
      const canvas=scene.paint(rows), result=scene.sourceAnswer(key,rows),check=pixelCheck(canvas,key);
      if(result!==check.answer)throw Error('Panel scene and rendered evidence disagree at '+key+' / '+seed);
      return {canvas,rows,key:result,check,variant:def.variants[i]};
    });
    if(tasks[0].key!==tasks[1].key||tasks[0].key===tasks[2].key)throw Error('Invalid panel comparison.');
    return {family:'panel_'+key,seed,question:key,difficulty,prompt:scene.defs[key][2],choices:def.choices,tasks};
  }
  function register(legacy) {
    const isPanel=family=>Object.hasOwn(scene.families,family);
    const prompts=new Map(Object.entries(scene.defs).map(([k,v])=>[v[2],k]));
    return {...legacy,families:{...legacy.families,...scene.families},
      create:(family,seed,key,d)=>isPanel(family)?create(key,seed,d):legacy.create(family,seed,key,d),
      promptFor:(family,key)=>isPanel(family)?scene.defs[key][2]:legacy.promptFor(family,key),
      sourceAnswer:(family,key,rows)=>isPanel(family)?scene.sourceAnswer(key,rows):legacy.sourceAnswer(family,key,rows),
      pixelCheck:(canvas,family,key)=>isPanel(family)?pixelCheck(canvas,key):legacy.pixelCheck(canvas,family,key),
      predict:(canvas,prompt)=>prompts.has(prompt)?predict(canvas,prompts.get(prompt)):legacy.predict(canvas,prompt)};
  }
  window.PanelInspection={register,pixelCheck,create,predict};
})();
