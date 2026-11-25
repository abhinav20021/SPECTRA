(() => {
  'use strict';
  const E=window.VTF, S=window.VisualSkills, L=window.ReasoningLab, Lab=window.StudioLab;

  function entropy() {
    const words=new Uint32Array(64);
    let pos=words.length;
    return () => {
      if(pos===words.length){crypto.getRandomValues(words);pos=0;}
      return words[pos++]/4294967296;
    };
  }

  function sample(family,task,difficulty,rng){
    if(!Object.hasOwn(S.families,family)||!Object.hasOwn(S.families[family].types,task))throw Error('Unknown task.');
    if(family==='charts'){
      const spec=E.chartSpecs(rng,task,difficulty)[0];
      return {rows:spec.rows,prompt:E.chartPrompt(task),draw:()=>E.render(spec)};
    }
    if(family==='counting'||family==='spatial'){
      const rows=S.objectScenes(family,rng,task,difficulty==='close')[0];
      return {rows,prompt:S.promptFor(family,task),draw:()=>S.paint(rows,family,0)};
    }
    const d=Lab.catalog[task],query=Lab.sampleQuery(d,rng,difficulty);
    const scene=d.make(rng,query,difficulty==='close');
    return {rows:{scene,query},prompt:query.text,draw(){
      const g=L.painter(0,d.title,'LIVE');
      d.draw(g,scene,query);
      return g.c;
    }};
  }

  function alternate(family,task,src,rng){
    if(!Lab.catalog[task]){
      const other=L.pick(rng,Object.keys(S.families[family].types).filter(k=>k!==task));
      return {task:other,rows:src.rows,prompt:S.promptFor(family,other)};
    }
    const d=Lab.catalog[task],{query,scene}=src.rows;
    let candidates;
    if(task==='recolor'){
      const n=scene.a.length;
      candidates=d.queries.filter(q=>q.bay===query.bay).map(q=>{
        const first=L.int(rng,1,n-1),last=L.int(rng,first+1,n);
        return {...q,first,last,text:q.text+' Inspect rows '+first+' through '+last+' from the top.'};
      });
    }else if(['positional','stack','pie','venn','linelength','transforminfer'].includes(task)){
      candidates=d.queries;
    }else if(task==='sorting'){
      candidates=d.queries.filter(q=>q.field===query.field);
    }else return null;
    const options=candidates.filter(q=>q.text!==query.text);
    if(!options.length)return null;
    const next=L.pick(rng,options);
    return {task,rows:{scene,query:next},prompt:next.text};
  }

  function shortlist(known,answer,rng){
    const pool=known||Array.from({length:9},(_,i)=>String(Math.max(0,Number(answer)-4)+i));
    const others=E.shuffled(pool.filter(v=>v!==answer),rng).slice(0,2);
    return E.shuffled([answer,...others],rng);
  }
  function directQuestion(src,answer,choices,rng){
    const options=shortlist(choices,answer,rng);
    return {text:src.prompt+'\nChoose one: '+options.join(' / ')+'.',choices:options,baseQuestion:src.prompt,kind:'direct'};
  }
  function project(question,baseAnswer){
    if(baseAnswer==null||baseAnswer==='Unresolved')return null;
    return Object.hasOwn(question,'claim')?(baseAnswer===question.claim?'Yes':'No'):baseAnswer;
  }
  function normalize(raw,choices){
    const clean=s=>s.trim().replace(/^["'*`\s]+|["'*`.!\s]+$/g,'').toLowerCase().replace(/[\s,>→]+/g,' ').trim();
    return choices.find(v=>clean(raw)===clean(v))||null;
  }

  async function generate(family,task,difficulty,io,notify=()=>{}){
    const times={},rng=entropy();
    async function stage(id,work){
      notify(id,'running');const start=performance.now();
      const value=await work();times[id]=Math.round((performance.now()-start)*10)/10;
      notify(id,'done',times[id]);return value;
    }
    const src=await stage('scene',()=>sample(family,task,difficulty,rng));
    const image=await stage('image',()=>{
      const canvas=src.draw();
      try{return io.encode(canvas);}finally{canvas.width=1;}
    });
    const alt=alternate(family,task,src,rng);
    const sourceAnswer=S.sourceAnswer(family,task,src.rows);
    const altAnswer=alt?S.sourceAnswer(family,alt.task,alt.rows):sourceAnswer;
    const allowed=id=>Lab.catalog[id]?.choices||S.families[family].choices;
    const probes=await stage('question',()=>{
      const direct=directQuestion(src,sourceAnswer,allowed(task),rng);
      if(alt)return {direct,swap:{...directQuestion(alt,altAnswer,allowed(alt.task),rng),kind:'new target'}};
      const claim=rng()<0.5?sourceAnswer:L.pick(rng,direct.choices.filter(v=>v!==sourceAnswer));
      const swap={kind:'claim check',baseQuestion:src.prompt,claim,choices:['Yes','No'],
        text:'A reviewer answered “'+claim+'” to this question.\n“'+src.prompt+'”\nDoes the image support that answer? Reply Yes or No.'};
      return {direct,swap};
    });
    const pixels=await stage('verify',async()=>{
      const c=await io.decode(image);
      const read=(id,prompt)=>family==='charts'?E.verifyImage(c,id):S.pixelCheck(c,family,id,prompt);
      try{
        const direct=read(task,src.prompt),swap=alt?read(alt.task,alt.prompt):direct;
        if(direct.answer!==sourceAnswer||swap.answer!==altAnswer)throw Error('The source and the delivered PNG disagree.');
        return {direct,swap};
      }finally{c.width=1;}
    });
    for(const [id,q] of Object.entries(probes)){
      const target=id==='swap'&&alt?alt:src;
      q.parameters=target.rows.query||{task:target.task||task};
      q.reference=project(q,id==='direct'?sourceAnswer:altAnswer);
      q.pixelAnswer=project(q,pixels[id].answer);
      if(!q.choices.includes(q.reference)||q.pixelAnswer!==q.reference)throw Error('The question could not be verified.');
    }
    return {family,task,difficulty,image,source:src.rows,questions:probes,pixels,times};
  }

  async function baseline(image,probe,decode){
    const c=await decode(image);
    try{
      const baseAnswer=S.predict(c,probe.baseQuestion);
      return {raw:project(probe,baseAnswer)||'Unresolved',baseAnswer};
    }finally{c.width=1;}
  }
  window.LiveLab={generate,baseline,normalize};
})();
