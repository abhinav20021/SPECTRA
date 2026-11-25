(() => {
  'use strict';
  const empty=()=>({images:0,questions:0,responses:0,correct:0});
  const signal='vtf-activity-updated';
  let opening;
  function database(){
    if(!opening)opening=new Promise((resolve,reject)=>{
      const req=indexedDB.open('vtf-activity',1);
      req.onupgradeneeded=()=>req.result.createObjectStore('counters');
      req.onerror=()=>reject(req.error);
      req.onsuccess=()=>resolve(req.result);
    });
    return opening;
  }
  async function read(){
    const db=await database();
    return new Promise((resolve,reject)=>{
      const req=db.transaction('counters').objectStore('counters').get('totals');
      req.onsuccess=()=>resolve(req.result||empty());
      req.onerror=()=>reject(req.error);
    });
  }
  async function add(fields){
    // One read/write transaction serializes increments from simultaneous runs or tabs.
    try{
      const db=await database();
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('counters','readwrite'),store=tx.objectStore('counters');
        const req=store.get('totals');
        req.onsuccess=()=>{
          const totals=req.result||empty();
          for(const [key,value] of Object.entries(fields))totals[key]+=value;
          store.put(totals,'totals');
        };
        tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(tx.error);
      });
      window.dispatchEvent(new Event(signal));
      try{localStorage.setItem(signal,crypto.randomUUID());}catch{/* Refresh on focus if storage events are unavailable. */}
    }catch{/* Aggregate storage is optional for generating and evaluating a case. */}
  }
  window.FactoryActivity={
    read,signal,
    generated:(images,questions)=>add({images,questions}),
    scored:(responses,correct)=>add({responses,correct})
  };
})();
