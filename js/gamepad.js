// 浏览器标准手柄：独立采样，和键盘共用战斗输入、方向缓冲及取消规则。
(function(){
  const players=['p1','p2'];
  const classic={light:2,medium:3,heavy:5,lightKick:0,mediumKick:1,heavyKick:7,impact:4,parry:6,throw:10,driveRush:11};
  const modern={light:2,medium:0,heavy:1,special:3,assist:5,impact:4,parry:6,throw:7,driveRush:11};
  const labels=['A / ×（下）','B / ○（右）','X / □（左）','Y / △（上）','LB / L1','RB / R1','LT / L2','RT / R2','View / Share','Start / Options','L3','R3'];
  const actions={light:'轻拳 / 轻攻击',medium:'中拳 / 中攻击',heavy:'重拳 / 重攻击',lightKick:'轻脚',mediumKick:'中脚',heavyKick:'重脚',special:'SP 必杀',assist:'辅助连段',impact:'斗气迸放',parry:'斗气招架',throw:'投 / 拆投',driveRush:'斗气冲刺'};
  const slots={p1:null,p2:null},states=new Map();
  let pads=[],context='',blocked=true,lastStatus='',error='',host=null,deadzone=.25;
  try{const n=Number(localStorage.getItem('pixel-fighter-pad-deadzone'));if(n>=.15&&n<=.5)deadzone=n;}catch(_){}
  const pressed=(pad,n)=>!!pad.buttons[n]&&(pad.buttons[n].pressed||pad.buttons[n].value>.5);
  function sample(pad){
    const old=states.get(pad.index)||{held:new Set(),x:0,y:0,repeat:{}};
    // 进入 / 退出阈值不同，避免摇杆在死区边缘反复抖动。
    const axis=(value,previous)=>Math.abs(value)>(previous&&Math.sign(value)===previous?deadzone*.72:deadzone)?Math.sign(value):0;
    const x=axis(pad.axes[0]||0,old.x),y=axis(pad.axes[1]||0,old.y);
    const held=new Set();pad.buttons.forEach((_,i)=>{if(pressed(pad,i))held.add('b'+i);});
    const dx=(pressed(pad,15)?1:0)-(pressed(pad,14)?1:0),dy=(pressed(pad,13)?1:0)-(pressed(pad,12)?1:0);
    // 十字键优先；相反方向同时按下视为中立。
    const horizontal=pressed(pad,14)||pressed(pad,15)?dx:x;
    const vertical=pressed(pad,12)||pressed(pad,13)?dy:y;
    if(horizontal<0)held.add('left');if(horizontal>0)held.add('right');
    if(vertical<0)held.add('up');if(vertical>0)held.add('down');
    const edge=new Set([...held].filter(k=>!old.held.has(k)));
    const repeat={};const nav=new Set(edge);
    for(const d of ['left','right','up','down'])if(held.has(d)){
      repeat[d]=(old.repeat[d]||0)+1;
      if(repeat[d]>22&&(repeat[d]-23)%7===0)nav.add(d);
    }
    const state={held,edge,nav,x,y,repeat};states.set(pad.index,state);return state;
  }
  function release(){blocked=true;states.clear();}
  function stopFight(){
    if(window.GAME?.scene!=='fight')return;
    GAME.paused=true;Input.clear();
    if(window.Settings?.isOpen)Settings.keepPaused();
    if(window.AppPanels?.isOpen)AppPanels.keepPaused();
    for(const f of [GAME.f1,GAME.f2])if(f){f.bufferedAttack=null;f.assistRoute=null;f.parrying=false;}
  }
  function visibleControls(dialog){
    return [...dialog.querySelectorAll('button,input,select,summary')].filter(el=>!el.disabled&&el.getClientRects().length&&!el.closest('[hidden]'));
  }
  function changeValue(el,delta){
    if(el.matches('select')){
      const options=[...el.options].filter(o=>!o.disabled),i=options.indexOf(el.selectedOptions[0]);
      el.value=options[Math.max(0,Math.min(options.length-1,i+delta))]?.value??el.value;
    }else if(el.matches('input[type=range],input[type=number]')){
      const min=el.min===''?-Infinity:Number(el.min),max=el.max===''?Infinity:Number(el.max);
      el.value=String(Math.max(min,Math.min(max,Number(el.value)+delta*(Number(el.step)||1))));
    }else return;
    el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function dialogInput(dialog,s){
    if(s.edge.has('b1')||s.edge.has('b9')||s.edge.has('b8')){
      if(window.Settings?.isOpen)Settings.close();else window.AppPanels?.closeGuide();return;
    }
    const controls=visibleControls(dialog);if(!controls.length)return;
    let el=document.activeElement,i=controls.indexOf(el);
    if(i<0){el=controls[0];el.focus();i=0;}
    if(s.nav.has('up')||s.nav.has('down')){
      el=controls[(i+(s.nav.has('up')?-1:1)+controls.length)%controls.length];el.focus();el.scrollIntoView({block:'nearest'});
    }
    if(s.nav.has('left')||s.nav.has('right'))changeValue(el,s.nav.has('left')?-1:1);
    if(s.edge.has('b0')){
      if(el.matches('select'))changeValue(el,1);
      else if(!el.matches('input[type=range],input[type=number]'))el.click();
    }
  }
  function refreshUI(){
    const signature=JSON.stringify([pads.map(p=>[p.index,p.id,p.mapping]),slots,Input.MODES,error,deadzone]);
    if(signature===lastStatus)return;lastStatus=signature;
    const count=players.filter(w=>pads.some(p=>p.index===slots[w])).length;
    const badge=document.getElementById('gamepad-status');
    if(badge){badge.textContent=count?'手柄 '+count+' 已连接':'连接手柄';badge.title=error||'连接后按任意手柄键；点击查看分配和按键';}
    if(!host)return;
    host.querySelector('#pad-status').textContent=error||(!pads.length?'尚未检测到手柄：连接 USB / 蓝牙后，先点击游戏页面，再按一下手柄按钮。':'已检测到 '+pads.length+' 个手柄。上下选择设置项，左右调整，A / × 确认，B / ○ 返回。');
    for(const who of players){
      const select=host.querySelector('#pad-'+who);select.replaceChildren();
      const none=document.createElement('option');none.value='';none.textContent='仅键盘';select.appendChild(none);
      for(const pad of pads){const o=document.createElement('option');o.value=String(pad.index);o.textContent=(pad.index+1)+' · '+pad.id+(pad.mapping==='standard'?'':'（非标准映射）');select.appendChild(o);}
      select.value=slots[who]===null?'':String(slots[who]);
      const mode=Input.MODES[who],map=mode==='modern'?modern:classic;
      const box=host.querySelector('#pad-map-'+who);box.replaceChildren();
      const title=document.createElement('h3');title.textContent=who.toUpperCase()+' · '+(mode==='modern'?'现代':'经典');box.appendChild(title);
      for(const [action,index] of Object.entries(map)){
        const row=document.createElement('div');row.className='key-row';
        const name=document.createElement('span');name.textContent=actions[action];
        const key=document.createElement('strong');key.textContent=labels[index];row.append(name,key);box.appendChild(row);
      }
    }
  }
  function mount(container){
    host=container;
    host.innerHTML=`<h2>手柄连接与操作</h2><p id="pad-status" role="status" aria-live="polite"></p>
      <div class="control-mode-grid">${players.map(w=>`<label class="control-mode-card">${w.toUpperCase()} 手柄<select id="pad-${w}"></select></label>`).join('')}</div>
      <label class="match-row">摇杆死区 <output id="pad-deadzone-value"></output><input id="pad-deadzone" type="range" min="15" max="50" step="1"></label>
      <p class="settings-help">十字键 / 左摇杆移动与搓招。漂移时调大死区。前两个连接的手柄自动分配 P1 / P2，可改为键盘＋手柄；电脑对战与训练由 P1 控制玩家。此页按键跟随上方经典 / 现代模式。</p>
      <p class="settings-help">菜单：A / × 确认，B / ○ 返回；Start / Options 暂停 / 继续，View / Share 打开设置；暂停时 Y / △ 查看出招表。进入新界面后先松开按键。选人时各自确认角色。</p>
      <div class="pad-maps">${players.map(w=>`<div class="key-panel" id="pad-map-${w}"></div>`).join('')}</div>
      <p class="settings-help">按键按物理位置标注（Xbox / PlayStation）；Switch 手柄以位置为准。非标准设备可切换 XInput 模式后重连。浏览器未识别时，可用 Chrome / Edge 打开本地游戏地址；无声音时点击页面以启用音频。</p>`;
    for(const who of players)host.querySelector('#pad-'+who).addEventListener('change',e=>{
      const chosen=e.target.value===''?null:Number(e.target.value),other=who==='p1'?'p2':'p1',old=slots[who];
      if(chosen!==null&&slots[other]===chosen)slots[other]=old;
      slots[who]=chosen;Input.clear();lastStatus='';refreshUI();
    });
    const slider=host.querySelector('#pad-deadzone'),value=host.querySelector('#pad-deadzone-value');
    slider.value=String(deadzone*100);value.textContent=Math.round(deadzone*100)+'%';
    slider.addEventListener('input',()=>{deadzone=Number(slider.value)/100;value.textContent=slider.value+'%';try{localStorage.setItem('pixel-fighter-pad-deadzone',String(deadzone));}catch(_){};});
    lastStatus='';refreshUI();
  }
  function poll(){
    const previous=pads;
    try{pads=typeof navigator.getGamepads==='function'?[...navigator.getGamepads()].filter(p=>p&&p.connected):[];error=typeof navigator.getGamepads==='function'?'':'此浏览器未提供手柄接口，请用 Chrome / Edge 打开本地游戏地址。';}
    catch(_){pads=[];error='浏览器阻止了手柄访问，请在独立浏览器窗口打开本地游戏地址。';}
    let lost=false;
    for(const old of previous)if(!pads.some(p=>p.index===old.index&&p.id===old.id)){
      for(const who of players)if(slots[who]===old.index){slots[who]=null;lost=true;}states.delete(old.index);
    }
    for(const pad of pads)if(!previous.some(p=>p.index===pad.index&&p.id===pad.id)){
      const who=players.find(w=>slots[w]===null);if(who)slots[who]=pad.index;blocked=true;
    }
    if(lost)stopFight();
    refreshUI();
    const snapshots=new Map(pads.map(p=>[p.index,sample(p)]));
    const dialog=document.querySelector('dialog[open]');
    const nextContext=[window.GAME?.scene,window.GAME?.paused,dialog?.id,Input.MODES.p1,Input.MODES.p2].join(':');
    if(context!==nextContext){context=nextContext;blocked=true;Input.setGamepadKeys([]);Input.clearMotions();}
    if(document.hidden||!document.hasFocus()){blocked=true;Input.setGamepadKeys([]);return;}
    const active=players.map(w=>snapshots.get(slots[w])).filter(Boolean);
    if(blocked){Input.setGamepadKeys([]);if(active.every(s=>s.held.size===0))blocked=false;return;}
    const keys=new Set();let globalHandled=false;
    for(const who of players){
      const s=snapshots.get(slots[who]);if(!s)continue;
      if(dialog){dialogInput(dialog,s);break;}
      if(s.edge.has('b8')){window.Settings?.open();globalHandled=true;break;}
      if(GAME.scene==='fight'){
        if(s.edge.has('b9')||(GAME.paused&&(s.edge.has('b0')||s.edge.has('b1')))){keys.add('p');globalHandled=true;break;}
        if(GAME.paused){if(s.edge.has('b3'))window.AppPanels?.openGuide();continue;}
        if(who==='p2'&&GAME.pve)continue;
        for(const d of ['left','right','up','down'])if(s.held.has(d))keys.add(Input.MAP[who][d]);
        const map=Input.MODES[who]==='modern'?modern:classic;
        for(const [a,n] of Object.entries(map))if(s.held.has('b'+n))keys.add(Input.MAP[who][a]);
      }else{
        const menu=who==='p1'?{left:'a',right:'d',up:'w',down:'s'}:{left:'ArrowLeft',right:'ArrowRight',up:'ArrowUp',down:'ArrowDown'};
        if(GAME.scene==='char'&&GAME.pve&&who==='p2')continue;
        for(const d of ['left','right','up','down'])if(s.nav.has(d))keys.add(menu[d]);
        if(s.edge.has('b0')||s.edge.has('b9'))keys.add(GAME.scene==='char'?(who==='p1'?'f':'j'):'Enter');
        if(s.edge.has('b1'))keys.add('Escape');
      }
    }
    // 对话框直接调用 UI，不派发伪键盘事件，避免触发改键或页面快捷键。
    Input.setGamepadKeys(dialog||globalHandled&&!keys.has('p')?[]:keys);
  }
  window.Gamepads={poll,release,mount};
  const badge=document.createElement('button');badge.id='gamepad-status';badge.textContent='连接手柄';badge.setAttribute('aria-label','手柄连接与操作设置');
  document.querySelector('#app-bar nav').prepend(badge);
  badge.addEventListener('click',()=>{Settings.open();document.querySelector('[data-section="keys"]').click();host?.scrollIntoView({block:'start'});});
})();
