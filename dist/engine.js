(() => {
  'use strict';
  const REGIONS = ['North', 'East', 'South', 'West'];
  const VARIANTS = ['Original', 'Restyled', 'Value swap'];
  const W = 820, H = 356, BASE = 285, TOP = 56;
  const SLOTS = [171, 352, 533, 714];
  const LABEL_FONT = '500 20px Arial, sans-serif';
  const palettes = [
    ['#8060df','#66b4a4','#e7a06d','#7399d1'],
    ['#4787a2','#c578aa','#628e6d','#c69851'],
    ['#5889c8','#da8566','#8397c9','#46a596']
  ];
  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let a = Math.imul(state ^ state >>> 15, state | 1);
      a ^= a + Math.imul(a ^ a >>> 7, a | 61);
      return ((a ^ a >>> 14) >>> 0) / 4294967296;
    };
  }
  function shuffled(items, rand) {
    const result = [...items];
    for (let i=result.length-1; i>0; i--) {
      const j=Math.floor(rand()*(i+1));
      [result[i],result[j]]=[result[j],result[i]];
    }
    return result;
  }
  function specs(seed, question, difficulty) {
    const rand=random(seed);
    const high=76+Math.floor(rand()*20);
    const low=15+Math.floor(rand()*18);
    const vals=[high,high-10-Math.floor(rand()*11),low+10+Math.floor(rand()*9),low];
    if(difficulty==='close') {
      if(question==='highest') vals[1]=high-1; else vals[2]=low+1;
    }
    const assigned=shuffled(vals,rand);
    const base=REGIONS.map((label,i)=>({label,value:assigned[i]}));
    const ranked=[...base].sort((a,b)=>question==='highest'?b.value-a.value:a.value-b.value);
    const changed=base.map(item=>({...item,value:item===ranked[0]?ranked[1].value:item===ranked[1]?ranked[0].value:item.value}));
    const offset=1+Math.floor(rand()*3);
    const restyle=base.slice(offset).concat(base.slice(0,offset));
    return [
      {rows:base,palette:palettes[0],width:91},
      {rows:restyle,palette:palettes[1+Math.floor(rand()*2)],width:66},
      {rows:changed,palette:palettes[0],width:91}
    ];
  }
  function surface(w,h) {
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;return canvas;
  }
  function render(spec) {
    const c=surface(W,H),ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#30313d';ctx.font='600 19px Arial, sans-serif';
    ctx.fillText('Sales by region',26,31);
    ctx.fillStyle='#686879';ctx.font='13px monospace';ctx.textAlign='right';
    ctx.fillText('UNITS',W-27,30);
    ctx.font='16px Arial, sans-serif';
    for(let tick=0;tick<=100;tick+=25) {
      const y=Math.round(BASE-tick*(BASE-TOP)/100);
      ctx.strokeStyle=tick===0?'#aaa9b4':'#dedee6';
      ctx.lineWidth=1;ctx.setLineDash(tick?[4,5]:[]);
      ctx.beginPath();ctx.moveTo(66,y+.5);ctx.lineTo(W-26,y+.5);ctx.stroke();
      ctx.fillStyle='#64646f';ctx.fillText(String(tick),54,y+5);
    }
    ctx.setLineDash([]);ctx.textAlign='center';
    spec.rows.forEach((row,i)=>{
      const height=Math.round(row.value*(BASE-TOP)/100);
      ctx.fillStyle=spec.palette[i];ctx.fillRect(SLOTS[i]-Math.floor(spec.width/2),BASE-height,spec.width,height);
      ctx.font=LABEL_FONT;ctx.fillStyle='#343440';ctx.fillText(row.label,SLOTS[i],320);
    });
    return c;
  }
  // Read colored bar spans and printed words directly from the delivered image.
  // This verifier receives no table, row order, palette, or precomputed answer.
  let wordTemplates;
  function verifyImage(canvas, question) {
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    const {data}=ctx.getImageData(0,0,W,H);
    const isInk=(x,y)=>{
      const i=(y*W+x)*4;
      return Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2])>36;
    };
    let spans=[],start=-1;
    for(let x=0;x<=W;x++){
      const inside=x<W && isInk(x,BASE-3);
      if(inside && start<0) start=x;
      if(!inside && start>=0){if(x-start>15)spans.push([start,x]);start=-1}
    }
    if(spans.length!==4)throw Error('The pixel check could not isolate four bars.');
    if(!wordTemplates){
      wordTemplates=REGIONS.map(label=>{
        const ref=surface(100,32),g=ref.getContext('2d',{willReadFrequently:true});
        g.fillStyle='#fff';g.fillRect(0,0,100,32);g.font=LABEL_FONT;g.textAlign='center';
        g.fillStyle='#343440';g.fillText(label,50,24);return g.getImageData(0,0,100,32).data;
      });
    }
    const readings=spans.map(([left,right])=>{
      const x=left+Math.floor((right-left)/2);
      let y=BASE-1;while(y>=0 && isInk(x,y))y--;
      const observed=ctx.getImageData(x-50,296,100,32).data;
      const errors=wordTemplates.map(t=>{
        let difference=0;for(let i=0;i<t.length;i+=4)difference+=Math.abs(observed[i]-t[i]);return difference;
      });
      const best=Math.min(...errors);
      if(best>1000||errors.filter(v=>v===best).length!==1)throw Error('A printed region label could not be verified.');
      return {label:REGIONS[errors.indexOf(best)],pixels:BASE-1-y,bounds:[left,y+1,right-left,BASE-1-y]};
    });
    if(new Set(readings.map(x=>x.label)).size!==4)throw Error('The rendered labels are ambiguous.');
    readings.sort((a,b)=>question==='highest'?b.pixels-a.pixels:a.pixels-b.pixels);
    if(readings[0].pixels===readings[1].pixels)throw Error('The rendered answer is tied.');
    return {answer:readings[0].label,readings};
  }
  function create(seed,question='highest',difficulty='standard'){
    const prompt='Which region recorded the '+question+' sales?';
    const tasks=specs(seed,question,difficulty).map((spec,i)=>{
      const canvas=render(spec);
      const values=spec.rows.map(row=>row.value);
      const target=(question==='highest'?Math.max:Math.min)(...values);
      const key=spec.rows.find(row=>row.value===target).label;
      const check=verifyImage(canvas,question);
      if(check.answer!==key)throw Error('The source table and rendered image disagree.');
      return {variant:VARIANTS[i],canvas,key,check,rows:spec.rows};
    });
    if(tasks[0].key!==tasks[1].key || tasks[0].key===tasks[2].key)throw Error('Invalid challenge pair.');
    return {seed,question,difficulty,prompt,tasks};
  }
  // Separate baseline: classify a low-resolution chart against seeded training
  // examples. It sees only pixels and the question, never generator metadata.
  let training;
  function train(){
    const rand=random(348019);
    const ranks=Array.from({length:1800},()=>{
      const values=Array.from({length:4},()=>rand());
      return {values,highest:values.indexOf(Math.max(...values)),lowest:values.indexOf(Math.min(...values))};
    });
    const glyphs=REGIONS.map(label=>{
      const c=surface(100,40),g=c.getContext('2d');g.fillStyle='white';g.fillRect(0,0,100,40);
      g.textAlign='center';g.font=LABEL_FONT;g.fillStyle='#343440';g.fillText(label,50,25);
      return wordFeatures(c,0,0);
    });
    return {ranks,glyphs};
  }
  function wordFeatures(c,x,y){
    const tiny=surface(20,8),g=tiny.getContext('2d');
    g.drawImage(c,x,y,100,40,0,0,20,8);
    const d=g.getImageData(0,0,20,8).data;
    return Array.from({length:160},(_,i)=>d[i*4]/255);
  }
  function localAnswer(image,prompt){
    training??=train();
    const highest=prompt.includes('highest');
    const values=SLOTS.map(x=>{
      const scaled=surface(1,24),g=scaled.getContext('2d');
      g.drawImage(image,x-5,TOP,10,BASE-TOP,0,0,1,24);
      const d=g.getImageData(0,0,1,24).data;let n=0;
      for(let i=0;i<d.length;i+=4)if(Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2])>27)n++;
      return n/24;
    });
    const examples=training.ranks.map(e=>({label:highest?e.highest:e.lowest,
      distance:e.values.reduce((sum,v,i)=>sum+(v-values[i])**2,0)})).sort((a,b)=>a.distance-b.distance).slice(0,9);
    const votes=[0,0,0,0];
    examples.forEach(e=>votes[e.label]+=1/(e.distance+.001));
    const slot=votes.indexOf(Math.max(...votes));
    const observed=wordFeatures(image,SLOTS[slot]-50,295);
    const errors=training.glyphs.map(t=>t.reduce((sum,v,i)=>sum+(v-observed[i])**2,0));
    return REGIONS[errors.indexOf(Math.min(...errors))];
  }
  function nextSeed(seed,index){return (seed+Math.imul(index,2654435761))>>>0;}
  function score(items){
    const correct=(item,i)=>item.answers[i].answer===item.keys[i];
    const hits=items.map(item=>[0,1,2].map(i=>correct(item,i)));
    return {
      correct:hits.flat().filter(Boolean).length,total:items.length*3,
      style:hits.filter(h=>h[0]&&h[1]).length,change:hits.filter(h=>h[0]&&h[2]).length,pairs:items.length
    };
  }
  window.VTF={random,shuffled,surface,create,specs,render,verifyImage,localAnswer,score,nextSeed,REGIONS,VARIANTS,W,H};
})();
