// 首页与攻略均为当前页面内的界面；打开攻略时冻结对战和输入。
(function(){
  const modes=['pvp','pve','training','settings'];
  const home=document.createElement('section');home.id='home-screen';home.setAttribute('aria-label','游戏主菜单');
  home.innerHTML=`<div class="home-hero"><small class="eyebrow">THE NEXT ROUND IS YOURS</small><h1>PIXEL<br>FIGHTER<span>像 素 格 斗</span></h1><p>选择你的斗士，打出自己的风格。</p><div class="home-tags"><span>6 名斗士</span><span>7 座舞台</span><span>本地格斗</span></div></div>
    <div class="home-menu"><div class="menu-heading"><span>开始游戏</span><small>SELECT MODE</small></div><nav aria-label="选择游戏模式">
      <button data-mode="pvp"><span class="mode-number">01</span><span class="mode-copy"><strong>双人对战</strong><small>键盘 / 手柄 · 三局两胜</small></span><span class="mode-arrow" aria-hidden="true">↗</span></button>
      <button data-mode="pve"><span class="mode-number">02</span><span class="mode-copy"><strong>电脑对战</strong><small>三档难度 · 挑战电脑</small></span><span class="mode-arrow" aria-hidden="true">↗</span></button>
      <button data-mode="training"><span class="mode-number">03</span><span class="mode-copy"><strong>训练模式</strong><small>无限时间 · 自定义训练场</small></span><span class="mode-arrow" aria-hidden="true">↗</span></button>
      <button data-mode="settings"><span class="mode-number">04</span><span class="mode-copy"><strong>设置</strong><small>声音与画面 · 操作按键</small></span><span class="mode-arrow" aria-hidden="true">↗</span></button>
    </nav><p class="home-help"><kbd>↑</kbd> <kbd>↓</kbd> 切换 <kbd>Enter</kbd> 确认 · 手柄 A / × 确认</p></div>`;
  document.getElementById('wrap').appendChild(home);
  const buttons=[...home.querySelectorAll('button')];
  for(const [i,button] of buttons.entries()){
    button.addEventListener('click',()=>{GAME.modeSel=i;GameControl.beginMode(modes[i]);});
    button.addEventListener('focus',()=>{GAME.modeSel=i;AppPanels.sync();});
  }
  const guide=document.createElement('dialog');guide.id='guide-dialog';guide.setAttribute('aria-labelledby','guide-title');
  guide.innerHTML=`<header><div><small>FIGHTER FIELD GUIDE</small><h1 id="guide-title">角色攻略 / 出招表</h1></div><button id="guide-close">关闭 ✕</button></header>
    <div class="guide-body"><details class="guide-basics"><summary>经典 / 现代 · 连段与斗气说明</summary>
    <p>按 F2，在「操作模式与按键」中为双方独立选择模式。经典有轻／中／重拳脚；现代使用轻／中／重攻击、SP 与辅助键，方向始终相对朝向。</p>
    <p>二段跳：起跳后松开上方向，再在空中按一次上方向（默认 P1 W / P2 ↑；手柄十字键或左摇杆向上）。配合左右可改变第二跳方向，不输入方向则保留惯性；每次离地最多两跳，落地恢复。受击和出招期间不能跳跃，上升必杀不能接二段跳。</p>
    <p>经典：↓↘→＋拳 / 脚，↓↙←＋拳 / 脚，→↓↘＋拳；同指令＋两个拳或脚为 OD。SA1：双波动拳；SA2：双反波动拳；SA3：双波动脚。</p>
    <p>现代：SP、前＋SP、后＋SP、下＋SP、下后＋SP 为五种必杀；辅助＋SP 为 OD。SP＋重攻击发动 SA1，后＋SP＋重发动 SA2，下＋SP＋重发动 SA3。手动双波动重攻击也能发动全伤害 SA3。</p>
    <p>按住辅助，连按同一种攻击键，每按一次推进一招；资源不足、挥空或受击会断开。快捷必杀与快捷超必杀为 80% 基础伤害，手动指令为全伤害；整段另有伤害递减。</p>
    <p>衔接分三种：轻攻击之间可连打，最多三招；角色专属目标连段按出招表取消；其他普通技必须等收招后目押。命中帧差足够才接得上，例如疾风中拳 +5F 可接 5F 轻拳，接 7F 中拳则有空隙，对手可防御。贴脸与场边均有推开效果。出招表帧差按早期地面命中计算，多段按末段；晚命中会增加优势。</p>
    <p>起手节奏：轻拳 5–6F，中拳 7–9F，重拳 11–14F，重脚 13–18F；中版远程招式 11–21F，中段蓄力 21–25F。1F 约 16.67ms。轻 / 中 / 重必杀有独立发生时间，见下方出招表；训练 HUD 显示前摇、有效与收招阶段。</p>
    <p>只有出招表标记的普通技可在接触后 8 帧内取消必杀、SA 或斗气冲刺；下轻脚只可连打，扫腿不可取消。允许取消不代表一定能连上，慢必杀仍可能被挡。普通必杀可取消 SA3；OD 可取消 SA2 / SA3；必杀接触后窗口为 10 帧。投技不能打硬直中的对手。</p>
    <p>伤害按招式递减：普通起手为 100% → 100% → 80% → 70%…，轻攻击起手为 100% → 90% → 80%…；同一招的多段命中共用一个修正档位。普通伤害最低 10%，SA1 / SA2 / SA3 最低 30% / 40% / 50%。目标连段后续额外扣 10 个百分点，下中脚起手后续扣 20 点，冲刺取消后续扣 15 点。断连后恢复全伤害，训练 HUD 显示实际修正。</p>
    <p>普通冲刺：快速两次按朝向对手的方向（→→）前冲，快速两次按远离对手的方向（←←）后撤步；中间需松开方向，左右换边后输入随朝向变化。键盘、方向键和手柄均支持，经典 / 现代通用。普通冲刺不耗斗气，耗尽时仍可用；期间不能出招、跳跃或防御，收招后才恢复操作。后撤步期间免疫投技，但仍会被打击和波命中。六名角色的距离与总帧数见出招表。</p>
    <p>六格斗气：OD 消耗 2 格，普通技斗气冲刺取消 3 格，自由斗气冲刺 1 格；斗气冲刺后的普通技增加 4 帧硬直。中拳＋中脚为招架，重拳＋重脚为斗气迸放；也可用独立按键。招架中前前 / 普通技接触后前前优先发动斗气冲刺。斗气耗尽后暂时不能发动斗气技，防御硬直增加。</p>
    <p>后方向站防，下后方向蹲防；下段需蹲防，中段可破蹲防。倒地起身期间受保护，可在起身时防御或反击；空中仍可被追击。光按下蹲不再自动格挡。普通投可在被抓后 7 帧内按投拆解。</p>
    </details><div id="motion-gallery-host"></div><div id="guide-bindings"></div><nav id="guide-characters" aria-label="选择出招表角色"></nav><div id="guide-roster"></div></div>`;
  document.body.appendChild(guide);
  window.MotionGallery?.mount(guide.querySelector("#motion-gallery-host"));
  let previousPause=false,lastLayoutState='';
  const AppPanels=window.AppPanels={isOpen:false,
    keepPaused(){previousPause=true;},
    sync(){
      const state=[GAME.scene,GAME.modeSel,GAME.training,GAME.pve].join(':');
      if(state===lastLayoutState)return;lastLayoutState=state;
      home.hidden=GAME.scene!=='title';
      buttons.forEach((b,i)=>b.classList.toggle('selected',GAME.modeSel===i));
      document.getElementById('settings-open').innerHTML=(GAME.training?'训练设置':'设置')+' <kbd>F2</kbd>';
      document.getElementById('scene-label').textContent=GAME.scene==='fight'?(GAME.training?'训练场 · 无限时间':GAME.pve?'电脑对战':'双人对战'):({title:'主菜单',diff:'选择难度',char:'选择角色',stage:'选择舞台',result:'对战结果',mode:'选择模式'}[GAME.scene]||'像素格斗');
    },
    openGuide(){
      if(this.isOpen)return;
      if(window.Settings?.isOpen)Settings.close();
      previousPause=GAME.paused;GAME.paused=true;Input.clear();this.isOpen=true;
      for(const f of [GAME.f1,GAME.f2])if(f){f.bufferedAttack=null;f.assistRoute=null;}
      guide.querySelector('#guide-bindings').textContent=['p1','p2'].map(who=>CombatControls.describe(who)+' · 迸放 '+CombatControls.label(Input.MAP[who].impact)+' / 招架 '+CombatControls.label(Input.MAP[who].parry)+' / 斗气冲刺 '+CombatControls.label(Input.MAP[who].driveRush)).join(' ｜ ');
      renderMovesRoster(guide.querySelector('#guide-roster'));
      const roster=[...guide.querySelector('#guide-roster').children];
      const nav=guide.querySelector('#guide-characters');nav.replaceChildren();
      const choose=index=>{roster.forEach((section,i)=>section.hidden=i!==index);[...nav.children].forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));};
      CHARACTERS.forEach((c,i)=>{const button=document.createElement('button');button.textContent=c.name;button.addEventListener('click',()=>choose(i));nav.appendChild(button);});
      choose(Math.max(0,CHARACTERS.findIndex(c=>c.id===GAME.f1?.def.id)));
      guide.showModal();guide.querySelector('.guide-body').scrollTop=0;
    },
    closeGuide(){if(!this.isOpen)return;this.isOpen=false;guide.close();Input.clear();GAME.paused=previousPause;document.getElementById('game').focus();}
  };
  document.getElementById('guide').addEventListener('click',()=>AppPanels.openGuide());
  guide.querySelector('#guide-close').addEventListener('click',()=>AppPanels.closeGuide());
  guide.addEventListener('cancel',e=>{e.preventDefault();AppPanels.closeGuide();});
  window.addEventListener('keydown',e=>{
    if(AppPanels.isOpen){e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();AppPanels.closeGuide();}return;}
    if(Settings.isOpen||home.hidden)return;
    if(e.target.closest?.('button')&&!home.contains(e.target))return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','s','a','d','Enter'].includes(e.key)){
      e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;
      if(e.key==='Enter'){GameControl.beginMode(modes[GAME.modeSel]);return;}
      GAME.modeSel=(GAME.modeSel+(['ArrowUp','ArrowLeft','w','a'].includes(e.key)?3:1))%4;
      AppPanels.sync();buttons[GAME.modeSel].focus();
    }
  },true);
  window.addEventListener('keyup',e=>{if(AppPanels.isOpen)e.stopImmediatePropagation();},true);
  AppPanels.sync();
})();
