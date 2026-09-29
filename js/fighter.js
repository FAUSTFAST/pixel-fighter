// ============================================================
// fighter.js — 战斗角色实例:物理、状态机、命中判定、绘制。
// 以及 Projectile(飞行道具)。
// 逻辑坐标:x 为角色中心,y 为脚底(= GROUND_Y 时站地面)。
// ============================================================
(function () {
  const GROUND = 460;      // == GROUND_Y
  const GRAV = 0.62;
  const FLOOR_MINX = 60, FLOOR_MAXX = 900;
  const SCALE = 2.1;        // 精灵放大倍数

  class Projectile {
    constructor(owner, dir, cfg) {
      this.owner = owner;
      this.dir = dir;
      this.x = owner.x + dir * 40;
      this.y = owner.y - 34;
      this.vx = dir * (cfg.big ? 6.5 : 8.5);
      this.color = cfg.projColor || '#5ad2ff';
      this.big = !!cfg.big;
      this.dmg = cfg.dmg;
      this.kb = cfg.kb;
      this.hitstun = cfg.hitstun;
      this.r = cfg.big ? 20 : 13;
      this.life = 120;
      this.dead = false;
      this.t = 0;
    }
    get box() { return { x: this.x - this.r, y: this.y - this.r, w: this.r*2, h: this.r*2 }; }
    update() {
      this.x += this.vx; this.t += 1; this.life--;
      if (this.life <= 0 || this.x < 20 || this.x > 940) this.dead = true;
    }
    draw(ctx) {
      const pulse = 1 + Math.sin(this.t * 0.5) * 0.15;
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 1.7 * pulse, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.r * pulse, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(this.x - this.dir*3, this.y - 3, this.r * 0.4, 0, 7); ctx.fill();
      // 拖尾
      ctx.globalAlpha = 0.4; ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(this.x - this.dir*this.r, this.y, this.r*0.7, 0, 7); ctx.fill();
      ctx.restore();
    }
  }

  class Fighter {
    constructor(def, x, facing, playerLabel) {
      this.def = def;
      this.name = def.name;
      this.label = playerLabel;      // 'P1' / 'P2'
      this.x = x;
      this.y = GROUND;
      this.vx = 0; this.vy = 0;
      this.facing = facing;          // 1 右, -1 左
      this.onGround = true;
      this.maxHp = def.hp;
      this.hp = def.hp;
      this.meter = 0; this.maxMeter = 100;
      this.state = 'idle';
      this.stateT = 0;               // 当前状态已持续帧
      this.walkPhase = 0;
      this.attack = null;            // 当前招式对象
      this.attackHasHit = false;     // 本次攻击是否已命中(避免多次)
      this.hitstun = 0;              // 受击硬直剩余帧
      this.blockstun = 0;
      this.stunned = false;
      this.crouching = false;
      this.blocking = false;
      this.invuln = 0;
      this.wins = 0;
      this.flashT = 0;               // 受击白闪
      this.koFall = 0;               // KO 倒地旋转
      this.dead = false;
      this.width = 34;               // 身体碰撞宽(逻辑)
    }

    get bodyBox() {
      const h = this.crouching ? 54 : 84;
      return { x: this.x - this.width/2, y: this.y - h, w: this.width, h };
    }

    // 命中盒(仅攻击 active 帧有效)
    getHitBox() {
      if (!this.attack || this.state === 'hit' || this.state === 'ko') return null;
      const m = this.attack;
      const prog = this.stateT;
      if (prog < m.startup || prog >= m.startup + m.active) return null;
      if (m.projectile) return null; // 飞行道具在生成时处理
      const front = this.facing;
      const cx = this.x + front * (this.width/2 + m.reach/2);
      const wk = (this.attackKind === 'special' && this._specialWeak) ? 0.55 : 1;
      return {
        x: cx - m.hw/2, y: this.y + m.hy - m.hh/2, w: m.hw, h: m.hh,
        dmg: Math.round(m.dmg * wk), kb: m.kb, hitstun: m.hitstun, type: m.type,
      };
    }

    canAct() {
      return this.hitstun <= 0 && this.blockstun <= 0 && !this.stunned &&
             this.state !== 'ko' &&
             !['light','heavy','special'].includes(this.state);
    }

    setState(s) {
      if (this.state === s) return;
      this.state = s; this.stateT = 0;
    }

    startAttack(kind, opts) {
      opts = opts || {};
      const m = this.def.moves[kind];
      if (kind === 'special') {
        const cost = m.cost || 50;
        if (this.meter >= cost) {
          this.meter -= cost;
          this._specialWeak = false;          // 满气 = 全力(EX)
        } else if (opts.motion) {
          this._specialWeak = true;           // 搓招无气 = 弱化版
        } else {
          return false;                        // 直接键且无气 -> 不发
        }
      }
      this.attack = m; this.attackKind = kind;
      this.attackHasHit = false;
      this.setState(kind);
      this.vx = 0;
      // 突进型必杀给一点前冲
      if (m.rush) this.pendingRush = true;
      return true;
    }

    // 输入意图:{move:-1/0/1, up, down, light, heavy, special, block}
    handleIntent(intent, game) {
      if (this.state === 'ko') return;

      // 硬直中不能行动
      if (!this.canAct()) return;

      this.blocking = false;
      this.crouching = false;

      // 攻击优先
      if (intent.special) { if (this.startAttack('special')) return; }
      if (intent.heavy)   { this.startAttack('heavy'); return; }
      if (intent.light)   { this.startAttack('light'); return; }

      if (this.onGround) {
        // 起跳
        if (intent.up) {
          this.vy = -this.def.jump;
          this.onGround = false;
          this.setState('jump');
          return;
        }
        // 下蹲(可格挡下段/减速)
        if (intent.down) {
          this.crouching = true;
          this.setState('crouch');
          this.vx = 0;
          return;
        }
        // 格挡:后退方向按住 block。允许边后退边防御,不再原地锁死。
        if (intent.block) {
          this.blocking = true;
          this.setState('block');
          this.vx = intent.move * this.def.walk * 0.55;
          return;
        }
        // 移动
        if (intent.move !== 0) {
          this.vx = intent.move * this.def.walk;
          this.setState('walk');
          this.walkPhase += 0.25;
        } else {
          this.vx = 0;
          this.setState('idle');
        }
      } else {
        // 空中:可小幅控制
        if (intent.move !== 0) this.vx = U.clamp(this.vx + intent.move*0.4, -this.def.walk, this.def.walk);
      }
    }

    // 受击
    takeHit(hit, fromDir, blocked) {
      if (this.invuln > 0) return { dmg: 0, blocked: false };
      if (blocked) {
        const chip = Math.max(1, Math.round(hit.dmg * 0.15));
        this.hp = Math.max(0, this.hp - chip);
        this.blockstun = Math.round(hit.hitstun * 0.5);
        this.vx = fromDir * (hit.kb * 0.4);
        this.meter = Math.min(this.maxMeter, this.meter + 4);
        this.flashT = 4;
        this.setState('block');
        return { dmg: chip, blocked: true };
      }
      this.hp = Math.max(0, this.hp - hit.dmg);
      this.hitstun = hit.hitstun;
      this.vx = fromDir * hit.kb;
      this.vy = hit.type === 'special' ? -6 : (hit.type === 'heavy' ? -3.5 : -1.5);
      if (this.vy < 0) this.onGround = false;
      this.attack = null;
      this.meter = Math.min(this.maxMeter, this.meter + 3);
      this.flashT = 6;
      this.setState('hit');
      if (this.hp <= 0) this.startKO(fromDir);
      return { dmg: hit.dmg, blocked: false };
    }

    startKO(dir) {
      this.state = 'ko'; this.stateT = 0;
      this.vx = dir * 5; this.vy = -8; this.onGround = false;
      this.koDir = dir;
    }

    update(game) {
      this.stateT++;
      if (this.hitstun > 0) this.hitstun--;
      if (this.blockstun > 0) this.blockstun--;
      if (this.invuln > 0) this.invuln--;
      if (this.flashT > 0) this.flashT--;

      // 突进必杀:在 active 前给前冲
      if (this.pendingRush && this.attack && this.stateT >= this.attack.startup && this.stateT < this.attack.startup + this.attack.active) {
        this.vx = this.facing * 7;
      } else if (this.pendingRush && this.attack && this.stateT >= this.attack.startup + this.attack.active) {
        this.pendingRush = false;
      }

      // 攻击生成飞行道具(在 active 首帧)
      if (this.attack && this.attack.projectile && !this.attackHasHit) {
        if (this.stateT === this.attack.startup) {
          const cfg = this.attack;
          const proj = new Projectile(this, this.facing, cfg);
          if (this._specialWeak) { proj.dmg = Math.round(proj.dmg * 0.55); proj.r *= 0.8; proj.weak = true; }
          game.projectiles.push(proj);
          this.attackHasHit = true; // 标记已发射
        }
      }

      // 物理
      this.x += this.vx;
      this.y += this.vy;
      if (!this.onGround) this.vy += GRAV;

      // 地面碰撞
      if (this.y >= GROUND) {
        this.y = GROUND;
        if (!this.onGround && this.state === 'ko') {
          this.vy = 0; this.vx *= 0.3;
        } else if (!this.onGround) {
          this.onGround = true; this.vy = 0;
          if (this.state === 'jump') this.setState('idle');
        }
        if (this.state !== 'ko') this.vy = 0;
      }
      // 地面摩擦
      if (this.onGround && this.state !== 'ko') {
        if (!['walk'].includes(this.state)) this.vx *= 0.6;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
      }
      if (this.state === 'ko') this.vx *= 0.92;

      // 边界
      this.x = U.clamp(this.x, FLOOR_MINX, FLOOR_MAXX);

      // 攻击状态结束回 idle
      if (['light','heavy','special'].includes(this.state) && this.attack) {
        const total = this.attack.startup + this.attack.active + this.attack.recovery;
        if (this.stateT >= total) {
          this.attack = null;
          this.setState(this.onGround ? 'idle' : 'jump');
        }
      }
      // hit 状态结束
      if (this.state === 'hit' && this.hitstun <= 0 && this.onGround) {
        this.setState('idle');
      }
      // ko 倒地旋转推进
      if (this.state === 'ko') {
        this.koFall = Math.min(1, this.koFall + 0.06);
      }
    }

    // 绘制
    draw(ctx) {
      const prog = this.attack ? (this.stateT - this.attack.startup) / Math.max(1, this.attack.active) : this.stateT * 0.1;
      const pose = computePose(this.state, this.state==='special'||this.state==='heavy'||this.state==='light' ? (this.stateT/(this.attack? (this.attack.startup+this.attack.active+this.attack.recovery):20)) : prog, this.walkPhase, !this.onGround);

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing * SCALE, SCALE);
      if (this.state === 'ko') {
        ctx.rotate(this.koDir * this.koFall * -1.3);
      }
      // 阴影(在缩放前世界更好,这里简单处理)
      ctx.restore();
      // 地面阴影
      const shW = 40 * (this.onGround ? 1 : 0.6);
      ctx.save();
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(this.x, GROUND + 4, shW/2, 6, 0, 0, 7); ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing * SCALE, SCALE);
      if (this.state === 'ko') ctx.rotate(this.koDir * this.koFall * -1.3);

      // 受击白闪:临时替换调色
      let pal = this.def.palette;
      if (this.flashT > 0 && Math.floor(this.flashT/2)%2===0) {
        pal = flashPalette(pal);
      }
      drawHumanoid(ctx, pal, pose, this.def.deco, this.state, this.state==='special'? (this.stateT*0.1):prog);
      ctx.restore();

      // 格挡火花
      if (this.state === 'block' && this.blockstun > 0) {
        ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = '#7ad0ff';
        const bx = this.x + this.facing*22;
        for (let i=0;i<4;i++){ctx.beginPath();ctx.arc(bx+U.rand(-6,6), this.y-40+U.rand(-14,14), 2, 0,7);ctx.fill();}
        ctx.restore();
      }
    }
  }

  function flashPalette(p) {
    const w = {};
    for (const k in p) w[k] = '#ffffff';
    w.eye = '#ff3030';
    return w;
  }

  window.Fighter = Fighter;
  window.Projectile = Projectile;
  window.FIGHT_GROUND = GROUND;
})();
