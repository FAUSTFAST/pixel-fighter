// ============================================================
// ai.js — 电脑对手。基于距离/时机的状态机,输出与人类相同的 intent。
// difficulty: 0.6 简单 / 0.8 普通 / 1.0 困难 —— 影响反应频率与格挡率。
// ============================================================
(function () {
  class AI {
    constructor(fighter, difficulty = 0.85) {
      this.f = fighter;
      this.diff = difficulty;
      this.decisionCd = 0;      // 决策冷却
      this.intent = blank();
      this.aggro = 0.6;
    }

    think(self, foe, game) {
      const dist = Math.abs(foe.x - self.x);
      const dir = self.facing;
      const reach=(f,key)=>CombatSpacing.geometry(f.def.moves[key],f.width).far;
      const normalRange=Math.max(...CombatRules.normals.map(k=>reach(self,k)))+foe.width/2;
      const threat=foe.attack?CombatSpacing.geometry(foe.attack,foe.width).far+self.width/2+45:230;
      // Facing is resolved once by game.js, including hit / throw locks.

      if(self.attackContact&&self.attackConnected&&Math.random()<this.diff*.6){
        if(self.attack?.category==='normal'&&self.attack.cancellable){
          const command=self.meter>=100?'super1':self.def.id==='tank'?'rush':self.def.id==='sage'?'rush':'tech';
          return {...blank(),command};
        }
        if(self.attack?.category==='special'&&self.meter>=300&&!self.def.moves.super.grab)return {...blank(),command:'super'};
      }
      // 冷却期间维持上次意图(制造"节奏")
      if (this.decisionCd > 0) { this.decisionCd--; return {...this.intent,up:false,light:false,heavy:false,medium:false,mediumKick:false,lightKick:false,heavyKick:false,throw:false,special:false,command:null}; }

      const it = blank();
      const reactRoll = Math.random();
      if(self.grabbedBy){it.throw=self.grabbedBy.throwSequence?.t<=7&&Math.random()<this.diff*.18;return it;}

      // 若对手正在攻击且距离近 -> 有概率格挡
      const foeAttacking = !!foe.attack &&
        foe.attack && foe.stateT < foe.attack.startup + foe.attack.active + 2;
      if (foeAttacking && dist < threat && reactRoll < this.diff * 0.7) {
        it.block = true;
        it.move = -dir; // 后退格挡
        this.intent = it; this.decisionCd = 6 + U.randi(0,6);
        return it;
      }

      // 风格决策：选择与距离、对手状态相符的专属技。
      if(self.canAct() && Math.random()<.55*this.diff){
        let command=null;
        if(self.meter>=300 && (self.def.id==='tank'?dist<105:dist<350))command='super';
        else if(!foe.onGround && dist<170)command='uppercut';
        else switch(self.def.id){
          case 'ryu': command=dist<140?'tech':dist>260?'special':null;break;
          case 'mei': command=dist<190?'tech':dist<320?'rush':null;break;
          case 'tank': command=dist<105&&foe.onGround?'tech':dist<210?'skill':null;break;
          case 'volt': command=dist>230?'tech':dist>160?'skill':null;break;
          case 'kaze': command=foeAttacking&&dist<150?'skill':dist>160&&dist<290?'tech':null;break;
          case 'sage': command=dist>270?'tech':dist>140&&dist<270?'skill':null;break;
        }
        if(command){it.command=command;this.intent=it;this.decisionCd=22;return it;}
      }

      // 有满气且距离合适 -> 放必杀
      if (dist < 240 && dist > 60 && Math.random() < 0.5 * this.diff) {
        it.special = true;
        this.intent = it; this.decisionCd = 20;
        return it;
      }

      // 近距离 -> 攻击
      if (dist < normalRange) {
        if (Math.random() < 0.5 + this.aggro*0.3) {
          if(dist<85&&foe.onGround&&foe.hitstun<=0&&Math.random()<.25){it.throw=true;it.move=Math.random()<.3?-dir:0;}
          else {const options=['light','medium','heavy','lightKick','mediumKick','heavyKick'].filter(k=>dist<reach(self,k)+foe.width/2-8);if(options.length){const key=options[U.randi(0,options.length-1)];it[key]=true;if(key==='lightKick'&&Math.random()<.3)it.down=true;}else it.move=dir;}
        } else {
          // 偶尔后撤拉开
          it.move = -dir;
        }
        this.intent = it; this.decisionCd = 8 + U.randi(0, 10);
        return it;
      }

      // 中距离 -> 逼近,偶尔跳入
      if (dist < 260) {
        it.move = dir;
        if (Math.random() < 0.08 * this.diff) it.up = true; // 跳入
        this.intent = it; this.decisionCd = 6 + U.randi(0, 8);
        return it;
      }

      // 远距离 -> 若是远程角色则放必杀/否则接近
      const hasProj = self.def.moves.special.projectile;
      if (hasProj && Math.random() < 0.6) {
        it.special = true; this.intent = it; this.decisionCd = 24; return it;
      }
      it.move = dir;
      this.intent = it; this.decisionCd = 4 + U.randi(0, 6);
      return it;
    }
  }

  function blank() {
    return { move: 0, up: false, down: false, light: false, heavy: false, special: false, block: false };
  }

  window.AI = AI;
})();
