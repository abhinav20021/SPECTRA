'use strict';
const {fs,path,hash,ensure}=require('./core.cjs');
const {decode,skills,revisionFor}=require('./runtime.cjs');
const panelInstruction='Return only the answer: the requested label, Yes or No, or one whole number.';
const legacyInstruction='Return only the answer: a region label, shape name, or whole number, as appropriate.';

function httpProblem(status,retryAfter) {
  const error=new Error('Model endpoint returned HTTP '+status);
  error.retryable=[408,409,429,500,502,503,504].includes(status);
  error.fatal=[400,401,403,404].includes(status);
  if(retryAfter){
    const seconds=Number(retryAfter);
    const delay=Number.isFinite(seconds)?seconds*1000:Date.parse(retryAfter)-Date.now();
    if(Number.isFinite(delay))error.retryAfterMs=Math.max(0,delay);
  }
  return error;
}
async function getAdapter(options={}) {
  const kind=options.adapter||'local';
  if(kind==='local')return {
    identity:{kind,model:'local-visual-baseline',revision:revisionFor(options.families||[])},
    async predict({png,question}){
      const canvas=await decode(png);
      try{return skills.predict(canvas,question);}finally{canvas.width=1;}
    }
  };
  if(kind==='openai'){
    const instruction=options.families?.some(f=>f.startsWith('panel_'))?panelInstruction:legacyInstruction;
    const model=options.model,apiKey=process.env.OPENAI_API_KEY;
    const base=new URL(process.env.OPENAI_BASE_URL||'https://api.openai.com/v1');
    ensure(!base.username&&!base.password&&!base.search&&!base.hash,'Use a base URL without credentials, query, or fragment.');
    ensure(base.protocol==='https:'||(['localhost','127.0.0.1','[::1]'].includes(base.hostname)&&base.protocol==='http:'),'A remote endpoint requires HTTPS.');
    ensure(model,'Specify --model for the OpenAI-compatible adapter.');
    if(base.hostname==='api.openai.com')ensure(apiKey,'Set OPENAI_API_KEY for OpenAI evaluation.');
    const endpoint=base.href.replace(/\/$/,'')+'/chat/completions';
    return {
      identity:{kind,model,endpoint,revision:hash(instruction+'|chat-completions-v1')},
      async predict({png,question},{signal}){
        const headers={'Content-Type':'application/json'};
        if(apiKey)headers.Authorization='Bearer '+apiKey;
        let response;
        try{
          response=await fetch(endpoint,{method:'POST',headers,signal,redirect:'error',
            body:JSON.stringify({model,messages:[{role:'user',content:[
              {type:'text',text:question+' '+instruction},
              {type:'image_url',image_url:{url:'data:image/png;base64,'+png.toString('base64')}}
            ]}]})});
        }catch(cause){const error=new Error('Model endpoint connection failed.');error.retryable=true;throw error;}
        if(!response.ok){
          await response.body?.cancel();
          throw httpProblem(response.status,response.headers.get('retry-after'));
        }
        const data=await response.json();
        const raw=data.choices?.[0]?.message?.content;
        ensure(typeof raw==='string','Provider returned no text content.');
        return raw;
      }
    };
  }
  const file=path.resolve(kind),custom=require(file);
  ensure(typeof custom.predict==='function'&&typeof custom.id==='string'&&custom.id.trim(),'A custom adapter must export id and predict().');
  return {identity:{kind:'module',model:options.model||custom.id,id:custom.id,revision:hash(await fs.readFile(file))},
    predict:(sample,ctx)=>custom.predict(sample,{...ctx,model:options.model||custom.id})};
}
module.exports={getAdapter,httpProblem};
