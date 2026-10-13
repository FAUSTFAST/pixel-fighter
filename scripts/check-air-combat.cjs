// Exercise air normals with real keyboard / pad edges, production physics and PNG contact.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {harness}=require('./gameplay-harness.cjs');
const {nativeHarness,createCanvas,root}=require('./native-game-art.cjs');
const neutral=()=>({move:0,up:false,down:false,block:false});
const baselineCommit='8ca09232b15160dc34e29e190f1f77024729e16c';
function setup(h,character,kind,facing=1,defense='air',distance=95){
  const g=h.fight();g.pve=false;g.training=false;
  const s=h.s,a=g.f1=new s.Fighter(s.CHARACTERS[character],400,facing,'P1');
  const b=g.f2=new s.Fighter(s.CHARACTERS[(character+1)%6],400+facing*distance,-facing,'P2');
  a.foe=b;b.foe=a;a.onGround=false;a.y=390;a.vy=0;
  if(defense==='air'){b.onGround=false;b.y=390;b.vy=0;}
  if(defense==='invulnerable')b.invuln=120;
  if(defense==='training')b.trainingInvincible=true;
  if(defense==='parry'){b.parrying=true;b.state='parry';}
  h.s.CombatControls.collect=(f,i)=>i;
  h.s.CombatControls.read=who=>who==='p2'&&defense==='parry'?{...neutral(),parryHeld:true}:
    who==='p2'&&['stand','crouch'].includes(defense)?{move:-b.facing,up:false,down:defense==='crouch',block:true}:neutral();
  assert.equal(a.startAttack(kind),true);return {g,a,b};
}
function rasterContact(a,b,box,art){
  const canvases=[a,b].map(f=>{
    const c=createCanvas(Math.ceil(box.w)+6,Math.ceil(box.h)+6),x=c.getContext('2d');
    x.translate(f.x-Math.floor(box.x)+3,f.y-Math.floor(box.y)+3);x.scale(f.facing*4.2,4.2);
    art.draw(x,f.def,f.sampleAnimation().animation);return x.getImageData(0,0,c.width,c.height);
  });
  const [one,two]=canvases,w=one.width;
  for(let y=0;y<one.height;y++)for(let x=1;x<w-1;x++)if(one.data[(y*w+x)*4+3]>96)
    for(const dx of [-1,0,1])if(two.data[(y*w+x+dx)*4+3]>96)return true;
  return false;
}
(async()=>{
  const native=nativeHarness(53);await native.s.DrawnAnimation.loading;const art=native.s.DrawnAnimation;
  const h=harness(53);h.s.DrawnAnimation=art;
  const old=harness(53,{sources:Object.fromEntries(['combat-rules','combat-spacing','fighter','game','motion60','ai'].map(name=>[name,execFileSync('git',['show',baselineCommit+':js/'+name+'.js'],{cwd:root}).toString()]))});
  old.s.DrawnAnimation=art;
  // No grounded balance / cancel / movement configuration changed.
  for(let i=0;i<6;i++)assert.equal(JSON.stringify(h.s.CHARACTERS[i].moves),JSON.stringify(old.s.CHARACTERS[i].moves));
  let groundFrames=0;
  for(const kind of ['light','medium','heavy','lightKick','mediumKick','heavyKick','tech','rush']){
    for(const game of [old,h]){
      const g=game.fight(1,.85,95);g.pve=false;g.training=false;
      game.s.CombatControls.collect=(f,i)=>i;game.s.CombatControls.read=neutral;
      g.f1.hp=g.f1.maxHp=g.f2.hp=g.f2.maxHp=100;g.f1.startAttack(kind);
    }
    for(let frame=0;frame<100;frame++){
      old.tick();h.tick();
      for(const who of ['f1','f2'])for(const field of ['x','y','vx','vy','hp','state','stateT','hitstun','blockstun','drive','meter','comboHits','comboDamage','facing'])assert.equal(h.g[who][field],old.g[who][field],kind+'/'+field);
      assert.equal(h.g.hitstop,old.g.hitstop);groundFrames++;
    }
  }
  let cases=0,contacts=0,landingChecks=0,inputChecks=0;
  const effects=new Set(),feedback=new Set(),events=[];
  for(let character=0;character<6;character++)for(const kind of h.s.CombatRules.airNormals)for(const facing of [1,-1]){
    const def=h.s.CHARACTERS[character],before=JSON.stringify(def.moves);
    const airborne=new h.s.Fighter(def,400,facing,'P1');assert.equal(airborne.tryJump(facing),true);
    const vx=airborne.vx,jumps=airborne.jumpsUsed;assert.equal(airborne.startAttack(kind),true);
    const m=airborne.attack;effects.add(m.airEffect);feedback.add(m.airFeedback.hitstop);
    assert.equal(airborne.vx,vx,'jump momentum retained');assert.equal(airborne.jumpsUsed,jumps);
    assert.equal(m.level,'overhead');assert.equal(m.stepDistance,0);assert.equal(m.cancellable,false);
    assert.equal(airborne.tryJump(-facing),false,'cannot cancel an air normal with second jump');
    for(let t=0;t<m.startup;t++){airborne.stateT=t;assert.equal(airborne.getHitBox(),null);}
    airborne.stateT=m.startup;assert.ok(airborne.getHitBox());
    const selected=art.selection(def,airborne.sampleAnimation().animation);
    assert.equal(selected.clip,m.physicalContact.clip);
    assert.equal(selected.sprite,art.collisionSprite(airborne),'collision uses exact original drawing');
    assert.equal(JSON.stringify(def.moves),before,'air variant must not mutate ground data');
    const state={projectiles:[],effects:[]};
    airborne.y=459;airborne.vy=2;airborne.update(state);
    assert.equal(airborne.onGround,true);assert.equal(airborne.attack,null);assert.equal(airborne.getHitBox(),null);
    assert.equal(airborne.airLandingFrames,m.landingRecovery);assert.equal(airborne.canStartAttack('light'),false);
    for(let t=0;t<m.landingRecovery;t++)airborne.update(state);
    assert.equal(airborne.canAct(),true);landingChecks++;
    for(const defense of ['air','ground','stand','crouch','parry','invulnerable','training','whiff']){
      const {g,a,b}=setup(h,character,kind,facing,defense,defense==='whiff'?340:95),move=a.attack,received=[];
      const take=b.takeHit.bind(b),x=b.x;
      b.takeHit=(box,...args)=>{
        assert.ok(a.stateT>=move.startup&&a.stateT<move.startup+move.active);
        assert.ok(rasterContact(a,b,box,art),`damage requires native raster contact: ${def.id}/${kind}/${facing}/${defense}/t${a.stateT} box=${JSON.stringify({x:box.x,y:box.y,w:box.w,h:box.h})}`);
        const r=take(box,...args);received.push({blocked:r.blocked,parried:!!r.parried,damage:r.dmg,vy:b.vy,vx:b.vx,reaction:b.reaction,knockedDown:!!b.knockedDown});contacts++;return r;
      };
      for(let t=0;t<60;t++)h.tick();
      assert.ok(received.length<=1,'one hit per attack instance');
      if(['whiff','invulnerable','training'].includes(defense)){assert.equal(received.length,0);assert.equal(b.hp,b.maxHp);if(defense==='whiff')assert.equal(b.x,x);}
      else if(received.length){
        const hit=received[0];
        if(defense==='stand')assert.equal(hit.blocked,true,'air normals require standing guard');
        if(defense==='crouch')assert.equal(hit.blocked,false,'crouch guard cannot block overhead');
        if(defense==='parry')assert.equal(hit.parried,true);
        if(defense==='air'){
          assert.equal(hit.vy,move.airHit.vy);assert.equal(hit.knockedDown,!!move.airHit.knockdown);
          if(kind==='heavy')assert.equal(hit.reaction,'knockdown');
          if(kind==='heavyKick')assert.equal(hit.reaction,'launch');
        }
        if(['ground','stand','crouch'].includes(defense))assert.equal(hit.knockedDown,false);
      }
      if(defense==='air'){assert.equal(received.length,1,'every air normal must hit at tested contact distance');events.push({character:def.id,kind,facing,...received[0]});}
      cases++;
    }
  }
  assert.equal(effects.size,6);assert.ok(feedback.size>=5);
  let preHitStops=0,jumpInLinks=0;
  for(const facing of [1,-1])for(const kind of h.s.CombatRules.airNormals)for(const height of [50,160,250]){
    const {a,b}=setup(h,0,kind,facing,'training',100);a.y=460-height;a.vx=facing*4.37;
    const x=b.x;
    for(let t=0;t<50;t++){
      const attacking=!!a.attack;h.tick();
      if(attacking)assert.equal(b.x,x,'descending air strike cannot shove an unhit defender');
    }
    preHitStops++;
  }
  for(const kind of ['medium','mediumKick']){
    const {a,b}=setup(h,0,kind,1,'ground',68),received=[],take=b.takeHit.bind(b);let queued=false;
    b.takeHit=(box,...args)=>{const r=take(box,...args);received.push({air:!!a.attack.airNormal,combo:b.comboHits});return r;};
    for(let t=0;t<100;t++){
      if(a.onGround&&a.canAct()&&!queued){a.queueAttack('light');queued=true;}
      h.tick();
    }
    assert.equal(received.length,2);assert.equal(received[0].air,true);assert.equal(received[1].air,false);assert.equal(received[1].combo,2);
    jumpInLinks++;
  }
  // Down + kick never borrows a grounded low / sweep during a jump.
  for(const [kind,canonical] of Object.entries({lowKick:'lightKick',lowMediumKick:'mediumKick',sweep:'heavyKick'})){
    const f=new h.s.Fighter(h.s.CHARACTERS[0],400,1,'P1');f.tryJump(0);f.startAttack(kind);
    assert.equal(f.attack.airKind,canonical);assert.equal(f.attack.level,'overhead');assert.equal(f.attack.knockdown,false);
  }
  // Both players, both control types and real keyboard / gamepad edges.
  for(const mode of ['classic','modern'])for(const who of ['p1','p2'])for(const device of ['keyboard','pad'])for(const action of (mode==='classic'?h.s.CombatRules.airNormals:['light','medium','heavy'])){
    const game=harness(7),g=game.fight(1,.85,650),s=game.s;g.pve=false;s.Input.MODES[who]=mode;
    const f=who==='p1'?g.f1:g.f2,key=s.Input.MAP[who][action];f.tryJump(0);
    if(device==='keyboard')game.key(key);else s.Input.setGamepadKeys([key]);
    game.tick();assert.equal(f.attack?.airNormal,true);
    assert.equal(f.attack.airKind,mode==='classic'?action:f.def.modernNormals[['light','medium','heavy'].indexOf(action)]);inputChecks++;
  }
  // Independent air hits retain normal damage scaling and attack-ID sharing.
  {
    const def=h.s.CHARACTERS[0],a=new h.s.Fighter(def,400,1,'P1'),b=new h.s.Fighter(def,500,-1,'P2');
    a.onGround=false;a.y=300;b.onGround=false;b.y=300;a.startAttack('light');a.stateT=a.attack.startup;
    b.takeHit(a.getHitBox(),1,false);assert.equal(b.lastDamageScale,1);
    const second=h.s.CombatRules.airMove(def,'medium');b.takeHit({...second,owner:a,attackId:a.attackId+1},1,false);
    assert.equal(b.lastDamageScale,.9);assert.equal(b.comboMoves,2);
  }
  const result={passed:true,baselineCommit,groundFrames,groundMoveCatalogUnchanged:true,cases,contacts,landingChecks,inputChecks,preHitStops,jumpInLinks,effects:effects.size,events};
  const out=path.join(root,'output/air-combat');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({...result,events:events.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
