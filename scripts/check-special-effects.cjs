// Effects-only regression: real authored pixels, unchanged 60 Hz combat, and
// effect silhouettes inside the existing damage boxes. No browser mocks
// replace the PNG contact tests; only full-screen rasterization is skipped.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {harness}=require('./gameplay-harness.cjs');
const {nativeHarness,createCanvas,root}=require('./native-game-art.cjs');
const ORIGINAL='797bb7816889b15d1f2ba54733366add411e2b12';
const output=path.resolve(root,process.env.PIXEL_FX_OUTPUT||'output/special-fx');
const neutral=()=>({move:0,up:false,down:false,block:false});
const keys=['special','uppercut','rush','tech','skill','super1','super2','super'];

function baseline(){
  const ref=process.env.PIXEL_FX_BASELINE_REF||ORIGINAL;
  const requested=process.env.PIXEL_FX_BASELINE_DIR;
  const saved=path.join(root,'output/special-fx/baseline');
  const source={},provenance={ref,files:{}};
  for(const name of ['fighter','motion60','game']){
    const original=execFileSync('git',['show',`${ref}:js/${name}.js`],{cwd:root,encoding:'utf8'});
    const candidate=path.join(requested?path.resolve(root,requested):saved,`${name}.js`);
    if(requested){
      source[name]=fs.readFileSync(candidate,'utf8');
      provenance.files[name]={path:candidate,matchesReference:source[name]===original};
    }else if(fs.existsSync(candidate)&&fs.readFileSync(candidate,'utf8')===original){
      source[name]=original;provenance.files[name]={path:candidate,matchesReference:true};
    }else{
      source[name]=original;provenance.files[name]={git:`${ref}:js/${name}.js`};
    }
  }
  return {source,provenance};
}

function references(key,value){
  if(value?.def&&value.label)return {fighter:value.label,id:value.def.id};
  return typeof value==='function'?undefined:value;
}
function state(h){
  const fighter=f=>{
    const own={};
    // Include new gameplay fields automatically, while excluding immutable
    // character definitions and the opponent's cyclic instance reference.
    for(const key of Object.keys(f))if(!['def','foe'].includes(key)&&typeof f[key]!=='function')own[key]=f[key];
    return {own,body:f.bodyBox,hit:f.getHitBox()};
  };
  return JSON.stringify({fighters:[fighter(h.g.f1),fighter(h.g.f2)],projectiles:h.g.projectiles,
    hitstop:h.g.hitstop,roundTime:h.g.roundTime,roundState:h.g.roundState,
    cameraX:h.g.cameraX,combo:h.g.combo,events:h.combatEvents,
    // The new character palette label is visual metadata. The original effect
    // position, life, update order, and timing must remain identical.
    effects:h.g.effects.map(({specialStyle,...effect})=>effect)},references);
}
function logic(seed,sources,art){
  const h=harness(seed,{sources,document:{createElement:()=>createCanvas(1,1)}});
  h.s.DrawnAnimation=art;
  h.s.CombatControls.collect=(f,intent)=>intent;
  h.s.CombatControls.read=who=>({...neutral(),block:who==='p2'&&h.defend});
  h.totalStyledImpacts=0;
  return h;
}
function setup(h,index,facing,scenario,ai=false,difficulty=.85){
  const {g,s}=h;h.s.Input.clear();
  h.fight((index+1)%6,difficulty,scenario==='far'?440:100);
  Object.assign(g,{pve:ai,training:false,roundTime:99,cameraX:0,shake:0,hitstop:0,
    combo:{P1:{count:0,timer:0},P2:{count:0,timer:0}}});
  const x=facing>0?280:680,distance=scenario==='far'?440:100;
  g.f1=new s.Fighter(s.CHARACTERS[index],x,facing,'P1');
  g.f2=new s.Fighter(s.CHARACTERS[(index+1)%6],x+facing*distance,-facing,'P2');
  g.f1.foe=g.f2;g.f2.foe=g.f1;g.ai=new s.AI(g.f2,difficulty);
  h.defend=scenario==='guard';h.combatEvents=[];h.testFrame=0;h.seenEffects=new WeakSet();
  for(const f of [g.f1,g.f2]){
    f.maxHp=f.hp=10000;f.meter=300;
    const hit=f.takeHit.bind(f);
    f.takeHit=(box,dir,blocked)=>{
      const result=hit(box,dir,blocked);
      h.combatEvents.push({frame:h.testFrame,player:f.label,kind:box.kind,source:box.owner?.def.id,dir,blocked,result});
      return result;
    };
  }
  if(scenario==='air')Object.assign(g.f2,{onGround:false,y:340,vy:-4,jumpsUsed:1,state:'jump'});
}
function compareTick(pair,label,frame){
  for(const h of pair){
    h.testFrame=frame;h.tick();
    for(const effect of h.g.effects)if(effect.specialStyle&&!h.seenEffects.has(effect)){
      assert.ok(h.combatEvents.some(event=>event.frame===frame&&!event.result.ignored&&
        (event.source===effect.specialStyle||event.result.countered&&[h.g.f1,h.g.f2].some(f=>f.label===event.player&&f.def.id===effect.specialStyle&&f.counterTriggered))),
        `${label}: styled impact appeared without an actual collision`);
      h.seenEffects.add(effect);h.totalStyledImpacts++;
    }
  }
  assert.equal(state(pair[1]),state(pair[0]),`${label}, frame ${frame}: effects changed combat`);
}

function pixelExtent(image){
  const width=image.width,height=image.height,data=image.data;
  let left=width,right=-1,top=height,bottom=-1,maxAlpha=0,count=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const alpha=data[(y*width+x)*4+3];maxAlpha=Math.max(maxAlpha,alpha);
    if(alpha){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}
  }
  return {left,right,top,bottom,maxAlpha,count};
}
function projectilePixels(h){
  const {s}=h;let drawings=0,mirrorChecks=0,dormantChecks=0;const exposures=new Set();
  for(const c of s.CHARACTERS)for(const kind of keys){
    const m=c.moves[kind];if(!m.projectile)continue;
    const ages=[...Array.from({length:8},(_,frame)=>frame*3),...(m.armFrames?
      [m.armFrames-1,...Array.from({length:8},(_,frame)=>m.armFrames+frame*3)]:[])];
    for(const weak of [false,true])for(const age of [...new Set(ages)]){
      exposures.add(Math.floor(age/3)%8);
      const images=[];
      for(const direction of [1,-1]){
        const owner=new s.Fighter(c,0,direction,'P1'),p=new s.Projectile(owner,direction,m);
        if(weak)p.r*=.8;
        const size=Math.max(320,Math.ceil(p.r*3.4+20)),center=size/2;
        Object.assign(p,{x:center,y:center,t:age});
        const canvas=createCanvas(size,size),ctx=canvas.getContext('2d');
        p.draw(ctx);
        const data=ctx.getImageData(0,0,size,size),extent=pixelExtent(data),box=p.box;
        assert.ok(extent.count>0,`${c.id}/${kind}: missing projectile drawing`);
        assert.ok(extent.left>=Math.floor(box.x)-1&&extent.right<Math.ceil(box.x+box.w)+1,
          `${c.id}/${kind}/${direction}: projectile pixels exceed horizontal damage range`);
        assert.ok(extent.top>=Math.floor(box.y)-1&&extent.bottom<Math.ceil(box.y+box.h)+1,
          `${c.id}/${kind}/${direction}: projectile pixels exceed vertical damage range`);
        if(m.armFrames){
          if(age<m.armFrames)assert.ok(extent.maxAlpha<200,'unarmed traps remain visibly subdued');
          else assert.equal(extent.maxAlpha,255,'armed traps expose their solid effect core');
          dormantChecks++;
        }
        images.push(data);drawings++;
      }
      // Reverse RGBA pixels, rather than channels, then compare byte buffers.
      const pixels=new Uint32Array(images[1].data.buffer,images[1].data.byteOffset,images[1].data.byteLength/4);
      for(let y=0;y<images[1].height;y++)pixels.subarray(y*images[1].width,(y+1)*images[1].width).reverse();
      assert.ok(Buffer.from(images[0].data).equals(Buffer.from(images[1].data)),`${c.id}/${kind}: mirrored projectile drawing changed`);
      mirrorChecks++;
    }
  }
  assert.equal(exposures.size,8,'all eight discrete projectile exposures were checked');
  return {drawings,mirrorChecks,dormantChecks,discreteExposures:[...exposures].sort((a,b)=>a-b)};
}

function projectileLifetimes(pair){
  let cases=0,frames=0;
  for(let index=0;index<6;index++)for(const kind of keys){
    const move=pair[1].s.CHARACTERS[index].moves[kind];if(!move.projectile)continue;
    for(const direction of [1,-1])for(const weak of [false,true]){
      const projectiles=pair.map(h=>{
        const owner=new h.s.Fighter(h.s.CHARACTERS[index],500,direction,'P1');
        const p=new h.s.Projectile(owner,direction,owner.def.moves[kind]);if(weak)p.r*=.8;
        return p;
      });
      const duration=projectiles[0].life+1;
      for(let frame=0;frame<duration;frame++){
        for(const p of projectiles)p.update();
        const states=projectiles.map(p=>JSON.stringify({projectile:p,box:p.box,armed:p.t>=p.armFrames},references));
        assert.equal(states[1],states[0],`${index}/${kind}/${direction}: projectile lifetime frame ${frame}`);frames++;
        if(projectiles[0].dead)break;
      }
      assert.ok(projectiles.every(p=>p.dead),'projectiles expire within their configured lifetime');cases++;
    }
  }
  return {cases,frames};
}

function visibleExtent(image,threshold=96){
  const width=image.width,height=image.height,result={left:width,right:-1,top:height,bottom:-1,count:0},data=image.data;
  // Most of the canvas is transparent. Only calculate coordinates for visible
  // pixels, keeping the native raster matrix much cheaper than game replay.
  for(let i=3;i<data.length;i+=4)if(data[i]>=threshold){
    const pixel=(i-3)/4,x=pixel%width,y=Math.floor(pixel/width);
    result.left=Math.min(result.left,x);result.right=Math.max(result.right,x);
    result.top=Math.min(result.top,y);result.bottom=Math.max(result.bottom,y);result.count++;
  }
  return result;
}
function assertInside(extent,box,label){
  if(!extent.count)return;
  assert.ok(extent.left>=Math.floor(box.x)-1&&extent.right<Math.ceil(box.x+box.w)+1,
    `${label}: visible core exceeded horizontal bounds (${extent.left}..${extent.right}, ${box.x}..${box.x+box.w})`);
  assert.ok(extent.top>=Math.floor(box.y)-1&&extent.bottom<Math.ceil(box.y+box.h)+1,
    `${label}: visible core exceeded vertical bounds (${extent.top}..${extent.bottom}, ${box.y}..${box.y+box.h})`);
}
function mirrored(a,b,label){
  const pixels=new Uint32Array(b.data.buffer,b.data.byteOffset,b.data.byteLength/4);
  for(let y=0;y<b.height;y++)pixels.subarray(y*b.width,(y+1)*b.width).reverse();
  assert.ok(Buffer.from(a.data).equals(Buffer.from(b.data)),`${label}: left/right effect drawings differ`);
}
function meleePixels(h){
  const {s}=h;let drawings=0,mirrorChecks=0,activeBounds=0,startupChecks=0,recoveryChecks=0,counterChecks=0,casterChecks=0;
  const exposures=new Set();let checkedExposureWindows=0;
  for(const c of s.CHARACTERS)for(const kind of keys){
    const special=s.CombatRules.isSpecial(kind);
    const variants=special?[{strength:2},{strength:1},{strength:3},{strength:1,od:true},{strength:2,od:true},{strength:3,od:true}]:[{}];
    for(const options of variants)for(const triggered of (c.moves[kind].counter?[false,true]:[false])){
      const fighters=[1,-1].map(direction=>{
        const f=new s.Fighter(c,400,direction,'P1');f.meter=300;
        assert.equal(f.startAttack(kind,options),true);f.y=350;f.counterTriggered=triggered;
        return f;
      });
      const m=fighters[0].attack,end=m.startup+m.active;
      // Pick every reachable authored exposure in each individual hit window.
      // Multi-hit attacks restart their effect phase at their own hitFrames.
      const activeTimes=[],windows=new Map(),hits=m.hitFrames||[m.startup];
      if(!m.projectile)for(let t=m.startup;t<end;t++){
        const last=hits.filter(frame=>frame<=t).at(-1)??m.startup,frame=Math.floor((t-last)/2)%12;
        const seen=windows.get(last)||new Set();windows.set(last,seen);
        if(!seen.has(frame)){activeTimes.push(t);seen.add(frame);exposures.add(frame);checkedExposureWindows++;}
      }
      const times=[...new Set([m.startup-1,m.startup,m.startup+Math.floor(m.active/2),end-1,end,end+m.recovery,...(m.hitFrames||[]),...activeTimes])];
      for(const t of times){
        const images=[];
        for(const f of fighters){
          f.stateT=t;
          const canvas=createCanvas(800,384),ctx=canvas.getContext('2d');s.Motion60.drawEffects(ctx,f);
          const transform=ctx.getTransform();
          assert.deepEqual([transform.a,transform.b,transform.c,transform.d,transform.e,transform.f],[1,0,0,1,0,0],`${c.id}/${kind}: leaked canvas transform`);
          assert.equal(ctx.globalAlpha,1,`${c.id}/${kind}: leaked canvas alpha`);
          const image=ctx.getImageData(0,0,800,384),core=visibleExtent(image),all=visibleExtent(image,1);
          const label=`${c.id}/${kind}/${JSON.stringify(options)}/${f.facing}/${t}/${triggered}`;
          const g=s.CombatSpacing.geometry(m,f.width,t,false),active=t>=m.startup&&t<end;
          if(m.projectile){
            // This catches the former Sage full-height pillar on both startup
            // and release. Only a small flash at the real emitter is allowed.
            const x=f.x+f.facing*(m.projOriginX??110),y=f.y+(m.projOriginY??-118);
            assertInside(all,{x:x-20,y:y-20,w:40,h:40},label+' caster flash');casterChecks++;
          }else if(m.counter&&!triggered&&t<end){
            const center=f.x+f.facing*48;
            assert.ok(core.count>0,label+' missing guard cue');
            assertInside(all,{x:center-19,y:f.y-154,w:38,h:68},label+' untriggered guard');counterChecks++;
          }else if(active){
            assert.ok(core.count>0,label+' missing active effect');
            const bottom=Math.min(0,g.y+g.h/2),top=g.y-g.h/2;
            assertInside(core,{x:f.x+(f.facing>0?g.near:-g.far),y:f.y+top,w:g.w,h:bottom-top},label+' damage geometry');
            activeBounds++;
            if(m.counter){
              const far=f.facing>0?core.right-f.x:f.x-core.left;
              assert.ok(far>g.near+g.w*.65,label+' triggered counter did not expose its slash');counterChecks++;
            }
          }else if(t<m.startup){
            if(m.effect==='pillar'){
              const y=Math.min(-2,g.y+g.h/2-2);
              assertInside(core,{x:f.x+(f.facing>0?g.near:-g.far)-4,y:f.y+y-12,w:g.w+8,h:18},label+' thin ground warning');
            }else{
              const x=f.x+f.facing*(m.grab?54:40),y=f.y+(m.level==='low'?-22:-112);
              assertInside(core,{x:x-20,y:y-20,w:40,h:40},label+' hand preparation');
            }
            startupChecks++;
          }else{
            assert.equal(all.count,0,label+' effect remained after recovery began');recoveryChecks++;
          }
          images.push(image);drawings++;
        }
        mirrored(images[0],images[1],`${c.id}/${kind}/${t}`);mirrorChecks++;
      }
    }
  }
  return {drawings,mirrorChecks,activeBounds,startupChecks,recoveryChecks,counterChecks,casterChecks,
    checkedExposureWindows,reachableDiscreteExposures:[...exposures].sort((a,b)=>a-b)};
}
function impactPixels(h){
  assert.equal(typeof h.s.Motion60.drawImpact,'function','character impacts are available');
  let drawings=0;const identities=new Set(),lifetimes=new Set();
  for(const c of h.s.CHARACTERS)for(const big of [false,true])for(let t=0;t<=16;t++){
    const canvas=createCanvas(128,128),ctx=canvas.getContext('2d');
    const life=big?16:12,event={x:64,y:64,t,life,big,blocked:false,specialStyle:c.id};lifetimes.add(life);
    assert.equal(h.s.Motion60.drawImpact(ctx,event),true);
    const image=ctx.getImageData(0,0,128,128),pixels=visibleExtent(image,1);
    if(t<life){assert.ok(pixels.count>0,`${c.id}/${big}/${t}: missing confirmed impact`);assertInside(pixels,{x:18,y:18,w:92,h:92},c.id+' impact');}
    else assert.equal(pixels.count,0,'impact faded at its existing lifetime');
    assert.equal(ctx.globalAlpha,1,'impact drawing restores alpha');
    if(t===0&&big)identities.add(Buffer.from(image.data).toString('base64'));drawings++;
  }
  assert.equal(identities.size,6,'each character has a distinct impact palette/drawing');
  for(const event of [{specialStyle:'ryu',blocked:true},{specialStyle:'unknown',blocked:false},{blocked:false}]){
    const canvas=createCanvas(128,128),ctx=canvas.getContext('2d');
    assert.equal(h.s.Motion60.drawImpact(ctx,{x:64,y:64,t:0,life:16,...event}),false);
    assert.equal(visibleExtent(ctx.getImageData(0,0,128,128),1).count,0,'normal and blocked impacts retain their original renderer');
  }
  return {drawings,distinctCharacters:identities.size,lifetimes:[...lifetimes],agesChecked:[0,16],fallbackChecks:3};
}
function distinctSilhouettes(h){
  // Remove colour and use identical geometry. A palette swap of the same
  // drawing must not pass as a separate character's special-move identity.
  const masks=[],pairs=[];
  for(const def of h.s.CHARACTERS){
    const f=new h.s.Fighter(def,100,1,'P1');f.width=80;f.y=300;
    f.attackKind='super2';f.stateT=18;f.attack={category:'super',startup:10,active:30,recovery:20,reach:65,hw:65,hh:84,hy:-75,saLevel:2};
    const canvas=createCanvas(400,320);h.s.Motion60.drawEffects(canvas.getContext('2d'),f);
    const data=canvas.getContext('2d').getImageData(0,0,400,320).data;
    const mask=Uint8Array.from({length:data.length/4},(_,i)=>data[i*4+3]>=96?1:0);
    assert.ok(mask.some(Boolean),def.id+' monochrome effect is visible');masks.push({id:def.id,mask});
  }
  for(let i=0;i<masks.length;i++)for(let j=i+1;j<masks.length;j++){
    let union=0,intersection=0;
    for(let k=0;k<masks[i].mask.length;k++){const a=masks[i].mask[k],b=masks[j].mask[k];if(a||b)union++;if(a&&b)intersection++;}
    const overlap=intersection/union;
    assert.ok(overlap<.8,`${masks[i].id}/${masks[j].id}: silhouette is too similar after removing colour (${overlap})`);
    pairs.push({characters:[masks[i].id,masks[j].id],intersectionOverUnion:Number(overlap.toFixed(3))});
  }
  return {sameGeometry:true,colourRemoved:true,characters:masks.length,pairs};
}

(async()=>{
  const started=Date.now(),original=baseline();
  const native=nativeHarness(83);await native.s.DrawnAnimation.loading;
  assert.equal(native.s.DrawnAnimation.status,'ready','production character PNGs loaded');
  if(process.env.PIXEL_FX_PIXELS_ONLY==='1'){
    const report={passed:true,scope:'Native pixel checks only; combat state comparison was not run.',
      projectilePixels:projectilePixels(native),meleePixels:meleePixels(native),impactPixels:impactPixels(native),distinctSilhouettes:distinctSilhouettes(native),
      seconds:Number(((Date.now()-started)/1000).toFixed(2))};
    fs.mkdirSync(output,{recursive:true});
    fs.writeFileSync(path.join(output,'check-pixels.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));return;
  }
  const art=native.s.DrawnAnimation;
  const pair=[logic(83,original.source,art),logic(83,{},art)];
  let cases=0,frames=0,hits=0,blocked=0;
  const modes=['near','far','guard','air'];
  for(let index=0;index<6;index++)for(const kind of keys)for(const facing of [1,-1]){
    const special=pair[1].s.CombatRules.isSpecial(kind);
    const variants=special?[{strength:2},{strength:1},{strength:3},{strength:1,od:true},{strength:2,od:true},{strength:3,od:true}]:[{}];
    for(let variant=0;variant<variants.length;variant++)for(const mode of (variant?['near']:modes)){
      for(const h of pair){setup(h,index,facing,mode);assert.equal(h.g.f1.startAttack(kind,variants[variant]),true);}
      const m=pair[0].g.f1.attack,label=`${pair[0].g.f1.def.id}/${kind}/${facing}/${mode}/${JSON.stringify(variants[variant])}`;
      const duration=Math.max(80,m.startup+m.active+m.recovery+15,m.projectile?m.startup+(m.armFrames||0)+40:0);
      assert.equal(state(pair[1]),state(pair[0]),`${label}: initial attack changed`);
      for(let frame=0;frame<duration;frame++){compareTick(pair,label,frame);frames++;}
      hits+=pair[1].combatEvents.filter(e=>!e.result.ignored&&!e.result.blocked).length;
      blocked+=pair[1].combatEvents.filter(e=>e.result.blocked).length;cases++;
    }
  }
  let counterCases=0;
  for(const facing of [1,-1]){
    for(const h of pair){
      setup(h,4,facing,'near');h.g.f2.x=h.g.f1.x+facing*68;
      assert.equal(h.g.f1.startAttack('skill'),true);assert.equal(h.g.f2.startAttack('light'),true);
    }
    for(let frame=0;frame<70;frame++){compareTick(pair,`counter/${facing}`,frame);frames++;}
    assert.ok(pair[1].combatEvents.some(e=>e.result.countered),'close light attack actually triggers the counter');
    counterCases++;
  }
  let aiFrames=0;
  for(let index=0;index<6;index++)for(const difficulty of [.6,.85,1]){
    for(const h of pair)setup(h,index,1,'far',true,difficulty);
    for(let frame=0;frame<360;frame++){
      for(const h of pair){
        h.g.f1.meter=300;
        if(frame%40===0)h.g.f1.startAttack(keys[Math.floor(frame/40)%keys.length]);
        if(frame===15)h.key('d');if(frame===60)h.key('d',false);
        if(frame===85||frame===110)h.key('w');if(frame===86||frame===111)h.key('w',false);
      }
      compareTick(pair,`AI/${index}/${difficulty}`,frame);aiFrames++;
    }
  }
  const trajectories=projectileLifetimes(pair),pixels=projectilePixels(native),melee=meleePixels(native),impacts=impactPixels(native);
  const report={passed:true,baseline:original.provenance,characters:6,moves:48,combatCases:cases,
    deterministicCombatFrames:frames,aiDifficulties:3,deterministicAIFrames:aiFrames,
    realDamageEvents:hits,guardEvents:blocked,counterCases,confirmedStyledImpacts:pair[1].totalStyledImpacts,
    projectileLifetimes:trajectories,projectilePixels:pixels,meleePixels:melee,impactPixels:impacts,distinctSilhouettes:distinctSilhouettes(native),
    seconds:Number(((Date.now()-started)/1000).toFixed(2)),
    limits:'Original PNG contact with the real simulation. Full-screen rendering is skipped for the combat matrix; isolated projectile, melee/caster, and impact pixels use native Canvas. This is not a browser input, OS-launch, sound, or subjective visual-quality test.'};
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,'check-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
