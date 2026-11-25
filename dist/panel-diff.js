(function(root){
  'use strict';
  // The two input canvases are full-size before/after images with the same finish.
  function changeBounds(before,after) {
    const w=before.width,h=before.height;
    if(w!==after.width||h!==after.height)throw Error('Image dimensions differ.');
    const a=before.getContext('2d').getImageData(0,0,w,h).data;
    const b=after.getContext('2d').getImageData(0,0,w,h).data;
    let left=w,top=h,right=-1,bottom=-1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const p=4*(y*w+x);
      if(a[p]===b[p]&&a[p+1]===b[p+1]&&a[p+2]===b[p+2]&&a[p+3]===b[p+3])continue;
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    return right<left?null:[left,top,right-left+1,bottom-top+1];
  }
  if(typeof module==='object'&&module.exports)module.exports=changeBounds;
  else root.panelChangeBounds=changeBounds;
})(typeof window==='undefined'?globalThis:window);
