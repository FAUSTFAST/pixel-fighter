// 60 Hz 动作时间轴：原画姿势结合逐帧胯肩发力；判定与画面共用动作时间。
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
    if(name==='dashForward'||name==='dashBack'){
      const back=name==='dashBack',start=back?8:0;
      return [key(0,move(start),{sink:1}),key(.12,move(start+1),{sink:1.5,lean:back?-1.7:2.4}),
        key(.3,move(start+3),{lean:back?-1.7:2.4}),key(.5,move(start+5),{lean:back?-1.3:1.8}),
        key(.7,move(start+7),{sink:1}),key(1,idle)];
    }
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
    }else if(fighter?.dash){name=fighter.state;p=clamp(fighter.stateT/fighter.dash.frames);}
    else if(fighter?.getupFrames>0){name='getup';p=1-fighter.getupFrames/18;}
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
    f.gaitSettle=motion.gaitSettle||0;f.elapsed=fighter?.stateT||0;f.grounded=fighter?.onGround;f.crouching=!!fighter?.crouching;f.grabbed=!!fighter?.grabbedBy;
    if(fighter?.dash)f.dashPhase=clamp(fighter.stateT/fighter.dash.travelEnd);
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
  // Authored pixel accents are independent of the character drawings and of
  // combat state. Twelve fixed exposures, no blur, frame blending or shared RNG.
  const effectTiles=new Map();
  const effectPixelBudget=4*1024*1024; // 16 MiB of cached RGBA surfaces.
  let effectPixels=0;
  const effectPalettes={
    ryu:['#183b59','#317eac','#68dbff','#defaff'],
    mei:['#692e58','#be477c','#ff78b5','#ffe6db'],
    tank:['#503b32','#a56a43','#ffb568','#fff0bb'],
    volt:['#22465e','#387f9c','#a6faff','#fff4aa'],
    kaze:['#42345f','#786aa4','#c7b7ff','#f2f1ff'],
    sage:['#702d32','#cf5438','#ffa361','#fff0b4']
  };
  function pixelBrush(ctx){
    const dot=(x,y,w,h,color,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(Math.round(x/2)*2,Math.round(y/2)*2,Math.max(2,Math.round(w/2)*2),Math.max(2,Math.round(h/2)*2));};
    // One-pixel edge nicks complement the two-pixel silhouettes; never smooth
    // or resample a character frame to get the additional detail.
    const pin=(x,y,color,alpha=1,w=1,h=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(Math.floor(x),Math.floor(y),w,h);};
    const line=(points,width,color,alpha=1)=>{
      for(let i=1;i<points.length;i++){
        const [ax,ay]=points[i-1],[bx,by]=points[i],steps=Math.max(1,Math.ceil(Math.max(Math.abs(bx-ax),Math.abs(by-ay))/2));
        for(let n=0;n<=steps;n++)dot(ax+(bx-ax)*n/steps-width/2,ay+(by-ay)*n/steps-width/2,width,width,color,alpha);
      }
    };
    const thread=(points,color,alpha=1)=>{
      // Integer, one-pixel material seams, not a smoothed Canvas stroke.
      for(let i=1;i<points.length;i++){
        let x=Math.floor(points[i-1][0]),y=Math.floor(points[i-1][1]);
        const tx=Math.floor(points[i][0]),ty=Math.floor(points[i][1]);
        const dx=Math.abs(tx-x),dy=-Math.abs(ty-y),sx=x<tx?1:-1,sy=y<ty?1:-1;
        let error=dx+dy;
        for(;;){pin(x,y,color,alpha);if(x===tx&&y===ty)break;const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}}
      }
    };
    const poly=(points,color,alpha=1)=>{
      const top=Math.floor(Math.min(...points.map(p=>p[1]))/2)*2,bottom=Math.ceil(Math.max(...points.map(p=>p[1]))/2)*2;
      for(let y=top;y<bottom;y+=2){
        const xs=[];
        for(let i=0,j=points.length-1;i<points.length;j=i++){
          const a=points[i],b=points[j],mid=y+1;
          if((a[1]>mid)!==(b[1]>mid))xs.push(a[0]+(mid-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        xs.sort((a,b)=>a-b);
        for(let i=0;i<xs.length;i+=2)if(xs[i+1]>xs[i])dot(xs[i],y,xs[i+1]-xs[i],2,color,alpha);
      }
    };
    return {dot,line,poly,pin,thread};
  }
  function paintSpecial(ctx,g,id,kind,frame,power){
    const p=effectPalettes[id]||effectPalettes.ryu,b=pixelBrush(ctx);
    const left=g.near,right=g.far,top=g.y-g.h/2,bottom=Math.min(0,g.y+g.h/2),w=right-left,h=bottom-top;
    const at=(x,y)=>[left+w*x,top+h*y],path=points=>points.map(p=>at(...p));
    const rise=kind==='uppercut';
    if(id==='sage'){
      // The ground seal begins at geometry.near, preserving the close blind spot.
      const columns=rise?1:kind==='skill'?3:2+power,base=bottom-4;
      for(let i=0;i<columns;i++){
        const x=left+w*(i+.5)/columns,cw=w/columns*.8;
        const tip=top+h*(.02+((i*3+frame)%7)*.035),bend=((i+frame)%3-1)*cw*.24,fh=base-tip;
        const tongue=(scale,color,alpha)=>b.poly([
          [x-cw*.56*scale,base],[x-cw*.55*scale,tip+fh*.78],[x-cw*.38*scale,tip+fh*.64],
          [x-cw*.49*scale,tip+fh*.45],[x-cw*.17*scale,tip+fh*.51],[x-cw*.23*scale,tip+fh*.28],
          [x+bend*scale,tip+fh*(1-scale)],[x+cw*.12*scale,tip+fh*.3],[x+cw*.08*scale,tip+fh*.48],
          [x+cw*.43*scale,tip+fh*.34],[x+cw*.32*scale,tip+fh*.64],[x+cw*.57*scale,tip+fh*.8],[x+cw*.5*scale,base]
        ],color,alpha);
        tongue(1,p[0],.5);tongue(.87,p[1],.9);tongue(.62,p[2],.95);tongue(.31,p[3],.95);
        // Combustion rolls back into the column: dark, open pockets between
        // unequal tongues, orange rims, and a short white-hot root.
        for(let j=0;j<3;j++){
          const side=j%2?1:-1,py=tip+fh*(.32+j*.2),px=x+side*cw*(.16+(frame+j)%3*.035);
          b.poly([[px-side*cw*.17,py+fh*.08],[px-side*cw*.12,py-fh*.07],[px+side*cw*.07,py-fh*.1],[px+side*cw*.02,py+fh*.035]],'#843329',.75);
          b.thread([[px-side*cw*.14,py+fh*.06],[px-side*cw*.08,py-fh*.05],[px+side*cw*.07,py-fh*.1]],'#ffca78',.85);
          b.poly([[px,py+fh*.04],[px+side*cw*.17,py-fh*.03],[px+side*cw*.23,py-fh*.17],[px+side*cw*.28,py+fh*.02]],'#ed722e',.75);
        }
        b.poly([[x-cw*.18,base-2],[x-cw*.08,base-fh*.28],[x+cw*.03,base-fh*.37],[x+cw*.12,base-fh*.13],[x+cw*.19,base-2]],'#fff7ce',.9);
        for(let j=0;j<5;j++){
          const sy=tip+fh*(.46+j*.09),sx=x+((j+frame+i)%3-1)*cw*.14;
          b.line([[sx-cw*.14,sy+5],[sx,sy-4],[sx+cw*.08,sy-1]],2,j%2?p[3]:p[1],.8);
        }
        for(let j=0;j<9;j++){
          const py=tip+fh*(.18+((j*7+frame*3)%23)/29),px=x+((j*5+frame)%11-5)*cw*.075;
          b.pin(px,py,j%3?'#ffd28a':'#a34532',j%3?.65:.45,1,1+j%2);
        }
      }
      // Low curling tongues connect the bases without filling the whole column.
      for(let i=0;i<columns*2;i++){
        const x=left+w*(i+.5)/(columns*2),cw=w/(columns*2),y=base-h*(.06+(i+frame)%3*.022);
        b.poly([[x-cw*.8,base],[x-cw*.45,y],[x,y-8],[x+cw*.32,y+4],[x+cw*.62,base]],p[2],.85);
        b.line([[x-cw*.4,base-2],[x,base-8],[x+cw*.3,base-4]],2,p[3],.85);
      }
      for(let i=0;i<7;i++){
        const q=at((i+.4)/7,.08+((i*5+frame)%9)/12),s=2+i%2*2;
        b.poly([[q[0]-s,q[1]+s],[q[0],q[1]-s*2],[q[0]+s,q[1]],[q[0],q[1]+s*2]],p[2],.85);
        b.pin(q[0],q[1]-1,p[3],.9,1,2);
      }
      b.line([[left+2,base],[left+w*.18,base-6],[right-w*.15,base-6],[right-2,base]],4,p[3],.9);
    }else if(id==='tank'){
      if(kind==='tech'||kind==='super'){
        // A missed command grab has only hand grips, never a false shockwave.
        for(const dy of [-20,20]){
          const x=Math.min(right-10,Math.max(left+10,64)),y=Math.max(top+12,Math.min(bottom-12,-110+dy));
          b.line([[x-14,y-8],[x,y-8],[x+6,y],[x,y+8]],6,p[0],.7);
          b.line([[x-12,y-8],[x,y-8],[x+6,y]],2,p[2]);
        }
      }else{
        // Iron Fist: discontinuous pressure plates and angular fault lines.
        // There is no circular energy ribbon behind the stone fragments.
        const slabs=rise?3:4+power;
        for(let i=0;i<slabs;i++){
          const u=(i+.5)/slabs,advance=((frame+i)%4)*.012;
          const cx=rise?.28+u*.47:u,cy=rise?.83-u*.7:.56+(i%2?-.1:.09);
          const rw=rise?.18:.13,rh=rise?.15:.2;
          const shape=[[cx-rw,cy+rh],[cx-rw*.7,cy-rh*.6],[cx+advance,cy-rh],[cx+rw,cy-rh*.25],[cx+rw*.75,cy+rh*.7],[cx,cy+rh*.5]];
          b.poly(path(shape),p[0],.8);
          b.poly(path([[cx-rw*.7,cy-rh*.6],[cx+advance,cy-rh],[cx+rw,cy-rh*.25],[cx,cy+.01]]),p[1],.9);
          // A lit cap and a shaded extrusion give each separate rock mass,
          // rather than using an orange fill to imply a generic energy flame.
          b.poly(path([[cx-rw*.7,cy-rh*.6],[cx+advance,cy-rh],[cx+rw,cy-rh*.25],[cx+rw*.4,cy-rh*.03],[cx-rw*.4,cy-rh*.25]]),'#be956a',.95);
          b.poly(path([[cx+rw,cy-rh*.25],[cx+rw*.75,cy+rh*.7],[cx,cy+rh*.5],[cx+rw*.4,cy-rh*.03]]),'#66503c',.95);
          b.poly(path([[cx-rw*.7,cy-rh*.6],[cx-rw*.4,cy-rh*.25],[cx-rw*.3,cy+rh*.6],[cx-rw,cy+rh]]),'#826443',.85);
          b.line(path([[cx-rw*.65,cy-rh*.6],[cx+advance,cy-rh],[cx+rw*.7,cy-rh*.3]]),2,p[2],.9);
          b.line(path([[cx-.03,cy-rh*.65],[cx+.015,cy],[cx-.025,cy+rh*.45]]),2,p[0],.9);
          b.thread(path([[cx-.026,cy-rh*.6],[cx+.025,cy-.01],[cx-.015,cy+rh*.43]]),'#d2ac79',.85);
          b.thread(path([[cx+.02,cy],[cx+rw*.55,cy+.03],[cx+rw*.7,cy+rh*.34]]),'#3e332b',.9);
          for(let j=0;j<8;j++){
            const q=at(cx+((j*3+i)%9-4)*rw*.15,cy+((j*7+frame)%11-5)*rh*.12);
            b.pin(q[0],q[1],j%3?'#d3ae7b':'#47392e',.65,j%3?1:2,1);
          }
          const q=at(cx,cy-rh);b.pin(q[0],q[1],p[3],.9,3,1);
        }
        const faults=rise?[[.11,.92],[.36,.7],[.28,.56],[.58,.37],[.52,.2],[.86,.06]]:[[.04,.64],[.25,.48],[.37,.59],[.54,.38],[.68,.49],[.96,.28]];
        b.line(path(faults),6,p[0],.7);b.line(path(faults),2,p[2],.95);
        for(let i=0;i<5;i++){
          const y=.28+i*.12;
          b.line(path([[.06,y+.07],[.16,y+.02],[.28,y+.02]]),2,p[1],.55);
        }
      }
    }else if(id==='volt'){
      // A wandering discharge with separate ionised sheaths. Forks do not
      // repeat as evenly spaced circuit nodes or a symmetrical star badge.
      const jitter=[-.035,.015,.05,-.02,.025,-.045][frame%6];
      const points=rise?[[.19,.94],[.4+jitter,.7],[.27,.56+jitter],[.65,.43],[.5-jitter,.27],[.83,.06]]:
        [[.03,.52],[.26,.42+jitter],[.2+jitter,.58],[.52,.36-jitter],[.47,.61],[.79+jitter,.43],[.75,.56],[.98,.46]];
      b.line(path(points),10,p[0],.2);b.line(path(points),6,p[1],.35);
      b.line(path(points),2,p[2],.95);b.thread(path(points),'#f3ffff',1);
      for(let i=0;i<5+power;i++){
        const x=.13+i*.103,y=i%2?.69+(i%3)*.055:.27-(i%3)*.048,offset=((frame+i)%3-1)*.04;
        const pts=path([[x,.5],[x+.075,y],[x+.023,y+offset],[x+.11,i%2?.9:.08]]);
        b.line(pts,6,p[1],.18);b.line(pts,2,p[2],.8);b.thread(pts,p[3],.9);
        const spur=path([[x+.075,y],[x+.13,y+(i%2?-.07:.07)],[x+.16,y+(i%2?-.16:.16)]]);
        b.thread(spur,'#94cbd8',.75);
        const q=pts[1];b.pin(q[0],q[1],'#ffffff',1,1,2);
      }
      for(let i=0;i<6;i++){
        const x=.12+((i*3+frame)%11)/13,y=.18+((i*7+frame)%9)/14,q=at(x,y);
        b.thread([[q[0]-5,q[1]-3],[q[0],q[1]-1],[q[0]-1,q[1]+3]],p[1],.65);
        b.pin(q[0],q[1],p[3],.9,2,1);
      }
    }else if(id==='kaze'){
      // Kaze: straight katana incisions and displaced steel splinters. The
      // projectile alone keeps its crescent; hand-to-hand cuts have a sharp tip.
      const cuts=kind==='tech'?2:kind==='super2'?4:kind==='super'?3:1;
      for(let i=0;i<cuts;i++){
        const offset=(i-(cuts-1)/2)*.15;
        const start=rise?[.13+offset,.96]:[.06,.76+offset];
        const tip=rise?[.86+offset,.04]:[.99,.2-offset*.3];
        const mid=[start[0]*.35+tip[0]*.65,start[1]*.35+tip[1]*.65],thick=.035+(power===3?.012:0);
        b.poly(path([start,[mid[0]-.04,mid[1]-thick*1.5],tip,[mid[0]+.02,mid[1]+thick*2]]),p[0],.7);
        b.poly(path([start,[mid[0],mid[1]-thick],tip,[mid[0],mid[1]+thick]]),p[1],.85);
        b.poly(path([[start[0]+.04,start[1]],[mid[0]-.03,mid[1]+thick*.2],tip,[mid[0],mid[1]+thick*1.4]]),'#554f70',.85);
        b.poly(path([[start[0]+.1,start[1]-.03],[mid[0]-.03,mid[1]-thick*.65],tip,[mid[0],mid[1]+thick*.12]]),'#ddd9e5',.9);
        b.line(path([[start[0]+.09,start[1]-.04],tip]),2,p[3],.95);
        b.line(path([[start[0]+.12,start[1]+.06],[mid[0]-.03,mid[1]+.05]]),2,p[2],.75);
        b.thread(path([[start[0]+.14,start[1]-.018],[mid[0],mid[1]-thick*.24],tip]),'#ffffff',.95);
        // Short moving specular bands along the blade, with a dark back bevel.
        for(let j=0;j<5;j++){
          const u=.18+j*.14+(frame%3)*.014,x=start[0]+(tip[0]-start[0])*u,y=start[1]+(tip[1]-start[1])*u;
          b.thread(path([[x-.015,y+.014],[x+.025,y-.013]]),j%2?'#8c86a6':'#fff8ee',.85);
        }
        const q=at(mid[0],mid[1]);b.pin(q[0]-3+frame%4,q[1]-2,p[3],1,4,1);
      }
      if(kind==='super1'||kind==='skill'){
        const q=at(.82,.36);b.line([[q[0]-10,q[1]],[q[0]+10,q[1]]],2,p[2],.8);b.line([[q[0],q[1]-10],[q[0],q[1]+10]],2,p[3],.9);
      }
    }else if(id==='mei'){
      // Mei: folded organic petals with a shaded underside, translucent rim
      // and branching veins. Unequal folds avoid a flat four-lobed icon.
      const blossoms=kind==='super'?3:kind==='super2'?4:kind==='skill'?3:2;
      for(let i=0;i<blossoms;i++){
        const u=(i+.6)/(blossoms+.2),cx=rise?.35+u*.4:.13+u*.75,cy=rise?.87-u*.76:.5+(i%2?-.12:.1);
        const rw=.1+power*.008,rh=.17+(rise?.02:0),fold=[.72,.86,1,.86,.72,.6][(frame+i)%6];
        for(const side of [-1,1]){
          const reach=side===1?1:.78,tilt=((i+frame)%3-1)*.028;
          const wing=[[cx,cy],[cx+side*rw*.27,cy-rh*.63],[cx+side*rw*.64*fold,cy-rh*.98+tilt],
            [cx+side*rw*fold,cy-rh*.86],[cx+side*rw*.95,cy-rh*.35],[cx+side*rw*.42,cy+.02],
            [cx+side*rw*.77*reach,cy+rh*.37],[cx+side*rw*.72*reach,cy+rh*.7],[cx+side*rw*.4,cy+rh*.94*reach],[cx+side*rw*.14,cy+rh*.36]];
          b.poly(path(wing),p[0],.7);
          b.poly(path(wing.map(([x,y])=>[cx+(x-cx)*.82,cy+(y-cy)*.82])),p[1],.9);
          b.poly(path([[cx,cy],[cx+side*rw*.29,cy-rh*.58],[cx+side*rw*.64*fold,cy-rh*.92+tilt],[cx+side*rw*.74,cy-rh*.52],[cx+side*rw*.36,cy-rh*.23]]),'#ee95ad',.8);
          b.poly(path([[cx,cy],[cx+side*rw*.45,cy-rh*.22],[cx+side*rw*.77,cy-rh*.54],[cx+side*rw*.95,cy-rh*.35],[cx+side*rw*.42,cy+.02]]),'#893855',.85);
          b.poly(path([[cx+.005,cy+.02],[cx+side*rw*.66*reach,cy+rh*.4],[cx+side*rw*.48,cy+rh*.72],[cx+side*rw*.18,cy+rh*.26]]),'#d67c9b',.8);
          b.line(path([[cx,cy],[cx+side*rw*.43,cy-rh*.5],[cx+side*rw*.8*fold,cy-rh*.83]]),2,p[2],.95);
          b.thread(path([[cx,cy+.02],[cx+side*rw*.4,cy+rh*.65]]),p[3],.8);
          for(let j=0;j<3;j++){
            const u=.28+j*.18;
            b.thread(path([[cx+side*rw*u*.7,cy-rh*u],[cx+side*rw*(u+.26),cy-rh*(u+.06)]]),'#ffd0cc',.7);
          }
          b.thread(path(wing.slice(1,5)),'#f8bcc4',.65);
        }
        const q=at(cx,cy);b.thread([[q[0]-1,q[1]-4],[q[0]+1,q[1]+4]],p[3],.8);
      }
      // Disconnected petal stitches track the kick's path; the negative spaces
      // distinguish these blossoms from solid steel or a continuous energy ring.
      for(let i=0;i<10+power*2;i++){
        const u=(i+.5)/(10+power*2),q=at(.05+u*.9,rise?.94-u*.88:.7-u*.3);
        b.poly([[q[0]-4,q[1]+2],[q[0],q[1]-4],[q[0]+4,q[1]-2],[q[0]+1,q[1]+3]],p[2],.7);
        b.pin(q[0],q[1]-2,p[3],.8);
      }
    }else{
      // Ryu: open pressure ribbons with thin condensation edges and darker
      // receding air sheets. Keep the hollow eye and the target readable.
      const coils=kind==='tech'?3:kind==='super2'?4:rise?3:2;
      for(let i=0;i<coils;i++){
        const u=(i+.5)/coils,cx=rise?.4+u*.28:.22+u*.53,cy=rise?.92-u*.78:.52;
        const rx=rise?.28:.17,ry=rise?.12:kind==='rush'?.2:.34;
        const spiral=[];
        for(let j=0;j<13;j++){
          const a=(-1.4+j*.48)+(frame%6)*.09,radius=.3+j*.052;
          spiral.push(at(cx+Math.cos(a)*rx*radius,cy+Math.sin(a)*ry*radius));
        }
        for(let j=1;j<spiral.length;j++){
          const thickness=2+Math.floor(Math.sin(j/13*Math.PI)*4),a=spiral[j-1],z=spiral[j];
          const dx=z[0]-a[0],dy=z[1]-a[1],length=Math.max(1,Math.hypot(dx,dy)),nx=-dy/length,ny=dx/length;
          b.poly([[a[0]-nx*thickness,a[1]-ny*thickness],[z[0]-nx*thickness*.75,z[1]-ny*thickness*.75],
            [z[0]+nx*thickness,z[1]+ny*thickness],[a[0]+nx*thickness*.6,a[1]+ny*thickness*.6]],p[j<5?0:1],j<5?.3:.55);
          if(j>3)b.thread([[a[0]+nx*thickness*.7,a[1]+ny*thickness*.7],[z[0]+nx*thickness*.8,z[1]+ny*thickness*.8]],j>8?p[3]:p[2],.85);
          if(j%3===1)b.thread([[a[0]-nx*2,a[1]-ny*2],[z[0]-nx*2,z[1]-ny*2]],'#93b6c7',.6);
        }
        const seam=spiral.slice(3,8).map(([x,y])=>[x-3,y+3]);b.thread(seam,'#72b0c5',.55);
      }
      for(let i=0;i<7+power;i++){
        const u=(i+.5)/(7+power),q=at(.07+u*.86,.16+((i*3+frame)%9)/14);
        b.line([[q[0]-12,q[1]+4],[q[0]-5,q[1]],[q[0]+7,q[1]]],2,p[2],.65);
        b.pin(q[0]+8,q[1],p[3],.8,3,1);
      }
    }
    paintSpecialParticles(ctx,g,id,kind,frame,power);
  }
  function paintSpecialParticles(ctx,g,id,kind,frame,power){
    // Fixed, individually drawn particle exposures. Positions are confined by
    // the real attack geometry in drawSpecialTile; they never extend its reach.
    const p=effectPalettes[id]||effectPalettes.ryu,b=pixelBrush(ctx);
    const top=g.y-g.h/2,bottom=Math.min(0,g.y+g.h/2),w=g.w,h=bottom-top;
    const grip=id==='tank'&&['tech','super'].includes(kind);
    const count=grip?8:18+power*6;
    for(let i=0;i<count;i++){
      const age=(frame+i*5)%12,depth=i%3;
      let x=g.near+w*(.1+((i*17)%37)/46),y=top+h*(.12+((i*11)%31)/40);
      const drift=age-5,fade=(.45+depth*.18)*(1-age/22);
      if(grip){x=Math.min(g.far-8,Math.max(g.near+8,64))+(i%4-1.5)*6;y=Math.max(top+8,Math.min(bottom-8,-110+(i<4?-20:20)))+drift;}
      else if(kind==='uppercut'){x+=drift*.7;y-=drift*1.6;}
      else{x+=drift*1.5;y+=(i%2?1:-1)*drift*.7;}
      const size=depth===2?4:2;
      if(id==='mei'){
        // Folded petals: a dark underside, a pale ridge, and a fine vein.
        const tilt=(i+frame)%3-1;
        b.poly([[x-4,y],[x-1,y-5],[x+4,y-2+tilt],[x+2,y+4],[x,y+2]],p[0],fade*.7);
        b.poly([[x-1,y-5],[x+4,y-2+tilt],[x,y+2]],p[2],fade);
        b.pin(x-1,y-3,p[3],fade,1,3);b.pin(x-5,y+6,p[1],fade*.7,2,1);
        b.thread([[x-2,y-3],[x+1,y-1],[x+2,y+2]],'#f8b5bd',fade);
        if(depth===2){b.pin(x+7,y-6,'#f4cc9e',fade*.8);b.pin(x+10,y-3,'#c88b8c',fade*.5);}
      }else if(id==='tank'){
        // Split rock facets and sand grains, with no shockwave on a missed grab.
        b.poly([[x-size,y+size],[x-size,y-2],[x,y-size-2],[x+size,y],[x+2,y+size]],p[0],fade);
        b.poly([[x-size,y-2],[x,y-size-2],[x+size,y],[x,y+1]],p[1],fade);
        b.pin(x-1,y-size,p[3],fade,2,1);b.pin(x-4-drift*.4,y+5,p[2],fade*.65);
        if(!grip&&depth===2)b.line([[x-7,y+4],[x-3,y+2],[x-1,y+3]],2,p[1],fade*.55);
        if(!grip&&i%4===0){
          b.poly([[x-9,y+7],[x-4,y+3],[x+3,y+5],[x+7,y+8],[x+2,y+9]],'#aa9174',fade*.18);
          b.pin(x-7,y+4,'#d5bd93',fade*.65);b.pin(x+5,y+10,'#5f4d3e',fade*.7,2,1);
        }
      }else if(id==='volt'){
        // Short forked discharges alternate with single hot charge points.
        if(i%3===0){b.line([[x-7,y+3],[x-1,y-2],[x-2,y+2],[x+6,y-4]],2,p[1],fade*.7);b.pin(x,y-1,p[3],fade,3,1);}
        else{b.dot(x,y,2,2,p[2],fade);b.pin(x-1,y-1,p[3],fade);}
        if(depth===2){b.pin(x-5,y-5,p[1],fade*.6,1,3);b.pin(x-7,y-4,p[2],fade*.7,3,1);}
        if(i%4===0)b.thread([[x-8,y+7],[x-4,y+2],[x-5,y-1],[x-2,y-5]],'#dbffff',fade*.55);
      }else if(id==='sage'){
        // Rising ember heads, charred tails and tiny detached flame tongues.
        y-=age*1.2;
        b.poly([[x-2,y+5],[x-3,y],[x,y-6],[x+3,y+1],[x+1,y+4]],p[1],fade*.8);
        b.dot(x,y-2,2,4,p[2],fade);b.pin(x,y-3,p[3],fade,1,2);
        b.pin(x-2,y+7,p[0],fade*.55,2,2);b.pin(x+3,y+3,p[2],fade*.55);
        if(depth===2){
          b.poly([[x-7,y-7],[x-5,y-13],[x,y-15],[x+4,y-11],[x+1,y-8]],'#6e5553',fade*.19);
          b.pin(x-5,y-16,'#a77c65',fade*.3,2,1);b.pin(x+4,y+8,'#e28844',fade*.65);
        }
      }else if(id==='kaze'){
        // Thin steel splinters, lavender backs, and cold single-pixel edges.
        const length=4+depth*3;
        b.poly([[x-length,y+3],[x+length,y-4],[x+length-3,y],[x-4,y+4]],p[1],fade*.8);
        b.line([[x-length+2,y+3],[x+length-1,y-3]],2,p[2],fade);
        b.pin(x+length-2,y-3,p[3],fade,2,1);b.pin(x-4,y-5,p[2],fade*.5);
        b.thread([[x-length+1,y+3],[x+length-2,y-3]],'#e5e0e4',fade*.75);
        if(i%4===0)b.thread([[x+3,y+5],[x+7,y+3],[x+9,y+4]],'#878194',fade*.55);
      }else{
        // Parallel wind filaments break into fine chips toward the edge.
        b.line([[x-8-depth*2,y+3],[x-3,y],[x+3,y]],2,p[1],fade*.7);
        b.pin(x-2,y,p[2],fade,3+depth,1);b.pin(x+3,y-1,p[3],fade,2,1);
        b.pin(x-6,y+5,p[2],fade*.6);b.pin(x+6,y-3,p[1],fade*.65,2,1);
        if(depth===2){
          b.poly([[x-14,y+4],[x-7,y],[x+5,y-1],[x+11,y+1],[x-3,y+2]],'#96bfd0',fade*.14);
          b.thread([[x-11,y+3],[x-5,y+1],[x+3,y+1]],'#d0e8e8',fade*.6);
        }
      }
    }
  }
  function drawSpecialTile(ctx,g,id,kind,frame,power,opacity){
    // Cache bounded tiles, rather than redrawing hundreds of pixel strokes at
    // every monitor refresh. The cache key includes the actual variant geometry.
    const key=[id,kind,frame,power,opacity,g.near,g.far,g.y,g.h].join(':');
    let tile=effectTiles.get(key);
    if(!tile){
      if(!document.createElement)return;
      // Integer inward bounds avoid fractional clip antialiasing that could
      // give the mirrored exposure a different fringe on the right-hand side.
      const x=Math.ceil(g.near),y=Math.ceil(g.y-g.h/2);
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(g.far)-x);canvas.height=Math.max(1,Math.floor(Math.min(0,g.y+g.h/2))-y);
      const c=canvas.getContext('2d');c.translate(-x,-y);
      paintSpecial(c,g,id,kind,frame,power);
      // Bake the exposure opacity once. Native Canvas fast copies and flipped
      // copies otherwise round translucent RGB differently at 1:1 resolution.
      if(opacity<1){c.globalCompositeOperation='destination-in';c.globalAlpha=opacity;c.fillRect(x,y,canvas.width,canvas.height);}
      const pixels=canvas.width*canvas.height;
      tile={canvas,x,y,pixels};
      while(effectTiles.size&&(effectTiles.size>=256||effectPixels+pixels>effectPixelBudget)){
        const oldest=effectTiles.keys().next().value;effectPixels-=effectTiles.get(oldest).pixels;effectTiles.delete(oldest);
      }
      effectTiles.set(key,tile);
      effectPixels+=pixels;
    }
    // The cached surface already lies wholly inside the damage geometry.
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.drawImage(tile.canvas,tile.x,tile.y);ctx.restore();
  }
  function drawSpecialEffects(ctx,f,m,g,t,active){
    const p=effectPalettes[f.def.id]||effectPalettes.ryu,b=pixelBrush(ctx),end=m.startup+m.active;
    ctx.save();ctx.translate(f.x,f.y);ctx.scale(f.facing,1);
    // Projectile geometry belongs to the moving instance, never to this caster.
    // In particular, Sage's inherited 'pillar' tag must not create a phantom hit.
    if(m.projectile){
      const since=t-(m.shots||[m.startup]).filter(v=>v<=t).at(-1),pre=t<m.startup;
      if(pre||since>=0&&since<4){
        const x=m.projOriginX??110,y=m.projOriginY??-118,r=pre?8+Math.floor(t/Math.max(1,m.startup)*4)*2:14-since*2;
        const alpha=pre?.32:.75;
        if(f.def.id==='ryu'){
          b.line([[x-r,y+3],[x-5,y-r*.6],[x+7,y-r*.4],[x+r,y+3],[x+4,y+r*.7],[x-5,y+5]],2,p[2],alpha);
          b.line([[x-8,y+4],[x,y-4],[x+7,y]],2,p[3],alpha);
        }else if(f.def.id==='mei'){
          for(const side of [-1,1])b.poly([[x,y],[x+side*r,y-r*.7],[x+side*r*.8,y+3],[x+side*4,y+r*.8]],p[2],alpha);
          b.line([[x,y-5],[x,y+5]],2,p[3],alpha);
        }else if(f.def.id==='tank'){
          b.poly([[x-r,y+8],[x-r*.7,y-3],[x-2,y-r],[x+r*.7,y-2],[x+r,y+8]],p[1],alpha);
          b.line([[x-r*.7,y-3],[x-2,y-r],[x+r*.7,y-2]],2,p[3],alpha);
        }else if(f.def.id==='volt'){
          b.line([[x-r,y-4],[x-3,y+4],[x+2,y-7],[x+5,y+4],[x+r,y-3]],2,p[2],alpha);
          b.line([[x-4,y-r],[x+3,y-3],[x-2,y+5],[x+3,y+r]],2,p[3],alpha);
        }else if(f.def.id==='kaze'){
          b.poly([[x-r,y+4],[x+r,y-5],[x+3,y],[x,y+3]],p[2],alpha);
          b.line([[x-2,y-r],[x+1,y+r]],2,p[3],alpha);
        }else{
          b.poly([[x-r*.7,y+9],[x-r*.6,y-1],[x-3,y+2],[x,y-r],[x+4,y-1],[x+r*.6,y-4],[x+r*.6,y+9]],p[1],alpha);
          b.poly([[x-4,y+7],[x,y-r*.5],[x+4,y+7]],p[3],alpha);
        }

      }
    }else if(m.counter&&!f.counterTriggered){
      // Readable guard preparation; no slash until the counter actually fires.
      if(t<end){const x=48,y=-120;b.line([[x-12,y+28],[x+8,y+16],[x+12,y-14],[x-4,y-28]],2,p[2],.45);b.line([[x-8,y+21],[x+4,y+12],[x+6,y-12]],2,p[3],.45);}
    }else if(active){
      const hits=m.hitFrames||[m.startup],last=hits.filter(v=>v<=t).at(-1)??m.startup;
      const frame=Math.floor((t-last)/2)%12,power=m.saLevel||(m.od?1:0);
      drawSpecialTile(ctx,g,f.def.id,f.attackKind,frame,power,t-last<3?1:.82);
    }else if(t<m.startup){
      if(m.effect==='pillar'){
        // Thin ground warning only; the active flame keeps the exact blind spot.
        const y=Math.min(-2,g.y+g.h/2-2),mid=g.center;
        b.line([[g.near+4,y],[mid-14,y],[mid-8,y-4],[mid+8,y-4],[mid+14,y],[g.far-4,y]],2,p[1],.35);
        for(let i=0;i<3;i++)b.dot(mid-12+i*10,y-6,4,2,p[2],.3);
      }else{
        const x=m.grab?54:40,y=m.level==='low'?-22:-112;
        b.line([[x-8,y+8],[x-2,y-2],[x+8,y-6]],2,p[2],.24);
        b.dot(x+8,y-8,2,4,p[3],.35);
      }
    }
    // Foot dust stays small and faint; it is not a second attack region.
    if(m.travelDistance&&t>=m.travelStart&&t<m.travelEnd){
      for(let i=0;i<3;i++)b.dot(-24-i*18,-4-i%2*4,10+i*4,2,p[1],.22);
    }
    ctx.restore();
  }
  const impactTiles=new Map();
  function drawImpact(ctx,e){
    const p=effectPalettes[e.specialStyle];if(!p||e.blocked)return false;
    if(e.t>=e.life)return true;
    const frame=Math.max(0,Math.floor(e.t)),key=[e.specialStyle,frame,e.life,!!e.big].join(':');
    let tile=impactTiles.get(key);
    if(!tile){
      if(!document.createElement)return true;
      tile=document.createElement('canvas');tile.width=tile.height=96;
      const c=tile.getContext('2d');c.translate(48,48);
      const b=pixelBrush(c),r=9+Math.min(frame,15)*1.45,fade=1-frame/e.life;
      // Only confirmed collisions spawn this burst. Larger super impacts add
      // facets rather than extra lifetime or an apparent second damage area.
      const count=e.big?36:24;
      for(let i=0;i<count;i++){
        // Unequal fragment directions and speeds prevent a repeated radial
        // badge. Gravity is visible in stone chips, buoyancy in fire cinders.
        const a=i*2.399963+.12*Math.sin(i*1.7+frame*.3),dx=Math.cos(a),dy=Math.sin(a),depth=i%3;
        const length=r*(.38+(i%7)*.085),x=dx*length;
        const y=dy*length+(e.specialStyle==='tank'?frame*.23:e.specialStyle==='sage'?-frame*.2:0);
        const alpha=fade*(depth===0?1:.65),size=depth===0?5:3;
        if(e.specialStyle==='mei'){
          b.poly([[x-size,y],[x,y-size-2],[x+size+1,y-2],[x+2,y+size]],p[0],alpha*.7);
          b.poly([[x,y-size-2],[x+size+1,y-2],[x+1,y+2]],p[2],alpha);
          b.pin(x,y-3,p[3],alpha,1,3);b.pin(x-dx*6,y-dy*6,p[1],alpha*.7,2,1);
          b.thread([[x-size+1,y],[x,y-2],[x+size-1,y-2]],'#f3a8b6',alpha*.8);
        }else if(e.specialStyle==='tank'){
          b.poly([[x-size,y+size],[x-size+1,y-size],[x+2,y-size-1],[x+size,y+2]],p[0],alpha);
          b.poly([[x-size+1,y-size],[x+2,y-size-1],[x+size,y],[x,y+1]],p[1],alpha);
          b.line([[x-size+1,y-size],[x+2,y-size-1]],2,p[2],alpha);
          b.pin(x+1,y-size,p[3],alpha);b.pin(x+dx*5,y+dy*5,p[1],alpha*.7,2,2);
          b.thread([[x-size+1,y-size],[x+1,y-size-1],[x+size-1,y]],'#d0b08b',alpha*.9);
          if(depth===0)b.poly([[x-6,y+4],[x,y+1],[x+7,y+5],[x+1,y+8]],'#aa9174',alpha*.18);
        }else if(e.specialStyle==='volt'){
          if(depth===0){
            const points=[[dx*6,dy*6],[dx*length*.6-dy*4,dy*length*.6+dx*4],[x+dy*3,y-dx*3],[x+dx*5,y+dy*5]];
            b.line(points,4,p[0],alpha*.65);b.line(points,2,p[2],alpha);
            b.thread(points,'#f2ffff',alpha);
            b.thread([[x+dy*3,y-dx*3],[x+dx*2+dy*7,y+dy*2-dx*7],[x+dx*6+dy*5,y+dy*6-dx*5]],p[2],alpha*.6);
            b.pin(x,y,p[3],alpha,2,1);
          }else{b.dot(x,y,2,2,p[2],alpha);b.pin(x+1,y,p[3],alpha);}
        }else if(e.specialStyle==='sage'){
          b.poly([[x-dx*6-dy*2,y-dy*6+dx*2],[x+dx*6,y+dy*6],[x-dx*2+dy*3,y-dy*2-dx*3]],p[1],alpha);
          b.dot(x-1,y-2,2,4,p[2],alpha);b.pin(x,y-2,p[3],alpha,1,2);
          b.pin(x-dx*7,y-dy*7,p[0],alpha*.6,2,2);
          if(depth===1)b.poly([[x-4,y-4],[x-2,y-9],[x+3,y-10],[x+6,y-5],[x+1,y-3]],'#80615a',alpha*.2);
        }else if(e.specialStyle==='kaze'){
          b.poly([[x-dx*7-dy*2,y-dy*7+dx*2],[x+dx*5,y+dy*5],[x-dx*4+dy*2,y-dy*4-dx*2]],p[1],alpha);
          b.line([[x-dx*6,y-dy*6],[x+dx*4,y+dy*4]],2,p[2],alpha);
          b.pin(x+dx*3,y+dy*3,p[3],alpha);
          b.thread([[x-dx*7-dy,y-dy*7+dx],[x+dx*4-dy,y+dy*4+dx]],'#fffbf0',alpha*.8);
        }else{
          b.line([[dx*(length-7)-dy*3,dy*(length-7)+dx*3],[x,y],[x+dx*4-dy*2,y+dy*4+dx*2]],2,p[1],alpha);
          b.pin(x,y,p[2],alpha,3,1);b.pin(x+dx*3,y+dy*3,p[3],alpha);
          if(depth===0)b.thread([[x-dx*7-dy*4,y-dy*7+dx*4],[x-dy*3,y+dx*3],[x+dx*5-dy,y+dy*5+dx]],'#c2dae1',alpha*.6);
        }
        // Small secondary grains lie between the main fragments, leaving the
        // target's outline visible instead of covering it with an opaque disc.
        if(i%2===0){const rr=Math.min(41,r+7+i%4);b.pin(dx*rr,dy*rr,p[depth===0?3:2],alpha*.8,depth===0?2:1,1);}
      }
      if(frame<9&&['ryu','volt'].includes(e.specialStyle)){
        const radius=7+frame*.9;
        for(let i=0;i<12;i++)if((i+frame)%3!==0){
          const a=i*TAU/12,z=a+.18;
          b.line([[Math.cos(a)*radius,Math.sin(a)*radius],[Math.cos(z)*radius,Math.sin(z)*radius]],2,p[1],fade*.65);
        }
      }
      if(frame<4){
        if(e.specialStyle==='ryu'){
          b.line([[-10,3],[-8,-4],[-1,-8],[7,-5],[9,2],[4,7]],3,p[2],fade*.9);
          b.thread([[-8,-2],[-2,-6],[4,-5],[7,-1]],p[3],fade);
        }else if(e.specialStyle==='mei'){
          b.poly([[-8,2],[-6,-5],[1,-9],[3,-3],[0,2],[-5,5]],p[2],fade*.8);
          b.poly([[0,2],[6,-4],[10,-2],[8,5],[1,9]],'#e299b0',fade*.85);
          b.thread([[-5,2],[0,-2],[1,-6]],p[3],fade);
        }else if(e.specialStyle==='tank'){
          b.poly([[-9,3],[-6,-5],[1,-8],[9,-2],[6,6],[-3,8]],'#7e6550',fade);
          b.poly([[-6,-5],[1,-8],[9,-2],[0,1]],'#d2b181',fade);
          b.thread([[-6,-4],[0,-1],[-1,4],[3,6]],'#f8ddb0',fade);
        }else if(e.specialStyle==='volt'){
          b.line([[-10,5],[-3,-3],[-5,3],[4,-2],[2,5],[9,-6]],2,p[2],fade);
          b.thread([[-7,3],[-2,-1],[-1,2],[5,-3]],'#ffffff',fade);
        }else if(e.specialStyle==='kaze'){
          b.poly([[-13,7],[4,-5],[13,-7],[-2,5]],'#9185ad',fade);
          b.thread([[-12,7],[0,-1],[13,-7]],p[3],fade);
          b.thread([[-3,-8],[1,2],[5,8]],p[2],fade*.8);
        }else{
          b.poly([[-8,7],[-7,-2],[-2,0],[0,-11],[4,-3],[9,-5],[7,8]],p[1],fade);
          b.poly([[-4,6],[-3,-1],[0,-5],[3,0],[4,6]],p[3],fade);
          b.pin(-2,-2,'#ffffff',fade,1,2);
        }
      }
      if(impactTiles.size>=192)impactTiles.delete(impactTiles.keys().next().value);
      impactTiles.set(key,tile);
    }
    ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(tile,e.x-48,e.y-48);ctx.restore();return true;
  }
  function drawEffects(ctx,f){
    const m=f.attack;if(!m)return;
    const t=f.stateT,g=CombatSpacing.geometry(m,f.width,t,!f.onGround&&!m.launch),active=t>=m.startup&&t<m.startup+m.active;
    if(m.category==='special'||m.category==='super'){drawSpecialEffects(ctx,f,m,g,t,active);return;}
    if(t>=m.startup+m.active)return;
    const color=m.effect==='drive'?'#65ffb7':f.def.fxColor;
    ctx.save();ctx.translate(f.x,f.y);ctx.scale(f.facing,1);ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=3;
    if(m.airNormal){
      if(active){
        // Pixel accents follow the exact exposed fist / foot. They never
        // transform the original drawing or create another damage volume.
        const limb=window.DrawnAnimation?.contactGeometry?.(m,t,true)||g;
        const x=Math.round(limb.far)-4,y=Math.round(limb.y),effect=m.airEffect;
        ctx.globalAlpha=.55;
        if(effect==='jab'){
          for(let i=0;i<2;i++)ctx.fillRect(x-12-i*8,y-3+i*6,7,2);
        }else if(effect==='palm'){
          for(const [dx,dy] of [[-18,0],[-10,-8],[-10,8]])ctx.fillRect(x+dx,y+dy,6,3);
        }else if(effect==='hammer'){
          for(let i=0;i<4;i++)ctx.fillRect(x-5-i*5,y-18+i*6,3,6);
        }else if(effect==='toe'){
          for(let i=0;i<3;i++)ctx.fillRect(x-7-i*5,y+2+i*4,5,2);
        }else if(effect==='sweep'){
          for(let i=0;i<6;i++){const a=-Math.PI*.6+i*Math.PI*.18;ctx.fillRect(x-16+Math.round(Math.cos(a)*14),y+Math.round(Math.sin(a)*14),3,3);}
        }else if(effect==='blast'){
          for(let i=0;i<5;i++){ctx.fillRect(x-12-i*9,y-4-i*3,7,3);ctx.fillRect(x-12-i*9,y+4+i*3,7,3);}
        }
        ctx.globalAlpha=.8;ctx.fillStyle='#fff6df';ctx.fillRect(x,y-1,3,3);
      }
      ctx.restore();return;
    }
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
  window.Motion60={sample,draw,drawEffects,drawImpact,frameCount:COUNT,preview:(def,name,frame)=>({...bake(name,def.moves[name])[clamp(frame,0,59)],name,phase:clamp(frame,0,59)/59,attack:def.moves[name],reactionDir:-1})};
})();
