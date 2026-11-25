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
      return {source:spec.rows,chartStyle:{palette:spec.palette,width:spec.width}};
    }
    if(family==='counting'||family==='spatial'){
      return {source:S.objectScenes(family,rng,task,difficulty==='close')[0]};
    }
    const d=Lab.catalog[task],query=Lab.sampleQuery(d,rng,difficulty);
    return {source:{scene:d.make(rng,query,difficulty==='close'),query}};
  }

  function renderImage({family,task,source,chartStyle}){
    if(family==='charts')return E.render({rows:source,...chartStyle});
    if(family==='counting'||family==='spatial')return S.paint(source,family,0);
    const d=Lab.catalog[task],g=L.painter(0,d.title,'LIVE');
    d.draw(g,source.scene,source.query);
    return g.c;
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

  function buildQuestions({family,task,source},rng){
    const src={rows:source,prompt:source.query?.text||S.promptFor(family,task)};
    const alt=alternate(family,task,src,rng);
    const answer=S.sourceAnswer(family,task,source);
    const allowed=id=>Lab.catalog[id]?.choices||S.families[family].choices;
    const direct=directQuestion(src,answer,allowed(task),rng);
    direct.parameters=source.query||{task};
    if(alt){
      const swap=directQuestion(alt,S.sourceAnswer(family,alt.task,alt.rows),allowed(alt.task),rng);
      return {direct,swap:{...swap,kind:'new target',parameters:alt.rows.query||{task:alt.task}}};
    }
    const claim=rng()<0.5?answer:L.pick(rng,direct.choices.filter(v=>v!==answer));
    return {direct,swap:{kind:'claim check',baseQuestion:src.prompt,claim,choices:['Yes','No'],parameters:direct.parameters,
      text:'A reviewer answered “'+claim+'” to this question.\n“'+src.prompt+'”\nDoes the image support that answer? Reply Yes or No.'}};
  }

  async function verify({family,task,source,questions,image},decode){
    const canvas=await decode(image),verified={},pixels={};
    try{
      for(const [id,q] of Object.entries(questions)){
        const target=source.query?task:q.parameters.task;
        const rows=source.query?{scene:source.scene,query:q.parameters}:source;
        const sourceAnswer=S.sourceAnswer(family,target,rows);
        const reading=family==='charts'?E.verifyImage(canvas,target):S.pixelCheck(canvas,family,target,q.baseQuestion);
        if(reading.answer!==sourceAnswer)throw Error('The source and the delivered PNG disagree.');
        pixels[id]=reading;
        const reference=project(q,sourceAnswer),pixelAnswer=project(q,reading.answer);
        if(!q.choices.includes(reference)||pixelAnswer!==reference)throw Error('The question could not be verified.');
        verified[id]={...q,reference,pixelAnswer};
      }
      return {questions:verified,pixels};
    }finally{canvas.width=1;}
  }

  const generationStages=['scene','image','question','verify'];
  async function advance(id,state,io){
    const started=performance.now();
    let patch;
    switch(id){
      case 'scene': patch=sample(state.family,state.task,state.difficulty,entropy()); break;
      case 'image': {
        const canvas=renderImage(state);
        try{patch={image:await io.encode(canvas)};}finally{canvas.width=1;}
        break;
      }
      case 'question': patch={questions:buildQuestions(state,entropy())}; break;
      case 'verify': patch=await verify(state,io.decode); break;
      default: throw Error('Unknown generation stage.');
    }
    return {patch,ms:Math.round((performance.now()-started)*10)/10};
  }

  async function generate(family,task,difficulty,io,notify=()=>{}){
    const state={family,task,difficulty,times:{}};
    for(const id of generationStages){
      notify(id,'running');
      const {patch,ms}=await advance(id,state,io);
      Object.assign(state,patch);
      state.times[id]=ms;notify(id,'done',ms);
    }
    return state;
  }

  async function baseline(image,probe,decode){
    const c=await decode(image);
    try{
      const baseAnswer=S.predict(c,probe.baseQuestion);
      return {raw:project(probe,baseAnswer)||'Unresolved',baseAnswer};
    }finally{c.width=1;}
  }
  window.LiveLab={generate,advance,baseline,normalize};
})();
