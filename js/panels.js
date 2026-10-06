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
    <p>经典：↓↘→＋拳 / 脚，↓↙←＋拳 / 脚，→↓↘＋拳；同指令＋两个拳或脚为 OD。SA1：双波动拳；SA2：双反波动拳；SA3：双波动脚。</p>
    <p>现代：SP、前＋SP、后＋SP、下＋SP、下后＋SP 为五种必杀；辅助＋SP 为 OD。SP＋重攻击发动 SA1，后＋SP＋重发动 SA2，下＋SP＋重发动 SA3。手动双波动重攻击也能发动全伤害 SA3。</p>
    <p>按住辅助，连按同一种攻击键，每按一次推进一招；资源不足、挥空或受击会断开。快捷必杀与快捷超必杀为 80% 基础伤害，手动指令为全伤害；整段另有伤害递减。</p>
    <p>普通技接触后可取消必杀、SA 或斗气冲刺，普通技之间只有角色专属目标连段或收招后的目押连接。普通必杀可取消 SA3；OD 可取消 SA2 / SA3。投技不能打硬直中的对手。</p>
    <p>六格斗气：OD 消耗 2 格，普通技冲刺取消 3 格，自由冲刺 1 格；冲刺后的普通技增加 4 帧硬直。中拳＋中脚为招架，重拳＋重脚为斗气迸放；也可用独立按键。斗气耗尽后暂时不能发动斗气技，防御硬直增加。</p>
    <p>后方向站防，下后方向蹲防；下段需蹲防，中段可破蹲防。光按下蹲不再自动格挡。普通投可在被抓后 7 帧内按投拆解。</p>
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
      guide.querySelector('#guide-bindings').textContent=['p1','p2'].map(who=>CombatControls.describe(who)+' · 迸放 '+CombatControls.label(Input.MAP[who].impact)+' / 招架 '+CombatControls.label(Input.MAP[who].parry)+' / 冲刺 '+CombatControls.label(Input.MAP[who].driveRush)).join(' ｜ ');
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
