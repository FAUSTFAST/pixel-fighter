(function(){
  const storageKey='pixel-fighter-settings-v1';
  const defaults=JSON.parse(JSON.stringify(Input.MAP));
  const actions={left:'向左',right:'向右',up:'跳跃',down:'下蹲',light:'轻拳 / 现代轻',medium:'中拳 / 现代中',heavy:'重拳 / 现代重',lightKick:'轻脚（经典）',mediumKick:'中脚（经典）',heavyKick:'重脚（经典）',throw:'投 / 拆投',special:'SP 必杀（现代）',assist:'辅助（现代）',impact:'斗气迸放',parry:'斗气招架',driveRush:'斗气冲刺'};
  const reserved=new Set(['Escape','Enter','Tab','F2','p','m','n']);
  const validKey=k=>typeof k==='string'&&(k.length===1||['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k))&&!reserved.has(k);
  const clone=v=>JSON.parse(JSON.stringify(v));
  let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch(_error){}
  const values={music:saved.music!==false,sfx:saved.sfx!==false,volume:typeof saved.volume==='number'?Math.max(0,Math.min(100,saved.volume)):90,shake:saved.shake!==false,keys:clone(defaults),controls:{p1:saved.controls?.p1==='modern'?'modern':'classic',p2:saved.controls?.p2==='modern'?'modern':'classic'}};
  if(saved.keys){
    const used=new Set();let valid=true;
    for(const who of ['p1','p2'])for(const action of Object.keys(actions)){
      const k=saved.keys[who]?.[action];if(k===undefined)continue;
      if(!validKey(k)||used.has(k))valid=false;used.add(k);
    }
    if(valid)for(const who of ['p1','p2'])for(const action of Object.keys(actions)){
      const old=saved.keys[who]?.[action];
      if(old!==undefined){values.keys[who][action]=old;continue;}
      let key=defaults[who][action];
      if(used.has(key))key=[...'1234567890-=[]\\`abcdefghijklmnopqrstuvwxyz,./;'].find(k=>validKey(k)&&!used.has(k));
      values.keys[who][action]=key;used.add(key);
    }
  }
  let recording=null,previousPause=false,previewing=false;
  const dialog=document.createElement('dialog');dialog.id='settings-dialog';dialog.setAttribute('aria-labelledby','settings-title');
  dialog.innerHTML=`<header><div><small>PIXEL FIGHTER</small><h1 id="settings-title">游戏设置</h1></div><button id="settings-close" aria-label="关闭设置">关闭 ✕</button></header>
    <nav class="settings-tabs" aria-label="设置分类"><button data-section="match" hidden>对战设置</button><button data-section="audio">声音与画面</button><button data-section="keys">操作模式与按键</button></nav>
    <div class="settings-body"><section id="match-settings" hidden></section>
    <section id="audio-settings"><h2>声音与画面</h2><p>调整你的游戏体验，修改自动保存。</p><div class="settings-options">
      <label><span>背景音乐</span><input id="setting-music" type="checkbox"></label>
      <label><span>游戏音效</span><input id="setting-sfx" type="checkbox"></label>
      <label><span>命中震屏</span><input id="setting-shake" type="checkbox"></label>
      <label class="volume-row"><span>总音量 <output id="volume-value"></output></span><input id="setting-volume" type="range" min="0" max="100" step="1"></label>
    </div><div class="music-library"><div class="music-library-heading"><h3>舞台原声</h3><span>7 首原创战斗配乐</span></div>
      <label class="match-row">选择舞台<select id="music-track"></select></label>
      <div class="music-track-card"><span class="music-disc" aria-hidden="true">♫</span><div><strong id="music-track-title"></strong><p id="music-track-description"></p><small id="music-track-tempo"></small></div></div>
      <div class="music-preview-actions"><button id="music-preview" class="primary-button">试听配乐</button><button id="music-restore">恢复场景配乐</button></div>
      <p id="music-preview-status" role="status" aria-live="polite">选择地图试听，关闭设置后恢复当前场景音乐。</p>
    </div></section>
    <section id="keys-settings"><h2>经典 / 现代操作</h2><div class="control-mode-grid">${['p1','p2'].map(w=>`<label class="control-mode-card">${w.toUpperCase()} 操作方式<select id="control-${w}"><option value="classic">经典 · 六键拳脚与搓招</option><option value="modern">现代 · 简化必杀与辅助连段</option></select></label>`).join('')}</div>
      <p class="settings-help">经典：轻中重拳脚＋指令技。现代：轻中重攻击，方向＋SP 必杀；按住辅助连按轻／中／重，逐段推进专属连段。现代手动搓招为全伤害，快捷必杀为 80%。</p>
      <p class="settings-help">双击前方向前冲，双击后方向后撤步，中间松开方向；普通冲刺免费，使用下方自定义方向键或手柄。普通必杀免费；OD 强化消耗 2 格斗气。SA1 / SA2 / SA3 消耗 100 / 200 / 300。斗气冲刺自由发动 1 格，普通技取消 3 格。</p><div id="gamepad-settings"></div><h2>键盘按键</h2><p>点击按键后，按下新的键。两名玩家的按键不能重复。</p><p class="settings-help">菜单操作仍用 WASD / 方向键；Enter 确认，P 暂停，M / N 音乐及音效，F2 打开设置。</p>
      <div id="settings-keys"></div><p id="settings-message" role="status" aria-live="polite"></p>
    </section></div><footer><div class="settings-status"><span id="settings-save">声音与按键自动保存到本机</span><span id="train-status" role="status" aria-live="polite" hidden></span></div><div class="settings-actions"><button id="settings-home" class="quiet-button">返回首页</button><button id="settings-reset" class="quiet-button">恢复默认</button><span class="action-spacer"></span><button id="settings-done">完成</button><button id="train-apply" class="primary-button" hidden>应用并继续训练</button></div></footer>`;
  document.body.appendChild(dialog);
  window.Gamepads?.mount(dialog.querySelector("#gamepad-settings"));
  const message=dialog.querySelector('#settings-message');
  const musicSelect=dialog.querySelector('#music-track');
  for(const [id,track] of Object.entries(Audio2.music.tracks)){
    if(id==='menu')continue;
    const option=document.createElement('option');option.value=id;option.textContent=track.stage;musicSelect.appendChild(option);
  }
  const sceneTrack=()=>GAME.scene==='fight'?GAME.stage.id:'menu';
  function showTrack(){
    const track=Audio2.music.tracks[musicSelect.value];
    dialog.querySelector('#music-track-title').textContent='《'+track.title+'》';
    dialog.querySelector('#music-track-description').textContent=track.genre;
    dialog.querySelector('#music-track-tempo').textContent=track.bpm+' BPM · 32 小节 · 主段 / 副歌 / 间奏';
  }
  function restoreSceneMusic(){
    previewing=false;
    if(Audio2.isMusicOn())Audio2.music.play(sceneTrack());
    dialog.querySelector('#music-preview-status').textContent='选择地图试听，关闭设置后恢复当前场景音乐。';
    dialog.querySelector('#music-preview').textContent='试听配乐';
  }
  function previewMusic(){
    if(!Audio2.isMusicOn()){dialog.querySelector('#music-preview-status').textContent='请先开启上方的背景音乐。';return;}
    previewing=true;Audio2.music.stop();Audio2.music.play(musicSelect.value);
    dialog.querySelector('#music-preview-status').textContent='正在试听：'+Audio2.music.tracks[musicSelect.value].stage+' · 建议听满一轮感受编曲变化。';
    dialog.querySelector('#music-preview').textContent='从头试听';
  }
  musicSelect.addEventListener('change',()=>{showTrack();if(previewing)previewMusic();});
  dialog.querySelector('#music-preview').addEventListener('click',previewMusic);
  dialog.querySelector('#music-restore').addEventListener('click',restoreSceneMusic);
  showTrack();
  function selectSection(name){
    for(const key of ['match','audio','keys'])dialog.querySelector('#'+key+'-settings').hidden=key!==name;
    for(const button of dialog.querySelectorAll('[data-section]'))button.setAttribute('aria-pressed',String(button.dataset.section===name));
    dialog.querySelector('#train-apply').hidden=!(GAME.training&&name==='match');
    dialog.querySelector('#train-status').hidden=!(GAME.training&&name==='match');
    dialog.querySelector('#settings-save').hidden=GAME.training&&name==='match';
    dialog.querySelector('#settings-reset').hidden=name==='match';
    dialog.querySelector('#settings-done').classList.toggle('primary-button',!(GAME.training&&name==='match'));
    dialog.querySelector('.settings-body').scrollTop=0;
    if(recording){recording=null;renderKeys();message.textContent='已取消改键。';}
  }
  for(const button of dialog.querySelectorAll('[data-section]'))button.addEventListener('click',()=>selectSection(button.dataset.section));
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(values));dialog.querySelector('#settings-save').textContent='已保存到本机';}catch(_error){dialog.querySelector('#settings-save').textContent='当前浏览器无法保存，设置仅本次有效';}}
  function apply(){
    for(const who of ['p1','p2']){Object.assign(Input.MAP[who],values.keys[who]);Input.MODES[who]=values.controls[who];}
    Audio2.setMasterVol(values.volume/100);Audio2.setSfxOn(values.sfx);Audio2.setMusicOn(values.music);
    if(values.music)Audio2.music.play(previewing?musicSelect.value:sceneTrack());
    else if(previewing){previewing=false;dialog.querySelector('#music-preview-status').textContent='背景音乐已关闭。';dialog.querySelector('#music-preview').textContent='试听配乐';}
    document.getElementById('hint').textContent=['p1','p2'].map(CombatControls.describe).join(' ｜ ')+' ｜ 双击前 / 后冲刺 · 空中再按跳跃键二段跳 · P 暂停 · F2 设置';
  }
  function renderKeys(){
    const host=dialog.querySelector('#settings-keys');host.replaceChildren();
    const display=k=>({'ArrowUp':'↑','ArrowDown':'↓','ArrowLeft':'←','ArrowRight':'→',' ':'空格'}[k]||k.toUpperCase());
    for(const who of ['p1','p2']){
      const panel=document.createElement('div');panel.className='key-panel';
      const title=document.createElement('h3');title.textContent=who.toUpperCase()+' · '+(values.controls[who]==='modern'?'现代':'经典');panel.appendChild(title);
      for(const [action,label] of Object.entries(actions)){
        const row=document.createElement('div');row.className='key-row';
        const text=document.createElement('span');text.textContent=label;
        const button=document.createElement('button');button.type='button';button.textContent=display(values.keys[who][action]);button.setAttribute('aria-label',who.toUpperCase()+' '+label+' 当前 '+display(values.keys[who][action]));
        button.addEventListener('click',()=>{recording={who,action};renderKeys();message.textContent='请按新的按键，Esc 取消。';});
        if(recording?.who===who&&recording.action===action){button.textContent='按新键…';button.className='recording';}
        row.append(text,button);panel.appendChild(row);
      }
      host.appendChild(panel);
    }
  }
  function renderMatchSettings(){
    const host=dialog.querySelector('#match-settings');
    host.replaceChildren();host.hidden=!GAME.training&&!GAME.pve;
    const matchTab=dialog.querySelector('[data-section="match"]');matchTab.hidden=host.hidden;matchTab.textContent=GAME.training?'训练场':'电脑难度';
    dialog.querySelector('#train-status').textContent='调整后应用，重置双方状态与位置。';
    dialog.querySelector('#settings-title').textContent=GAME.training?'训练设置':'游戏设置';
    dialog.querySelector('#settings-home').hidden=GAME.scene==='title';
    dialog.querySelector('#settings-done').textContent=GAME.training?'继续训练':'完成';
    if(host.hidden)return;
    const difficulties='<option value="0.6">简单电脑</option><option value="0.85">普通电脑</option><option value="1">困难电脑</option>';
    if(!GAME.training){
      host.innerHTML='<h2>电脑对战</h2><label class="match-row">电脑难度<select id="match-difficulty">'+difficulties+'</select></label><p class="settings-help">简单：反应较慢，短连段、较多破绽。普通：走位试探、命中确认与对空。困难：更快反应、资源连段与收招惩罚，仍有失误空间。调整后立即生效。</p>';
      const select=host.querySelector('select');select.value=String(GAME.difficulty);
      select.addEventListener('change',()=>GameControl.setDifficulty(Number(select.value)));return;
    }
    const chars=CHARACTERS.map((c,i)=>`<option value="${i}">${c.name} · ${c.style}</option>`).join('');
    const stages=STAGES.map((s,i)=>`<option value="${i}">${s.name}</option>`).join('');
    host.innerHTML=`<h2>无限时间训练场</h2><p>时间无限，不结算胜负。任意一方血量归零后自动恢复本页配置，直到主动退出。</p>
      <div class="training-fighters">${['p1','p2'].map((who,i)=>`<fieldset><legend>${i?'对手':'玩家'} · ${who.toUpperCase()}</legend>
        <label class="match-row">角色<select id="train-${who}-character">${chars}</select></label>
        <label class="match-row">血量<input id="train-${who}-hp" type="number" min="1" max="999" step="1" required></label>
        <label class="match-row">SA 能量<input id="train-${who}-meter" type="number" min="0" max="300" step="1" required></label>
        <label class="match-row">斗气<input id="train-${who}-drive" type="number" min="0" max="6" step="1" required></label>
        <label class="match-row">无敌<input id="train-${who}-invincible" type="checkbox"></label></fieldset>`).join('')}</div>
      <div class="training-environment"><label class="match-row">训练地图<select id="train-stage">${stages}</select></label>
      <label class="match-row">对手行为<select id="train-opponent"><option value="dummy">站立木桩 · 只挨打</option>${difficulties}</select></label></div>
      <p class="settings-help">简单电脑偏向短连段，普通加入确认与对空，困难更擅长惩罚与资源连段。血量 1–999，SA 能量 0–300，斗气 0–6（0 进入耗尽）。资源正常消耗。无敌会免疫攻击与投技。应用后重置双方位置、血量和能量。</p>
      `;
    for(const who of ['p1','p2']){
      const o=GAME.trainingOptions[who];
      host.querySelector(`#train-${who}-character`).value=GAME.charSel[who];
      host.querySelector(`#train-${who}-hp`).value=o.hp;
      host.querySelector(`#train-${who}-meter`).value=o.meter;
      host.querySelector(`#train-${who}-drive`).value=o.drive??6;
      host.querySelector(`#train-${who}-invincible`).checked=o.invincible;
    }
    host.querySelector('#train-stage').value=GAME.stageSel;
    host.querySelector('#train-opponent').value=GAME.trainingOptions.opponent;
    dialog.querySelector('#train-apply').onclick=()=>{
      for(const input of host.querySelectorAll('input[type=number]'))if(!input.reportValidity())return;
      const options={stage:Number(host.querySelector('#train-stage').value),opponent:host.querySelector('#train-opponent').value};
      for(const who of ['p1','p2'])options[who]={
        character:Number(host.querySelector(`#train-${who}-character`).value),
        hp:Number(host.querySelector(`#train-${who}-hp`).value),meter:Number(host.querySelector(`#train-${who}-meter`).value),drive:Number(host.querySelector(`#train-${who}-drive`).value),
        invincible:host.querySelector(`#train-${who}-invincible`).checked
      };
      GameControl.applyTraining(options);
      Settings.close();
    };
    host.oninput=()=>{dialog.querySelector('#train-status').textContent='有未应用的训练调整';};
  }
  function sync(){
    for(const who of ['p1','p2'])dialog.querySelector('#control-'+who).value=values.controls[who];
    for(const name of ['music','sfx','shake'])dialog.querySelector('#setting-'+name).checked=values[name];
    dialog.querySelector('#setting-volume').value=values.volume;
    dialog.querySelector('#volume-value').textContent=values.volume+'%';renderKeys();
  }
  const Settings=window.Settings={values,isOpen:false,
    keepPaused(){previousPause=true;},
    saveAudio(){values.music=Audio2.isMusicOn();values.sfx=Audio2.isSfxOn();save();},
    open(){if(this.isOpen)return;this.isOpen=true;previousPause=GAME.paused;GAME.paused=true;Input.clear();
      for(const f of [GAME.f1,GAME.f2])if(f){f.bufferedAttack=null;f.assistRoute=null;}
      values.music=Audio2.isMusicOn();values.sfx=Audio2.isSfxOn();recording=null;message.textContent='';musicSelect.value=GAME.scene==='fight'?GAME.stage.id:'dojo';showTrack();sync();renderMatchSettings();selectSection(GAME.training||GAME.pve?'match':'audio');dialog.showModal();},
    close(){if(!this.isOpen)return;if(previewing)restoreSceneMusic();this.isOpen=false;recording=null;dialog.close();Input.clear();GAME.paused=previousPause;document.getElementById('game').focus();}
  };
  for(const who of ['p1','p2'])dialog.querySelector('#control-'+who).addEventListener('change',e=>{
    values.controls[who]=e.target.value;Input.clear();
    const f=who==='p1'?GAME.f1:GAME.f2;if(f){f.bufferedAttack=null;f.assistRoute=null;}
    apply();renderKeys();save();
  });
  dialog.querySelector('#settings-home').addEventListener('click',()=>{Settings.close();GameControl.returnHome();});
  for(const name of ['music','sfx','shake'])dialog.querySelector('#setting-'+name).addEventListener('change',e=>{values[name]=e.target.checked;apply();save();});
  dialog.querySelector('#setting-volume').addEventListener('input',e=>{values.volume=Number(e.target.value);dialog.querySelector('#volume-value').textContent=values.volume+'%';Audio2.setMasterVol(values.volume/100);save();});
  for(const id of ['settings-close','settings-done'])dialog.querySelector('#'+id).addEventListener('click',()=>Settings.close());
  dialog.querySelector('#settings-reset').addEventListener('click',()=>{Object.assign(values,{music:true,sfx:true,volume:90,shake:true,keys:clone(defaults),controls:{p1:'classic',p2:'classic'}});recording=null;apply();sync();save();message.textContent='已恢复默认设置。';});
  dialog.addEventListener('cancel',e=>{e.preventDefault();Settings.close();});
  window.addEventListener('keydown',e=>{
    if(window.AppPanels?.isOpen)return;
    if(!Settings.isOpen){if(e.key==='F2'){e.preventDefault();e.stopImmediatePropagation();Settings.open();}return;}
    e.stopImmediatePropagation();
    if(!recording){if(e.key==='Escape'){e.preventDefault();Settings.close();}return;}
    e.preventDefault();
    if(e.key==='Escape'){recording=null;renderKeys();message.textContent='已取消改键。';return;}
    const key=e.key.length===1?e.key.toLowerCase():e.key;
    if(!validKey(key)){message.textContent='此按键用于菜单或系统操作，请选择字母、数字、符号或方向键。';return;}
    for(const who of ['p1','p2'])for(const action of Object.keys(actions)){
      if(who===recording.who&&action===recording.action)continue;
      if(values.keys[who][action]===key){message.textContent='此键已用于 '+who.toUpperCase()+' '+actions[action]+'，请换一个键。';return;}
    }
    values.keys[recording.who][recording.action]=key;recording=null;apply();renderKeys();save();message.textContent='按键已更新。';
  },true);
  window.addEventListener('keyup',e=>{if(Settings.isOpen)e.stopImmediatePropagation();},true);
  document.getElementById('settings-open').addEventListener('click',()=>Settings.open());
  apply();
})();
