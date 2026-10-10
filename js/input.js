// ============================================================
// input.js — 键盘输入系统 + 每个玩家的按键状态与"刚按下"边沿检测
// ============================================================
(function () {
  const down = Object.create(null);      // 当前按住的物理键
  const pressed = Object.create(null);   // 本帧刚按下(边沿),消费后清除
  let padDown = new Set();
  const padPressed = new Set();

  window.addEventListener('keydown', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // 阻止方向键/空格滚动页面
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    if (!down[k]) pressed[k] = true;   // 只有从未按到按下才算边沿
    down[k] = true;
    recordDirectionEdge(k);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    down[k] = false;
    recordDirectionEdge(k);
  });
  function clearKeys() {
    Input.resetSerial++;
    for (const k in down) down[k] = false;
    for (const k in pressed) pressed[k] = false;
    padDown.clear();padPressed.clear();
    window.Gamepads?.release();
    if (typeof motionBuf !== 'undefined') {
      motionBuf.p1 = [];
      motionBuf.p2 = [];
      directionState.p1=directionState.p2=5;
    }
  }
  window.addEventListener('blur', clearKeys);
  // Browsers may keep the window focused while a tab is backgrounded.
  document.addEventListener?.('visibilitychange', () => {
    if (document.hidden) clearKeys();
  });

  const Input = {
    resetSerial:0,
    clear:clearKeys,
    isDown(k) { return !!down[k] || padDown.has(k); },
    // 独立来源：手柄松开不会清掉仍按住的键盘按键。
    setGamepadKeys(keys) {
      const next = new Set(keys);
      for (const k of next) if (!padDown.has(k) && !down[k]) padPressed.add(k);
      padDown = next;
    },
    // 消费型:读取后清除,保证一次按下只触发一次
    justPressed(k) {
      const hit = !!pressed[k] || padPressed.has(k);
      pressed[k] = false;padPressed.delete(k);return hit;
    },
    // 只看不消费
    peekPressed(k) { return !!pressed[k] || padPressed.has(k); },
    // 每帧末尾调用,清空未被消费的边沿
    endFrame() { for (const k in pressed) pressed[k] = false;padPressed.clear(); },
  };

  // 两位玩家的按键映射
  Input.MAP = {
    p1: { left:'a', right:'d', up:'w', down:'s', light:'f', medium:'t', heavy:'g', lightKick:'v', mediumKick:'c', heavyKick:'b', throw:'r', special:'h', assist:'e', impact:'q', parry:'z', driveRush:'x' },
    p2: { left:'ArrowLeft', right:'ArrowRight', up:'ArrowUp', down:'ArrowDown', light:'j', medium:';', heavy:'k', lightKick:'u', mediumKick:',', heavyKick:'i', throw:'o', special:'l', assist:'/', impact:'.', parry:"'", driveRush:'[' },
  };

  Input.MODES={p1:'classic',p2:'classic'};

  // ---- 方向指令缓冲(搓招识别)----
  // 方向按格斗游戏的数字键盘记法记录,并只在方向改变时入列。
  // 5=中立 2=下 6=右 3=右下 4=左 1=左下 8=上。
  const motionBuf = { p1: [], p2: [] };
  const motionFrame = { p1: 0, p2: 0 };
  const directionState = { p1: 5, p2: 5 };
  const MOTION_MAX = 32;

  function recordDirectionEdge(key) {
    for(const who of ['p1','p2']) {
      const m=Input.MAP[who];
      if([m.left,m.right,m.up,m.down].includes(key))Input.recordMotion(who,false);
    }
  }
  Input.recordMotion = function (who, advance=true) {
    const m = Input.MAP[who];
    const horizontal = Number(Input.isDown(m.right)) - Number(Input.isDown(m.left));
    const vertical = Number(Input.isDown(m.up)) - Number(Input.isDown(m.down));
    const dir = 5 + horizontal + vertical * 3;
    const fresh=dir!==directionState[who];directionState[who]=dir;
    const buf = motionBuf[who];
    if(advance)motionFrame[who]++;
    if (!buf.length || buf[buf.length-1].dir !== dir) {
      buf.push({ dir, frame: motionFrame[who], lastFrame: motionFrame[who],fresh });
      if (buf.length > MOTION_MAX) buf.shift();
    } else buf[buf.length-1].lastFrame = motionFrame[who];
  };

  Input.clearMotions = function (who) {
    if (who) motionBuf[who] = [];
    else { motionBuf.p1 = []; motionBuf.p2 = []; }
  };

  // 两次纯水平方向之间必须松开；只消费新的第二次按下，长按不连冲。
  // 按首个边沿计时，防止长时间走路后松开再按被当成双击。
  Input.checkDoubleTap = function(who,facing,windowFrames=18){
    const buf=motionBuf[who],now=motionFrame[who];
    const [first,neutral,last]=buf.slice(-3);
    if(!last||!first.fresh||!last.fresh||![4,6].includes(last.dir)||neutral.dir!==5||first.dir!==last.dir||
       now-last.frame>1||now-first.frame>windowFrames)return null;
    Input.clearMotions(who);
    return last.dir===(facing>0?6:4)?'forward':'back';
  };

  // patterns 是相对朝向的方向序列;允许中间经过中立,每条指令有独立时限。
  Input.checkMotion = function (who, facing, patterns) {
    const buf = motionBuf[who];
    if (!buf.length) return null;
    const forward = facing >= 0 ? 6 : 4;
    const downForward = facing >= 0 ? 3 : 1;
    const back = facing >= 0 ? 4 : 6;
    const downBack = facing >= 0 ? 1 : 3;
    const map = { f:forward, b:back, d:2, df:downForward, db:downBack, n:5 };

    for (const pattern of patterns) {
      const seq = pattern.dirs.map(d => map[d]);
      // 允许方向指令后回到中立再按攻击键,但不跨过其他方向输入。
      let end = buf.length - 1;
      while (end >= 0 && buf[end].dir === 5 && motionFrame[who] - buf[end].frame <= pattern.window) end--;
      if (end < 0 || buf[end].dir !== seq[seq.length-1] || motionFrame[who] - buf[end].frame > pattern.window) continue;
      let at = end, first = end;
      for (let s = seq.length - 2; s >= 0; s--) {
        let found = -1;
        for (let i = at - 1; i >= 0; i--) {
          const when = s === 0 ? buf[i].lastFrame : buf[i].frame;
          if (motionFrame[who] - when > pattern.window) break;
          if (buf[i].dir === seq[s]) { found = i; break; }
          if (buf[i].dir !== 5) break;
        }
        if (found < 0) { first = -1; break; }
        first = found; at = found;
      }
      if (first >= 0 && motionFrame[who] - buf[first].lastFrame <= pattern.window) {
        motionBuf[who] = [];
        return pattern.name;
      }
    }
    return null;
  };

  // 蓄力允许斜下后蓄力、松开后 10 帧内完成前拳。
  Input.checkCharge = function(who, facing) {
    const buf=motionBuf[who], now=motionFrame[who];
    const forward=facing>0?6:4, backs=facing>0?[4,1,7]:[6,3,9];
    let at=buf.length-1;
    if(at>=0 && buf[at].dir===5 && now-buf[at].frame<=6)at--;
    if(at<0||buf[at].dir!==forward||now-buf[at].frame>10)return false;
    const end=buf[at].frame;let held=0;
    for(let i=at-1;i>=0;i--){
      const b=buf[i];
      if(b.dir===5&&end-b.frame<=5)continue;
      if(!backs.includes(b.dir)||end-b.lastFrame>held+10)break;
      held+=b.lastFrame-b.frame+1;
      if(held>=30){Input.clearMotions(who);return true;}
    }
    return false;
  };
  window.Input = Input;
})();
