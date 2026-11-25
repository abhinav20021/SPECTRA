(() => {
  'use strict';
  const {define,range,int,pick,shuffle,names,boardBox,result,tileDraw,tileRead,matrix}=window.ReasoningLab;
  const family='quantities';
  const membership=(p,c)=>Math.hypot(p.x-c,p.y-199)<112;
  const region=(a,b,q)=>q==='both'?a&&b:q==='left'?a&&!b:b&&!a;
  const vennQueries=['left','right','both'].map(k=>({k,text:'Sum the values of the counters '+({left:'in the left circle only',right:'in the right circle only',both:'in the overlap of the two circles'}[k])+'. Each blue pip is worth one.'}));
  define('venn',{family,name:'Venn region sums',title:'Inventory overlap',queries:vennQueries,
    make(r,q,h){const coins=[];for(const k of shuffle(r,range(70))){const x=215+k%10*43,y=87+Math.floor(k/10)*37;
      const dist=[332,477].map(c=>Math.hypot(x-c,y-199));
      if(Math.min(...dist.map(n=>Math.abs(n-112)))<19||Math.min(...dist)>93)continue;
      coins.push({x,y,value:int(r,1,h?4:3)});if(coins.length===(h?18:12))break;
    }return {coins};},
    draw(g,s){for(const [i,x] of [332,477].entries()){g.g.strokeStyle=g.p[i+2];g.g.lineWidth=3;g.g.beginPath();g.g.arc(x,199,112,0,2*Math.PI);g.g.stroke();}
      for(const c of s.coins){g.dot(c.x,c.y,15,g.theme.counter);for(let i=0;i<c.value;i++)g.dot(c.x+(i%2)*9-4,c.y+Math.floor(i/2)*9-4,3,1);}
      g.text('Left set',263,338,15,'center');g.text('Right set',536,338,15,'center');},
    solve:(s,q)=>String(s.coins.filter(c=>region(membership(c,332),membership(c,477),q.k)).reduce((a,c)=>a+c.value,0)),
    read(v,q){const circles=[2,3].map(i=>{const b=v.blobs(boardBox,i).map(o=>o.bounds);const l=Math.min(...b.map(a=>a[0])),r=Math.max(...b.map(a=>a[0]+a[2]-1));return {x:(l+r)/2,r:(r-l)/2};});
      const dots=v.blobs(boardBox,1),included=dots.filter(p=>{const hit=circles.map(c=>Math.hypot(p.x-c.x,p.y-199)<c.r);return region(hit[0],hit[1],q.k);});return result(included.length,included.length+' unit pips inside the requested region; '+dots.length+' pips across both sets.');}});
  define('composite',{family,name:'Composite shape counting',title:'Partitioned floor plan',queries:[{square:false,text:'How many axis-aligned rectangles of every size appear in the outlined grid? Include squares.'},{square:true,text:'How many squares of every size can be traced along the blue grid lines?'}],
    make(r,q,h){return {rows:int(r,2,h?5:4),cols:int(r,3,h?7:5),step:h?38:45};},
    draw(g,s){const x=410-Math.floor(s.cols*s.step/2),y=195-Math.floor(s.rows*s.step/2);
      for(let i=0;i<=s.cols;i++)g.line(x+i*s.step,y,x+i*s.step,y+s.rows*s.step,1,3);
      for(let j=0;j<=s.rows;j++)g.line(x,y+j*s.step,x+s.cols*s.step,y+j*s.step,1,3);},
    solve(s,q){if(!q.square)return String(s.rows*(s.rows+1)*s.cols*(s.cols+1)/4);return String(range(Math.min(s.rows,s.cols)).reduce((a,k)=>a+(s.rows-k)*(s.cols-k),0));},
    read(v,q){const b=v.blobs(boardBox,1)[0].bounds;
      const find=(len,pred)=>range(len).filter((i)=>pred(i)&&(i===0||!pred(i-1)));
      const xs=find(b[2],i=>v.at(b[0]+i,b[1]+8)===1),ys=find(b[3],i=>v.at(b[0]+8,b[1]+i)===1);
      let count=0;for(let a=0;a<xs.length;a++)for(let b=a+1;b<xs.length;b++)for(let c=0;c<ys.length;c++)for(let d=c+1;d<ys.length;d++)if(!q.square||Math.abs((xs[b]-xs[a])-(ys[d]-ys[c]))<=2)count++;
      return result(count,xs.length+' vertical lines and '+ys.length+' horizontal lines. Enumerated '+count+' matching outlines.');}});
  const grid={x:181,y:78,s:34,w:13,h:7};
  function routes(r,h){const ys=shuffle(r,[1,2,3,4,5,6]).slice(0,int(r,1,h?4:3)).sort((a,b)=>a-b),xs=shuffle(r,range(12).map(i=>i+1)).slice(0,int(r,1,h?4:3)).sort((a,b)=>a-b);
    const blue=[],orange=[];ys.forEach((v,i)=>{blue.push([i%2?13:0,v],[i%2?0:13,v]);});xs.forEach((v,i)=>{orange.push([v,i%2?7:0],[v,i%2?0:7]);});return {blue,orange};}
  function mesh(g){for(let x=0;x<=grid.w;x++)g.line(grid.x+x*34,grid.y,grid.x+x*34,grid.y+238,g.theme.routeGrid,1);
    for(let y=0;y<=grid.h;y++)g.line(grid.x,grid.y+y*34,grid.x+442,grid.y+y*34,g.theme.routeGrid,1);}
  function drawRoutes(g,s){mesh(g);[s.blue,s.orange].forEach((path,i)=>path.slice(1).forEach(([x,y],j)=>{const [a,b]=path[j];g.line(grid.x+a*34,grid.y+b*34,grid.x+x*34,grid.y+y*34,i+1,5);}));}
  function vertices(path){const set=new Set();for(let i=1;i<path.length;i++){let [x,y]=path[i-1];const [X,Y]=path[i],dx=Math.sign(X-x),dy=Math.sign(Y-y);set.add(x+','+y);
    while(x!==X||y!==Y){x+=dx;y+=dy;set.add(x+','+y);}
  }return set;}
  define('linelength',{family,name:'Tiled line length',title:'Warehouse aisle routes',queries:['blue','orange'].map(color=>({color,text:'How long is the '+color+' route in unit tile edges? Count each grid step along its path.'})),
    make:(r,q,h)=>routes(r,h),draw:drawRoutes,
    solve:(s,q)=>String(vertices(s[q.color]).size-1),
    read(v,q){const ink=q.color==='blue'?1:2;let n=0;
      for(let y=0;y<=7;y++)for(let x=0;x<=13;x++){if(x<13&&v.at(grid.x+(x+.5)*34,grid.y+y*34)===ink)n++;if(y<7&&v.at(grid.x+x*34,grid.y+(y+.5)*34)===ink)n++;}
      return result(n,n+' occupied unit-edge midpoints measured on the '+q.color+' route.');}});
  define('intersections',{family,name:'Tiled line intersections',title:'Crossing routes',queries:[{text:'How many distinct grid vertices are shared by the blue and orange routes?'},{text:'How many crossing points would a walker encounter between the blue and orange paths? Count each point once.'}],
    make:(r,q,h)=>routes(r,h),draw:drawRoutes,
    solve(s){const b=vertices(s.orange);return String([...vertices(s.blue)].filter(k=>b.has(k)).length);},
    read(v){let n=0;for(let y=0;y<=7;y++)for(let x=0;x<=13;x++){const px=grid.x+x*34,py=grid.y+y*34;
      const near=[v.at(px-8,py),v.at(px+8,py),v.at(px,py-8),v.at(px,py+8)];if(near.includes(1)&&near.includes(2))n++;}
      return result(n,n+' vertices have incident strokes in both colors.');}});
  const bays=['North','South','East','West'];
  const recount=[0,1,2].flatMap(ink=>bays.map(bay=>({ink,bay,text:'Audit the '+bay+' warehouse bay. '+(ink?'How many bins that were '+names[ink]+' in the before plan changed color?':'How many bin locations changed color between the before and after plans?')})));
  define('recolor',{family,name:'Tiled board recoloring',title:'Warehouse bin audit',queries:recount,
    make(r,q,h){const n=h?6:5,a=matrix(n,()=>int(r,1,3)),b=a.map(row=>[...row]);for(const k of shuffle(r,range(n*n)).slice(0,int(r,2,h?12:7))){const y=Math.floor(k/n),x=k%n;b[y][x]=1+(a[y][x]-1+int(r,1,2))%3;}if(q.ink&&!a.slice((q.first||1)-1,q.last||n).some(row=>row.includes(q.ink))){a[(q.first||1)-1][0]=q.ink;b[(q.first||1)-1][0]=q.ink;}return {a,b};},
    edit(r,s,q){const a=s.a,b=s.b.map(row=>[...row]),n=a.length;
      const eligible=range(n*n).filter(i=>{const y=Math.floor(i/n);return y+1>=(q.first||1)&&y+1<=(q.last||n)&&(!q.ink||a[y][i%n]===q.ink);});
      const i=pick(r,eligible),y=Math.floor(i/n),x=i%n;
      b[y][x]=b[y][x]===a[y][x]?1+a[y][x]%3:a[y][x];return {a,b};},
    draw(g,s,q){const n=s.a.length;[s.a,s.b].forEach((m,i)=>{g.text(q.bay+' bay  /  '+(i?'After':'Before'),223+i*374,85,17,'center');const pitch=Math.floor(211/n);tileDraw(g,m,119+i*374,107,pitch);for(let y=0;y<n;y++)g.text(y+1,105+i*374,112+(y+.5)*pitch,13,'center');});},
    solve:(s,q)=>String(s.a.flat().filter((v,i)=>Math.floor(i/s.a.length)+1>=(q.first||1)&&Math.floor(i/s.a.length)+1<=(q.last||s.a.length)&&v!==s.b.flat()[i]&&(!q.ink||q.ink===v)).length),
    read(v,q){let n=0;for(let x=119;x<332;x++)if(v.at(x,113)&&!v.at(x-1,113))n++;if(n!==5&&n!==6)throw Error('Unreadable warehouse grid.');
      const s=Math.floor(211/n),a=tileRead(v,119,107,s,n),b=tileRead(v,493,107,s,n);let changed=0,all=0;
      for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(a[y][x]!==b[y][x]){all++;if(y+1>=(q.first||1)&&y+1<=(q.last||n)&&(!q.ink||a[y][x]===q.ink))changed++;}
      return result(changed,n+' × '+n+' bins compared at their cell centers. '+all+' color changes, '+changed+' matching the question.');}});
})();
