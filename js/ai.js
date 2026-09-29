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
      const dir = U.sign(foe.x - self.x);
      self.facing = dir || self.facing;   // 面向对手(与人类一致由 game 统一处理,这里兜底)

      // 冷却期间维持上次意图(制造"节奏")
      if (this.decisionCd > 0) { this.decisionCd--; return this.intent; }

      const it = blank();
      const reactRoll = Math.random();

      // 若对手正在攻击且距离近 -> 有概率格挡
      const foeAttacking = ['light','heavy','special'].includes(foe.state) &&
        foe.attack && foe.stateT < foe.attack.startup + foe.attack.active + 2;
      if (foeAttacking && dist < 130 && reactRoll < this.diff * 0.7) {
        it.block = true;
        it.move = -dir; // 后退格挡
        this.intent = it; this.decisionCd = 6 + U.randi(0,6);
        return it;
      }

      // 有满气且距离合适 -> 放必杀
      if (self.meter >= 50 && dist < 240 && dist > 60 && Math.random() < 0.5 * this.diff) {
        it.special = true;
        this.intent = it; this.decisionCd = 20;
        return it;
      }

      // 近距离 -> 攻击
      if (dist < 90) {
        if (Math.random() < 0.5 + this.aggro*0.3) {
          if (Math.random() < 0.6) it.light = true; else it.heavy = true;
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
      if (hasProj && self.meter >= 50 && Math.random() < 0.6) {
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
