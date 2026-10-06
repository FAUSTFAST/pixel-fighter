// v7: authored arcade poses, fixed skeleton origins, no per-frame morphing.
(function(){
  const ROOT='assets/characters/animation-v7/',VERSION='air-style1',IDENTITY_VERSION='identity-v1',RES=2;
  const identities=Object.freeze({ryu:'blue-ninja-burgundy-scarf',mei:'magenta-kungfu-black-ponytail',tank:'human-boxer-red-gloves',volt:'yellow-jacket-cyan-scarf',kaze:'ivory-samurai-purple-ponytail',sage:'silver-hair-purple-mage'});
  const ready=new Map(),failures=[];
  const labels={idle:'待机',walk:'前进步法',backwalk:'后退步法',crouch:'下蹲',guard:'站立防御',guardLow:'蹲防',jump:'前跳',backjump:'后跳',airPunch:'空中拳',airKick:'空中脚',jab:'前手拳',heavy:'重拳 / 斩击',kick:'站立踢击',lowKick:'低踢 / 扫腿',cast:'发射动作',rise:'上升必杀',rush:'突进必杀',throw:'投技',head:'上段受击',body:'腹部受击',fall:'倒地',getup:'起身'};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  let status='loading',poseCount=0;
  function loadImage(name,revision){
    return new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error('图集加载失败：'+name));image.src=ROOT+name+'.png?v='+revision;
    });
  }
  function isolate(source,meta,scale){
    const [sx,sy,w,h]=meta.rect,mask=new Uint8Array(w*h),queue=new Int32Array(w*h);
    if(sx<0||sy<0||w<1||h<1||sx+w>source.width||sy+h>source.height)throw new Error('图帧边界越界');
    const seed=(Math.floor(meta.seed/source.width)-sy)*w+meta.seed%source.width-sx;
    if(seed<0||seed>=w*h)throw new Error('图帧起点越界');
    let read=0,write=1;queue[0]=seed;mask[seed]=1;
    const alpha=p=>source.data[((sy+Math.floor(p/w))*source.width+sx+p%w)*4+3];
    const visit=p=>{if(!mask[p]&&alpha(p)>64){mask[p]=1;queue[write++]=p;}};
    while(read<write){const p=queue[read++],x=p%w,y=Math.floor(p/w);if(x)visit(p-1);if(x<w-1)visit(p+1);if(y)visit(p-w);if(y<h-1)visit(p+w);}
    const raw=document.createElement('canvas');raw.width=w;raw.height=h;
    const context=raw.getContext('2d'),pixels=context.createImageData(w,h);
    for(let p=0;p<w*h;p++){
      const x=p%w,y=Math.floor(p/w);
      const edge=mask[p]||(x&&mask[p-1])||(x<w-1&&mask[p+1])||(y&&mask[p-w])||(y<h-1&&mask[p+w]);
      if(!edge)continue;
      const offset=((sy+y)*source.width+sx+x)*4;
      for(let c=0;c<4;c++)pixels.data[p*4+c]=source.data[offset+c];
    }
    context.putImageData(pixels,0,0);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale*RES));canvas.height=Math.max(1,Math.round(h*scale*RES));
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(raw,0,0,canvas.width,canvas.height);
    // Use the same pixel grid and integer-sized texels for both facing directions.
    // Rescaling each trimmed frame to fractional widths made mirrored edges shimmer.
    return {canvas,flash:null,x:Math.round((sx-meta.root)*scale*RES)/RES,y:Math.round((sy-meta.ground)*scale*RES)/RES,w:canvas.width/RES,h:canvas.height/RES,flip:!!meta.flip};
  }
  async function prepareCharacter(id,clips){
    const entries=Object.entries(clips);
    if(!identities[id]||entries.length!==Object.keys(labels).length)throw new Error('角色动作目录不完整：'+id);
    for(const [name,clip] of entries){
      if(!labels[name]||clip.owner!==id||clip.identity!==identities[id]||
        !clip.sheet.startsWith(id+'-')||!/^[a-z0-9-]+$/.test(clip.sheet)||
        !/^[a-f0-9]{16}$/.test(clip.revision)||!Number.isFinite(clip.scale)||clip.scale<=0||
        !Array.isArray(clip.frames)||!(['walk','backwalk'].includes(name)?[8]:[4,8]).includes(clip.frames.length))throw new Error('角色图集形象不匹配：'+id+'/'+name);
    }
    // Decode one sheet at a time per character, release full-resolution pixels after
    // baking small native-pixel sprites. Do not retain dozens of huge source canvases.
    for(const sheetName of new Set(Object.values(clips).map(c=>c.sheet))){
      const revision=entries.find(([,clip])=>clip.sheet===sheetName)[1].revision;
      const image=await loadImage(sheetName,revision),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
      const source={width:image.width,height:image.height,data:ctx.getImageData(0,0,image.width,image.height).data};
      const cache=new Map();
      for(const clip of Object.values(clips).filter(c=>c.sheet===sheetName)){
        clip.sprites=clip.frames.map(meta=>{
          const key=meta.seed+':'+clip.scale+':'+meta.root+':'+meta.ground;
          if(!cache.has(key))cache.set(key,isolate(source,meta,clip.scale));return cache.get(key);
        });
      }
      canvas.width=canvas.height=1;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    ready.set(id,clips);poseCount+=Object.values(clips).reduce((n,c)=>n+c.frames.length,0);
  }
  function attackIndex(count,p,clip){
    // Cast / throw sheets have anticipation in slot 1 and release in slot 2.
    if(count<=4&&['cast','throw'].includes(clip))return p<.16?0:p<.32?1:p<=.58?2:p<.8?1:3;
    if(count<=4)return p<.32?0:p<=.58?1:p<.8?2:3;
    if(p<.32)return Math.min(2,Math.floor(p/.32*3));
    if(p<=.58)return p<.49?3:4;
    return Math.min(count-1,5+Math.floor((p-.59)/.41*(count-5)));
  }
  function selection(def,anim){
    const clips=ready.get(def.id);if(!clips)return null;
    const m=anim.attack,pose=m?.pose||anim.name,p=clamp(anim.phase??anim.frame/59);
    let clip='idle',index=0;
    const sequence=(name,progress=p)=>{
      if(!clips[name])return false;
      clip=name;index=Math.min(clips[name].frames.length-1,Math.floor(clamp(progress)*clips[name].frames.length));
      return true;
    };
    if(m){
      if(m.grab&&clips.throw)clip='throw';
      else if(m.counter&&p<.32)clip='guard';
      else if((m.launch||pose==='uppercut')&&clips.rise)clip='rise';
      else if(anim.airborne&&clips[/Kick|sweep/i.test(anim.name)?'airKick':'airPunch'])clip=/Kick|sweep/i.test(anim.name)?'airKick':'airPunch';
      else if(m.projectile&&clips.cast)clip='cast';
      else if((m.noHit||pose==='rush')&&clips.rush)clip='rush';
      else if((m.level==='low'||pose==='lowKick')&&clips.lowKick)clip='lowKick';
      else if(/Kick/.test(pose)&&clips.kick)clip='kick';
      else clip=pose==='light'||anim.name==='light'?'jab':'heavy';
      if(!clips[clip])return null;
      index=attackIndex(clips[clip].frames.length,p,clip);
      if(m.hitFrames?.length>1&&p>=.32&&p<=.58){
        // Each multi-hit burst has a distinct extension / retraction, keeping the
        // game hit timestamps unchanged. Super moves share the matching new base art.
        index=anim.reach<.92?(clips[clip].frames.length>4?2:0):(clips[clip].frames.length>4?3:1);
      }
    }else if(anim.name==='walk'||anim.name==='backwalk')sequence(anim.name)||sequence('walk');
    else if(anim.name==='jump'||anim.name==='backjump'){
      clip=anim.name;
      // Slot 0 is grounded anticipation. Extend on ascent, tuck at the apex,
      // then open the legs on descent; never hold a floor crouch in midair.
      index=p<.36?1:p<.68?2:3;
    }
    else if(['airPunch','airKick'].includes(anim.name))sequence(anim.name);
    else if(anim.name==='crouch'){clip=clips.crouch?'crouch':clips.idle?'idle':'walk';index=clips[clip]?Math.min(clips[clip].frames.length-1,Math.floor((anim.elapsed??12)/3)):0;}
    else if(anim.name==='block'||anim.name==='parry'){clip=anim.crouching&&clips.guardLow?'guardLow':clips.guard?'guard':clips.idle?'idle':'walk';index=Math.min(1,(clips[clip]?.frames.length||1)-1);}
    else if(anim.name==='landing'){clip='crouch';index=p<.35?1:0;}
    else if(anim.name==='getup')sequence('getup')||sequence('idle')||sequence('walk');
    else if(anim.name==='ko'){sequence('fall')||sequence('idle')||sequence('walk');if(anim.grounded===false)index=Math.min(index,2);}
    else if(anim.name.startsWith('react:')){
      const type=anim.name.slice(6);
      if(type==='guard'||type==='guardLow'){clip=clips[type]?type:clips.guard?'guard':clips.idle?'idle':'walk';index=p<.65?Math.min(2,clips[clip].frames.length-1):Math.min(1,clips[clip].frames.length-1);}
      else if(['launch','air','throw','sweep','knockdown'].includes(type)){
        sequence('fall')||sequence('idle')||sequence('walk');if(anim.grounded===false)index=Math.min(index,2);if(anim.grabbed)index=0;
      }else sequence(type==='body'||type==='low'?'body':'head')||sequence('idle')||sequence('walk');
    }else {
      const breath=[0,0,1,2,3,3,2,1];index=breath[Math.min(7,Math.floor(p*8))];
    }
    const data=clips[clip];
    if(!data||data.owner!==def.id||data.identity!==identities[def.id]||!data.frames?.length||!data.sprites?.length)return null;
    index=clamp(index,0,data.frames.length-1);
    return {clip,index,count:data.frames.length,label:labels[clip],data,meta:data.frames[index],sprite:data.sprites[index]};
  }
  function draw(ctx,def,anim,flash=false){
    const selected=selection(def,anim);if(!selected)return false;
    const f=selected.sprite;
    if(flash&&!f.flash){const c=document.createElement('canvas');c.width=f.canvas.width;c.height=f.canvas.height;const paint=c.getContext('2d');paint.drawImage(f.canvas,0,0);paint.globalCompositeOperation='source-atop';paint.fillStyle='rgba(255,242,223,0.24)';paint.fillRect(0,0,c.width,c.height);f.flash=c;}
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(f.flip)ctx.scale(-1,1);
    ctx.drawImage(flash?f.flash:f.canvas,f.flip?-f.x-f.w:f.x,f.y,f.w,f.h);ctx.restore();return true;
  }
  const loading=fetch(ROOT+'manifest.json?v='+VERSION).then(r=>{if(!r.ok)throw new Error('动作目录加载失败');return r.json();}).then(async manifest=>{
    if(manifest.identityVersion!==IDENTITY_VERSION||Object.keys(identities).some(id=>!manifest.characters?.[id]))throw new Error('角色形象目录版本不匹配');
    await Promise.all(Object.entries(manifest.characters).map(([id,clips])=>prepareCharacter(id,clips).catch(error=>{failures.push(id);console.warn(error);})));status=ready.size===6?'ready':'fallback';
  }).catch(error=>{status='fallback';console.warn(error);});
  window.DrawnAnimation={draw,selection,loading,version:7,identityVersion:IDENTITY_VERSION,has:id=>ready.has(id),get status(){return status;},get poseCount(){return poseCount;},get failures(){return [...failures];},get charactersReady(){return ready.size;}};
})();
