// ============================================================
// input.js — 键盘输入系统 + 每个玩家的按键状态与"刚按下"边沿检测
// ============================================================
(function () {
  const down = Object.create(null);      // 当前按住的物理键
  const pressed = Object.create(null);   // 本帧刚按下(边沿),消费后清除

  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // 阻止方向键/空格滚动页面
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (!down[k]) pressed[k] = true;   // 只有从未按到按下才算边沿
    down[k] = true;
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    down[k] = false;
  });
  window.addEventListener('blur', () => { for (const k in down) down[k] = false; });

  const Input = {
    isDown(k) { return !!down[k]; },
    // 消费型:读取后清除,保证一次按下只触发一次
    justPressed(k) {
      if (pressed[k]) { pressed[k] = false; return true; }
      return false;
    },
    // 只看不消费
    peekPressed(k) { return !!pressed[k]; },
    // 每帧末尾调用,清空未被消费的边沿
    endFrame() { for (const k in pressed) pressed[k] = false; },
  };

  // 两位玩家的按键映射
  Input.MAP = {
    p1: { left:'a', right:'d', up:'w', down:'s', light:'f', heavy:'g', special:'h' },
    p2: { left:'ArrowLeft', right:'ArrowRight', up:'ArrowUp', down:'ArrowDown', light:'j', heavy:'k', special:'l' },
  };

  // ---- 方向指令缓冲(搓招识别)----
  // 为每个玩家记录最近若干帧的方向编号:
  // 5=中立 2=下 6=右 3=右下(↘) 4=左 1=左下(↙)
  const motionBuf = { p1: [], p2: [] };
  const MOTION_MAX = 18;   // 缓冲保留帧数

  Input.recordMotion = function (who) {
    const m = Input.MAP[who];
    const l = down[m.left], r = down[m.right], d = down[m.down];
    let dir = 5;
    if (d && r) dir = 3;         // ↘
    else if (d && l) dir = 1;    // ↙
    else if (d) dir = 2;         // ↓
    else if (r) dir = 6;         // →
    else if (l) dir = 4;         // ←
    const buf = motionBuf[who];
    buf.push(dir);
    if (buf.length > MOTION_MAX) buf.shift();
  };

  // 检测"面向 facing 方向的 ↓↘→"(波动拳)。facing:1 右 / -1 左。
  // 右向序列 ↓→ 经 ↘;左向则镜像为 ↓←。返回 true 时消费缓冲。
  Input.checkQCF = function (who, facing) {
    const buf = motionBuf[who];
    if (buf.length < 3) return false;
    const fwd = facing >= 0 ? 6 : 4;         // 前方向
    const diag = facing >= 0 ? 3 : 1;        // 前下斜
    // 从最近往前找:需要出现 下 -> (斜) -> 前 的顺序
    // 简化:最近 8 帧内存在 2,随后 3/1,随后 6/4
    const recent = buf.slice(-10);
    let sawDown = false, sawDiag = false;
    for (const d of recent) {
      if (!sawDown) { if (d === 2 || d === diag) sawDown = true; }
      else if (!sawDiag) { if (d === diag || d === 2) sawDiag = true; }
      else { if (d === fwd || d === diag) { motionBuf[who] = []; return true; } }
    }
    // 宽松兜底:序列里同时含 2 和 fwd 且 2 在 fwd 之前
    const iDown = recent.indexOf(2), iFwd = recent.lastIndexOf(fwd);
    if (iDown !== -1 && iFwd !== -1 && iDown < iFwd) { motionBuf[who] = []; return true; }
    return false;
  };

  window.Input = Input;
})();
