(() => {
  'use strict';
  const E=window.VTF, catalog={}, letters=['A','B','C','D'];
  const palettes=[['#ffffff','#387aca','#d57538','#299a85','#9160be','#dbaa36'],['#f5f6fb','#588dd8','#e58b4e','#3aa991','#a078cc','#d5a334']];
  const names=['','blue','orange','teal','violet','gold'];
  const range=n=>Array.from({length:n},(_,i)=>i);
  const int=(r,a,b)=>a+Math.floor(r()*(b-a+1));
  const pick=(r,a)=>a[int(r,0,a.length-1)];
  const shuffle=(r,a)=>E.shuffled(a,r);
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const mapped=new Map();
  for(const p of palettes)p.forEach((v,i)=>mapped.set(parseInt(v.slice(1),16),i));
  function painter(style,title,serial) {
    const c=E.surface(E.W,E.H),g=c.getContext('2d',{willReadFrequently:true}),p=palettes[style];
    const color=v=>typeof v==='number'?p[v]:v;
    const rect=(x,y,w,h,v)=>{g.fillStyle=color(v);g.fillRect(x,y,w,h);};
    const line=(x,y,X,Y,v,w=2)=>{g.beginPath();g.strokeStyle=color(v);g.lineWidth=w;g.moveTo(x,y);g.lineTo(X,Y);g.stroke();};
    const dot=(x,y,r,v)=>{g.fillStyle=color(v);g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();};
    const text=(v,x,y,size=15,align='left')=>{g.fillStyle='#394052';g.font='600 '+size+'px '+(window.VTF_RENDER_FONT||'Arial, sans-serif');g.textAlign=align;g.fillText(String(v),x,y);g.textAlign='left';};
    const frame=(x,y,w,h,col='#c5ccda',weight=2)=>{g.strokeStyle=color(col);g.lineWidth=weight;g.strokeRect(x,y,w,h);};
    const poly=(pts,v)=>{g.fillStyle=color(v);g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();};
    rect(0,0,820,356,0);text(title,27,32,21);text('FRAME '+serial,791,31,14,'right');line(26,49,794,49,'#d7dbe4',1);
    return {c,g,p,rect,line,dot,text,frame,poly};
  }
  function pixels(canvas) {
    const w=canvas.width,h=canvas.height,data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
    const at=(x,y)=>{const p=4*(Math.round(y)*w+Math.round(x));return mapped.get((data[p]<<16)|(data[p+1]<<8)|data[p+2])??0;};
    function blobs(box,ink) {
      const [ox,oy,W,H]=box, mask=new Uint8Array(W*H),q=new Int32Array(W*H),out=[];
      for(let y=0;y<H;y++)for(let x=0;x<W;x++)mask[y*W+x]=+(at(ox+x,oy+y)===ink);
      for(let i=0;i<mask.length;i++)if(mask[i]){
        let head=0,tail=1,sx=0,sy=0,l=W,r=0,t=H,b=0;q[0]=i;mask[i]=0;
        while(head<tail){
          const k=q[head++],x=k%W,y=Math.floor(k/W);sx+=x;sy+=y;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
          for(const n of [x?k-1:-1,x+1<W?k+1:-1,y?k-W:-1,y+1<H?k+W:-1])if(n>=0&&mask[n]){q[tail++]=n;mask[n]=0;}
        }
        if(tail>=5)out.push({x:ox+sx/tail,y:oy+sy/tail,area:tail,bounds:[ox+l,oy+t,r-l+1,b-t+1]});
      }
      return out;
    }
    return {at,blobs};
  }
  const result=(answer,detail)=>({answer:String(answer),readings:[{detail:String(detail)}]});
  const define=(id,def)=>{catalog[id]={id,...def};};
  const matrix=(n,fn)=>range(n).map(y=>range(n).map(x=>fn(x,y)));
  function tileDraw(g,m,x,y,s){
    const h=m.length,w=m[0].length;
    g.rect(x,y,w*s,h*s,'#e5e9f0');
    m.forEach((row,j)=>row.forEach((v,i)=>g.rect(x+i*s+1,y+j*s+1,s-2,s-2,v||0)));
  }
  const tileRead=(v,x,y,s,n,cols=n)=>range(n).map(j=>range(cols).map(i=>v.at(x+(i+.5)*s,y+(j+.5)*s)));
  function transform(m,op){
    const n=m.length;
    switch(op){
      case 'Clockwise':return matrix(n,(x,y)=>m[n-1-x][y]);
      case 'Counterclockwise':return matrix(n,(x,y)=>m[x][n-1-y]);
      case 'Half turn':return matrix(n,(x,y)=>m[n-1-y][n-1-x]);
      case 'Vertical mirror':return m.map(row=>[...row].reverse());
      case 'Horizontal mirror':return [...m].reverse().map(row=>[...row]);
      default:return m.map(row=>[...row]);
    }
  }
  const ops=['Clockwise','Counterclockwise','Half turn','Vertical mirror','Horizontal mirror'];
  function motif(r,n=3) {
    for(let i=0;i<60;i++){
      const m=matrix(n,()=>pick(r,[0,0,0,1,2,3]));
      const forms=['Identity',...ops].map(o=>JSON.stringify(transform(m,o)));
      if(new Set(forms).size===forms.length)return m;
    }
    return [[1,2,0],[0,3,0],[0,0,0]];
  }
  function uniqueIndex(arr,pred){
    const found=arr.map((v,i)=>pred(v,i)?i:-1).filter(i=>i>=0);
    if(found.length!==1)throw Error('Ambiguous visible option.');
    return letters[found[0]];
  }
  const boardBox=[22,57,776,285];
  window.ReasoningLab={E,catalog,define,palettes,names,letters,range,int,pick,shuffle,same,painter,pixels,result,matrix,tileDraw,tileRead,transform,ops,motif,uniqueIndex,boardBox};
})();
