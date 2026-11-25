(() => {
  'use strict';
  const {define,range,int,pick,shuffle,same,result,tileDraw,tileRead,transform,motif,ops,letters,uniqueIndex}=window.ReasoningLab;
  const family='sequences';
  const tileSlot=i=>[82+178*i,72],choiceSlot=i=>[82+178*i,218];
  function options(g,ms){ms.forEach((m,i)=>{const [x,y]=choiceSlot(i);tileDraw(g,m,x,y,28);g.text(letters[i],x+42,y+111,17,'center');});}
  const readChoices=v=>range(4).map(i=>tileRead(v,...choiceSlot(i),28,3));
  const opPhrases={'Clockwise':'a 90-degree clockwise rotation','Counterclockwise':'a 90-degree counterclockwise rotation','Half turn':'a 180-degree rotation','Vertical mirror':'a reflection across a vertical axis','Horizontal mirror':'a reflection across a horizontal axis'};
  const optionSet=(r,base,target)=>shuffle(r,[target,...shuffle(r,['Identity',...ops].map(op=>transform(base,op)).filter(m=>!same(m,target))).slice(0,3)]);
  define('transformresult',{family,name:'Transform result identification',title:'Orientation check',choices:letters,queries:ops.map(op=>({op,text:'Which candidate A–D is the result of '+opPhrases[op]+' applied to the source tile?'})),
    make(r,q){const m=motif(r);return {m,options:optionSet(r,m,transform(m,q.op))};},
    draw(g,s){tileDraw(g,s.m,369,68,30);g.text('Source',414,185,15,'center');options(g,s.options);},
    solve:(s,q)=>uniqueIndex(s.options,m=>same(m,transform(s.m,q.op))),
    read(v,q){const ref=tileRead(v,369,68,30,3);return result(uniqueIndex(readChoices(v),m=>same(m,transform(ref,q.op))),'Compared all nine sampled cells after '+opPhrases[q.op]+'.');}});
  define('transforminfer',{family,name:'Transform pair inference',title:'Tile orientation transfer',choices:ops,
    queries:[false,true].map(reverse=>({reverse,text:'Which operation maps the '+(reverse?'right tile to the left':'left tile to the right')+'? Answer Clockwise, Counterclockwise, Half turn, Vertical mirror or Horizontal mirror. Clockwise turns are 90 degrees.'})),
    make(r){const m=motif(r);return {a:m,b:transform(m,pick(r,ops))};},
    draw(g,s){tileDraw(g,s.a,141,100,57);tileDraw(g,s.b,501,100,57);g.text('Left tile',227,308,17,'center');g.text('Right tile',587,308,17,'center');},
    solve:(s,q)=>ops.find(op=>same(transform(q.reverse?s.b:s.a,op),q.reverse?s.a:s.b)),
    read(v,q){const a=tileRead(v,141,100,57,3),b=tileRead(v,501,100,57,3);const hits=ops.filter(op=>same(transform(q.reverse?b:a,op),q.reverse?a:b));
      if(hits.length!==1)throw Error('Transformation is ambiguous.');return result(hits[0],'Exactly one of five transformations reproduces all colored target cells.');}});
  const simX=[81,249,405,561,717];
  const dist=(p,q)=>(p[0]-q[0])**2+(p[1]-q[1])**2;
  function ratios(p){const d=[dist(p[0],p[1]),dist(p[1],p[2]),dist(p[0],p[2])];return d.map(n=>n/d[0]);}
  function equivalent(a,b){const ra=ratios(a),rb=ratios(b);return ra.every((n,i)=>Math.abs(n-rb[i])<.025);}
  define('similarity',{family,name:'Transform similarity',title:'Landmark shape matching',choices:letters,
    queries:[true,false].map(want=>({want,text:'Which candidate A–D is '+(want?'similar':'not similar')+' to the reference triangle? Match colored vertices. Rotation, reflection and uniform scaling are allowed.'})),
    make(r,q){const p=[[-24,-20],[24,-12],[-12,24+4*int(r,0,2)]],unique=int(r,0,3);
      const options=range(4).map(i=>{const valid=q.want?(i===unique):(i!==unique),f=pick(r,[.75,1,1.25]),turn=int(r,0,3),flip=pick(r,[-1,1]),stretch=valid?1:pick(r,[1.5,1.75]);
        return p.map(([x,y])=>{x*=stretch*f*flip;y*=f;for(let k=0;k<turn;k++)[x,y]=[-y,x];return [x,y];});});return {p,options};},
    draw(g,s){[s.p,...s.options].forEach((pts,i)=>{const cx=simX[i],cy=191;pts.forEach(([x,y],j)=>{const [X,Y]=pts[(j+1)%3];g.line(cx+x,cy+y,cx+X,cy+Y,g.theme.edge,3);});pts.forEach(([x,y],j)=>g.dot(cx+x,cy+y,6,j+1));g.text(i?letters[i-1]:'Reference',cx,289,17,'center');});},
    solve:(s,q)=>uniqueIndex(s.options,m=>equivalent(s.p,m)===q.want),
    read(v,q){const pts=simX.map(cx=>[1,2,3].map(ink=>{const o=v.blobs([cx-67,118,134,145],ink)[0];return [o.x,o.y];}));
      const signature=m=>[dist(m[0],m[1]),dist(m[1],m[2]),dist(m[2],m[0])];const ref=signature(pts[0]);
      const errors=pts.slice(1).map(m=>{const s=signature(m),f=s.reduce((a,b)=>a+b,0)/ref.reduce((a,b)=>a+b,0);return Math.max(...s.map((d,i)=>Math.abs(1-d/(ref[i]*f))));});
      return result(uniqueIndex(errors,e=>(e<.05)===q.want),'Maximum proportional edge errors for A–D: '+errors.map(n=>Math.round(n*100)+'%').join(', ')+'.');}});
  const rotationQs=[{text:'Which tile A–D comes next if the same rotation continues from panel to panel?'},{text:'Complete the rotation sequence. Which candidate A–D preserves the turn between each pair of tiles?'}];
  define('rotation',{family,name:'Sequence rotation',title:'Rotating tile sequence',choices:letters,queries:rotationQs,
    make(r){const m=motif(r),op=pick(r,ops.slice(0,3)),shown=[m];for(let i=0;i<2;i++)shown.push(transform(shown.at(-1),op));return {shown,op,options:optionSet(r,m,transform(shown[2],op))};},
    draw(g,s){s.shown.forEach((m,i)=>tileDraw(g,m,...tileSlot(i),28));g.text('?',658,129,35,'center');g.line(44,187,775,187,g.theme.divider);options(g,s.options);},
    solve:s=>uniqueIndex(s.options,m=>same(m,transform(s.shown[2],s.op))),
    read(v){const m=range(3).map(i=>tileRead(v,...tileSlot(i),28,3));const op=ops.slice(0,3).find(o=>same(transform(m[0],o),m[1])&&same(transform(m[1],o),m[2]));if(!op)throw Error('No constant rotation in the visible panels.');
      return result(uniqueIndex(readChoices(v),t=>same(t,transform(m[2],op))),'Both observed steps match '+op.toLowerCase()+'. Applied the same step to the third panel.');}});
  function arithmetic(r,multi,h){
    const steps=multi?shuffle(r,[-1,0,1]):[pick(r,h?[-3,-2,2,3]:[-2,-1,1,2])];
    const top=multi?8:18,start=steps.map(d=>int(r,1+Math.max(0,-3*d),top-Math.max(0,3*d)));
    const seq=range(4).map(i=>start.map((v,j)=>v+i*steps[j])),target=seq[3],opts=[target];
    while(opts.length<4){const v=[...target],j=int(r,0,v.length-1);v[j]=Math.max(0,Math.min(top+1,v[j]+pick(r,[-3,-2,-1,1,2,3])));if(!opts.some(a=>same(a,v)))opts.push(v);}
    return {shown:seq.slice(0,3),options:shuffle(r,opts)};
  }
  function dotPanel(g,counts,i,bottom,multi){const x=43+i*190,y=bottom?208:70;g.frame(x,y,156,98);
    counts.forEach((n,col)=>{if(multi&&col)g.line(x+col*50,y+3,x+col*50,y+95,g.theme.columnRule,1);
      for(let k=0;k<n;k++){if(multi)g.dot(x+27+col*50,y+89-k*9,3.6,col+1);else g.dot(x+19+(k%6)*23,y+18+Math.floor(k/6)*22,6,1);}});
    if(bottom)g.text(letters[i],x+78,y+122,17,'center');}
  function observeDots(v,i,bottom,multi){const box=[44+i*190,(bottom?208:70)+1,154,95];return (multi?[1,2,3]:[1]).map(k=>v.blobs(box,k).length);}
  for(const multi of [false,true]){const id=multi?'columns':'arithmetic';
    define(id,{family,name:multi?'Multi-column arithmetic':'Sequence arithmetic',title:multi?'Independent column progressions':'Quantity progression',choices:letters,
      queries:[{text:multi?'Which panel A–D comes next when each colored column follows its own arithmetic progression?':'Which panel A–D completes the arithmetic progression of dot counts?'},{text:multi?'Continue each of the three columns independently by its observed step. Which candidate A–D matches all three?':'Use the constant change in quantity between the upper panels. Which candidate A–D comes next?'}],
      make:(r,q,h)=>arithmetic(r,multi,h),draw(g,s){s.shown.forEach((m,i)=>dotPanel(g,m,i,false,multi));g.text('?',691,134,35,'center');s.options.forEach((m,i)=>dotPanel(g,m,i,true,multi));},
      solve(s){const next=s.shown[2].map((v,i)=>2*v-s.shown[1][i]);return uniqueIndex(s.options,m=>same(m,next));},
      read(v){const a=range(3).map(i=>observeDots(v,i,false,multi)),step=a[1].map((n,i)=>n-a[0][i]);
        if(step.some((d,i)=>a[2][i]-a[1][i]!==d))throw Error('Measured panels do not form a progression.');
        const target=a[2].map((n,i)=>n+step[i]);return result(uniqueIndex(range(4).map(i=>observeDots(v,i,true,multi)),m=>same(m,target)),'Measured '+a.map(x=>'['+x.join(', ')+']').join(' → ')+'. Predicted ['+target.join(', ')+'].');}});
  }
})();
