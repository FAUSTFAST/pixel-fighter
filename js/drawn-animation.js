// Newly drawn v6 poses. The original PNGs are kept intact; alpha components isolate
// neighbouring sprites whose rectangular bounds overlap (raised arms / long hair).
(function(){
  const ROOT='assets/characters/animation-v6/';
  const sheets=new Map(),ready=new Map();
  const labels={walk:'前进',backwalk:'后退',strike:'出拳 / 斩击',kick:'踢腿',rise:'上升攻击',recoil:'受击'};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  let status='loading';
  function loadSheet(name){
    if(sheets.has(name))return sheets.get(name);
    const promise=new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>{
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
        resolve({width:image.width,data:ctx.getImageData(0,0,image.width,image.height).data,frames:new Map()});
      };image.onerror=()=>reject(new Error('动画图集加载失败：'+name));image.src=ROOT+name+'.png?v=drawn6-1';
    });sheets.set(name,promise);return promise;
  }
  function extract(sheet,meta){
    if(sheet.frames.has(meta.seed))return sheet.frames.get(meta.seed);
    const [sx,sy,w,h]=meta.rect,mask=new Uint8Array(w*h),queue=new Int32Array(w*h);
    const seed=(Math.floor(meta.seed/sheet.width)-sy)*w+meta.seed%sheet.width-sx;
    let read=0,write=1;queue[0]=seed;mask[seed]=1;
    const alpha=p=>sheet.data[((sy+Math.floor(p/w))*sheet.width+sx+p%w)*4+3];
    const visit=p=>{if(!mask[p]&&alpha(p)>64){mask[p]=1;queue[write++]=p;}};
    while(read<write){const p=queue[read++],x=p%w,y=Math.floor(p/w);if(x)visit(p-1);if(x<w-1)visit(p+1);if(y)visit(p-w);if(y<h-1)visit(p+w);}
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d'),out=ctx.createImageData(w,h);
    for(let p=0;p<w*h;p++){
      const x=p%w,y=Math.floor(p/w);
      // Keep translucent edge pixels adjacent to the selected body only.
      const edge=mask[p]||(x&&mask[p-1])||(x<w-1&&mask[p+1])||(y&&mask[p-w])||(y<h-1&&mask[p+w]);
      if(!edge)continue;
      const source=((sy+y)*sheet.width+sx+x)*4;
      for(let c=0;c<4;c++)out.data[p*4+c]=sheet.data[source+c];
    }
    ctx.putImageData(out,0,0);const frame={canvas,flash:null};sheet.frames.set(meta.seed,frame);return frame;
  }
  function flashFrame(frame){
    if(!frame.flash){
      const c=document.createElement('canvas');c.width=frame.canvas.width;c.height=frame.canvas.height;
      const ctx=c.getContext('2d');ctx.drawImage(frame.canvas,0,0);ctx.globalCompositeOperation='source-atop';ctx.fillStyle='#fff2df';ctx.fillRect(0,0,c.width,c.height);frame.flash=c;
    }return frame.flash;
  }
  function selection(def,anim){
    const clips=ready.get(def.id);if(!clips)return null;
    const m=anim.attack,pose=m?.pose||anim.name,p=clamp(anim.phase??anim.frame/59);
    let clip=null,index=0;
    if(anim.name==='walk'||anim.name==='backwalk'){
      clip=anim.name;index=Math.min(clips[clip].frames.length-1,Math.floor(p*clips[clip].frames.length));
    }else if(anim.name==='idle'){
      clip='walk';index=0;
    }else if(anim.name.startsWith('react:')&&['head','body','heavy','slash','electric','burn'].includes(anim.name.slice(6))){
      clip='recoil';
      const order=anim.name==='react:body'?[1,4,4,5,5,6,7,7]:[1,2,3,3,4,5,6,7];
      index=order[Math.min(7,Math.floor(p*8))];
    }else if(m&&!m.grab&&!m.counter&&!m.projectile&&!m.noHit){
      if(pose==='uppercut'||m.launch)clip='rise';
      else if(['lightKick','heavyKick'].includes(pose))clip='kick';
      else if(['light','heavy','rush'].includes(pose)||m.category==='normal'&&m.level!=='low')clip='strike';
      if(clip){
        // Contact pose begins on the first active tick; recovery has its own drawings.
        if(p<.32)index=Math.min(2,Math.floor(p/.32*3));
        else if(p<=.58)index=3;
        else index=Math.min(7,4+Math.floor((p-.59)/.41*4));
        if(m.hitFrames?.length>1&&p>=.32&&p<=.58)index=anim.reach<.92?2:3;
      }
    }
    if(!clip||!clips[clip])return null;
    const data=clips[clip];index=clamp(index,0,data.frames.length-1);
    return {clip,index,count:data.frames.length,label:labels[clip],data,meta:data.frames[index],sprite:data.sprites[index]};
  }
  function draw(ctx,def,anim,flash){
    const choice=selection(def,anim);if(!choice)return false;
    const {data,meta,sprite}=choice,[x,y,w,h]=meta.rect,s=data.scale;
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(flash?flashFrame(sprite):sprite.canvas,(x-meta.root)*s,(y-meta.ground)*s,w*s,h*s);
    return true;
  }
  const loading=fetch(ROOT+'manifest.json?v=drawn6-1').then(r=>{if(!r.ok)throw new Error('动画目录加载失败');return r.json();}).then(async manifest=>{
    await Promise.all(Object.entries(manifest.characters).map(async([id,clips])=>{
      await Promise.all(Object.values(clips).map(async clip=>{const sheet=await loadSheet(clip.sheet);clip.sprites=clip.frames.map(f=>extract(sheet,f));}));
      ready.set(id,clips);
    }));status='ready';
  }).catch(error=>{status='fallback';console.warn(error);});
  window.DrawnAnimation={draw,selection,loading,get status(){return status;},get charactersReady(){return ready.size;}};
})();
