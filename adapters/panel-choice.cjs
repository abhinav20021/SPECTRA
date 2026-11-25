'use strict';
// Closed-choice inference for the fixed answer vocabulary of the panel suite.
const {httpProblem}=require('../framework/adapters.cjs');
exports.id='panel-choice-llama.cpp-v1';
exports.predict=async ({png,question},{signal,model})=>{
  const base=new URL(process.env.PANEL_LLAMA_URL||'http://127.0.0.1:8080/v1');
  if(!['localhost','127.0.0.1','[::1]'].includes(base.hostname)||base.protocol!=='http:')
    throw Error('PANEL_LLAMA_URL must point to a local llama.cpp instance.');
  const count=question.includes('six sockets in J2');
  if(!count&&!question.endsWith('Answer Yes or No.'))throw Error('Expected a panel inspection question.');
  const allowed=count?['0','1','2','3','4','5','6']:['Yes','No'];
  const grammar='root ::= " "? ('+allowed.map(JSON.stringify).join(' | ')+')';
  const url=base.href.replace(/\/$/,'')+'/chat/completions';
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},signal,
    body:JSON.stringify({model,temperature:0,seed:17,max_tokens:8,grammar,messages:[{role:'user',content:[
      {type:'image_url',image_url:{url:'data:image/png;base64,'+png.toString('base64')}},
      {type:'text',text:question}
    ]}]})});
  if(!r.ok){await r.body?.cancel();throw httpProblem(r.status,r.headers.get('retry-after'));}
  const message=(await r.json()).choices?.[0]?.message?.content;
  if(typeof message!=='string')throw Error('Missing llama.cpp prediction.');
  return message;
};
