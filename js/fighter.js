// ============================================================
// fighter.js — 战斗角色实例:物理、状态机、命中判定、绘制。
// 以及 Projectile(飞行道具)。
// 逻辑坐标:x 为角色中心,y 为脚底(= GROUND_Y 时站地面)。
// ============================================================
(function () {
  const GROUND = 460;      // == GROUND_Y
  const GRAV = 0.62;
  const FLOOR_MINX = -150, FLOOR_MAXX = 1110; // 1440 宽舞台，两端留出角色空间
  const SIZE = 2;           // 人物与战斗判定同步放大
  const SCALE = 2.1 * SIZE;
  const MOVE_SPEED = 1.3; // 旧定义的回退值，新角色使用独立前后步速。
  const WALK_ANIMATION_RATE = 0.75; // Only the walking drawings slow down; world movement stays unchanged.
  const AIR_JUMP_SCALE = 0.8; // 第二跳稍低，最高点仍留在战斗画面内。
  const ATTACK_STATES = window.ATTACK_STATES || ['light','heavy','special','uppercut','rush','tech','skill','super'];

  class Projectile {
    constructor(owner, dir, cfg) {
      this.owner = owner;
      this.dir = dir;
      this.x = owner.x + dir * (cfg.projOriginX ?? 40 * SIZE);
      this.y = owner.y + (cfg.projOriginY ?? -34 * SIZE);
      this.vx = dir * (cfg.projSpeed ?? (cfg.big ? 6.5 : 8.5));
      this.color = cfg.projColor || '#5ad2ff';
      this.big = !!cfg.big;
      this.dmg = cfg.dmg;
      this.kb = cfg.kb;
      this.hitstun = cfg.hitstun;
      this.r = (cfg.big ? 20 : 13) * SIZE;
      this.life = cfg.projLife || 120;
      this.dead = false;
      this.t = 0;
      this.reaction=cfg.reaction;this.returnFrame=cfg.projReturnFrame||35;
      this.shape=cfg.projShape||'orb';this.path=cfg.projPath||'straight';
      this.baseY=this.y;this.vy=cfg.projVy||0;this.gravity=cfg.projGravity||0;
      this.amplitude=cfg.projAmplitude||28;this.bounce=!!cfg.projBounce;
      this.knockdown=!!cfg.knockdown;this.level=cfg.level;this.blockstun=cfg.blockstun;this.armFrames=cfg.armFrames||0;this.attackId=owner.attackId;this.meterGain=cfg.meterGain;this.scaleFloor=cfg.scaleFloor;
      this.comboMeta={owner,attackId:this.attackId,kind:owner.attackKind,lightStarter:cfg.lightStarter,starterScaling:cfg.starterScaling,damagePenalty:cfg.damagePenalty};
      if(cfg.projRadius)this.r=cfg.projRadius*SIZE;
      if(cfg.projGround)this.y=GROUND-this.r;this.baseY=this.y;
    }
    get box() {
      let near=-this.r,far=this.r,height=this.r*2;
      if(this.shape==='spear'){near=-this.r*2;height=12;}
      if(this.shape==='crescent')near=0;
      if(this.shape==='flame')near=-this.r*1.6;
      return {x:this.x+(this.dir>0?near:-far),y:this.y-height/2,w:far-near,h:height};
    }
    hitTarget(target) {
      if (this.dead || this.t < this.armFrames || target.state === 'ko' || target.invuln > 0 || target.trainingInvincible) return null;
      if (!U.overlap(this.box, target.bodyBox)) return null;
      const blocked = target.blocking && target.facing === -this.dir && target.onGround && (this.level !== 'low' || target.crouching);
      const result = target.takeHit({...this.comboMeta,dmg:this.dmg,kb:this.kb,hitstun:this.hitstun,type:'special',projectile:true,knockdown:this.knockdown,level:this.level,reaction:this.reaction,blockstun:this.blockstun,scaleFloor:this.scaleFloor}, this.dir, blocked);
      if (result.ignored) return null;
      if (this.owner.attackId === this.attackId) {
        this.owner.attackContact = true; this.owner.attackConnected = !result.blocked;
        this.owner.contactFrame = this.owner.stateT;
      }
      if (!result.blocked) this.owner.meter = Math.min(this.owner.maxMeter, this.owner.meter + (this.meterGain ?? 10));
      this.dead = true;
      return result;
    }
    update() {
      this.x += this.vx; this.t += 1; this.life--;
      if(this.path==='return'&&this.t===this.returnFrame)this.vx*=-1;
      if(this.path==='wave')this.y=this.baseY+Math.sin(this.t*.12)*this.amplitude;
      if(this.path==='arc'){
        this.y+=this.vy;this.vy+=this.gravity;
        if(this.y+this.r>=GROUND){
          if(this.bounce){this.y=GROUND-this.r;this.vy=-Math.abs(this.vy)*.65;this.bounce=false;}
          else this.dead=true;
        }
      }
      if (this.life <= 0 || this.x < -320 || this.x > 1280) this.dead = true;
    }
    draw(ctx) {
      if(this.shape!=='orb'){
        ctx.save();ctx.translate(this.x,this.y);ctx.scale(this.dir,1);
        ctx.fillStyle=this.color;ctx.strokeStyle=this.color;ctx.lineWidth=3;
        ctx.globalAlpha=.3;ctx.fillRect(-this.r*2,-4,this.r*2,8);ctx.globalAlpha=1;
        const r=this.r;
        if(this.shape==='shuriken'||this.shape==='blade'){
          ctx.rotate(this.t*(this.shape==='blade'?.2:.35));
          ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*.3:r;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();
          ctx.fillStyle='#ecfaff';ctx.fillRect(-3,-3,6,6);
        }else if(this.shape==='spear'){
          ctx.beginPath();ctx.moveTo(-r*2,-3);ctx.lineTo(r*.5,-3);ctx.lineTo(r,0);ctx.lineTo(r*.5,3);ctx.lineTo(-r*2,3);ctx.fill();
        }else if(this.shape==='crescent'){
          ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,Math.PI/2);ctx.quadraticCurveTo(r*.5,0,0,-r);ctx.fill();
        }else if(this.shape==='electric'){
          ctx.beginPath();for(let i=0;i<12;i++){const a=i*Math.PI/6,rr=i%2?r*.55:r;ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();
          ctx.fillStyle='#f3ffff';ctx.fillRect(-5,-5,10,10);
        }else{
          ctx.beginPath();ctx.moveTo(r,0);ctx.lineTo(-r*.4,-r);ctx.lineTo(-r*.2,-r*.3);ctx.lineTo(-r*1.6,-r*.2);ctx.lineTo(-r*.4,r*.5);ctx.lineTo(-r*.8,r);ctx.closePath();ctx.fill();
          ctx.fillStyle='#fff0a0';ctx.fillRect(-r*.3,-r*.3,r*.8,r*.6);
        }
        ctx.restore();return;
      }
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
    static get walkAnimationRate() { return WALK_ANIMATION_RATE; }
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
      this.meter = 0; this.maxMeter = 300;
      this.drive=6;this.maxDrive=6;this.burnout=false;this.driveRegenDelay=0;this.driveBoost=0;this.parrying=false;this.parryFrames=0;
      this.assistRoute=null;this.attackContact=false;this.attackId=0;this.juggleHits=0;this.repeatChain=0;
      this.state = 'idle';
      this.reaction=null;this.reactionDuration=20;this.reactionDir=-1;
      this.stateT = 0;               // 当前状态已持续帧
      this.walkPhase = 0;
      this.stepPhase = 0;
      this.gaitDirection = 1;
      this.gaitMoving = false;
      this.gaitSettling = 0;
      this.gaitSettleFrom = 0;
      this.gaitSettleTo = 0;
      this.gaitSettleDuration = 8;
      this.moveBlend = 0;
      this.moveLean = 0;
      this.airFrames = 0;
      this.jumpDirection = 0;
      this.jumpsUsed = 0;
      this.airJumpEffect = null;
      this.landingFrames = 0;
      this.trail = [];
      this.armorLeft=0;this.counterTriggered=false;this.moveLabelT=0;
      this.attack = null;            // 当前招式对象
      this.pendingRush = false;
      this.bufferedAttack = null;
      this.dash=null;this.bufferedDash=null;
      this.attackConnected = false;
      this.contactFrame = 0;
      this.comboHits = 0;
      this.comboDamage = 0;
      this.comboActive=false;this.comboMoves=0;this.comboMoveScales=[];this.comboPenalty=0;this.comboLightStarter=false;
      this.lastDamageScale=1;this.lastHitDamage=0;this.pendingComboPenalty=0;this.pushbackSource=null;
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
      this.throwInputFrames=0;this.grabbedBy=null;this.throwSequence=null;this.throwRotation=0;
      this.width = 34 * SIZE;               // 身体碰撞宽(逻辑)
    }

    get bodyBox() {
      const h = (this.crouching ? 54 : 84) * SIZE;
      return { x: this.x - this.width/2, y: this.y - h, w: this.width, h };
    }

    // 命中盒(仅攻击 active 帧有效)
    getHitBox() {
      if (!this.attack || this.state === 'hit' || this.state === 'ko') return null;
      const m = this.attack;
      const prog = this.stateT;
      if (prog < m.startup || prog >= m.startup + m.active) return null;
      if (m.projectile || m.noHit || (m.counter && !this.counterTriggered)) return null; // 飞行道具在生成时处理
      const front = this.facing;
      const geometry=CombatSpacing.geometry(m,this.width,this.stateT,!this.onGround&&!m.launch);
      const cx = this.x + front * geometry.center;
      const wk=1;
      return {
        x: cx - geometry.w/2, y: this.y + geometry.y-geometry.h/2, w: geometry.w, h: geometry.h,
        dmg: m.dmg * wk, kb: m.hitFrames && this.stateT>=m.hitFrames[m.hitFrames.length-1] ? (m.finalKb??m.kb) : m.kb, hitstun: m.hitstun, type: m.type, grab:!!m.grab,
        owner:this,attackId:this.attackId,kind:this.attackKind,lightStarter:m.lightStarter,starterScaling:m.starterScaling,damagePenalty:m.damagePenalty,
        groundCombo:!m.knockdown||!!m.hitFrames&&prog<m.hitFrames[m.hitFrames.length-1],level:m.level,knockdown:!!m.knockdown&&(!m.hitFrames||prog>=m.hitFrames[m.hitFrames.length-1]),normalThrow:!!m.normalThrow,blockstun:m.blockstun,scaleFloor:m.scaleFloor,driveDamage:m.category==='drive'?1:.25,reaction:m.reaction,launch:!!m.launch,
      };
    }

    canAct() {
      return this.hitstun <= 0 && this.blockstun <= 0 && !this.stunned &&
             !this.dash &&
             !['ko','hit','grabbed'].includes(this.state) &&
             !ATTACK_STATES.includes(this.state);
    }

    queueAttack(kind, opts = {}) {
      this.bufferedDash=null;
      if(this.state!=='ko'&&!this.grabbedBy)this.bufferedAttack={kind,opts,frames:opts.assist?45:8};
    }
    queueDash(kind){
      if(!this.onGround||this.state==='ko'||this.grabbedBy||!this.def.dashes[kind])return;
      this.bufferedAttack=null;this.assistRoute=null;
      this.bufferedDash={kind,frames:6,inputSerial:window.Input?.resetSerial};
    }
    startDash(kind){
      if(!this.canAct()||!this.onGround||this.throwSequence)return false;
      const config=this.def.dashes[kind];if(!config)return false;
      this.dash={...config,kind,dir:this.facing*(kind==='forward'?1:-1),travelBlocked:false};
      this.bufferedDash=null;this.attack=null;this.pendingRush=false;
      this.parrying=this.blocking=this.crouching=false;this.vx=this.vy=0;
      this.driveBoost=0;this.pendingComboPenalty=0;this.trail=[];
      this.state=kind==='forward'?'dashForward':'dashBack';this.stateT=0;
      this.moveLabel=kind==='forward'?'前冲':'后撤步';this.moveLabelT=config.frames+12;
      Audio2.sfx.whiff();return true;
    }
    isThrowInvulnerable(){return this.dash?.kind==='back';}
    queueAssist(button){
      const route=this.def.assistCombos[button];
      if(!route||this.state==='ko')return;
      if(!this.assistRoute||this.assistRoute.button!==button||this.assistRoute.frames<=0||(!this.attack&&!this.foe?.hitstun&&!this.foe?.blockstun))this.assistRoute={button,index:0,frames:90};
      const at=this.assistRoute.index;
      if(at>=route.length){this.assistRoute=null;return;}
      const entry=typeof route[at]==='string'?{kind:route[at]}:route[at];
      if(at>0&&this.attackContact&&!this.attackConnected&&(entry.od||CombatRules.isSuper(entry.kind))){this.assistRoute=null;this.moveLabel='辅助连段停止 · 未命中';this.moveLabelT=45;return;}
      this.queueAttack(entry.kind,{...entry,shortcut:CombatRules.isSpecial(entry.kind)||CombatRules.isSuper(entry.kind),strength:2,assist:{button,index:at}});
    }
    spendDrive(cost){
      if(this.burnout||this.drive+1e-6<cost){this.moveLabel=this.burnout?'斗气耗尽':'斗气不足';this.moveLabelT=45;return false;}
      this.drive=Math.max(0,this.drive-cost);this.driveRegenDelay=100;
      if(this.drive<=.001)this.burnout=true;
      return true;
    }
    hasCancelWindow(){
      return !!this.attack&&this.attackContact&&this.stateT>=this.contactFrame&&this.stateT-this.contactFrame<=(this.attack.cancelWindow??10);
    }
    canStartAttack(kind) {
      const next=this.def.moves[kind];
      if(!next||this.grabbedBy||this.hitstun>0||this.blockstun>0||this.stunned||this.state==='ko')return false;
      if(next.groundOnly&&!this.onGround&&!(next.category==='super'&&this.attack?.launch&&this.attackContact))return false;
      if(this.canAct())return true;
      if(this.attack&&this.attackKind==='driveRush'&&this.stateT>=3)return next.category==='normal';
      if(!this.hasCancelWindow())return false;
      if(next.grab||next.counter||this.attack?.grab)return false;
      if(kind==='driveRush')return this.attack?.category==='normal'&&this.attack.cancellable;
      if(this.attack?.category==='normal'){
        if(next.category==='special'||next.category==='super')return this.attack.cancellable;
        if(next.category==='normal')return (this.attack.cancelInto||[]).includes(kind)||((this.attack.chainInto||[]).includes(kind)&&this.repeatChain<(this.attack.chainLimit||3));
      }
      if(this.attack?.category==='special'&&next.category==='super')return next.saLevel===3||this.attack.od&&next.saLevel===2;
      return false;
    }

    setState(s) {
      if (this.state === s) return;
      this.state = s; this.stateT = 0;
    }

    walkVelocity(target) {
      if(!target){this.vx=0;return;}
      // A short weight-transfer on starting; a direction change responds now,
      // without drifting toward the old input or delaying a defensive action.
      if(this.vx*target<0)this.vx=0;
      const step=this.def.walkAcceleration||.65;
      this.vx+=U.clamp(target-this.vx,-step,step);
    }

    tryJump(move) {
      if (!this.canAct() || this.grabbedBy || this.throwSequence) return false;
      // 只有主动起跳才能接第二跳；上升必杀或被挑空不提供额外跳跃。
      const second = !this.onGround;
      if (second && (this.state !== 'jump' || this.jumpsUsed !== 1)) return false;
      const speed = this.def.jumpTravel || this.def.walk * MOVE_SPEED;
      this.vy = -this.def.jump * (second ? AIR_JUMP_SCALE : 1);
      // 第二跳可立即改变方向；不输入方向时沿用原来的水平惯性。
      if (!second || move) this.vx = move * speed;
      this.onGround = false;
      this.jumpsUsed = second ? 2 : 1;
      this.airFrames = 0;
      this.jumpDirection = Math.sign(this.vx * this.facing);
      this.landingFrames = 0;
      this.blocking = this.crouching = this.parrying = false;
      this.state = 'jump'; this.stateT = 0;
      if (second) {
        this.airJumpEffect = { x: this.x, y: this.y, frames: 16 };
        this.moveLabel = '二段跳'; this.moveLabelT = 24;
      }
      Audio2.sfx.jump();
      return true;
    }

    startAttack(kind, opts={}) {
      if(opts.assist&&opts.assist.index>0&&this.attack?.hitFrames&&this.stateT<this.attack.hitFrames.at(-1))return false;
      if(opts.assist&&opts.assist.index>0&&this.attackContact&&!this.attackConnected&&(opts.od||CombatRules.isSuper(kind))){this.assistRoute=null;this.bufferedAttack=null;return false;}
      if(!this.canStartAttack(kind))return false;
      if(opts.assist&&opts.assist.index>0&&!this.foe?.hitstun&&!this.foe?.blockstun&&!(this.attack&&this.attackKind==='driveRush')){
        this.bufferedAttack=null;this.assistRoute=null;return false;
      }
      const source=this.def.moves[kind],m={...source};
      const cancelling=this.hasCancelWindow();
      const targetCancel=cancelling&&this.attack.category==='normal'&&(this.attack.cancelInto||[]).includes(kind);
      const lightChain=cancelling&&(this.attack.chainInto||[]).includes(kind);
      const cost=m.cost||0;
      if(this.meter<cost){this.moveLabel='SA 不足 · 需要 '+cost/100+' 级';this.moveLabelT=45;this.bufferedAttack=null;this.assistRoute=null;return false;}
      const driveCost=kind==='driveRush'?(this.attack?.category==='normal'?3:1):m.driveCost||(opts.od&&m.category==='special'?2:0);
      if(driveCost&&!this.spendDrive(driveCost)){this.bufferedAttack=null;this.assistRoute=null;return false;}
      this.meter-=cost;
      if(m.category==='special'){
        const strength=Math.max(1,Math.min(3,opts.strength||2)),recoveryShift=strength===1?-2:strength===3?2:0;
        const shift=strength===1&&kind==='uppercut'?-1:recoveryShift;
        CombatRules.retimeStartup(m,shift);m.recovery=Math.max(6,m.recovery+recoveryShift);
        if(m.travelDistance){m.travelStart=Math.max(1,m.startup-4);m.travelEnd=m.startup+m.active;m.travelDistance*=strength===1?.9:strength===3?1.1:1;}
        m.dmg*=strength===1?.88:strength===3?1.12:1;
        if(m.projSpeed)m.projSpeed*=strength===1?.85:strength===3?1.15:1;
        if(opts.od){m.od=true;m.dmg*=1.2;m.hitstun+=m.odHitstunBonus??6;m.blockstun+=3;if(kind==='uppercut')m.invincible=m.startup+5;}
      }
      if(opts.shortcut&&(m.category==='special'||m.category==='super'))m.dmg*=.8;
      if(m.category==='super'){m.scaleFloor=[0,.3,.4,.5][m.saLevel];if(this.attack?.launch){this.y=GROUND;this.vy=0;this.onGround=true;}}
      m.damagePenalty=targetCancel?.1:0;
      if(this.driveBoost>0&&m.category==='normal'){
        m.hitstun+=4;m.blockstun=(m.blockstun||10)+4;this.driveBoost=0;
        m.damagePenalty+=this.pendingComboPenalty;this.pendingComboPenalty=0;
      }
      if(kind==='driveRush'){this.driveBoost=90;this.pendingComboPenalty=cancelling?.15:0;}
      this.repeatChain=lightChain?this.repeatChain+1:1;
      this.bufferedAttack=null;this.attackConnected=false;this.attackContact=false;this.attackId++;
      this.blocking=this.crouching=this.parrying=false;
      this.reaction=null;this.attack=m;this.attackKind=kind;this.throwBack=!!opts.back;this.attackHasHit=false;this._specialWeak=false;
      this.armorLeft=m.armor||0;this.counterTriggered=false;
      this.moveLabel=(m.od?'OD · ':'')+(m.saLevel?'SA'+m.saLevel+' · ':'')+m.name;this.moveLabelT=55;
      this.state=kind;this.stateT=0;this.vx=0;this.pendingRush=!!(m.rush||m.rushSpeed);
      if(m.invincible)this.invuln=m.invincible;
      if(opts.assist)this.assistRoute={button:opts.assist.button,index:opts.assist.index+1,frames:90};
      return true;
    }

    // 输入意图:{move:-1/0/1, up, down, light, heavy, special, block}
    handleIntent(intent, game) {
      if (this.state === 'ko') return;
      if(this.canAct())this.endCombo();

      if(intent.throw){this.throwInputFrames=8;if(this.grabbedBy)this.grabbedBy.escapeThrow(game);else this.queueAttack('throw',{back:intent.move===-this.facing});}
      if(this.grabbedBy)return;

      if(intent.throw){}
      else if (intent.command) this.queueAttack(intent.command, { motion:true, ...intent.commandOptions });
      else if (intent.special) this.queueAttack('special');
      else if (intent.heavyKick) this.queueAttack(intent.down?'sweep':'heavyKick');
      else if (intent.lightKick) this.queueAttack(intent.down?'lowKick':'lightKick');
      else if (intent.mediumKick) this.queueAttack(intent.down?'lowMediumKick':'mediumKick');
      else if (intent.medium) this.queueAttack('medium');
      else if (intent.heavy) this.queueAttack('heavy');
      else if (intent.light) this.queueAttack('light');
      if (this.bufferedAttack && this.startAttack(this.bufferedAttack.kind, this.bufferedAttack.opts)) return;
      if(intent.dash&&!intent.up&&!intent.parryHeld)this.queueDash(intent.dash);
      if(intent.up||intent.parryHeld)this.bufferedDash=null;
      if(this.bufferedDash?.inputSerial!==window.Input?.resetSerial)this.bufferedDash=null;
      if(this.bufferedDash&&this.startDash(this.bufferedDash.kind))return;
      if (!this.canAct()) return;

      this.blocking=false;this.crouching=false;
      if(intent.parryHeld&&this.onGround&&!this.burnout){
        if(!this.parrying&&!this.spendDrive(.5))return;
        if(!this.parrying)this.parryFrames=0;
        this.parrying=true;this.state='parry';this.vx=0;return;
      }
      this.parrying=false;
      // up 是再次按下的边沿，按住跳跃不会自动消耗第二跳。
      if (intent.up && this.tryJump(intent.move)) return;
      if (this.onGround) {
        // 下蹲(可格挡下段/减速)
        if (intent.down) {
          this.blocking=!!intent.block;this.crouching = true;
          this.setState('crouch');
          this.vx = 0;
          return;
        }
        // 格挡:后退方向按住 block。允许边后退边防御,不再原地锁死。
        if (intent.block) {
          this.blocking = true;
          this.setState('block');
          this.walkVelocity(intent.move * (this.def.walkBackward||this.def.walk*MOVE_SPEED*.55));
          return;
        }
        // 移动
        if (intent.move !== 0) {
          this.walkVelocity(intent.move * (intent.move===this.facing?this.def.walkForward:this.def.walkBackward));
          this.setState('walk');

        } else {
          this.vx = 0;
          this.setState('idle');
        }
      } else {
        // 空中:可小幅控制
        if (intent.move !== 0) this.vx = U.clamp(this.vx + intent.move*.18, -(this.def.jumpTravel||this.def.walk*MOVE_SPEED), this.def.jumpTravel||this.def.walk*MOVE_SPEED);
      }
    }

    // 受击
    endCombo(){
      // Leave the last damage result visible. A combo ends when a defensive
      // action can actually be entered, including the exact hitstun boundary.
      this.comboActive=false;
    }
    takeHit(hit, fromDir, blocked) {
      if(hit.grab&&this.isThrowInvulnerable())return {dmg:0,blocked:false,ignored:true};
      if (this.invuln > 0 || this.trainingInvincible) return { dmg: 0, blocked: false, ignored: true };
      if(this.parrying&&!hit.grab&&!this.burnout){
        this.drive=Math.min(6,this.drive+.4);this.moveLabel=this.parryFrames<=2?'精准招架':'招架';this.moveLabelT=35;
        return {dmg:0,blocked:true,parried:true};
      }
      this.bufferedAttack=null;this.assistRoute=null;this.attackConnected=false;this.attackContact=false;this.parrying=false;
      this.pendingComboPenalty=0;this.driveBoost=0;
      this.dash=null;this.bufferedDash=null;this.trail=[];
      const counter=this.attack?.counter && this.stateT>=3 && this.stateT<=18 && !this.counterTriggered;
      if(counter&&!hit.grab&&!hit.projectile){
        this.counterTriggered=true;this.attackHasHit=true;this.stateT=this.attack.startup;
        this.moveLabel=this.attack.name+' · 反击';this.moveLabelT=45;
        return {dmg:0,blocked:false,countered:true};
      }
      if(!blocked && !hit.grab && this.armorLeft>0 && this.attack && this.stateT<=(this.attack.armorUntil||0)){
        this.armorLeft--;const damage=Math.max(1,Math.round(hit.dmg*.7));
        this.hp=Math.max(0,this.hp-damage);this.flashT=5;
        if(this.hp<=0)this.startKO(fromDir);
        return {dmg:damage,blocked:false,armored:true};
      }
      if (blocked) {
        this.endCombo();
        const chip=this.burnout&&hit.type==='special'?Math.max(1,Math.round(hit.dmg*.15)):0;
        this.hp = Math.max(0, this.hp - chip);
        this.blockstun=(hit.blockstun||Math.round(hit.hitstun*.5))+(this.burnout?4:0);
        if(!this.burnout){this.drive=Math.max(0,this.drive-(hit.driveDamage||.2));this.driveRegenDelay=100;if(this.drive===0)this.burnout=true;}
        this.attack=null;this.pendingRush=false;
        this.vx = fromDir * (hit.kb * 0.4);
        this.pushbackSource=hit.owner||this.foe;
        this.meter = Math.min(this.maxMeter, this.meter + 4);
        this.flashT = 4;
        this.reaction=this.crouching?'guardLow':'guard';this.reactionDir=fromDir*this.facing;this.reactionDuration=this.blockstun;
        this.state='block';this.stateT=0;
        return { dmg: chip, blocked: true };
      }
      if(!this.comboActive){
        this.comboHits=0;this.comboDamage=0;this.comboMoves=0;this.comboMoveScales=[];
        this.comboLightStarter=!!hit.lightStarter;this.comboPenalty=hit.starterScaling||0;
      }
      let move=hit.owner&&hit.attackId!=null?this.comboMoveScales.find(m=>m.owner===hit.owner&&m.attackId===hit.attackId):null;
      if(!move){
        this.comboMoves++;
        if(this.comboMoves>1)this.comboPenalty+=hit.damagePenalty||0;
        const scale=this.comboMoves===1?1:CombatRules.damageScale(this.comboMoves,this.comboLightStarter,this.comboPenalty,hit.scaleFloor??.1);
        move={owner:hit.owner,attackId:hit.attackId,scale};this.comboMoveScales.push(move);
      }
      this.comboActive=true;this.comboHits++;
      const damage = Math.max(1, Math.round(hit.dmg * move.scale));
      this.lastDamageScale=move.scale;this.lastHitDamage=damage;
      this.comboDamage += damage;
      this.hp = Math.max(0, this.hp - damage);
      this.hitstun = hit.hitstun;
      this.vx = fromDir * hit.kb;
      this.pushbackSource=hit.owner||this.foe;
      this.reaction=hit.grab?'throw':hit.launch?'launch':hit.knockdown?(hit.level==='low'?'sweep':'knockdown'):!this.onGround?'air':hit.reaction|| (hit.type==='light'?'head':'heavy');
      this.reactionDir=fromDir*this.facing;this.reactionDuration=Math.max(1,hit.hitstun);
      this.vy=hit.launch?-10:hit.knockdown?-7:this.onGround?0:-4;
      if(!this.onGround){this.juggleHits++;if(this.juggleHits>6)this.vy=Math.max(3,this.vy);}else this.juggleHits=0;
      this.knockedDown=!!hit.knockdown;
      if (this.vy < 0) this.onGround = false;
      this.attack = null;
      this.pendingRush = false;
      this.meter = Math.min(this.maxMeter, this.meter + 3);
      this.flashT = 6;
      this.state='hit';this.stateT=0;
      if (this.hp <= 0) this.startKO(fromDir);
      return { dmg: damage, blocked: false };
    }

    startKO(dir) {
      this.dash=null;this.bufferedDash=null;
      this.reaction='knockdown';this.reactionDuration=60;
      this.state = 'ko'; this.stateT = 0;
      this.vx = dir * 5; this.vy = -8; this.onGround = false;
      this.koDir = dir;
    }

    beginThrow(target,game){
      if(target.isThrowInvulnerable())return;
      if(target.throwInputFrames>0){this.throwSequence={target,t:0};this.escapeThrow(game);return;}
      this.assistRoute=null;target.assistRoute=null;target.parrying=false;
      target.endCombo();
      this.throwSequence={target,t:0,dir:this.throwBack?-this.facing:this.facing,hit:{owner:this,attackId:this.attackId,dmg:this.attack.dmg,kb:this.attack.kb,hitstun:this.attack.hitstun,type:'heavy',grab:true,knockdown:true}};
      target.grabbedBy=this;target.attack=null;target.bufferedAttack=null;target.blocking=target.crouching=false;
      target.dash=null;target.bufferedDash=null;
      target.hitstun=45;target.vx=target.vy=0;target.state='grabbed';target.stateT=0;target.reaction='throw';target.reactionDuration=24;target.reactionDir=this.facing*target.facing;
      this.invuln=30;target.invuln=30;
      this.moveLabel=this.throwBack?'后投 · '+this.attack.name:this.attack.name;
    }
    escapeThrow(game){
      const q=this.throwSequence;if(!q||q.t>7)return false;
      const target=q.target;this.throwSequence=null;target.grabbedBy=null;
      for(const f of [this,target]){f.attack=null;f.bufferedAttack=null;f.pendingRush=false;f.invuln=12;f.hitstun=12;f.y=GROUND;f.onGround=true;f.throwRotation=0;f.vy=0;f.state='hit';f.stateT=0;f.reaction='body';f.reactionDuration=12;f.moveLabel='拆投';f.moveLabelT=40;}
      const dir=this.facing;this.vx=-dir*5;target.vx=dir*5;game.hitstop=4;
      return true;
    }
    update(game) {
      if(this.canAct())this.endCombo();
      if(this.driveRegenDelay>0)this.driveRegenDelay--;
      if(this.driveBoost>0)this.driveBoost--;
      if(this.assistRoute&&--this.assistRoute.frames<=0)this.assistRoute=null;
      if(this.parrying){this.parryFrames++;this.drive=Math.max(0,this.drive-.016);this.driveRegenDelay=100;if(this.drive===0){this.burnout=true;this.parrying=false;}}
      else if(this.burnout||this.driveRegenDelay===0&&!this.attack&&this.hitstun<=0&&this.blockstun<=0){
        this.drive=Math.min(6,this.drive+(this.burnout?.008:.009));if(this.drive===6)this.burnout=false;
      }
      if(this.throwInputFrames>0)this.throwInputFrames--;
      if(this.grabbedBy){this.stateT++;return;}
      if(this.throwSequence){
        const q=this.throwSequence,v=q.target;q.t++;
        const lift=Math.sin(Math.max(0,(q.t-7)/17)*Math.PI);
        const toss={ryu:[100,1.4],mei:[85,2.2],tank:[145,.8],volt:[55,1.8],kaze:[115,1.6],sage:[125,.6]}[this.def.id]||[90,1.4];
        v.x=U.clamp(this.x+q.dir*(48+q.t*1.5),FLOOR_MINX,FLOOR_MAXX);
        v.y=GROUND-lift*toss[0];v.throwRotation=q.dir*lift*toss[1];
        if(q.t>=24){
          v.grabbedBy=null;v.throwRotation=0;v.invuln=0;v.onGround=false;
          v.takeHit(q.hit,q.dir,false);this.throwSequence=null;
          this.meter=Math.min(this.maxMeter,this.meter+12);game.hitstop=8;game.shake=12;
          game.effects.push({x:v.x,y:GROUND-10,t:0,life:16,big:true,blocked:false});
          Audio2.sfx.hitHeavy();
        }
      }
      this.stateT++;
      if(this.attack&&this.stateT===this.attack.startup&&(this.attack.category==='normal'||this.attack.normalThrow))Audio2.sfx.whiff();
      if(this.moveLabelT>0)this.moveLabelT--;
      if (this.airJumpEffect && --this.airJumpEffect.frames <= 0) this.airJumpEffect = null;
      if(this.attack?.hitFrames?.includes(this.stateT))this.attackHasHit=false;
      if(this.attack?.moveSpeed && this.stateT>=this.attack.startup && this.stateT<this.attack.startup+this.attack.active)this.vx=this.facing*this.attack.moveSpeed;
      this.walkPhase += .055;
      if (this.landingFrames > 0) this.landingFrames--;
      if(this.getupFrames>0&&this.onGround)this.getupFrames--;
      if (!this.onGround) this.airFrames++;
      if (this.dash || ['rush','uppercut'].includes(this.state) || (this.state === 'special' && this.pendingRush)) {
        if (this.stateT % 2 === 0) this.trail.push({x:this.x,y:this.y});
        if(this.trail.length>4)this.trail.shift();
      } else this.trail.length=0;
      if (this.bufferedAttack && --this.bufferedAttack.frames <= 0) this.bufferedAttack = null;
      if(this.bufferedDash&&--this.bufferedDash.frames<=0)this.bufferedDash=null;
      if (this.attack?.launch && this.stateT === this.attack.startup) {
        this.vy = -9; this.vx = this.facing * 2; this.onGround = false;
      }
      if (this.hitstun > 0) this.hitstun--;
      if (this.blockstun > 0) this.blockstun--;
      if (this.invuln > 0) this.invuln--;
      if (this.flashT > 0) this.flashT--;

      // 突进必杀的旧速度回退；有距离配置时下方精确位移覆盖它。
      if (this.pendingRush && this.attack && this.stateT >= this.attack.startup && this.stateT < this.attack.startup + this.attack.active) {
        this.vx = this.facing * (this.attack.rushSpeed || 7);
      } else if (this.pendingRush && this.attack && this.stateT >= this.attack.startup + this.attack.active) {
        this.pendingRush = false;
      }

      if(this.attack?.travelDistance){
        this.vx=this.attack.travelBlocked?0:this.facing*(CombatSpacing.travelAt(this.attack,this.stateT)-CombatSpacing.travelAt(this.attack,this.stateT-1));
      }
      if(this.attack?.stepDistance&&this.onGround){
        const m=this.attack;
        this.vx=m.stepBlocked?0:this.facing*(StrikeMotion.stepAt(m,this.stateT)-StrikeMotion.stepAt(m,this.stateT-1));
      }
      if(this.dash){
        const d=this.dash;
        this.vx=d.travelBlocked?0:d.dir*(CombatSpacing.travelAt(d,this.stateT)-CombatSpacing.travelAt(d,this.stateT-1));
      }

      // 每个发射时刻独立生成；普通飞行道具每人最多两枚，超必杀允许三枚。
      if(this.attack?.projectile && (this.attack.shots||[this.attack.startup]).includes(this.stateT)){
        const cap=this.attack.category==='super'?6:2;
        if(game.projectiles.filter(p=>p.owner===this&&!p.dead).length<cap){
          const config={...this.attack,knockdown:!!this.attack.knockdown&&(!this.attack.shots||this.stateT===this.attack.shots.at(-1))};
          const proj=new Projectile(this,this.facing,config);
          if(this._specialWeak){proj.dmg=Math.round(proj.dmg*.55);proj.r*=.8;proj.weak=true;}
          game.projectiles.push(proj);
        }
        this.attackHasHit=true;
      }

      // 物理
      this.x += this.vx;
      this.y += this.vy;
      if (!this.onGround) this.vy += GRAV;

      // 地面碰撞
      if (this.y >= GROUND) {
        this.y = GROUND;
        this.jumpsUsed = 0;
        this.airJumpEffect = null;
        if (!this.onGround && this.state === 'ko') {
          this.vy = 0; this.vx *= 0.3; this.onGround=true;
        } else if (!this.onGround) {
          this.landingFrames = Math.min(9, Math.max(4, Math.round(Math.abs(this.vy))));
          this.airFrames = 0;
          if(this.knockedDown){
            this.hitstun=Math.max(this.hitstun,18);this.getupFrames=18;
            // Grounded knockdowns cannot be re-hit before the defender has a
            // chance to guard / reverse on wakeup. Air juggles remain hittable.
            this.invuln=Math.max(this.invuln,19);this.endCombo();
          }
          this.onGround = true; this.vy = 0;
          if (this.state === 'jump') this.setState('idle');
        }
        if (this.state !== 'ko') this.vy = 0;
      }
      // 地面摩擦
      if (this.onGround && this.state !== 'ko') {
        if (!['walk','block'].includes(this.state)||this.blockstun>0) this.vx *= 0.6;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
      }
      if (this.state === 'ko') this.vx *= 0.92;

      // 边界
      const unclampedX=this.x;
      this.x = U.clamp(this.x, FLOOR_MINX, FLOOR_MAXX);
      if(this.dash&&unclampedX!==this.x)this.dash.travelBlocked=true;
      if(this.attack?.stepDistance&&unclampedX!==this.x)this.attack.stepBlocked=true;
      // Transfer the displacement the wall absorbed to the attacker. Corner
      // pressure still pushes the fighters apart instead of deleting recoil.
      if(unclampedX!==this.x&&(this.hitstun>0||this.blockstun>0)&&this.pushbackSource){
        const source=this.pushbackSource;
        source.x=U.clamp(source.x-(unclampedX-this.x),FLOOR_MINX,FLOOR_MAXX);
        if(source.attack?.travelDistance)source.attack.travelBlocked=true;
        if(source.attack?.stepDistance)source.attack.stepBlocked=true;
      }

      // 攻击状态结束回 idle
      if(this.dash&&this.stateT>=this.dash.frames){
        this.dash=null;this.vx=0;this.trail=[];this.setState('idle');
      }
      if (ATTACK_STATES.includes(this.state) && this.attack) {
        const total = this.attack.startup + this.attack.active + this.attack.recovery;
        if (this.stateT >= total) {
          if(this.attack.stepDistance&&this.onGround)this.vx=0;
          this.attack = null;
          this.pendingRush = false;
          this.setState(this.onGround ? 'idle' : 'jump');
        }
      }
      // hit 状态结束
      if (this.state === 'hit' && this.hitstun <= 0 && this.onGround) {
        this.knockedDown=false;this.reaction=null;
        this.setState('idle');
      }
      // ko 倒地旋转推进
      if (this.state === 'ko') {
        this.koFall = Math.min(1, this.koFall + 0.06);
      }
    }

    // Called after BOTH fighters move and body separation is complete. A blocked
    // step or the opponent's push must not advance/restart a walking animation.
    updateGait(distance) {
      const turn=Math.PI*2;
      const canSettle=this.onGround&&!this.attack&&!this.grabbedBy&&this.hitstun<=0&&this.blockstun<=0&&['idle','walk','block'].includes(this.state);
      const travel=Math.max(0,Math.min(Math.abs(this.vx),distance*Math.sign(this.vx)));
      const moving=canSettle&&['walk','block'].includes(this.state)&&Math.abs(this.vx)>.1&&travel>.02;
      if(moving){
        this.gaitDirection=Math.sign(this.vx*this.facing)||1;
        this.gaitSettling=0;
        const stride=this.gaitDirection<0?this.def.strideBackward:this.def.stride;
        // Resume the support-foot phase instead of jumping back to pose zero.
        this.stepPhase=(this.stepPhase+travel*turn/(stride||104)*WALK_ANIMATION_RATE)%turn;
      }else if(canSettle){
        if(this.gaitMoving){
          const phase=((this.stepPhase%turn)+turn)%turn;
          this.gaitSettleFrom=phase;
          // Freeze travel phase. Set down the moving foot, then replace the
          // support foot with a short lifted step rather than a floor slide.
          this.gaitSettleDuration=Math.round(12/WALK_ANIMATION_RATE);
          this.gaitSettling=this.gaitSettleDuration;
        }
        if(this.gaitSettling){
          this.gaitSettling--;
          if(!this.gaitSettling){this.walkPhase=0;this.stepPhase=0;}
        }
      }else{
        this.gaitSettling=0;this.stepPhase=0;
      }
      this.gaitMoving=moving;
      this.moveBlend+=((moving?1:0)-this.moveBlend)*.3;
      this.moveLean+=((moving?this.vx*this.facing/(this.def.walkForward||this.def.walk*MOVE_SPEED):0)-this.moveLean)*.22;
    }

    // Shared animation sampling for rendering and physical contact checks.
    sampleAnimation() {
      const prog = this.attack ? (this.stateT - this.attack.startup) / Math.max(1, this.attack.active) : this.stateT * 0.1;
      const attackPose = ATTACK_STATES.includes(this.state);
      const poseState=this.grabbedBy?'hit':this.knockedDown?'ko':this.dash?(this.dash.kind==='forward'?'walk':'block'):this.state==='parry'?'block':this.attack?.pose||this.state;
      const motion = {
        fighter:this,attack:this.attack,kind:this.attackKind,state:this.state,reaction:this.reaction,reactionDuration:this.reactionDuration,reactionDir:this.reactionDir,
        attackT:this.stateT,attackStartup:this.attack?.startup,attackActive:this.attack?.active,
        gait: this.stepPhase, blend: this.gaitSettling?1:this.moveBlend, lean: this.moveLean, gaitDirection:this.gaitDirection, gaitSettle:this.gaitSettling?1-this.gaitSettling/this.gaitSettleDuration:0,
        moving: this.gaitMoving || this.gaitSettling>0,
        air: !this.onGround && this.state === 'jump',
        airFrames: this.airFrames, vy: this.vy,
        jumpDirection: this.jumpDirection, jumpDuration: 2*this.def.jump/GRAV,
        airDirection: U.clamp(this.vx * this.facing / (this.def.walkForward||this.def.walk * MOVE_SPEED), -1, 1),
        landing: this.onGround && ['idle','walk','block'].includes(this.state) ? this.landingFrames / 9 : 0,
      };
      const artProgress = attackPose&&this.attack ? this.stateT/(this.attack.startup+this.attack.active+this.attack.recovery) : (this.state==='walk'?this.stepPhase:this.stateT*.06);
      const animation=window.Motion60?.sample(this.def,poseState,artProgress,motion);
      return {animation,motion,poseState,artProgress,attackPose,prog};
    }
    // 绘制
    draw(ctx) {
      const {animation,motion,poseState,artProgress,attackPose,prog}=this.sampleAnimation();
      if(animation){
        motion.animation=animation;this.animationFrame=animation.frame;
        const drawn=window.DrawnAnimation?.selection(this.def,animation);
        this.drawnFrame=drawn?drawn.index+1:null;this.drawnFrameCount=drawn?.count;
      }
      const pose = computePose(poseState, attackPose ? (this.stateT/(this.attack? (this.attack.startup+this.attack.active+this.attack.recovery):20)) : prog, this.walkPhase, !this.onGround);

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing * SCALE, SCALE);
      if (this.state === 'ko') {
        ctx.rotate(this.koDir * this.koFall * -1.3);
      }
      // 阴影(在缩放前世界更好,这里简单处理)
      ctx.restore();
      // 地面阴影
      const shW = 40 * SIZE * (this.onGround ? 1 : 0.6);
      ctx.save();
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(this.x, GROUND + 4, shW/2, 6 * SIZE, 0, 0, 7); ctx.fill();
      ctx.restore();

      if(this.dash&&this.stateT<=this.dash.travelEnd){
        ctx.save();ctx.fillStyle='#e0cba5';ctx.globalAlpha=.3;
        for(let i=0;i<3;i++){
          ctx.beginPath();ctx.ellipse(this.x-this.dash.dir*(18+i*14),GROUND-2-i*2,9+i*2,2+i,0,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
      }
      if (this.airJumpEffect) {
        const effect = this.airJumpEffect, p = 1 - effect.frames / 16;
        ctx.save();
        ctx.globalAlpha = (1 - p) * .8;
        ctx.strokeStyle = this.def.fxColor || '#bdefff'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(effect.x, effect.y + p * 16, 22 + p * 34, 6 + p * 8, 0, 0, Math.PI * 2);
        ctx.stroke(); ctx.restore();
      }

      for(let i=0;i<this.trail.length;i++) {
        const q=this.trail[i];
        ctx.save();ctx.globalAlpha=.045+.035*i;
        ctx.translate(q.x,q.y);ctx.scale(this.facing*SCALE,SCALE);
        drawHumanoid(ctx,this.def.palette,pose,this.def.deco,poseState,artProgress,motion);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing * SCALE, SCALE);
      const authoredFall=window.DrawnAnimation?.version>=7&&window.DrawnAnimation.has(this.def.id);
      if (this.state === 'ko'&&!authoredFall) ctx.rotate(this.koDir * this.facing * this.koFall * -1.3);
      if(this.grabbedBy)ctx.rotate(this.throwRotation);
      else if(this.knockedDown&&!authoredFall)ctx.rotate((this.reaction==='sweep'?-.95:-.7)*(this.onGround?(this.getupFrames||0)/18:Math.min(1,this.stateT/14)));

      // 受击白闪:临时替换调色
      let pal = this.def.palette;
      if (this.flashT > 0 && Math.floor(this.flashT/2)%2===0) {
        pal = flashPalette(pal);
      }
      drawHumanoid(ctx, pal, pose, this.def.deco, poseState, artProgress, motion);
      ctx.restore();

      if(this.moveLabelT>0 && this.moveLabel){
        U.textOutline(ctx,this.moveLabel,this.x,Math.max(105,this.y-230),15,this.def.fxColor||'#fff','#101222');
      }
      if(this.parrying||this.driveBoost>0||this.attack?.od){ctx.save();ctx.strokeStyle=this.parrying?'#74a9ff':this.attack?.od?'#ffe178':'#65ffb7';ctx.lineWidth=3;ctx.globalAlpha=.7;ctx.beginPath();ctx.ellipse(this.x,this.y-90,55,100,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
      window.Motion60?.drawEffects(ctx,this);

      // 格挡火花
      if (this.state === 'block' && this.blockstun > 0) {
        ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = '#7ad0ff';
        const bx = this.x + this.facing*22 * SIZE;
        for (let i=0;i<4;i++){ctx.beginPath();ctx.arc(bx+U.rand(-6,6), this.y-40 * SIZE+U.rand(-14,14) * SIZE, 2, 0,7);ctx.fill();}
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
