// Deterministic replay of production Fighter / Projectile behavior, at 60 Hz.
(function () {
  const settings = Object.freeze({ defenderX:280, attackerX:800, firstJump:62, secondJump:82, frames:150, move:'special', attacker:'tank' });
  const cases = Object.freeze({ground:{label:'铁拳 · 地裂震拳',options:{}},crescent:{label:'苍月 · 弦月剑气',options:{attacker:'kaze',firstJump:28,secondJump:48}}});
  function copyFighter(f) {
    return Object.assign(Object.create(Fighter.prototype), f, {
      attack:f.attack && {...f.attack}, trail:f.trail.map(p=>({...p})),
      airJumpEffect:f.airJumpEffect && {...f.airJumpEffect}, foe:null,
    });
  }
  function simulate(mode='double', options={}) {
    const cfg={...settings,...options};
    const defender=new Fighter(CHARACTERS[0],cfg.defenderX,1,'P1');
    const attacker=new Fighter(CHARACTERS.find(c=>c.id===cfg.attacker),cfg.attackerX,-1,'P2');
    const game={projectiles:[],effects:[],hitstop:0,shake:0,f1:defender,f2:attacker};
    const frames=[],events=[];let hits=0,spawned=0,passed=false,clearance=Infinity;
    const add=(frame,type,text)=>events.push({frame,type,text});
    if(!attacker.startAttack(cfg.move,{strength:2}))throw new Error('Test attack could not start');
    add(0,'cast',attacker.attack.name+'起手');
    for(let frame=0;frame<=cfg.frames;frame++){
      if(game.hitstop>0)game.hitstop--;
      else {
        const jump=mode!=='stand'&&frame===cfg.firstJump||mode==='double'&&frame===cfg.secondJump;
        const before=defender.jumpsUsed;
        defender.handleIntent({move:0,up:jump,down:false,block:false},game);
        if(defender.jumpsUsed>before)add(frame,before===1?'second':'first',before===1?'第二次起跳':'第一次起跳');
        const count=game.projectiles.length;
        defender.update(game);attacker.update(game);
        if(game.projectiles.length>count){spawned+=game.projectiles.length-count;add(frame,'wave','冲击波发射');}
        for(const p of game.projectiles){
          p.update();
          if(p.dead)continue;
          const b=defender.bodyBox,box=p.box;
          if(box.x < b.x+b.w && box.x+box.w > b.x)clearance=Math.min(clearance,box.y-(b.y+b.h));
          const hit=p.hitTarget(defender);
          if(hit){hits++;game.hitstop=6;add(frame,'hit','波命中，扣血 '+hit.dmg);}
          else if(!passed && p.dir<0 && box.x+box.w<=b.x){passed=true;add(frame,'pass','波完全越过角色');}
        }
        game.projectiles=game.projectiles.filter(p=>!p.dead);
        if(frame>cfg.firstJump&&defender.onGround&&!frames.at(-1)?.defender.onGround)add(frame,'land','角色落地');
      }
      frames.push({frame,defender:copyFighter(defender),attacker:copyFighter(attacker),
        projectiles:game.projectiles.map(p=>Object.assign(Object.create(Projectile.prototype),p)),
        events:events.filter(e=>e.frame<=frame),hits,passed});
    }
    return {mode,settings:cfg,frames,events,result:{hits,damage:defender.maxHp-defender.hp,hp:defender.hp,
      spawned,passed,clearance:Number.isFinite(clearance)?clearance:null,
      jumps:events.filter(e=>e.type==='first'||e.type==='second').length,
      grounded:defender.onGround,invincible:!!defender.trainingInvincible||defender.invuln>0}};
  }
  window.JumpWaveScenario={settings,cases,simulate};
})();
