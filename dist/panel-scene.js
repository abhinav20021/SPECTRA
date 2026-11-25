(() => {
  'use strict';
  const E = window.VTF;
  const yes = value => value ? 'Yes' : 'No';
  const defs = {
    seat: ['Geometric', 'Connector seating', 'Is the entire gold plug in J1 inside the cyan seating window? Answer Yes or No.', 'An overhanging plug can flag a seating issue.', 'Plug displaced'],
    pins: ['Counting', 'Populated pins', 'How many of the six sockets in J2 contain a gold pin? Answer with one number.', 'The assembly calls for four populated pins. A missing pin can leave a signal unavailable.', 'Pin population changed'],
    mirror: ['Symmetry & pattern', 'Mirrored contacts', 'In J3, are the gold contacts mirror images across the dashed vertical line? Answer Yes or No.', 'Matching counts on both sides can hide a contact in the wrong socket.', 'Contact relocated'],
    keys: ['Sequence & transformation', 'Key rotation', 'From left to right in K1, does every gold key turn exactly 90 degrees clockwise from the previous socket? Answer Yes or No.', 'A misoriented keyed socket can prevent the matching connector from fitting.', 'One key rotated'],
    net: ['Topology & graph', 'Trace continuity', 'In NET, is there a continuous gold path from S to T? Answer Yes or No.', 'An open trace can leave a test point disconnected even when both terminals are present.', 'Trace segment changed']
  };
  const stations = {seat:'J1', pins:'J2', mirror:'J3', keys:'K1', net:'NET'};
  const families = Object.fromEntries(Object.entries(defs).map(([key,d]) => ['panel_'+key,{
    name:d[0], types:{[key]:d[1]}, choices:key==='pins'?['0','1','2','3','4','5','6']:['Yes','No'],
    variants:['Original','Restyled',d[4]]
  }]));
  const netPoints = [[477,265],[524,265],[524,237],[595,237],[665,237],[719,237],[719,265],[756,265],
    [524,296],[595,296],[665,296],[719,296]];
  const netEdges = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[1,8],[8,9],[9,10],[10,11],[11,6]];
  function linked(edges) {
    const reached=new Set([0]), queue=[0];
    while(queue.length) {
      const node=queue.pop();
      for(const [a,b,gap] of edges) {
        if(gap || (a!==node && b!==node)) continue;
        const next=a===node?b:a;
        if(!reached.has(next)){ reached.add(next); queue.push(next); }
      }
    }
    return reached.has(7);
  }
  function sourceAnswer(key,s) {
    switch(key) {
      case 'seat': return yes(s.plug[0]>=s.window[0] && s.plug[1]<=s.window[1]);
      case 'pins': return String(s.pins.filter(Boolean).length);
      case 'mirror': return yes(s.left.every((on,i)=>on===s.right[i]));
      case 'keys': return yes(s.keys.slice(1).every((d,i)=>d===(s.keys[i]+1)%4));
      case 'net': return yes(linked(s.edges));
      default: throw Error('Unknown inspection station.');
    }
  }
  const nominal = (key,answer) => answer === (key==='pins'?'4':'Yes');
  const copy = s => JSON.parse(JSON.stringify(s));
  function scenes(seed,key,difficulty) {
    const rng=E.random(seed);
    const index=n=>Math.floor(rng()*n);
    const hard=difficulty==='close';
    const shuffled = n=>E.shuffled(Array.from({length:n},(_,i)=>i),rng);
    const drift=index(9)-4, left=75+drift, right=218+drift, width=54+index(14), flip=index(2);
    const healthyX=flip?right-width-9-index(12):left+9+index(12);
    const shift=hard?3+index(3):15+index(9);
    const badX=flip?right+shift-width:left-shift;
    const pinOrder=shuffled(6), mask=shuffled(6), populated=2+index(4), phase=index(4);
    const goodLane=index(2), upper=2+index(3), lower=8+index(3);
    const goodEdge=goodLane?upper:lower, other=goodLane?lower:upper;
    const base={window:[left,right],plug:[healthyX,healthyX+width],
      pins:Array.from({length:6},(_,i)=>pinOrder.slice(0,4).includes(i)),
      left:Array.from({length:6},(_,i)=>mask.slice(0,populated).includes(i)),
      keys:Array.from({length:4},(_,i)=>(phase+i)%4),
      edges:netEdges.map(([a,b],i)=>[a,b,i===other]),gap:hard?4+index(3):14+index(7),
      radius:hard?5:8, offset:index(7)-3, finish:index(2)};
    base.right=[...base.left];
    const fault=copy(base);
    switch(key) {
      case 'seat': fault.plug=[badX,badX+width]; break;
      case 'pins': fault.pins[pinOrder[0]]=false; break;
      case 'mirror': fault.right[mask[0]]=false; fault.right[mask[populated]]=true; break;
      case 'keys': {const k=index(4); fault.keys[k]=(fault.keys[k]+1+index(3))%4; break;}
      case 'net': fault.edges[goodEdge][2]=true; break;
    }
    const swapped=index(2);
    const first=swapped?fault:base, edited=swapped?base:fault;
    return [first,{...copy(first),finish:1-first.finish},edited];
  }
  const zone={seat:[34,98,224,91],pins:[283,100,240,90],mirror:[553,100,228,90],keys:[33,231,382,82],net:[456,220,322,94]};
  function paint(s) {
    const c=E.surface(E.W,E.H),g=c.getContext('2d',{willReadFrequently:true});
    const dark=s.finish===0;
    const bg=dark?'#122b31':'#233042', panel=dark?'#1a373c':'#303f4d';
    const edge=dark?'#516b6e':'#62717f',gold=dark?'#ffc565':'#ffae45',cyan=dark?'#69d9df':'#7be2ee';
    const fill=(col,x,y,w,h)=>{g.fillStyle=col; g.fillRect(x,y,w,h);};
    const circle=(col,x,y,r)=>{g.fillStyle=col;g.beginPath();g.arc(x,y,r,0,2*Math.PI);g.fill();};
    function line(color,x1,y1,x2,y2,n=2){g.strokeStyle=color;g.lineWidth=n;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();}
    function label(value,x,y,size=14,color='#dfe9eb',bold=600){g.fillStyle=color;g.font=bold+' '+size+'px '+(window.VTF_RENDER_FONT||'Arial, sans-serif');g.fillText(value,x,y);}
    function plate(x,y,w,h,head){fill(panel,x,y,w,h);g.strokeStyle=edge;g.lineWidth=1;g.strokeRect(x+.5,y+.5,w-1,h-1);label(head,x+13,y+23);}
    fill(bg,0,0,820,356);
    label('PATCH PANEL',26,37,24); label('ASSEMBLY INSPECTION   /   TOP VIEW',465,34,14,'#becdd1');
    [14,806].forEach(x=>[13,343].forEach(y=>{circle(edge,x,y,5);line(bg,x-2,y,x+2,y,1);}));
    plate(26,63,241,134,'J1   /   Seating window');plate(278,63,257,134,'J2   /   Pin bank');
    plate(546,63,248,134,'J3   /   Paired contacts');plate(26,207,405,118,'K1   /   Keyed sockets');
    plate(442,207,352,118,'');label('NET   /   Trace continuity',454,229);
    const [a,b]=s.window;const [p,q]=s.plug;
    g.strokeStyle=cyan;g.lineWidth=2;g.strokeRect(a,112,b-a,66);
    fill('#132128',p-2,126,q-p+4,36);fill(gold,p,128,q-p,32);
    for(let x=p+9;x<q-3;x+=9)line('#a07740',x,132,x,154,1);
    for(let i=0;i<6;i++){const x=310+i*38;circle(edge,x,145+s.offset,14);circle(bg,x,145+s.offset,11);if(s.pins[i])circle(gold,x,145+s.offset,s.radius);}
    line('#9daeb5',670,100,670,188,1);g.setLineDash([4,5]);line(panel,670,100,670,188,2);g.setLineDash([]);
    for(const side of [-1,1])for(let i=0;i<6;i++){
      const x=670+side*(28+Math.floor(i/3)*42),y=116+(i%3)*28;
      circle(edge,x,y,10);circle(bg,x,y,8);if((side<0?s.left:s.right)[i])circle(gold,x,y,s.radius);
    }
    const dir=[[0,-1],[1,0],[0,1],[-1,0]];
    s.keys.forEach((v,i)=>{const x=78+i*92,y=272;
      fill(edge,x-25,y-25,50,50);fill(bg,x-22,y-22,44,44);
      circle(edge,x,y,8);circle(panel,x,y,5);
      const [dx,dy]=dir[v];fill(gold,x+dx*17-(dx?4:7),y+dy*17-(dy?4:7),dx?8:14,dy?8:14);
      label(String(i+1),x-4,314,12,'#bbc8cd');
    });
    for(const [from,to,broken] of s.edges){
      const [x,y]=netPoints[from], [xx,yy]=netPoints[to];
      if(!broken){line(gold,x,y,xx,yy,4);continue;}
      const mid=(x+xx)/2;line(gold,x,y,mid-s.gap/2,y,4);line(gold,mid+s.gap/2,y,xx,yy,4);
    }
    for(const i of [0,1,6,7]){const [x,y]=netPoints[i];circle(gold,x,y,i===0||i===7?7:4);}
    label('S',472,290,14);label('T',752,290,14);
    return c;
  }
  window.PanelScene={defs,stations,families,zone,scenes,sourceAnswer,nominal,paint};
})();
