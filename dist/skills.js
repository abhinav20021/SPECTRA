(() => {
  'use strict';
  const E=window.VTF;
  const shapes=['Circle','Square','Triangle','Diamond'];
  const tints=['Blue','Orange','Teal','Violet'];
  const inks=[
    {Blue:'#407cd0',Orange:'#de864b',Teal:'#309986',Violet:'#9865cf',Gold:'#e5ab3e'},
    {Blue:'#5997ea',Orange:'#e79862',Teal:'#45ad99',Violet:'#a27ad3',Gold:'#dca733'}
  ];
  const sides=['left','right','above','below'];
  const families={
    charts:{name:'Chart reading',types:{highest:'Highest value',lowest:'Lowest value'},choices:E.REGIONS,
      notes:['Reference image','New colors and bar order · same values','Two values exchanged · same styling'],
      variants:E.VARIANTS,method:'The source table ranks the regions. The pixel check measures bar heights and recognizes each printed label.'},
    counting:{name:'Object counting',types:{blue:'Count blue circles',orange:'Count orange triangles',squares:'Count all squares'},
      notes:['Reference collection','New positions and shades · same objects','One matching object added'],
      variants:['Original','Restyled','Object added'],method:'The source inventory identifies matching objects. The pixel check finds connected shapes, measures their outlines and reads their colors.'},
    spatial:{name:'Spatial reasoning',types:{left:'Left of the star',right:'Right of the star',above:'Above the star',below:'Below the star'},choices:shapes,
      notes:['Reference layout','New sizes and colors · same neighbors','Two neighbors trade places'],
      variants:['Original','Restyled','Position swap'],method:'The scene records the intended neighbors. The pixel check identifies the star and shapes, then compares their measured centers.'}
  };
  const countTargets={blue:{shape:'Circle',color:'Blue'},orange:{shape:'Triangle',color:'Orange'},squares:{shape:'Square'}};
  const countPrompts={blue:'How many blue circles are visible?',orange:'How many orange triangles are visible?',squares:'How many squares are visible, across all colors?'};
  const prompts={};Object.entries(countPrompts).forEach(([key,p])=>prompts[p]=['counting',key]);
  function spatialPrompt(side){return 'Which shape is directly '+({left:'left of',right:'right of',above:'above',below:'below'}[side])+' the gold star?';}
  sides.forEach(k=>prompts[spatialPrompt(k)]=['spatial',k]);
  const pick=(arr,rng)=>arr[Math.floor(rng()*arr.length)];
  const integer=(rng,low,high)=>low+Math.floor(rng()*(high-low+1));
  function matches(obj,target){return obj.shape===target.shape&&(!target.color||obj.color===target.color);}
  function countScenes(rng,key,hard){
    const target=countTargets[key],quantity=integer(rng,2,hard?7:5),total=integer(rng,hard?17:10,hard?21:14);
    const sample=()=>({shape:pick(shapes,rng),color:pick(tints,rng)});
    const targetObject=()=>({shape:target.shape,color:target.color||pick(tints,rng)});
    const items=Array.from({length:quantity},targetObject);
    if(target.color){
      items.push({shape:target.shape,color:pick(tints.filter(c=>c!==target.color),rng)});
      items.push({shape:pick(shapes.filter(s=>s!==target.shape),rng),color:target.color});
    }
    while(items.length<total){const other=sample();if(!matches(other,target))items.push(other);}
    function layout(){
      const rows=hard?4:3,cols=hard?7:6;
      return E.shuffled(Array.from({length:rows*cols},(_,i)=>({
        x:Math.round(84+(i%cols)*648/(cols-1))+integer(rng,-10,10),
        y:Math.round(90+Math.floor(i/cols)*212/(rows-1))+integer(rng,-6,6),
        radius:integer(rng,hard?10:20,hard?22:30)
      })),rng);
    }
    const a=layout(),b=layout();
    const original=items.map((v,i)=>({...v,...a[i]}));
    const restyled=items.map((v,i)=>({...v,...b[i]}));
    const changed=[...original,{...targetObject(),...a[items.length]}];
    return [original,restyled,changed];
  }
  function spatialScenes(rng,key,hard){
    const names=E.shuffled(shapes,rng),colors=E.shuffled(tints,rng);
    const jitter=()=>integer(rng,-(hard?23:10),hard?23:10);
    const center={x:410+jitter(),y:190+jitter()/2};
    const offsets={left:[-184,0],right:[184,0],above:[0,-90],below:[0,90]};
    const base=sides.map((side,i)=>({side,shape:names[i],color:colors[i],
      x:Math.round(center.x+offsets[side][0]+jitter()),y:Math.round(center.y+offsets[side][1]+jitter()/2),
      radius:integer(rng,hard?10:23,hard?18:27)}));
    const star={side:'anchor',shape:'Star',color:'Gold',x:Math.round(center.x),y:Math.round(center.y),radius:hard?21:29};
    const restyled=base.map((obj,i)=>({...obj,color:colors[(i+1)%4],x:obj.x+jitter()/2,y:obj.y+jitter()/4,radius:obj.radius+3}));
    const from=sides.indexOf(key),to=(from+integer(rng,1,3))%4;
    const changed=base.map(o=>({...o}));
    for(const p of ['shape','color'])[changed[from][p],changed[to][p]]=[changed[to][p],changed[from][p]];
    return [[...base,star],[...restyled,{...star,radius:star.radius+2}],[...changed,star]];
  }
  function paintShape(g,shape,x,y,r){
    g.beginPath();
    if(shape==='Circle')g.arc(x,y,r,0,Math.PI*2);
    else if(shape==='Square')g.rect(x-r,y-r,2*r,2*r);
    else{
      let vertices;
      if(shape==='Star')vertices=Array.from({length:10},(_,i)=>{
        const a=i*Math.PI/5-Math.PI/2,length=i%2?r*.43:r;
        return [x+Math.cos(a)*length,y+Math.sin(a)*length];
      });
      else if(shape==='Triangle')vertices=[[x,y-r],[x+r,y+r],[x-r,y+r]];
      else vertices=[[x,y-r],[x+r,y],[x,y+r],[x-r,y]];
      vertices.forEach(([px,py],i)=>i?g.lineTo(px,py):g.moveTo(px,py));g.closePath();
    }
    g.fill();
  }
  function paint(rows,family,style){
    const c=E.surface(E.W,E.H),g=c.getContext('2d',{willReadFrequently:true});
    g.fillStyle=style?'#f7f7f7':'#fcfcfc';g.fillRect(0,0,c.width,c.height);
    g.fillStyle='#34343d';g.font='600 19px '+(window.VTF_RENDER_FONT||'Arial, sans-serif');g.fillText(family==='counting'?'Object collection':'Spatial arrangement',25,32);
    g.strokeStyle='#dedee3';g.lineWidth=1;g.beginPath();g.moveTo(25,48.5);g.lineTo(795,48.5);g.stroke();
    if(family==='spatial'){
      g.setLineDash([3,7]);g.strokeStyle='#d8d8dd';g.beginPath();g.moveTo(410,59);g.lineTo(410,337);g.moveTo(76,190);g.lineTo(744,190);g.stroke();g.setLineDash([]);
    }
    for(const obj of rows){g.fillStyle=inks[style][obj.color];paintShape(g,obj.shape,obj.x,obj.y,obj.radius);}
    return c;
  }
  // Isolate colored components without receiving a palette or scene coordinates.
  function components(canvas){
    const w=canvas.width,h=canvas.height,p=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
    const mask=new Uint8Array(w*h),queue=new Int32Array(w*h),result=[];
    for(let i=0;i<mask.length;i++){
      const r=p[4*i],g=p[4*i+1],b=p[4*i+2];
      mask[i]=Math.max(r,g,b)-Math.min(r,g,b)>48?1:0;
    }
    for(let i=0;i<mask.length;i++)if(mask[i]){
      let front=0,end=1;queue[0]=i;mask[i]=0;
      let x0=w,x1=0,y0=h,y1=0,sx=0,sy=0,red=0,green=0,blue=0;
      while(front<end){
        const at=queue[front++],x=at%w,y=Math.floor(at/w);
        x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);sx+=x;sy+=y;
        red+=p[at*4];green+=p[at*4+1];blue+=p[at*4+2];
        if(x>0&&mask[at-1]){mask[at-1]=0;queue[end++]=at-1;}
        if(x<w-1&&mask[at+1]){mask[at+1]=0;queue[end++]=at+1;}
        if(y>0&&mask[at-w]){mask[at-w]=0;queue[end++]=at-w;}
        if(y<h-1&&mask[at+w]){mask[at+w]=0;queue[end++]=at+w;}
      }
      if(end<2)continue;
      const width=x1-x0+1,height=y1-y0+1,cx=sx/end,cy=sy/end;
      result.push({x:cx,y:cy,x0,y0,width,height,area:end,fill:end/(width*height),
        vertical:(cy-y0+.5)/height,rgb:[red/end,green/end,blue/end],pixels:queue.slice(0,end),stride:w});
    }
    return result;
  }
  function hueName([r,g,b]){
    const max=Math.max(r,g,b),delta=max-Math.min(r,g,b);
    const hue=(60*(max===r?(g-b)/delta:max===g?2+(b-r)/delta:4+(r-g)/delta)+360)%360;
    if(hue<35)return 'Orange';if(hue<65)return 'Gold';if(hue<180)return 'Teal';if(hue<250)return 'Blue';return 'Violet';
  }
  function measuredShape(o){
    if(o.fill>.90)return 'Square';
    if(o.fill>.67)return 'Circle';
    if(o.fill<.455)return 'Star';
    return o.vertical>.57?'Triangle':'Diamond';
  }
  function sideOf(p,origin){const dx=p.x-origin.x,dy=p.y-origin.y;return Math.abs(dx)>Math.abs(dy)?(dx<0?'left':'right'):(dy<0?'above':'below');}
  function pixelCheck(canvas,family,key){
    const found=components(canvas).map(o=>({shape:measuredShape(o),color:hueName(o.rgb),x:Math.round(o.x),y:Math.round(o.y),area:o.area,bounds:[o.x0,o.y0,o.width,o.height]}));
    if(family==='counting'){
      found.forEach(o=>o.selected=matches(o,countTargets[key]));
      return {answer:String(found.filter(o=>o.selected).length),readings:found};
    }
    const anchors=found.filter(o=>o.color==='Gold'&&o.shape==='Star');
    if(anchors.length!==1)throw Error('The pixel reader could not verify a unique gold star.');
    const others=found.filter(o=>o!==anchors[0]);others.forEach(o=>o.side=sideOf(o,anchors[0]));
    if(others.length!==4||new Set(others.map(o=>o.side)).size!==4)throw Error('A spatial neighbor is ambiguous.');
    found.forEach(o=>o.selected=o===anchors[0]||o.side===key);
    return {answer:others.find(o=>o.side===key).shape,readings:found};
  }
  // The baseline identifies silhouettes using bitmap prototypes on a coarse image.
  // The verifier instead measures full-resolution fill ratios and centroids.
  function bitmap(o){
    const result=new Float32Array(64);
    for(const at of o.pixels){
      const x=at%o.stride-o.x0,y=Math.floor(at/o.stride)-o.y0;
      result[Math.floor(y*8/o.height)*8+Math.floor(x*8/o.width)]+=64/(o.width*o.height);
    }
    return result;
  }
  let templates;
  function fitShapes(){
    const examples=[];
    for(const shape of [...shapes,'Star'])for(const r of [3,5,9,13]){
      const c=E.surface(40,40),g=c.getContext('2d');
      g.fillStyle='#fff';g.fillRect(0,0,40,40);g.fillStyle='#407cd0';paintShape(g,shape,20,20,r);
      examples.push({shape,features:bitmap(components(c)[0])});
    }
    return examples;
  }
  function readCoarse(canvas){
    templates??=fitShapes();
    const small=E.surface(117,51),g=small.getContext('2d',{willReadFrequently:true});g.drawImage(canvas,0,0,117,51);
    return components(small).map(obj=>{
      const features=bitmap(obj);
      let best=Infinity,shape;
      for(const t of templates){
        const d=t.features.reduce((sum,v,i)=>sum+(v-features[i])**2,0);
        if(d<best){best=d;shape=t.shape;}
      }
      return {x:obj.x,y:obj.y,shape,color:hueName(obj.rgb)};
    });
  }
  function predict(canvas,prompt){
    if(!prompts[prompt])return E.localAnswer(canvas,prompt);
    const [family,key]=prompts[prompt],objects=readCoarse(canvas);
    if(family==='counting')return String(objects.filter(o=>matches(o,countTargets[key])).length);
    const anchor=objects.find(o=>o.color==='Gold');
    if(!anchor)return 'Unresolved';
    const candidate=objects.find(o=>o!==anchor&&sideOf(o,anchor)===key);
    return candidate?.shape||'Unresolved';
  }
  function sourceAnswer(family,key,rows){
    if(family==='charts')return E.chartKey(rows,key);
    if(family==='counting')return String(rows.filter(o=>matches(o,countTargets[key])).length);
    return rows.find(o=>o.side===key).shape;
  }
  function promptFor(family,key){
    if(family==='charts')return E.chartPrompt(key);
    return family==='counting'?countPrompts[key]:spatialPrompt(key);
  }
  function create(family,seed,key,difficulty){
    const def=families[family];
    if(!Object.hasOwn(def.types,key))throw Error('Unknown question for this skill.');
    if(family==='charts')return {...E.create(seed,key,difficulty),family,choices:def.choices};
    const rng=E.random(seed),hard=difficulty==='close';
    const scenes=family==='counting'?countScenes(rng,key,hard):spatialScenes(rng,key,hard);
    const tasks=scenes.map((rows,i)=>{
      const canvas=paint(rows,family,i===1?1:0);
      const answer=sourceAnswer(family,key,rows);
      const check=pixelCheck(canvas,family,key);
      if(answer!==check.answer || rows.length!==check.readings.length)throw Error('The rendered scene disagrees with its source data.');
      return {canvas,rows,key:answer,check,variant:def.variants[i]};
    });
    if(tasks[0].key!==tasks[1].key||tasks[0].key===tasks[2].key)throw Error('Invalid visual comparison.');
    return {family,seed,question:key,difficulty,prompt:promptFor(family,key),choices:def.choices,tasks};
  }
  function tourPlan(seed,first='charts',selected){
    const order=Object.keys(families),offset=order.indexOf(first);
    return order.map((_,i)=>{
      const family=order[(offset+i)%order.length],keys=Object.keys(families[family].types),s=E.nextSeed(seed,i);
      return {family,seed:s,key:i===0?selected||keys[0]:keys[s%keys.length]};
    });
  }
  function skillScores(items){
    return Object.entries(families).flatMap(([family,def])=>{
      const group=items.filter(i=>(i.family||'charts')===family);
      return group.length?[{family,name:def.name,...E.score(group)}]:[];
    });
  }
  window.VisualSkills={sourceAnswer,promptFor,families,create,predict,tourPlan,skillScores,pixelCheck};
})();
