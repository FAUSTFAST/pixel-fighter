// Exercise the move-guide demonstrations through the production 60 Hz loop.
// Character contact uses the shipped PNGs, never placeholder sprite frames.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHash}=require('node:crypto');
const {nativeHarness,createCanvas,fonts,root}=require('./native-game-art.cjs');
const {harness}=require('./gameplay-harness.cjs');
const output=path.join(root,'output/move-demo');
const keys=['special','uppercut','rush','tech','skill','super1','super2','super'];
const plain=value=>JSON.parse(JSON.stringify(value));

async function originalArt(h){
  await h.s.DrawnAnimation.loading;
  assert.equal(h.s.DrawnAnimation.status,'ready','original character art loaded');
  for(let tries=0;tries<200&&!Object.values(h.s.STAGE_ART).every(art=>art.ready);tries++)await new Promise(resolve=>setTimeout(resolve,20));
  assert.ok(Object.values(h.s.STAGE_ART).every(art=>art.ready),'original stage PNGs loaded');
}
function sampledHarness(art,game){
  // Every physics / collision tick still runs. Only the main-window compositor
  // is deferred until capture; PNG masks and their native canvases stay real.
  const canvas=createCanvas(960,540),native=canvas.getContext('2d'),methods=new Map();
  native.imageSmoothingEnabled=false;let raster=false;
  const context=new Proxy({}, {
    get(_target,key){
      const value=native[key];if(typeof value!=='function')return value;
      if(!methods.has(key))methods.set(key,(...args)=>raster||String(key).startsWith('create')||key==='measureText'?value.apply(native,args):undefined);
      return methods.get(key);
    },
    set(_target,key,value){if(raster)native[key]=value;return true;}
  });
  const h=harness(417,{sources:{game},context,document:{createElement:()=>createCanvas(1,1)}});
  Object.assign(h.s,{DrawnAnimation:art.s.DrawnAnimation,STAGE_ART:art.s.STAGE_ART,STAGES:art.s.STAGES});
  return {...h,canvas,render(){raster=true;try{h.tick(1,Infinity);}finally{raster=false;}}};
}
function attachSession(h,source,search='?moveDemo=1&character=ryu&move=special'){
  Object.assign(h.s,{URLSearchParams,location:{search},parent:{}});
  h.s.document.documentElement={classList:{add(){}}};
  h.s.Audio2.setMusicOn=()=>{};h.s.Audio2.setSfxOn=()=>{};
  vm.runInContext(source,h.s,{filename:'move-demo.js'});
  assert.ok(h.s.MoveDemoSession,'only an embedded demonstration creates a session');
  return h.s.MoveDemoSession;
}
function fighterState(f){
  return {id:f.def.id,x:f.x,y:f.y,vx:f.vx,vy:f.vy,hp:f.hp,meter:f.meter,drive:f.drive,
    state:f.state,stateT:f.stateT,onGround:f.onGround,attackId:f.attackId,hitstun:f.hitstun,blockstun:f.blockstun};
}
function battleState(h){
  const g=h.g;
  return plain({f1:fighterState(g.f1),f2:fighterState(g.f2),t:g.t,hitstop:g.hitstop,roundTime:g.roundTime,
    roundState:g.roundState,cameraX:g.cameraX,combo:g.combo,projectiles:g.projectiles.map(p=>({x:p.x,y:p.y,t:p.t,dead:p.dead})),effects:g.effects});
}
function runCase(h,session,character,move,options={},frames=240){
  session.playing=true;session.speed=1;
  session.select(character,move,options);
  h.tick();
  assert.equal(h.g.f1.def.id,character,`${character}/${move}: selected fighter instantiated`);
  const target=h.g.f2,attacker=h.g.f1,initialHp=target.hp,events=[],phases=new Set(),projectiles=[];
  let reaction=false,counter=false,knockdown=false,od=false,captured=false;
  const take=target.takeHit.bind(target);
  target.takeHit=(hit,...args)=>{const airborne=!target.onGround,result=take(hit,...args);events.push({frame:session.snapshot().frame,
    damage:result.dmg,blocked:!!result.blocked,ignored:!!result.ignored,kind:hit.kind,grab:!!hit.grab,projectile:!!hit.projectile,airborne});return result;};
  const takeAttacker=attacker.takeHit.bind(attacker);
  attacker.takeHit=(...args)=>{const result=takeAttacker(...args);counter=counter||!!result.countered;return result;};
  for(let frame=1;frame<frames;frame++){
    h.tick();
    assert.equal(h.g.f2,target,`${character}/${move}: scenario reset before its effects could be watched`);
    const snapshot=session.snapshot();phases.add(snapshot.phase);
    assert.ok([attacker.x,attacker.y,target.x,target.y,target.hp].every(Number.isFinite),`${character}/${move}: finite battle coordinates`);
    reaction=reaction||target.hitstun>0||target.blockstun>0||target.state==='ko';
    knockdown=knockdown||target.knockedDown||!target.onGround;
    od=od||!!attacker.attack?.od;
    if(!options.guard&&!options.od&&!captured&&snapshot.hits>0){
      h.render?.();
      fs.writeFileSync(path.join(output,`${character}-${move}-demo.png`),h.canvas.toBuffer('image/png'));captured=true;
    }
    for(const projectile of h.g.projectiles)if(!projectiles.includes(projectile))projectiles.push(projectile);
  }
  const snapshot=plain(session.snapshot()),damage=initialHp-target.hp;
  const actual=events.filter(e=>!e.ignored),hits=actual.filter(e=>!e.blocked&&e.damage>0),blocks=actual.filter(e=>e.blocked);
  assert.ok(snapshot.ready,`${character}/${move}: replay ready`);
  assert.ok(reaction,`${character}/${move}: target never reacted`);
  assert.equal(damage,events.reduce((sum,e)=>sum+(e.damage||0),0),`${character}/${move}: damage must come from real takeHit calls`);
  assert.equal(snapshot.damage,damage,`${character}/${move}: displayed damage agrees with battle`);
  assert.equal(snapshot.hits,hits.length,`${character}/${move}: displayed hits agree with actual contacts`);
  assert.equal(snapshot.blocks,blocks.length,`${character}/${move}: displayed blocks agree with actual contacts`);
  const airborneTarget=character==='ryu'&&move==='skill';
  if(airborneTarget)assert.ok(events.some(e=>e.airborne&&!e.ignored),`${character}/${move}: anti-air demonstration must contact a genuinely airborne target`);
  if(options.guard&&!attacker.def.moves[move].grab&&!attacker.def.moves[move].counter&&!airborneTarget){
    assert.ok(blocks.length>0,`${character}/${move}: guarding target did not block`);
    assert.equal(hits.length,0,`${character}/${move}: guard setup let through a hit`);
    assert.equal(damage,0,`${character}/${move}: guard without burnout must not lose HP`);
  }else assert.ok(hits.length>0,`${character}/${move}: no actual hit`);
  if(attacker.def.moves[move].counter)assert.ok(counter,`${character}/${move}: counter must be triggered by a real opposing strike`);
  if(options.od&&attacker.def.moves[move].category==='special')assert.ok(od,`${character}/${move}: OD option did not reach Fighter.startAttack`);
  if(!options.od)assert.equal(od,false,`${character}/${move}: ordinary demonstration must not silently enable OD`);
  assert.ok(phases.size>1,`${character}/${move}: phase display did not follow the move`);
  if(!options.guard&&attacker.def.moves[move].knockdown)assert.ok(knockdown,`${character}/${move}: expected launch / knockdown feedback`);
  return {character,move,options,frames,damage,hits:hits.length,blocks:blocks.length,counter,projectiles:projectiles.length,phases:[...phases]};
}

(async()=>{
  fs.mkdirSync(output,{recursive:true});fonts();
  require('@napi-rs/canvas').GlobalFonts.registerFromPath('/System/Library/Fonts/STHeiti Medium.ttc','monospace');
  const source=fs.readFileSync(path.join(root,'js/move-demo.js'),'utf8');
  const game=fs.readFileSync(path.join(root,'js/game.js'),'utf8');
  const art=nativeHarness(417,true,{game});await originalArt(art);
  const fullRaster=process.env.MOVE_DEMO_FULL_RASTER==='1',h=fullRaster?art:sampledHarness(art,game);
  const session=attachSession(h,source),cases=[],failures=[];
  const checkCase=(character,move,options)=>{
    try{const result=runCase(h,session,character,move,options);cases.push(result);return result;}
    catch(error){failures.push({character,move,options,error:error.message});console.error(`FAILED ${character}/${move}: ${error.message}`);return null;}
  };
  for(const character of h.s.CHARACTERS)for(const [index,move] of keys.entries()){
    const result=checkCase(character.id,move,{facing:index%2?-1:1});
    if(result)console.log(`${character.id}/${move}: ${result.hits} real hits, ${result.damage} damage`);
  }
  const guardCases=[['ryu','special'],['ryu','rush'],['ryu','skill'],['mei','rush'],['tank','special'],['tank','skill'],['volt','special'],['volt','skill'],['kaze','super2'],['kaze','skill'],['sage','rush'],['sage','tech'],['tank','tech'],['tank','super']];
  for(const [character,move] of guardCases)checkCase(character,move,{guard:true});
  for(const [character,move] of [['ryu','uppercut'],['mei','special'],['tank','rush'],['volt','tech'],['kaze','rush'],['sage','uppercut']])checkCase(character,move,{od:true,facing:-1});

  session.select('mei','super');session.playing=true;session.speed=1;h.tick(40);
  session.playing=false;const frozen=battleState(h),frame=session.snapshot().frame;h.tick(60);
  assert.deepEqual(battleState(h),frozen,'paused demonstration preserves all battle state');
  assert.equal(session.snapshot().frame,frame,'paused demonstration preserves timeline');
  session.playing=true;session.speed=1;session.restart();h.tick();const reset=plain(session.snapshot());
  assert.ok(reset.frame<=2,'replay starts at its beginning');assert.equal(reset.damage,0,'replay restores target HP and damage count');
  assert.equal(h.g.projectiles.length,0,'replay removes old projectiles');
  const cycle=reset.cycle;h.tick(250);assert.ok(session.snapshot().cycle>cycle,'automatic replay advances to a fresh cycle');
  session.restart();session.speed=.5;h.tick(20);const slow=session.snapshot().frame;
  session.restart();session.speed=1;h.tick(20);const normal=session.snapshot().frame;
  assert.ok(Math.abs(normal-slow*2)<=2,`half speed keeps 60 Hz steps (${slow} versus ${normal})`);
  session.select('missing-character','light');h.tick();
  assert.equal(session.snapshot().character,'ryu','unknown character safely falls back to an existing fighter');
  assert.equal(session.snapshot().move,'special','ordinary attacks cannot be selected as special demonstrations');
  session.speed=1;session.playing=true;session.select('ryu','super2');h.tick();
  const doomed=h.g.f2;doomed.hp=1;const koCycle=session.snapshot().cycle;
  h.tick(239);
  assert.equal(h.g.f2,doomed,'KO must not enter the ordinary training reset during a demo');
  assert.equal(doomed.hp,0,'low-health target is actually knocked out');
  assert.equal(doomed.state,'ko','KO target displays its real defeat state');
  h.tick();assert.ok(session.snapshot().cycle>koCycle,'KO demonstration restarts through its own loop');
  assert.equal(h.g.f2.hp,h.g.f2.maxHp,'new cycle restores target after KO');

  // Loading the module in a normal game must leave its inputs and simulation unchanged.
  const pair=[harness(775,{sources:{game}}),harness(775,{sources:{game:source+'\n'+game},globals:{URLSearchParams,location:{search:''}}})];
  for(const sample of pair){sample.s.DrawnAnimation=h.s.DrawnAnimation;sample.fight(2,.85,280);sample.s.CombatControls.collect=(fighter,intent)=>intent;sample.s.CombatControls.read=who=>({move:0,up:false,down:false,block:false,command:who==='p1'?'special':undefined});}
  assert.equal(pair[1].s.MoveDemoSession,undefined,'normal top-level game has no demo session');
  for(let i=0;i<180;i++){pair.forEach(sample=>sample.tick());assert.deepEqual(battleState(pair[1]),battleState(pair[0]),`normal simulation unchanged at frame ${i}`);}
  for(const search of ['?moveDemo=1','?moveDemo=0']){
    const top=harness(91,{sources:{game:'window.parent=window;\n'+source+'\n'+game},globals:{URLSearchParams,location:{search}}});
    assert.equal(top.s.MoveDemoSession,undefined,'direct / ordinary navigation cannot start a demonstration session');
  }
  const hash=text=>createHash('sha256').update(text).digest('hex');
  const report={passed:failures.length===0,originalPNG:true,simulationHz:60,fullCanvasEveryFrame:fullRaster,nativeContactCaptures:48,sources:{'js/move-demo.js':hash(source),'js/game.js':hash(game)},cases,failures,pause:true,restart:true,automaticReplay:true,lowHealthKO:true,halfSpeed:{slow,normal},normalModeUnchangedFrames:180};
  fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(report,null,2));
  assert.equal(failures.length,0,`${failures.length} demonstration cases failed; see output/move-demo/checks.json`);
  console.log(JSON.stringify({passed:true,cases:cases.length,report:path.join(output,'checks.json')}));
})().catch(error=>{console.error(error);process.exitCode=1;});
