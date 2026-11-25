(() => {
  'use strict';
  const {define,range,int,pick,shuffle,names,letters,boardBox,result,same}=window.ReasoningLab;
  const family='geometry', six=['A B C','A C B','B A C','B C A','C A B','C B A'];
  const sortLabels=(values,labels,desc)=>values.map((v,i)=>[v,labels[i]]).sort((a,b)=>(a[0]-b[0])*(desc?-1:1)).map(p=>p[1]).join(' ');
  const ext=marks=>{if(!marks.length)throw Error('Reference outline missing.');const bs=marks.map(m=>m.bounds);return [Math.min(...bs.map(b=>b[0])),Math.min(...bs.map(b=>b[1])),Math.max(...bs.map(b=>b[0]+b[2]-1)),Math.max(...bs.map(b=>b[1]+b[3]-1))];};
  const rel=(p,b,k)=>k==='inside'?p.x>b[0]&&p.x<b[2]&&p.y>b[1]&&p.y<b[3]:k==='outside'?!rel(p,b,'inside'):k==='above'?p.y<b[1]:p.y>b[3];
  const posQueries=[1,2].flatMap(ink=>['inside','outside','above','below'].map(side=>({ink,side,text:'How many '+(ink===1?'blue circles':'orange squares')+' are '+side+' the teal reference frame?'})));
  define('positional',{family,name:'Positional count',title:'Survey markers',queries:posQueries,
    make(r,q,h){const pts=shuffle(r,range(32)).slice(0,h?24:16).map(k=>({x:74+(k%8)*96+int(r,-3,3),y:80+Math.floor(k/8)*73+int(r,-3,3),ink:int(r,1,2)}));return {b:[242,113,571,256],pts};},
    draw(g,s){g.frame(s.b[0],s.b[1],s.b[2]-s.b[0],s.b[3]-s.b[1],3,3);for(const p of s.pts)p.ink===1?g.dot(p.x,p.y,8,1):g.rect(p.x-7,p.y-7,14,14,2);},
    solve:(s,q)=>String(s.pts.filter(p=>p.ink===q.ink&&rel(p,s.b,q.side)).length),
    read(v,q){const b=ext(v.blobs(boardBox,3)),m=v.blobs(boardBox,q.ink);const n=m.filter(p=>rel(p,b,q.side)).length;return result(n,m.length+' target marks located; '+n+' satisfy the selected relation.');}});
  const order=(field,unit)=>[false,true].map(desc=>({field,desc,text:'Order A, B and C by '+field+', '+(desc?'largest to smallest':'smallest to largest')+'. Give three letters separated by spaces.'}));
  function shapeMeasure(f,field){
    if(field==='angle measure')return f.angle;
    if(field==='line length')return f.length;
    if(field==='area')return f.kind==='ellipse'?Math.PI*f.w*f.h/4:f.kind==='triangle'?f.w*f.h/2:f.w*f.h;
    if(f.kind==='triangle')return f.w+2*Math.hypot(f.w/2,f.h);
    if(f.kind==='ellipse'){const a=f.w/2,b=f.h/2;return Math.PI*(3*(a+b)-Math.sqrt((3*a+b)*(a+3*b)));}
    return 2*(f.w+f.h);
  }
  define('sorting',{family,name:'Shape sorting',title:'Geometry samples',choices:six,queries:[...order('area'),...order('perimeter'),...order('angle measure'),...order('line length')],
    make(r,q,h){for(let i=0;i<120;i++){const levels=shuffle(r,h?[0,1,2]:[0,2,4]),kinds=shuffle(r,['rectangle','ellipse','triangle']);
      const figs=levels.map((n,j)=>({kind:kinds[j],w:40+n*14+int(r,0,10),h:36+n*10+int(r,0,11),angle:20+n*14+int(r,0,4),length:49+n*12+int(r,0,3)}));
      const sorted=figs.map(f=>shapeMeasure(f,q.field)).sort((a,b)=>a-b),gap=q.field==='area'?180:q.field==='perimeter'?10:3;
      if(sorted[1]-sorted[0]>gap&&sorted[2]-sorted[1]>gap)return {figs};}throw Error('Could not separate shape measures.');},
    draw(g,s,q){s.figs.forEach((f,i)=>{const x=135+i*270,y=209;if(q.field==='angle measure'){const px=x-44,py=y+28,a=f.angle*Math.PI/180;g.line(px,py,px+93,py,1,4);g.line(px,py,px+93*Math.cos(a),py-93*Math.sin(a),1,4);g.dot(px,py,5,3);g.dot(px+93*Math.cos(a),py-93*Math.sin(a),5,2);}else if(q.field==='line length'){const a=f.angle*Math.PI/180,dx=f.length*Math.cos(a)/2,dy=f.length*Math.sin(a)/2;g.line(x-dx,y+dy,x+dx,y-dy,1,4);g.dot(x-dx,y+dy,5,3);g.dot(x+dx,y-dy,5,2);}
      else if(f.kind==='ellipse'){g.g.fillStyle=g.p[1];g.g.beginPath();g.g.ellipse(x,y,f.w/2,f.h/2,0,0,2*Math.PI);g.g.fill();}
      else if(f.kind==='triangle')g.poly([[x,y-f.h/2],[x+f.w/2,y+f.h/2],[x-f.w/2,y+f.h/2]],1);
      else g.rect(x-Math.floor(f.w/2),y-Math.floor(f.h/2),f.w,f.h,1);g.text(letters[i],x,300,21,'center');});},
    solve:(s,q)=>sortLabels(s.figs.map(f=>shapeMeasure(f,q.field)),letters,q.desc),
    read(v,q){const values=range(3).map(i=>{const roi=[20+i*270,70,230,197];
      if(q.field==='angle measure'||q.field==='line length'){const a=v.blobs(roi,3)[0],b=v.blobs(roi,2)[0];return q.field==='line length'?Math.round(Math.hypot(b.x-a.x,b.y-a.y)):Math.round(Math.atan2(a.y-b.y,b.x-a.x)*180/Math.PI);}
      const m=v.blobs(roi,1)[0];const w=m.bounds[2],h=m.bounds[3],fill=m.area/(w*h);return q.field==='area'?m.area:Math.round(shapeMeasure({w,h,kind:fill>.90?'rectangle':fill>.65?'ellipse':'triangle'},'perimeter'));});return result(sortLabels(values,letters,q.desc),'A / B / C measured '+q.field+': '+values.join(' / ')+'.');}});
  const stackQueries=[1,2,3].map(ink=>({ink,text:'How many violet markers lie strictly inside the '+names[ink]+' sheet, including its covered portion? The three sheets are equal rectangles.'}));
  function contained(p,b,rad){return p.x-rad>b[0]&&p.x+rad<b[2]&&p.y-rad>b[1]&&p.y+rad<b[3];}
  define('stack',{family,name:'Stack count',title:'Overlay registration sheets',queries:stackQueries,
    make(r,q,h){const x=int(r,135,165),y=int(r,76,85);const boxes=range(3).map(i=>[x+i*76,y+i*44,x+i*76+315,y+i*44+150]);const pts=[];
      for(const k of shuffle(r,range(15*8))){const p={x:78+(k%15)*47,y:73+Math.floor(k/15)*36};if(boxes.some(b=>Math.min(Math.abs(p.x-b[0]),Math.abs(p.x-b[2]),Math.abs(p.y-b[1]),Math.abs(p.y-b[3]))<9))continue;pts.push(p);if(pts.length===(h?28:18))break;}return {boxes,pts};},
    draw(g,s){s.boxes.forEach(([x,y,X,Y],i)=>{g.rect(x,y,X-x,Y-y,['#e3edf8','#f8e9dd','#e0f1ea'][i]);g.frame(x,y,X-x,Y-y,i+1,3);});s.pts.forEach(p=>g.dot(p.x,p.y,5,4));},
    solve:(s,q)=>String(s.pts.filter(p=>contained(p,s.boxes[q.ink-1],5)).length),
    read(v,q){const b=ext(v.blobs(boardBox,q.ink)),m=v.blobs(boardBox,4);const n=m.filter(p=>{const [x,y,w,h]=p.bounds;return x>b[0]&&x+w-1<b[2]&&y>b[1]&&y+h-1<b[3];}).length;return result(n,'Visible sheet extrema '+b.join(', ')+' enclose '+n+' complete marker outlines.');}});
  const colorLabels=['Blue','Orange','Teal'];
  const colorOrders=six.map(s=>s.split(' ').map(l=>colorLabels[letters.indexOf(l)]).join(' '));
  function shares(r,h){return shuffle(r,h?[4,5,6]:[2,4,7]);}
  function pie(g,values,x,y,r){
    let a=-Math.PI/2;const total=values.reduce((s,n)=>s+n,0);
    values.forEach((v,i)=>{const b=a+2*Math.PI*v/total;g.g.fillStyle=g.p[i+1];g.g.beginPath();g.g.moveTo(x,y);g.g.arc(x,y,r,a,b);g.g.closePath();g.g.fill();a=b;});
  }
  function angular(v,x,y,r){const n=[0,0,0];for(let i=0;i<720;i++){const a=i*Math.PI/360,k=v.at(x+r*Math.cos(a),y+r*Math.sin(a));if(k>=1&&k<=3)n[k-1]++;}return n;}
  define('pie',{family,name:'Pie chart ordering',title:'Budget allocation',choices:colorOrders,queries:[false,true].map(desc=>({desc,text:'Order the blue, orange and teal budget slices from '+(desc?'largest to smallest':'smallest to largest')+'. Give the three color names in order.'})),
    make:(r,q,h)=>({values:shares(r,h),angle:int(r,0,5)}),
    draw(g,s){g.g.save();g.g.translate(355,201);g.g.rotate(s.angle*Math.PI/6);pie(g,s.values,0,0,123);g.g.restore();colorLabels.forEach((v,i)=>{g.rect(560,139+43*i,19,19,i+1);g.text(v,593,156+i*43,18);});},
    solve:(s,q)=>sortLabels(s.values,colorLabels,q.desc),
    read(v,q){const m=angular(v,355,201,91);return result(sortLabels(m,colorLabels,q.desc),'Angular samples by color: '+m.join(', ')+'.');}});
  define('chartmatch',{family,name:'Chart comparison',title:'Allocation cross-check',choices:letters.slice(0,3),queries:[{text:'Which bar chart, A, B or C, has the same color proportions as the pie?'},{text:'Which candidate reproduces the pie allocation when its bar heights are normalized? Answer A, B or C.'}],
    make(r,q,h){const a=shares(r,h),bars=shuffle(r,[a,[a[1],a[2],a[0]],[a[2],a[0],a[1]]]);return {a,bars,scale:int(r,17,20)};},
    draw(g,s){pie(g,s.a,147,193,98);g.text('Reference',147,318,16,'center');s.bars.forEach((a,i)=>{const x=303+i*166;g.line(x,266,x+119,266,'#a9b2c2');a.forEach((v,j)=>g.rect(x+8+j*36,266-v*s.scale,26,v*s.scale,j+1));g.text(letters[i],x+60,303,20,'center');});},
    solve:s=>letters[s.bars.findIndex(b=>same(b,s.a))],
    read(v){const a=angular(v,147,193,74);const normalize=ns=>ns.map(n=>n/ns.reduce((sum,x)=>sum+x,0));const ref=normalize(a);
      const distances=range(3).map(i=>{const vals=range(3).map(j=>v.blobs([301+i*166,61,121,205],j+1)[0].bounds[3]);return normalize(vals).reduce((s,n,j)=>s+Math.abs(n-ref[j]),0);});
      const k=distances.indexOf(Math.min(...distances));return result(letters[k],'Normalized height errors for A / B / C: '+distances.map(n=>n.toFixed(3)).join(' / ')+'.');}});
})();
