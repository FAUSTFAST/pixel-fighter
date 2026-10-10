// Fixed authored pixel frames: no bitmap deformation or interpolated drawings.
(function(){
  const ROOT='assets/characters/animation-v8/',VERSION='historical-contact-b3',IDENTITY_VERSION='identity-v1',RES=2;
  const RESTORED_ROOT='assets/characters/art-restoration/',HISTORICAL_COMMIT='aadfccb3140210730936c185ad2fc82647404dd1';
  const identities=Object.freeze({ryu:'blue-ninja-burgundy-scarf',mei:'magenta-kungfu-black-ponytail',tank:'human-boxer-red-gloves',volt:'yellow-jacket-cyan-scarf',kaze:'ivory-samurai-purple-ponytail',sage:'silver-hair-purple-mage'});
  const ready=new Map(),failures=[];
  const labels={idle:'待机',walk:'前进步法',backwalk:'后退步法',crouch:'下蹲',guard:'站立防御',guardLow:'蹲防',jump:'前跳',backjump:'后跳',airPunch:'空中拳',airKick:'空中脚',jab:'前手拳',heavy:'重拳 / 斩击',kick:'站立踢击',lowKick:'低踢 / 扫腿',cast:'发射动作',rise:'上升必杀',rush:'突进必杀',throw:'投技',head:'上段受击',body:'腹部受击',fall:'倒地',getup:'起身'};
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  let status='loading',poseCount=0;
  function loadImage(name,revision,sourceRoot=ROOT){
    return new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);
      image.onerror=()=>reject(new Error('图集加载失败：'+name));image.src=sourceRoot+name+'.png?v='+revision;
    });
  }
  function isolate(source,meta,scale){
    const [sx,sy,w,h]=meta.rect;
    if(sx<0||sy<0||w<1||h<1||sx+w>source.width||sy+h>source.height)throw new Error('图帧边界越界');
    const seed=(Math.floor(meta.seed/source.width)-sy)*w+meta.seed%source.width-sx;
    if(seed<0||seed>=w*h)throw new Error('图帧起点越界');
    // Authored frame rectangles contain one complete drawing. Preserve every
    // painted pixel, including hair strands / cloth tips outside the main body.
    const raw=document.createElement('canvas');raw.width=w;raw.height=h;
    const context=raw.getContext('2d'),pixels=context.createImageData(w,h);
    for(let p=0;p<w*h;p++){
      const x=p%w,y=Math.floor(p/w);
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
        !Array.isArray(clip.frames)||clip.frames.length<4||clip.frames.length>64||clip.authored!==true)
        throw new Error('固定逐帧图集形象不匹配：'+id+'/'+name);
      if(clip.sourceRoot&&(clip.sourceRoot!==RESTORED_ROOT||clip.historicalCommit!==HISTORICAL_COMMIT))
        throw new Error('历史画风参考不匹配：'+id+'/'+name);
      if(['walk','backwalk'].includes(name)&&
        (clip.cycleFrames!==16||clip.direction!==(name==='walk'?1:-1)||clip.stopVariants?.length!==16))
        throw new Error('步法 / 收脚逐帧目录不完整：'+id+'/'+name);
    }
    // Decode one sheet at a time per character, release full-resolution pixels after
    // baking small native-pixel sprites. Do not retain dozens of huge source canvases.
    for(const sheetName of new Set(Object.values(clips).map(c=>c.sheet))){
      const sourceClip=entries.find(([,clip])=>clip.sheet===sheetName)[1];
      const image=await loadImage(sheetName,sourceClip.revision,sourceClip.sourceRoot),canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
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
      // Preparation, contact and recovery are separate fixed drawings.
      if(clips[clip].timeline){
        index=clips[clip].timeline.findIndex(end=>p<end);if(index<0)index=clips[clip].frames.length-1;
      }
      if(m.hitFrames?.length>1&&p>=.32&&p<=.58){
        // Each multi-hit burst has a distinct extension / retraction, keeping the
        // game hit timestamps unchanged. Super moves share the matching new base art.
        index=clips[clip].timeline?(anim.reach<.92?3:4):anim.reach<.92?(clips[clip].frames.length>4?2:0):(clips[clip].frames.length>4?3:1);
      }

    }else if(anim.name==='dashForward'||anim.name==='dashBack'){
      // One quick, authored step cycle; then plant the feet during recovery.
      if(anim.dashPhase<1){clip=anim.name==='dashBack'?'backwalk':'walk';index=Math.min(15,Math.floor(anim.dashPhase*16));}
      else sequence('idle',0)||sequence('walk',0);
    }else if(anim.name==='walk'||anim.name==='backwalk'){
      clip=anim.name;const data=clips[clip],cycle=Math.min(15,Math.floor(p*16));
      index=anim.gaitSettle>0?data.stopVariants[cycle][Math.min(3,Math.floor(anim.gaitSettle*4))]:cycle;
    }
    else if(anim.name==='jump'||anim.name==='backjump'){
      clip=anim.name;
      // Select fixed ascent, tucked apex and descent drawings by vertical phase.
      index=Math.min(7,1+Math.floor(p*7));
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
      // Each B-version stance keeps its original fixed breath sequence.
      index=clips.idle.breath?clips.idle.breath[Math.min(7,Math.floor(p*8))]:0;
    }
    const data=clips[clip];
    if(!data||data.owner!==def.id||data.identity!==identities[def.id]||!data.frames?.length||!data.sprites?.length)return null;
    index=clamp(index,0,data.frames.length-1);
    return {clip,index,count:data.frames.length,label:labels[clip],data,meta:data.frames[index],sprite:data.sprites[index]};
  }
  function draw(ctx,def,anim,flash=false){
    const selected=selection(def,anim);if(!selected)return false;
    const f=renderSprite(selected.sprite,anim);
    if(flash&&!f.flash){const c=document.createElement('canvas');c.width=f.canvas.width;c.height=f.canvas.height;const paint=c.getContext('2d');paint.drawImage(f.canvas,0,0);paint.globalCompositeOperation='source-atop';paint.fillStyle='rgba(255,242,223,0.24)';paint.fillRect(0,0,c.width,c.height);f.flash=c;}
    ctx.save();ctx.imageSmoothingEnabled=false;
    if(f.flip)ctx.scale(-1,1);
    ctx.drawImage(flash?f.flash:f.canvas,f.flip?-f.x-f.w:f.x,f.y,f.w,f.h);ctx.restore();return true;
  }
  // Every pose is a fixed PNG drawing. Rendering and collision use that exact
  // bitmap; there is no mesh, pixel warp, morph, skeleton tween or frame blend.
  function renderSprite(source){return source;}
  function mask(sprite){
    if(!sprite.alpha)sprite.alpha=sprite.canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,sprite.canvas.width,sprite.canvas.height).data;
    return sprite.alpha;
  }
  function solid(sprite,x,y){
    if(sprite.flip)x=-x;
    const px=Math.floor((x-sprite.x)*RES),py=Math.floor((y-sprite.y)*RES);
    return px>=0&&py>=0&&px<sprite.canvas.width&&py<sprite.canvas.height&&mask(sprite)[(py*sprite.canvas.width+px)*4+3]>96;
  }
  function collisionSprite(fighter){
    const anim=fighter.sampleAnimation().animation,selected=selection(fighter.def,anim);
    return selected&&renderSprite(selected.sprite,anim);
  }
  // Measure the leading fist / foot / blade in the exact currently exposed PNG.
  // Keep body pushboxes separate: an extended arm is hittable without becoming
  // a larger obstacle to walking. Nothing here changes the drawing itself.
  function contactGeometry(move,time,air=false){
    const profile=move.physicalContact;if(!profile||!ready.has(profile.id))return null;
    const selected=selection({id:profile.id},{name:profile.kind,attack:move,phase:StrikeMotion.phase(move,time),airborne:air,reach:1});
    if(!selected)return null;
    const bands={jab:[-46,-23],heavy:[-46,-23],kick:[-42,-10],lowKick:[-14,1],airPunch:[-65,-18],airKick:[-65,-8]};
    const band=bands[selected.clip];if(!band)return null;
    const sprite=selected.sprite;
    if(!sprite.strikeBounds)sprite.strikeBounds={};
    if(!(selected.clip in sprite.strikeBounds)){
      const pixels=mask(sprite),width=sprite.canvas.width,height=sprite.canvas.height;let far=-Infinity;
      for(let y=0;y<height;y++){
        const ly=sprite.y+(y+.5)/RES;if(ly<band[0]||ly>band[1])continue;
        for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>96)far=Math.max(far,sprite.x+(x+1)/RES);
      }
      let top=Infinity,bottom=-Infinity;
      const near=Math.max(0,far-14);
      for(let y=0;y<height;y++){
        const ly=sprite.y+(y+.5)/RES;if(ly<band[0]||ly>band[1])continue;
        for(let x=0;x<width;x++)if(sprite.x+(x+1)/RES>near&&pixels[(y*width+x)*4+3]>96){top=Math.min(top,sprite.y+y/RES);bottom=Math.max(bottom,sprite.y+(y+1)/RES);}
      }
      sprite.strikeBounds[selected.clip]=Number.isFinite(top)&&far>near?{near:near*4.2,far:far*4.2,y:(top+bottom)*2.1,w:(far-near)*4.2,h:(bottom-top)*4.2,center:(near+far)*2.1,physical:true}:null;
    }
    return sprite.strikeBounds[selected.clip];
  }
  function contactPoint(attacker,defender,box){
    if(!ready.has(attacker.def.id)||!ready.has(defender.def.id))return {x:box.x+box.w/2,y:box.y+box.h/2};
    const a=collisionSprite(attacker),b=collisionSprite(defender);
    if(!a||!b)return {x:box.x+box.w/2,y:box.y+box.h/2};
    // Sample the actual opaque pixels at the striking extremity. One world
    // pixel tolerance allows the pixel grid edges to meet without a visible gap.
    for(let y=box.y;y<box.y+box.h;y++)for(let x=box.x;x<box.x+box.w;x++){
      if(!solid(a,(x-attacker.x)*attacker.facing/4.2,(y-attacker.y)/4.2))continue;
      for(const dx of [-1,0,1])if(solid(b,(x+dx-defender.x)*defender.facing/4.2,(y-defender.y)/4.2))return {x:x+dx/2,y};
    }
    return null;
  }
  function touches(attacker,defender,box){return !!contactPoint(attacker,defender,box);}
  const loading=fetch(ROOT+'manifest.json?v='+VERSION).then(r=>{if(!r.ok)throw new Error('动作目录加载失败');return r.json();}).then(async manifest=>{
    if(manifest.identityVersion!==IDENTITY_VERSION||Object.keys(identities).some(id=>!manifest.characters?.[id]))throw new Error('角色形象目录版本不匹配');
    const response=await fetch(RESTORED_ROOT+'manifest.json?v='+VERSION);
    if(!response.ok)throw new Error('历史画风目录加载失败');
    const restored=await response.json();
    if(restored.identityVersion!==IDENTITY_VERSION||restored.sourceCommit!==HISTORICAL_COMMIT||
      Object.keys(restored.characters||{}).length!==6||Object.keys(identities).some(id=>
        !restored.characters[id]||Object.keys(restored.characters[id]).sort().join(',')!==Object.keys(labels).sort().join(',')))throw new Error('历史画风恢复范围不匹配');
    for(const id of Object.keys(identities))Object.assign(manifest.characters[id],restored.characters[id]);
    await Promise.all(Object.entries(manifest.characters).map(([id,clips])=>prepareCharacter(id,clips).catch(error=>{failures.push(id);console.warn(error);})));status=ready.size===6?'ready':'fallback';
  }).catch(error=>{status='fallback';console.warn(error);});
  window.DrawnAnimation={draw,selection,touches,contactPoint,contactGeometry,collisionSprite,solid,loading,sprite:(id,clip,index)=>ready.get(id)?.[clip]?.sprites[index],version:8,identityVersion:IDENTITY_VERSION,has:id=>ready.has(id),get status(){return status;},get poseCount(){return poseCount;},get failures(){return [...failures];},get charactersReady(){return ready.size;}};
})();
