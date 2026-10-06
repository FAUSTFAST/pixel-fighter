// 60 Hz 动作时间轴：优先播放新绘制姿势；旧动作直接选帧，不做网格变形。
// 动画采样与起手 / 有效 / 收招分离；轻拳不会被强制延长为一秒。
(function(){
  const COUNT=60,TAU=Math.PI*2;
  const clips=new Map(),flipped=new WeakMap();
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
  const mix=(a,b,t)=>a+(b-a)*t;
  const ref=(bank,index)=>({bank,index});
  const base=i=>ref('base',i),combat=i=>ref('combat',i),move=i=>ref('move',i);
  function key(t,art,params={}){return {t,art,lean:0,sink:0,recoil:0,reach:0,lift:0,twist:0,...params};}
  function track(name,m){
    const idle=base(0),guard=base(6),hit=base(7);
    if(name==='idle')return [key(0,idle),key(.5,base(1),{lift:.55,twist:.3}),key(1,idle)];
    if(name==='walk'||name==='backwalk')return Array.from({length:9},(_,i)=>key(i/8,move((name==='backwalk'?8:0)+i%8),{lean:name==='walk'?.7:-.45,lift:Math.sin(i/8*TAU)*.25}));
    if(name==='jump'||name==='backjump')return [key(0,move(name==='backjump'?24:16),{sink:1.5}),key(.09,move(name==='backjump'?25:17)),key(.25,move(name==='backjump'?26:18)),key(.45,move(name==='backjump'?27:19),{lean:name==='backjump'?-1:1}),key(.64,move(name==='backjump'?28:20)),key(.83,move(name==='backjump'?29:21)),key(1,move(name==='backjump'?31:23),{sink:1.1})];
    if(name==='getup')return [key(0,base(7),{lean:-3,sink:2}),key(.35,base(4),{sink:2}),key(.7,base(4)),key(1,idle)];
    if(name==='landing')return [key(0,base(4),{sink:1.5}),key(.35,base(4),{sink:2.2}),key(1,idle)];
    if(name==='crouch')return [key(0,base(4)),key(.5,base(4),{lift:.3,twist:.2}),key(1,base(4))];
    if(name==='block'||name==='parry')return [key(0,guard),key(.5,guard,{lift:.4,lean:-.4}),key(1,guard)];
    const reactions={
      head:{lean:-2.7,recoil:2,twist:-.8},body:{lean:3.8,sink:1.6,recoil:1.3},
      heavy:{lean:-5,recoil:3.5,twist:-2},low:{sink:4,lean:2,recoil:1.7},
      slash:{lean:-4,twist:3,recoil:2.2},electric:{lean:-2,twist:-1.6,recoil:2.8},
      burn:{lean:-3.6,recoil:2.3,lift:1},launch:{lean:-4,recoil:2,lift:2.2},
      air:{lean:-3.5,recoil:1.7,lift:1.5},sweep:{lean:4.5,sink:3,recoil:2},
      knockdown:{lean:-4.5,recoil:3,sink:1.3},throw:{lean:-3,twist:4,lift:2},
      guard:{lean:-1.8,recoil:1.3},guardLow:{lean:-1,sink:3,recoil:.9}
    };
    if(name.startsWith('react:')){
      const type=name.slice(6),r=reactions[type]||reactions.heavy,b=type==='guardLow'||type==='low'?base(4):type.startsWith('guard')?guard:['launch','air','throw'].includes(type)?base(5):hit;
      return [key(0,b,r),key(.13,b,{...r,recoil:r.recoil*1.2}),key(.45,b,{...r,recoil:r.recoil*.7}),key(.72,b,{lean:r.lean*.5,sink:(r.sink||0)*.6}),key(1,type.startsWith('guard')?guard:idle)];
    }
    if(name==='ko')return [key(0,hit,{lean:-3}),key(.35,hit,{lean:-6,recoil:3}),key(1,hit,{lean:-6,sink:2})];
    let prep=base(10),contact=base(11),retract=prep;
    const pose=m?.pose||name;
    if(pose==='light'){prep=base(8);contact=base(9);}
    if(pose==='special'){prep=base(12);contact=base(13);}
    if(pose==='weaponThrow'){prep=combat(12);contact=combat(15);retract=combat(14);}
    if(pose==='uppercut'){prep=base(4);contact=base(14);retract=base(5);}
    if(pose==='rush'){prep=base(10);contact=base(15);}
    if(['lightKick','heavyKick','lowKick'].includes(pose)){
      const row={lightKick:0,heavyKick:4,lowKick:8}[pose];prep=combat(row+1);contact=combat(row+2);retract=combat(row+3);
    }
    if(pose==='throw'){return [key(0,combat(12)),key(.3,combat(13),{lean:1}),key(.5,combat(14),{sink:1,twist:1}),key(.75,combat(15),{lean:2}),key(1,idle)];}
    if(m?.counter)return [key(0,guard),key(.32,guard,{sink:.5}),key(.48,contact,{reach:1,twist:1}),key(.62,contact,{reach:1}),key(1,idle)];
    const weight=m?.category==='normal'?(name==='light'?.45:1):1.25;
    return [key(0,idle),key(.15,prep,{lean:-weight*1.1,sink:weight*.45,twist:-weight}),key(.29,prep,{lean:-weight*.5}),
      key(.32,contact,{reach:1,lean:weight*.6,twist:weight}),key(.58,contact,{reach:1,lean:weight*.8,twist:weight*.7}),
      key(.7,retract,{reach:.2,lean:weight*.3,twist:-weight*.2}),key(.85,prep,{sink:.3}),key(1,idle)];
  }
  function bake(name,m){
    const id=name+':'+(m?.pose||'')+':'+(m?.category||'')+':'+!!m?.counter;
    if(clips.has(id))return clips.get(id);
    const keys=track(name,m),frames=[];
    for(let i=0;i<COUNT;i++){
      const p=i/(COUNT-1);let n=0;while(n<keys.length-2&&p>keys[n+1].t)n++;
      const a=keys[n],b=keys[n+1],u=smooth((p-a.t)/(b.t-a.t));
      const f={frame:i,a:a.art,b:b.art,mix:u};
      for(const k of ['lean','sink','recoil','reach','lift','twist'])f[k]=mix(a[k],b[k],u);
      frames.push(Object.freeze(f));
    }
    clips.set(id,frames);return frames;
  }
  function sample(def,state,progress,motion={}){
    const fighter=motion.fighter,m=motion.attack;
    let name=state,p=0;
    if(m){
      name=motion.kind||state;const t=motion.attackT||0;
      if(t<m.startup)p=.32*t/Math.max(1,m.startup);
      else if(t<m.startup+m.active){
        p=.32+.26*(t-m.startup)/Math.max(1,m.active-1);
        // 多段攻击每一击都有小幅回收再发力，避免保持伸直姿势滑行。
      }else p=.59+.41*(t-m.startup-m.active)/Math.max(1,m.recovery);
    }else if(fighter?.getupFrames>0){name='getup';p=1-fighter.getupFrames/18;}
    else if(fighter?.state==='ko'){name='ko';p=clamp(fighter.stateT/60);}
    else if(motion.reaction&&(fighter?.hitstun>0||fighter?.blockstun>0||fighter?.grabbedBy||state==='hit'||state==='ko')){
      name='react:'+motion.reaction;p=clamp((motion.attackT||0)/Math.max(1,motion.reactionDuration));
      if(!fighter?.onGround&&p>.72)p=.72;
    }else if(motion.air){name=motion.jumpDirection<0?'backjump':'jump';p=clamp((motion.vy+(def.jump||12))/(2*(def.jump||12)));}
    else if(motion.landing>0){name='landing';p=1-motion.landing;}
    else if(motion.moving&&motion.blend>.08){name=motion.gaitDirection<0?'backwalk':'walk';p=((motion.gait/TAU)%1+1)%1;}
    else {name=['crouch','block','parry'].includes(state)?state:'idle';p=((fighter?.walkPhase??progress)/TAU)%1;}
    const f={...bake(name,m)[Math.round(clamp(p)*59)],name,attack:m,phase:clamp(p)};
    if(m?.hitFrames&&motion.attackT>=m.startup&&motion.attackT<m.startup+m.active){
      const hits=m.hitFrames,last=hits.filter(t=>t<=motion.attackT).at(-1)??m.startup,next=hits.find(t=>t>motion.attackT)??m.startup+m.active;
      const wave=Math.sin(clamp((motion.attackT-last)/Math.max(1,next-last))*Math.PI);
      f.reach=1-wave*.16;f.twist+=wave*(def.id==='mei'?2.1:1);f.lean-=wave*.6;
    }
    if(name==='react:electric'){f.twist+=Math.sin(f.frame*1.9)*(1-p)*.7;}
    f.elapsed=fighter?.stateT||0;f.grounded=fighter?.onGround;f.crouching=!!fighter?.crouching;f.grabbed=!!fighter?.grabbedBy;
    f.reactionDir=motion.reactionDir||-1;f.airborne=!!(fighter&&!fighter.onGround&&m&&!m.launch);
    return f;
  }
  function frameFor(id,r){
    const bank=r.bank==='move'?window.MOVEMENT_ART:r.bank==='combat'?window.COMBAT_ART:window.CHARACTER_ART;
    const f=bank?.[id]?.frames?.[r.index];
    if(f&&id==='kaze'&&r.bank==='move'&&r.index>=24&&r.index<=30){
      if(!flipped.has(f)){
        const copy={x:f.canvas.width-f.x,y:f.y};
        for(const key of ['canvas','flash']){const canvas=document.createElement('canvas');canvas.width=f[key].width;canvas.height=f[key].height;const c=canvas.getContext('2d');c.translate(canvas.width,0);c.scale(-1,1);c.drawImage(f[key],0,0);copy[key]=canvas;}
        flipped.set(f,copy);
      }
      return flipped.get(f);
    }
    return f||window.CHARACTER_ART?.[id]?.frames?.[0];
  }
  function draw(ctx,def,anim,flash=false){
    if(!anim)return false;
    if(window.DrawnAnimation?.draw(ctx,def,anim,flash))return true;
    const selected=frameFor(def.id,anim.mix<.5?anim.a:anim.b);
    if(!selected)return false;
    const image=flash?selected.flash:selected.canvas;
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,-selected.x/2,-selected.y/2,image.width/2,image.height/2);
    return true;
  }
  function drawEffects(ctx,f){
    const m=f.attack;if(!m)return;
    const g=CombatSpacing.geometry(m,f.width),t=f.stateT,active=t>=m.startup&&t<m.startup+m.active;
    if(t>=m.startup+m.active)return;
    const color=m.effect==='drive'?'#65ffb7':f.def.fxColor;
    ctx.save();ctx.translate(f.x,f.y);ctx.scale(f.facing,1);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=3;
    if(m.effect==='pillar'){
      ctx.globalAlpha=active?.6:.22;
      ctx.fillRect(g.near,-4,g.w,4);
      if(active){
        const top=g.y-g.h/2,bottom=g.y+g.h/2;
        for(let i=0;i<9;i++){
          const x=g.near+g.w*i/9,wiggle=Math.sin(t*.9+i*2)*5;
          ctx.beginPath();ctx.moveTo(x,bottom);ctx.lineTo(x+wiggle,top+g.h*.12);ctx.lineTo(x+g.w/18,top);ctx.lineTo(x+g.w/9,bottom);ctx.fill();
        }
        ctx.globalAlpha=.9;ctx.fillStyle='#fff2bd';ctx.fillRect(g.center-5,top,10,g.h);
      }
    }else if(m.counter&&!active){ctx.globalAlpha=.5;ctx.beginPath();ctx.arc(42,-115,49,-1.2,1.2);ctx.stroke();}
    else if(active&&!m.projectile&&!m.grab&&!m.noHit){
      // 末端及扫掠弧来自同一命中框，效果的最远点等于攻击最远点。
      ctx.globalAlpha=m.category==='normal'?.36:.7;
      const left=Math.max(18,g.near),right=g.far,top=g.y-g.h/2,bottom=g.y+g.h/2;
      ctx.beginPath();
      if(m.effect==='slash'){
        ctx.moveTo(left,bottom);ctx.quadraticCurveTo(right,top-10,right,g.y);ctx.quadraticCurveTo(right-12,bottom,left,bottom);ctx.fill();
      }else if(m.effect==='electric'){
        for(let i=0;i<=10;i++){const x=mix(left,right,i/10),y=g.y+(i===10?0:Math.sin(t*1.2+i*2.8)*g.h*.28);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();
      }else if(m.category==='normal'){
        ctx.moveTo(Math.max(left,right-38),g.y+g.h*.2);ctx.quadraticCurveTo(right,g.y-g.h*.45,right,g.y);ctx.stroke();
      }else{
        ctx.moveTo(left,g.y);ctx.quadraticCurveTo(g.center,top,right,g.y);ctx.quadraticCurveTo(g.center,bottom,left,g.y);ctx.stroke();
      }
      ctx.globalAlpha=.8;ctx.fillStyle='#fff6df';ctx.fillRect(right-4,g.y-2,4,4);
    }
    if(m.travelDistance&&t>=m.travelStart&&t<m.travelEnd){
      ctx.globalAlpha=.26;
      for(let i=0;i<4;i++)ctx.fillRect(-30-i*19,-3-(i%2)*5,12+i*3,2);
    }
    if(m.projectile&&!active){ctx.globalAlpha=.25;ctx.beginPath();ctx.arc(m.projOriginX||110,m.projOriginY||-118,8+clamp(t/m.startup)*8,0,TAU);ctx.stroke();}
    ctx.restore();
  }
  window.Motion60={sample,draw,drawEffects,frameCount:COUNT,preview:(def,name,frame)=>({...bake(name,def.moves[name])[clamp(frame,0,59)],name,phase:clamp(frame,0,59)/59,attack:def.moves[name],reactionDir:-1})};
})();
