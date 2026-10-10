// 60 Hz CPU decisions: delayed observations, footwork, hit confirms and shared move rules.
(function () {
  const profiles=Object.freeze({
    easy:Object.freeze({name:'简单',reaction:[23,31],decision:[18,30],confirm:[6,9],confirmChance:.32,maxChain:2,guard:.36,antiAir:.22,techChance:.12,techDelay:10,mistake:.23,projectileCd:155,shotFootwork:36,jumpCd:155,od:0,superLevel:1,driveRush:0}),
    normal:Object.freeze({name:'普通',reaction:[12,17],decision:[10,17],confirm:[3,6],confirmChance:.73,maxChain:3,guard:.68,antiAir:.58,techChance:.38,techDelay:6,mistake:.09,projectileCd:115,shotFootwork:48,jumpCd:115,od:.18,superLevel:2,driveRush:.10}),
    hard:Object.freeze({name:'困难',reaction:[6,9],decision:[5,10],confirm:[2,4],confirmChance:.93,maxChain:5,guard:.86,antiAir:.83,techChance:.66,techDelay:3,mistake:.035,projectileCd:90,shotFootwork:60,jumpCd:85,od:.42,superLevel:3,driveRush:.22}),
  });
  const styles={
    ryu:{range:175,zone:.25,pressure:.65,finish:['tech','rush','uppercut'],poke:['medium','mediumKick','lowKick']},
    mei:{range:125,zone:.04,pressure:.85,finish:['special','skill','uppercut'],poke:['light','medium','mediumKick']},
    tank:{range:110,zone:.08,pressure:.76,finish:['rush','skill','uppercut'],poke:['medium','heavy','lowKick']},
    volt:{range:195,zone:.20,pressure:.72,finish:['rush','uppercut','tech'],poke:['mediumKick','medium','lowMediumKick']},
    kaze:{range:225,zone:.22,pressure:.60,finish:['tech','rush','uppercut'],poke:['medium','heavyKick','lowMediumKick']},
    sage:{range:235,zone:.36,pressure:.46,finish:['uppercut','rush','skill'],poke:['medium','heavy','lowKick']},
  };
  const blank=()=>({move:0,up:false,down:false,block:false});
  const pickRange=range=>U.randi(range[0],range[1]);
  const reach=(f,kind)=>CombatSpacing.maxReach(f.def.moves[kind],f.width);

  class AI {
    constructor(fighter,difficulty=.85){
      this.f=fighter;this.diff=difficulty;
      this.level=difficulty<=.65?'easy':difficulty<.95?'normal':'hard';
      this.profile=profiles[this.level];this.style=styles[fighter.def.id]||styles.ryu;
      this.reset();
    }
    reset(){
      this.reactionFrames=pickRange(this.profile.reaction);
      this.clock=0;this.observations=[];this.decisionCd=0;this.intent=blank();
      this.strategy='approach';this.strategyFrames=0;
      this.projectileCd=0;this.jumpCd=0;this.driveCd=0;this.dashCd=0;this.footwork=Infinity;this.lastX=this.f.x;
      this.recent=[];this.chain=1;this.contactId=-1;this.confirmDelay=0;this.confirmRoll=0;
      this.response=null;this.threatKey=null;this.airAttempts=new Set();this.grabFrames=0;this.techRoll=1;
    }
    observe(self,foe,game){
      this.observations.push({
        x:foe.x,y:foe.y,vx:foe.vx,vy:foe.vy,hp:foe.hp,onGround:foe.onGround,
        attack:foe.attack?{...foe.attack}:null,attackId:foe.attackId,stateT:foe.stateT,
        crouching:foe.crouching,blocking:foe.blocking,hitstun:foe.hitstun,blockstun:foe.blockstun,
        projectiles:(game.projectiles||[]).filter(p=>p.owner!==self&&!p.dead).map(p=>({
          x:p.x,y:p.y,vx:p.vx,box:{...p.box},level:p.level,id:p.attackId,t:p.t,armFrames:p.armFrames,
        })),
      });
      if(this.observations.length<=this.reactionFrames)return null;
      return this.observations.shift();
    }
    weighted(candidates){
      const pool=candidates.filter(c=>c.weight>0).map(c=>({...c,weight:c.weight/(1+this.recent.filter(k=>k===c.kind).length*1.15)}));
      let roll=Math.random()*pool.reduce((n,c)=>n+c.weight,0);
      return pool.find(c=>(roll-=c.weight)<0)||pool.at(-1)||null;
    }
    affordable(self,kind,opts={}){
      const m=self.def.moves[kind];if(!m||!self.canStartAttack(kind)||self.meter<(m.cost||0))return false;
      const cost=kind==='driveRush'?(self.attack?.category==='normal'?3:1):m.driveCost||(opts.od?2:0);
      return !cost||!self.burnout&&self.drive>=cost;
    }
    inRange(self,seen,kind,extra=0){
      const m=self.def.moves[kind],dist=Math.abs(seen.x-self.x);
      if(kind==='driveRush')return dist>70&&dist<m.travelDistance+Math.max(...this.style.poke.map(k=>reach(self,k)))+14;
      if(m.grab)return seen.onGround&&!seen.hitstun&&!seen.blockstun&&dist<reach(self,kind)+34-8;
      if(m.projectile){
        if(m.projSpeed===0)return dist<210&&dist>90;
        return dist>100&&dist<780;
      }
      return dist<reach(self,kind)+34+(m.travelDistance?Math.min(170,m.travelDistance*.6):0)+extra-8;
    }
    emit(self,kind,opts={}){
      if(!this.affordable(self,kind,opts))return blank();
      this.recent.push(kind);if(this.recent.length>7)this.recent.shift();
      this.intent=blank();this.decisionCd=pickRange(this.profile.decision);
      const m=self.def.moves[kind];
      if(m.projectile){this.projectileCd=this.profile.projectileCd;this.footwork=0;this.strategy='approach';this.strategyFrames=60;}
      if(kind==='driveRush')this.driveCd=150;
      if(kind==='throw')return {...blank(),throw:true,move:opts.back?-self.facing:0};
      return {...blank(),command:kind,commandOptions:opts};
    }
    shotAllowed(self,game){
      return this.projectileCd===0&&this.footwork>=this.profile.shotFootwork&&
        !(game.projectiles||[]).some(p=>p.owner===self&&!p.dead);
    }
    confirm(self,seen,game){
      if(!self.attack||!self.attackContact)return null;
      if(!self.attackConnected){this.chain=1;return null;}
      if(self.attack.hitFrames?.length>1&&self.stateT<self.attack.hitFrames.at(-1))return null;
      if(this.contactId!==self.attackId){
        this.contactId=self.attackId;this.confirmDelay=pickRange(this.profile.confirm);this.confirmRoll=Math.random();
      }
      const age=self.stateT-self.contactFrame;
      if(age<this.confirmDelay||!self.hasCancelWindow()||this.confirmRoll>=this.profile.confirmChance||this.chain>=this.profile.maxChain)return null;
      const m=self.attack,candidates=[];
      const add=(kind,weight,opts={})=>{
        const next=self.def.moves[kind];
        // After confirming a grounded hit, do not spend resources on a move
        // whose startup already exceeds the remaining stun. Cancel legality
        // alone does not make a continuation a true combo.
        if(kind!=='driveRush'&&self.foe?.comboActive&&self.foe.onGround&&next.startup>self.foe.hitstun)return;
        if(this.affordable(self,kind,opts)&&this.inRange(self,seen,kind))candidates.push({kind,weight,opts});
      };
      if(m.category==='normal'){
        for(const kind of m.cancelInto||[])add(kind,5);
        if(self.repeatChain<2)for(const kind of m.chainInto||[])add(kind,kind===self.attackKind?1.2:.6);
        for(const kind of m.cancellable?this.style.finish:[]){
          const next=self.def.moves[kind];if(next.grab||next.counter)continue;
          if(next.projectile&&!this.shotAllowed(self,game))continue;
          const od=this.level!=='easy'&&self.drive>=4&&Math.random()<this.profile.od;
          add(kind,2.5,{strength:2,od});
        }
        if(m.cancellable&&this.level==='hard'&&self.drive>=4&&this.driveCd===0&&this.chain<3)add('driveRush',1.6);
      }
      if(m.category==='normal'&&m.cancellable||m.category==='special'){
        for(const kind of CombatRules.supers){
          const next=self.def.moves[kind];if(next.saLevel>this.profile.superLevel||next.grab)continue;
          const useful=seen.hp<=next.dmg*1.4||self.meter>=self.maxMeter||this.chain>=this.profile.maxChain-1||this.level==='hard'&&this.chain>=3&&self.meter>=200;
          if(useful)add(kind,this.level==='easy'?.3:next.saLevel===3?4:1.5);
        }
      }
      const next=this.weighted(candidates);if(!next)return null;
      this.chain++;this.confirmRoll=1;return this.emit(self,next.kind,next.opts);
    }
    threats(self,seen){
      const dist=Math.abs(seen.x-self.x);
      const attack=seen.attack;
      if(attack&&!attack.projectile&&!attack.noHit&&!attack.grab&&seen.stateT<attack.startup+attack.active){
        const far=CombatSpacing.geometry(attack,self.width,seen.stateT,!seen.onGround&&!attack.launch).far+self.width/2;
        if(dist<far+35&&Math.abs(seen.y-self.y)<180)return {key:'attack:'+seen.attackId,kind:'melee',level:attack.level,air:!seen.onGround};
      }
      for(const p of seen.projectiles){
        if(p.t<p.armFrames)continue;
        const dx=self.x-p.x;
        if(p.vx&&dx*p.vx<0)continue;
        const time=p.vx?Math.abs(dx/p.vx):0;
        const body=self.bodyBox;
        if(time<35&&(p.vx||Math.abs(dx)<120)&&p.box.y<body.y+body.h+40&&p.box.y+p.box.h>body.y-30)
          return {key:'wave:'+p.id,kind:'wave',level:p.level,time};
      }
      if(!seen.onGround&&dist<190&&seen.vy>-7)return {key:'jump:'+seen.attackId,kind:'air'};
      return null;
    }
    defend(self,seen,threat){
      if(!threat){this.response=null;this.threatKey=null;return null;}
      if(this.threatKey!==threat.key){
        this.threatKey=threat.key;this.response=null;
        if(threat.kind==='air'){
          if(Math.random()<this.profile.antiAir&&this.affordable(self,'uppercut'))this.response={kind:'uppercut',until:this.clock+18};
        }else if(Math.random()<this.profile.guard){
          let kind='guard';
          if(threat.kind==='wave'&&this.jumpCd===0&&threat.time>15&&Math.random()<(this.level==='easy'?.18:.42))kind='jump';
          else if(this.level==='hard'&&!self.burnout&&self.drive>=1.5&&Math.random()<.14)kind='parry';
          this.response={kind,until:this.clock+(threat.kind==='wave'?60:24),level:threat.level};
        }
      }
      const r=this.response;if(!r||r.until<this.clock)return null;
      if(r.kind==='uppercut'){this.response=null;return this.emit(self,'uppercut',{strength:2});}
      if(r.kind==='jump'){this.response=null;this.jumpCd=this.profile.jumpCd;return {...blank(),up:true,move:Math.abs(seen.x-self.x)>220?self.facing:0};}
      if(r.kind==='parry')return {...blank(),parryHeld:true};
      return {...blank(),move:-self.facing,block:true,down:r.level==='low'||seen.crouching&&r.level!=='overhead'};
    }
    aerial(self,seen,threat){
      const dist=Math.abs(seen.x-self.x);
      const airKey=threat?.kind==='wave'?threat.key:'neutral';
      if(self.jumpsUsed===1&&self.airFrames>=12&&!this.airAttempts.has(airKey)){
        this.airAttempts.add(airKey);
        const chance=threat?.kind==='wave'?(this.level==='hard'?.7:this.level==='normal'?.4:.1):.04;
        if(Math.random()<chance)return {...blank(),up:true,move:dist>180?self.facing:0};
      }
      if(self.canAct()&&self.vy>-2&&self.y>seen.y-135&&this.decisionCd===0){
        const options=['lightKick','mediumKick','heavyKick','light'].filter(k=>this.inRange(self,seen,k));
        if(options.length)return this.emit(self,options[U.randi(0,options.length-1)]);
      }
      return {...blank(),move:dist>120?self.facing:0};
    }
    chooseStrategy(self,seen){
      if(--this.strategyFrames>0)return;
      this.strategyFrames=U.randi(45,100);
      const corner=self.x<-75||self.x>1035;
      if(corner){this.strategy='approach';return;}
      const roll=Math.random();
      this.strategy=roll<this.style.zone?'zone':roll<this.style.zone+.20?'bait':roll<this.style.zone+.30?'retreat':'approach';
      if(Math.abs(seen.x-self.x)>440&&this.strategy==='retreat')this.strategy='approach';
    }
    neutral(self,seen,game){
      const dist=Math.abs(seen.x-self.x),dir=self.facing,corner=self.x<-75||self.x>1035;
      this.chooseStrategy(self,seen);
      if(this.decisionCd>0)return {...this.intent,up:false,command:null};
      this.decisionCd=pickRange(this.profile.decision);
      if(Math.random()<this.profile.mistake){this.intent=blank();return this.intent;}
      const normalRange=Math.max(...CombatRules.normals.map(k=>reach(self,k)))+34;
      const punishWindow=seen.attack&&seen.stateT>=seen.attack.startup+seen.attack.active?
        seen.attack.startup+seen.attack.active+seen.attack.recovery-seen.stateT-this.reactionFrames:0;
      const recovering=punishWindow>5;
      const candidates=[];
      const add=(kind,weight,opts={})=>{if(this.affordable(self,kind,opts)&&this.inRange(self,seen,kind))candidates.push({kind,weight,opts});};
      if(dist<normalRange&&seen.onGround){
        if(dist<100&&!seen.hitstun&&!seen.blockstun){add('throw',seen.blocking?4:1.2,{back:corner});if(self.def.id==='tank')add('tech',seen.blocking?4:1.1);}
        for(const kind of CombatRules.normals){
          const m=self.def.moves[kind];let weight=this.style.poke.includes(kind)?4:1.5;
          if(m.startup>10&&!recovering)weight*=.45;
          if(m.level==='low'&&!seen.crouching)weight*=1.5;
          if(recovering&&m.startup<punishWindow&&(kind==='heavy'||kind==='heavyKick'))weight*=this.level==='hard'?3:2;
          if(this.strategy==='bait')weight*=.55;
          add(kind,weight);
        }
        for(const kind of this.style.finish){const m=self.def.moves[kind];if(!m.projectile&&!m.launch&&!m.grab)add(kind,recovering?3:.55);}
        if(this.level!=='easy'&&seen.blocking)add(self.def.id==='mei'?'rush':'skill',1);
        if(this.level==='hard'&&self.drive>=2&&!self.burnout)add('impact',.35);
        if(this.level!=='easy'&&this.shotAllowed(self,game)&&['zone','bait'].includes(this.strategy)){
          for(const kind of CombatRules.specials)if(self.def.moves[kind].projectile&&self.def.moves[kind].projSpeed===0)add(kind,1.6);
        }
      }
      if(dist>normalRange&&dist<400&&this.strategy==='approach'){
        for(const kind of this.style.finish)if(self.def.moves[kind].travelDistance)add(kind,2.2);
      }
      if(dist>220&&seen.onGround&&this.shotAllowed(self,game)){
        for(const kind of CombatRules.specials){
          const m=self.def.moves[kind];if(!m.projectile||m.projSpeed===0)continue;
          // Projectile zoning is one option alongside sustained movement and jump-ins.
          add(kind,this.strategy==='zone'?4:1.2,{strength:U.randi(1,3)});
        }
      }
      const movementWeight=dist>normalRange?9:Math.max(2,(1-this.style.pressure)*9);
      candidates.push({kind:'move',weight:movementWeight});
      // Delayed observations also govern ordinary dashes. Commit only when no
      // approaching wave or active strike is visible; do not dash every decision.
      if(self.onGround&&this.dashCd===0&&!seen.attack&&!seen.projectiles.length){
        const weight=this.level==='easy'?.65:this.level==='normal'?1.7:2.6;
        if(dist>normalRange+100&&dist<700&&this.strategy==='approach')candidates.push({kind:'dashForward',weight});
        if(dist<normalRange&&!corner&&['bait','retreat'].includes(this.strategy))candidates.push({kind:'dashBack',weight});
      }
      if(self.onGround&&this.jumpCd===0&&dist>160&&dist<620)candidates.push({kind:'jump',weight:this.strategy==='approach'?1.8:.55});
      if(this.profile.driveRush&&this.driveCd===0&&dist>normalRange+25&&dist<420&&self.drive>=2&&Math.random()<this.profile.driveRush)add('driveRush',2.8);
      const action=this.weighted(candidates);
      if(action?.kind==='dashForward'||action?.kind==='dashBack'){
        this.dashCd=this.level==='easy'?150:this.level==='normal'?105:75;
        this.recent.push(action.kind);if(this.recent.length>7)this.recent.shift();this.intent=blank();
        return {...blank(),dash:action.kind==='dashForward'?'forward':'back'};
      }
      if(action&&action.kind!=='move'&&action.kind!=='jump')return this.emit(self,action.kind,action.opts);
      if(action?.kind==='jump'){this.jumpCd=this.profile.jumpCd;this.intent={...blank(),move:dir};return {...this.intent,up:true};}
      const target=this.strategy==='zone'?this.style.range+100:this.strategy==='bait'?this.style.range+35:this.style.range;
      let move=dist>target+20?dir:dist<target-30&&!corner?-dir:0;
      if(this.strategy==='approach'&&dist>95)move=dir;
      if(this.strategy==='retreat'&&!corner&&dist<350)move=-dir;
      this.intent={...blank(),move,block:move===-dir};return this.intent;
    }
    think(self,foe,game){
      this.clock++;
      for(const key of ['decisionCd','projectileCd','jumpCd','driveCd','dashCd'])this[key]=Math.max(0,this[key]-1);
      if(self.onGround&&['walk','block'].includes(self.state))this.footwork+=Math.min(Math.abs(self.x-this.lastX),Math.abs(self.vx));
      this.lastX=self.x;
      const seen=this.observe(self,foe,game);
      if(self.state==='ko')return blank();
      if(self.grabbedBy){
        if(this.grabFrames++===0)this.techRoll=Math.random();
        return {...blank(),throw:this.grabFrames===this.profile.techDelay&&this.techRoll<this.profile.techChance};
      }
      this.grabFrames=0;
      if(!seen)return blank();
      if(self.hitstun>0||self.blockstun>0||self.state==='hit'){
        this.chain=1;this.response=null;this.intent=blank();return blank();
      }
      const confirm=this.confirm(self,seen,game);if(confirm)return confirm;
      if(self.attack){
        if(self.attackKind==='driveRush'&&self.stateT>=3){
          const options=this.style.poke.filter(k=>this.affordable(self,k)&&this.inRange(self,seen,k));
          if(options.length)return this.emit(self,options[0]);
        }
        return blank();
      }
      this.chain=1;
      const threat=this.threats(self,seen);
      if(!self.onGround)return this.aerial(self,seen,threat);
      this.airAttempts.clear();
      const defense=this.defend(self,seen,threat);if(defense)return defense;
      return this.neutral(self,seen,game);
    }
  }
  AI.PROFILES=profiles;
  window.AI=AI;
})();
