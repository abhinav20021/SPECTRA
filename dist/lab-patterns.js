(() => {
  'use strict';
  const {define,range,int,pick,shuffle,same,result,matrix,tileDraw,tileRead,transform,motif,ops,letters,uniqueIndex}=window.ReasoningLab;
  const family='patterns',classes=['Vertical','Horizontal','Both','Neither'];
  function mirrorClass(m){const v=same(m,transform(m,'Vertical mirror')),h=same(m,transform(m,'Horizontal mirror'));return v?(h?'Both':'Vertical'):(h?'Horizontal':'Neither');}
  define('mirror',{family,name:'Mirror identification',title:'Textile repeat sample',choices:classes,queries:[{text:'Which mirror axes preserve the colored tile? Answer Vertical, Horizontal, Both or Neither.'},{text:'Classify the color pattern by left–right and top–bottom reflection. Answer Vertical, Horizontal, Both or Neither.'}],
    make(r){const desired=pick(r,classes),n=6;
      for(let i=0;i<80;i++){const src=matrix(n,()=>pick(r,[0,0,1,2,3]));const m=matrix(n,(x,y)=>src[desired==='Both'||desired==='Horizontal'?Math.min(y,n-1-y):y][desired==='Both'||desired==='Vertical'?Math.min(x,n-1-x):x]);
        if(mirrorClass(m)===desired)return {m};}throw Error('Could not construct requested mirror class.');},
    draw(g,s){tileDraw(g,s.m,287,70,40);},solve:s=>mirrorClass(s.m),
    read(v){const m=tileRead(v,287,70,40,6);let lr=0,tb=0;for(let y=0;y<6;y++)for(let x=0;x<6;x++){lr+=m[y][x]!==m[y][5-x];tb+=m[y][x]!==m[5-y][x];}
      return result(lr?(tb?'Neither':'Horizontal'):(tb?'Vertical':'Both'),lr+' left–right mismatches; '+tb+' top–bottom mismatches.');}});
  const fillQ=['upper left','upper right','lower left','lower right'].map((name,missing)=>({missing,text:'Which tile A–D completes the '+name+' position? Across each seam, the colored cells must be mirror images.'}));
  const panel=(i)=>[86+(i%2)*119,74+Math.floor(i/2)*121];
  const option=(i)=>[452+(i%2)*151,76+Math.floor(i/2)*124];
  define('fill',{family,name:'Symmetry fill',title:'Mirrored tile assembly',choices:letters,queries:fillQ,
    make(r,q){const base=motif(r);const square=['Identity','Vertical mirror','Horizontal mirror','Half turn'].map(op=>transform(base,op));
      const other=shuffle(r,['Identity',...ops].map(op=>transform(base,op)).filter(m=>!same(m,square[q.missing]))).slice(0,3);
      return {square,choices:shuffle(r,[square[q.missing],...other])};},
    draw(g,s,q){s.square.forEach((m,i)=>{const [x,y]=panel(i);if(i===q.missing){g.frame(x,y,93,93);g.text('?',x+46,y+61,32,'center');}else tileDraw(g,m,x,y,31);});
      s.choices.forEach((m,i)=>{const [x,y]=option(i);tileDraw(g,m,x,y,26);g.text(letters[i],x+39,y+100,16,'center');});},
    solve:(s,q)=>uniqueIndex(s.choices,c=>same(c,s.square[q.missing])),
    read(v,q){const buddy=q.missing^1;const horizontal=tileRead(v,...panel(buddy),31,3).map(row=>[...row].reverse());
      const vertical=[...tileRead(v,...panel(q.missing^2),31,3)].reverse();if(!same(horizontal,vertical))throw Error('Mirror seams disagree.');
      return result(uniqueIndex(range(4).map(i=>tileRead(v,...option(i),26,3)),m=>same(m,horizontal)),'Reflections from both visible neighbors agree on all nine cell colors.');}});
  const odd=classes=>{const count=classes.filter(Boolean).length;if(count!==1&&count!==3)throw Error('No unique symmetry outlier.');return letters[classes.indexOf(count===1)];};
  function arrange(r){const isHalf=!!int(r,0,1),out=int(r,0,3);return {modes:range(4).map(i=>i===out?!isHalf:isHalf),
    stamps:range(4).map(()=>{const pts=shuffle(r,[1,2,3]);const m=matrix(5,()=>0);m[1][1]=pts[0];m[1][2]=pts[1];m[3][1]=pts[2];return transform(m,pick(r,['Identity',...ops]));}),phase:range(4).map(()=>int(r,0,1))};}
  function dimensions(wall,i){return wall?{x:84+399*(i%2),y:76+141*Math.floor(i/2),nx:8,ny:3,step:7}:{x:108,y:75+68*i,nx:12,ny:1,step:10};}
  function paintRepeat(g,s,wall){for(let i=0;i<4;i++){const {x,y,nx,ny,step}=dimensions(wall,i),width=5*nx*step,height=5*ny*step;
      g.frame(x-3,y-3,width+6,height+6,g.theme.rule,1);g.text(letters[i],x-26,y+height/2+6,18,'center');
      for(let ty=0;ty<ny;ty++)for(let tx=0;tx<nx;tx++){const flip=s.modes[i]&&(tx+ty+s.phase[i])%2;const m=flip?transform(s.stamps[i],'Half turn'):s.stamps[i];
        m.forEach((row,j)=>row.forEach((ink,k)=>{if(ink)g.rect(x+(tx*5+k)*step+1,y+(ty*5+j)*step+1,step-2,step-2,ink);}));}
    }}
  function readRepeat(v,wall){const matches=range(4).map(i=>{const {x,y,nx,ny,step}=dimensions(wall,i),m=tileRead(v,x,y,step,ny*5,nx*5);
      return m.every((row,j)=>row.every((ink,k)=>ink===m[m.length-1-j][row.length-1-k]));});return result(odd(matches),'Half-turn invariance of the four aligned repeats: '+matches.map(x=>x?'present':'absent').join(', ')+'.');}
  for(const [id,wall] of [['frieze',false],['wallpaper',true]]){
    const label=wall?'patch':'strip';
    define(id,{family,name:wall?'Wallpaper group oddity':'Frieze group oddity',title:wall?'Wallpaper production samples':'Frieze production samples',choices:letters,
      queries:[{text:'Which '+label+' A–D has a different symmetry group? Compare translation-only repeats with repeats that also have half-turn symmetry.'},{text:'Inspect the four periodic '+label+'s. Which has the odd symmetry class when tested for 180-degree rotation? Answer A, B, C or D.'}],
      make:arrange,draw:(g,s)=>paintRepeat(g,s,wall),solve:s=>odd(s.modes),read:v=>readRepeat(v,wall)});
  }
})();
