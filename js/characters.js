// ============================================================
// characters.js — 6名角色:配色、属性、招式数据 + 像素人形骨架渲染器
// 坐标系:角色朝右,原点在双脚中点,y 向上为负。整体高约 48 单位。
// 绘制时由 fighter 决定 scale 与朝向翻转。
// ============================================================
(function () {

  // ---------- 通用像素人形渲染 ----------
  // pose 是一组关节的局部坐标(朝右)。我们用"粗线段"画四肢,方块画头/身。
  function seg(ctx, ax, ay, bx, by, thick, color) {
    // 沿 a->b 画一条有厚度的像素段
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.max(1, Math.round(len));
    const nx = -dy / len, ny = dx / len; // 法线
    ctx.fillStyle = color;
    const h = thick / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + dx * t, y = ay + dy * t;
      ctx.fillRect(Math.round(x - h), Math.round(y - h), thick, thick);
    }
  }

  // 计算 idle/walk/attack 等姿态。返回关节点坐标。
  // 参数 f: 该动作内的插值相位辅助由各 pose 生成。
  // 关键关节:hip, neck, headC, shoulder, elbowF/handF(前臂-前手), elbowB/handB, kneeF/footF, kneeB/footB
  function basePose() {
    return {
      hipX: 0, hipY: -20,
      neckX: 0, neckY: -37,
      headX: 0, headY: -44,
      lean: 0,          // 上身前倾(向右为正)
      // 手:相对 shoulder 的位置
      handF: { x: 6, y: -26 }, elbowF: { x: 4, y: -30 },
      handB: { x: -5, y: -26 }, elbowB: { x: -4, y: -30 },
      footF: { x: 6, y: 0 }, kneeF: { x: 5, y: -10 },
      footB: { x: -6, y: 0 }, kneeB: { x: -5, y: -10 },
      crouch: 0,        // 下蹲量,抬高双脚使身体下沉
      headTiltDmg: 0,
    };
  }

  // 姿态库:根据 state + 帧进度返回 pose。t 为 0..1 该动作进度,walkPhase 用于走路循环。
  function computePose(state, prog, walkPhase, airborne) {
    const p = basePose();
    switch (state) {
      case 'idle': {
        const b = Math.sin(walkPhase * 2) * 1.2;      // 呼吸
        p.neckY += b * 0.4; p.headY += b * 0.4;
        p.handF = { x: 7, y: -25 + b }; p.elbowF = { x: 5, y: -30 };
        p.handB = { x: -6, y: -25 - b }; p.elbowB = { x: -5, y: -30 };
        p.footF = { x: 7, y: 0 }; p.footB = { x: -7, y: 0 };
        break;
      }
      case 'walk': {
        const s = Math.sin(walkPhase);
        p.footF = { x: 6 + s * 7, y: -Math.max(0, s) * 4 };
        p.footB = { x: -6 - s * 7, y: -Math.max(0, -s) * 4 };
        p.kneeF = { x: 4 + s * 4, y: -10 };
        p.kneeB = { x: -4 - s * 4, y: -10 };
        p.handF = { x: 6 - s * 5, y: -26 }; p.handB = { x: -6 + s * 5, y: -26 };
        p.lean = 2;
        break;
      }
      case 'crouch': {
        p.crouch = 10;
        p.hipY = -12; p.neckY = -26; p.headY = -33;
        p.footF = { x: 9, y: 0 }; p.footB = { x: -9, y: 0 };
        p.kneeF = { x: 8, y: -6 }; p.kneeB = { x: -8, y: -6 };
        p.handF = { x: 8, y: -18 }; p.handB = { x: -6, y: -18 };
        break;
      }
      case 'jump': {
        p.footF = { x: 5, y: -6 }; p.footB = { x: -6, y: -3 };
        p.kneeF = { x: 6, y: -12 }; p.kneeB = { x: -5, y: -11 };
        p.handF = { x: 8, y: -32 }; p.handB = { x: -8, y: -32 };
        p.lean = 3;
        break;
      }
      case 'block': {
        p.lean = -3;
        p.handF = { x: 4, y: -30 }; p.elbowF = { x: 2, y: -28 };
        p.handB = { x: 2, y: -24 }; p.elbowB = { x: 0, y: -28 };
        p.footF = { x: 4, y: 0 }; p.footB = { x: -9, y: 0 };
        break;
      }
      case 'light': {
        // 直拳:前手快速伸出,prog 0..1
        const ext = Math.sin(Math.min(1, prog) * Math.PI); // 出拳-收回
        p.lean = 3 + ext * 3;
        p.handF = { x: 8 + ext * 20, y: -28 }; p.elbowF = { x: 6 + ext * 10, y: -29 };
        p.handB = { x: -7, y: -24 };
        p.footF = { x: 8, y: 0 }; p.footB = { x: -8, y: 0 };
        break;
      }
      case 'heavy': {
        // 摆拳/勾拳:后手大幅挥出
        const ext = Math.sin(Math.min(1, prog) * Math.PI);
        p.lean = 4 + ext * 5;
        p.handB = { x: -6 + ext * 30, y: -30 + ext * 4 }; p.elbowB = { x: -4 + ext * 14, y: -31 };
        p.handF = { x: 6, y: -22 };
        p.footF = { x: 10, y: 0 }; p.footB = { x: -7, y: 0 };
        p.hipX = ext * 3;
        break;
      }
      case 'special': {
        // 蓄力后冲拳/发波:先后仰蓄力再前冲
        const wind = prog < 0.4 ? prog / 0.4 : 1;
        const push = prog >= 0.4 ? (prog - 0.4) / 0.6 : 0;
        const ext = Math.sin(Math.min(1, push) * Math.PI);
        p.lean = -wind * 6 + ext * 12;
        p.handF = { x: 4 - wind * 8 + ext * 26, y: -26 };
        p.elbowF = { x: 2 + ext * 12, y: -28 };
        p.handB = { x: -8 + wind * 4 + ext * 20, y: -26 };
        p.elbowB = { x: -6, y: -29 };
        p.footF = { x: 8 + ext * 4, y: 0 }; p.footB = { x: -10 - wind * 2, y: 0 };
        break;
      }
      case 'hit': {
        p.lean = -6;
        p.headTiltDmg = -3;
        p.handF = { x: 4, y: -22 }; p.handB = { x: -9, y: -24 };
        p.footF = { x: 4, y: 0 }; p.footB = { x: -10, y: 0 };
        p.hipX = -2;
        break;
      }
      case 'ko': {
        // 倒地:整体躺平(由 fighter 额外旋转),这里给一个瘫软姿态
        p.lean = -10;
        p.hipY = -8; p.neckY = -16; p.headY = -22;
        p.handF = { x: 10, y: -10 }; p.handB = { x: -10, y: -10 };
        p.footF = { x: 12, y: -2 }; p.footB = { x: -12, y: -2 };
        break;
      }
    }
    return p;
  }

  // 绘制人形。palette:{skin,skinSh,cloth,clothSh,cloth2,hair,eye,trim}
  // charDraw: 角色特有的附加绘制(发型/装备/武器),接收 (ctx, p, palette, state, prog)
  function drawHumanoid(ctx, palette, p, charDraw, state, prog) {
    const P = palette;
    const shoulderY = p.neckY + 1;
    // ---- 后侧腿/臂先画(在身体后) ----
    seg(ctx, p.hipX - 2, p.hipY, p.kneeB.x, p.kneeB.y, 5, P.clothSh);
    seg(ctx, p.kneeB.x, p.kneeB.y, p.footB.x, p.footB.y, 5, P.clothSh);
    U.px(ctx, p.footB.x - 4, p.footB.y - 3, 9, 4, P.shoe || '#222'); // 后脚
    seg(ctx, 0, shoulderY, p.elbowB.x, p.elbowB.y, 4, U.shade(P.skin, -25));
    seg(ctx, p.elbowB.x, p.elbowB.y, p.handB.x, p.handB.y, 4, U.shade(P.skin, -25));
    U.px(ctx, p.handB.x - 2, p.handB.y - 2, 5, 5, U.shade(P.skin, -25)); // 后拳

    // ---- 躯干 ----
    const tx = p.lean; // 上身随 lean 偏移
    // 髋->颈,画成梯形躯干
    ctx.fillStyle = P.cloth;
    ctx.beginPath();
    ctx.moveTo(p.hipX - 6, p.hipY);
    ctx.lineTo(p.hipX + 6, p.hipY);
    ctx.lineTo(p.neckX + tx + 6, shoulderY + 2);
    ctx.lineTo(p.neckX + tx - 6, shoulderY + 2);
    ctx.closePath();
    ctx.fill();
    // 胸前高光条
    U.px(ctx, p.neckX + tx - 5, shoulderY + 3, 3, (p.hipY - shoulderY) - 3, P.cloth2 || U.shade(P.cloth, 25));

    // ---- 前侧腿 ----
    seg(ctx, p.hipX + 2, p.hipY, p.kneeF.x, p.kneeF.y, 6, P.cloth);
    seg(ctx, p.kneeF.x, p.kneeF.y, p.footF.x, p.footF.y, 6, P.cloth);
    U.px(ctx, p.footF.x - 4, p.footF.y - 3, 10, 4, P.shoe || '#111'); // 前脚

    // ---- 头 + 脖子 ----
    seg(ctx, p.neckX + tx, shoulderY, p.headX + tx, p.neckY - 2, 5, P.skin);
    const hx = p.headX + tx + (p.headTiltDmg || 0), hy = p.headY;
    U.px(ctx, hx - 5, hy - 5, 11, 12, P.skin);         // 头
    U.px(ctx, hx - 5, hy - 5, 11, 12, null);           // (占位,轮廓下方处理)
    // 脸部阴影(背光侧)
    U.px(ctx, hx - 5, hy - 5, 3, 12, P.skinSh);
    // 眼睛(朝右)
    U.px(ctx, hx + 1, hy - 1, 2, 3, P.eye || '#111');

    // ---- 前臂(在身体前) ----
    seg(ctx, p.neckX + tx, shoulderY + 1, p.elbowF.x, p.elbowF.y, 5, P.skin);
    seg(ctx, p.elbowF.x, p.elbowF.y, p.handF.x, p.handF.y, 5, P.skin);
    // 前拳(攻击时放大加高光)
    const punch = (state === 'light' || state === 'heavy' || state === 'special');
    const fistSz = punch ? 7 : 6;
    U.px(ctx, p.handF.x - fistSz/2, p.handF.y - fistSz/2, fistSz, fistSz, P.skin);
    U.px(ctx, p.handF.x - fistSz/2, p.handF.y - fistSz/2, fistSz, 2, U.shade(P.skin, 30));

    // ---- 角色特有装饰 ----
    if (charDraw) charDraw(ctx, p, P, state, prog, { hx, hy, tx, shoulderY });
  }

  // ---------- 各角色装饰绘制 ----------
  const deco = {
    // 忍者:头巾 + 尾带
    ryu(ctx, p, P, st, pr, m) {
      U.px(ctx, m.hx - 6, m.hy - 6, 13, 4, P.trim);          // 头带
      U.px(ctx, m.hx - 6, m.hy - 3, 13, 2, U.shade(P.trim, -40));
      // 飘带
      const w = Math.sin((pr || 0) * 6 + p.hipX) * 4;
      seg(ctx, m.hx - 6, m.hy - 4, m.hx - 14, m.hy - 2 + w, 3, P.trim);
      U.px(ctx, m.hx - 5, m.hy - 8, 10, 3, P.hair);          // 前发
    },
    // 女武者:马尾 + 护腕
    mei(ctx, p, P, st, pr, m) {
      const sway = Math.sin((pr || 0) * 5) * 3;
      seg(ctx, m.hx - 4, m.hy - 5, m.hx - 12, m.hy + 6 + sway, 4, P.hair); // 马尾
      U.px(ctx, m.hx - 5, m.hy - 7, 11, 4, P.hair);          // 刘海
      U.px(ctx, p.handF.x - 4, p.handF.y - 4, 8, 3, P.trim);  // 护腕
    },
    // 拳王:光头 + 拳套 + 腰带
    tank(ctx, p, P, st, pr, m) {
      U.px(ctx, m.hx - 5, m.hy - 6, 11, 4, U.shade(P.skin, -30)); // 头顶阴影
      U.px(ctx, p.handF.x - 4, p.handF.y - 4, 8, 8, P.trim);   // 大拳套
      U.px(ctx, p.handB.x - 3, p.handB.y - 3, 6, 6, P.trim);
      U.px(ctx, p.hipX - 7, p.hipY - 1, 14, 3, '#e8c020');     // 金腰带
    },
    // 电光少年:尖发 + 头盔条
    volt(ctx, p, P, st, pr, m) {
      ctx.fillStyle = P.hair;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(m.hx + i*4 - 2, m.hy - 5);
        ctx.lineTo(m.hx + i*4, m.hy - 12 - Math.abs(i)*2);
        ctx.lineTo(m.hx + i*4 + 2, m.hy - 5);
        ctx.fill();
      }
      // 蓄力时手上有电球
      if (st === 'special') {
        const g = 4 + Math.sin((pr||0)*20)*2;
        ctx.fillStyle = P.trim;
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(p.handF.x, p.handF.y, g, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
    },
    // 剑客:头发 + 背刀/挥刀
    kaze(ctx, p, P, st, pr, m) {
      U.px(ctx, m.hx - 6, m.hy - 7, 13, 5, P.hair);
      seg(ctx, m.hx - 6, m.hy - 3, m.hx - 12, m.hy + 4, 3, P.hair);
      // 武器:重攻/必杀时挥刀
      if (st === 'heavy' || st === 'special') {
        seg(ctx, p.handF.x, p.handF.y, p.handF.x + 22, p.handF.y - 14, 3, '#dfe7ef');
        seg(ctx, p.handF.x, p.handF.y, p.handF.x + 20, p.handF.y - 12, 1, '#ffffff');
      } else {
        // 背后的刀
        seg(ctx, -6, -34, -12, -20, 3, U.shade('#dfe7ef', -30));
      }
    },
    // 大法师:兜帽 + 法杖 + 火球
    sage(ctx, p, P, st, pr, m) {
      // 兜帽
      ctx.fillStyle = P.trim;
      ctx.beginPath();
      ctx.moveTo(m.hx - 7, m.hy + 5);
      ctx.lineTo(m.hx - 6, m.hy - 8);
      ctx.lineTo(m.hx + 7, m.hy - 6);
      ctx.lineTo(m.hx + 8, m.hy + 5);
      ctx.fill();
      // 法杖(后手)
      seg(ctx, p.handB.x, p.handB.y + 8, p.handB.x, p.handB.y - 14, 3, '#7a5230');
      ctx.fillStyle = st === 'special' ? '#ff5522' : '#ffb020';
      ctx.beginPath(); ctx.arc(p.handB.x, p.handB.y - 15, st==='special'?5:3, 0, 7); ctx.fill();
    },
  };

  // ---------- 招式表 ----------
  // 每招:startup 起手帧, active 命中帧, recovery 收招帧, dmg 伤害,
  // reach 命中盒相对身体前方距离/尺寸, kb 击退, meter 攒气, block:是否可被格挡
  // hitH:命中盒垂直中心相对脚(负=高)
  function moves(cfg) {
    return {
      light: { startup: 3, active: 4, recovery: 6, dmg: 6, reach: 40, hw: 26, hh: 16, hy: -30, kb: 3, meterGain: 6, hitstun: 12, type: 'light' },
      heavy: { startup: 8, active: 5, recovery: 16, dmg: 12, reach: 46, hw: 30, hh: 20, hy: -28, kb: 7, meterGain: 10, hitstun: 22, type: 'heavy' },
      special: Object.assign(
        { startup: 12, active: 8, recovery: 20, dmg: 20, kb: 12, meterGain: 0, hitstun: 30, type: 'special', cost: 50 },
        cfg.special || { reach: 60, hw: 46, hh: 26, hy: -30 }
      ),
    };
  }

  // ---------- 角色定义 ----------
  const CHARACTERS = [
    {
      id: 'ryu', name: '疾风', title: '流浪忍者',
      hp: 100, walk: 2.6, jump: 12.2, weight: 1.0,
      palette: { skin:'#e8b891', skinSh:'#c8946b', cloth:'#2b6cb0', clothSh:'#1e4e80', cloth2:'#4a90d0', hair:'#3a2b1a', eye:'#111', trim:'#e2e2e2', shoe:'#1a2a3a' },
      deco: deco.ryu,
      moves: moves({ special: { reach: 70, hw: 40, hh: 40, hy: -34, projectile: true, projColor:'#5ad2ff', projName:'风刃' } }),
      desc: '均衡型。必杀发射风刃远程打击。',
    },
    {
      id: 'mei', name: '美琳', title: '疾影武者',
      hp: 88, walk: 3.2, jump: 13.5, weight: 0.85,
      palette: { skin:'#f0c4a0', skinSh:'#d09a72', cloth:'#c53a6a', clothSh:'#95264c', cloth2:'#e86a92', hair:'#20242e', eye:'#111', trim:'#ffd166', shoe:'#40222c' },
      deco: deco.mei,
      moves: moves({ special: { reach: 64, hw: 40, hh: 46, hy: -34, rush: true } }),
      desc: '敏捷型。移动快、跳得高,必杀为多段突进。',
    },
    {
      id: 'tank', name: '铁拳', title: '钢铁拳王',
      hp: 128, walk: 2.0, jump: 10.0, weight: 1.35,
      palette: { skin:'#c98a5a', skinSh:'#9c6740', cloth:'#7a3b1e', clothSh:'#552814', cloth2:'#a85e35', hair:'#000', eye:'#111', trim:'#c0392b', shoe:'#2a2a2a' },
      deco: deco.tank,
      moves: (function(){ const m = moves({ special: { reach: 56, hw: 40, hh: 34, hy: -26 } }); m.heavy.dmg=16; m.heavy.kb=10; m.special.dmg=26; return m; })(),
      desc: '力量型。血厚攻高但慢,必杀为强力上勾冲拳。',
    },
    {
      id: 'volt', name: '闪电', title: '电光少年',
      hp: 84, walk: 3.4, jump: 13.0, weight: 0.8,
      palette: { skin:'#e8b891', skinSh:'#c08a5e', cloth:'#f0c020', clothSh:'#c09a10', cloth2:'#fff07a', hair:'#3a3a3a', eye:'#111', trim:'#5ad2ff', shoe:'#333' },
      deco: deco.volt,
      moves: (function(){ const m = moves({ special: { reach: 66, hw: 44, hh: 40, hy: -32, projectile:true, projColor:'#fff07a', projName:'雷球' } }); m.light.startup=2; m.light.recovery=5; return m; })(),
      desc: '速攻型。出手极快,必杀放出雷球。',
    },
    {
      id: 'kaze', name: '苍月', title: '流云剑客',
      hp: 92, walk: 2.8, jump: 12.5, weight: 0.95,
      palette: { skin:'#eabf9a', skinSh:'#c8946b', cloth:'#3a4a5a', clothSh:'#26323e', cloth2:'#5a7088', hair:'#6a4a8a', eye:'#111', trim:'#dfe7ef', shoe:'#222' },
      deco: deco.kaze,
      moves: (function(){ const m = moves({ special: { reach: 78, hw: 52, hh: 40, hy: -32, rush:true } }); m.heavy.reach=58; m.heavy.hw=40; m.heavy.dmg=14; return m; })(),
      desc: '剑术型。攻击距离长,必杀为拔刀突斩。',
    },
    {
      id: 'sage', name: '贤者', title: '烈焰法师',
      hp: 90, walk: 2.4, jump: 11.0, weight: 1.0,
      palette: { skin:'#e0b890', skinSh:'#b88a60', cloth:'#5b3a8a', clothSh:'#3e2762', cloth2:'#8a5ac0', hair:'#cfcfcf', eye:'#111', trim:'#4a2f6a', shoe:'#2a1f3a' },
      deco: deco.sage,
      moves: (function(){ const m = moves({ special: { reach: 74, hw: 44, hh: 44, hy: -32, projectile:true, projColor:'#ff6622', projName:'火球', big:true } }); m.special.dmg=22; m.special.cost=50; return m; })(),
      desc: '术法型。必杀发射大火球,远程压制强。',
    },
  ];

  window.CHARACTERS = CHARACTERS;
  window.computePose = computePose;
  window.drawHumanoid = drawHumanoid;
})();
