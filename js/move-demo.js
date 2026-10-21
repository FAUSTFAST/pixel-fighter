// Move-guide demonstrations run the original fight in a disposable same-origin
// frame. The live match, controls, audio preferences and RNG stay in their window.
(function(){
  const keys=()=>[...CombatRules.specials,...CombatRules.supers];
  const query=new URLSearchParams(window.location?.search||'');
  if(query.get('moveDemo')==='1'&&window.parent!==window){
    document.documentElement.classList.add('move-demo-player');
    Audio2.setMusicOn(false);Audio2.setSfxOn(false);
    let config,pending=true,tick=0,cycle=0,game=null,hits=0,blocks=0,damage=0;
    const session=window.MoveDemoSession={
      playing:true,speed:1,ready:false,
      select(character,move,options={}){
        const def=CHARACTERS.find(c=>c.id===character)||CHARACTERS[0];
        config={def,move:keys().includes(move)?move:'special',guard:options.guard===true,od:options.od===true,facing:options.facing===-1?-1:1};
        this.restart();
      },
      restart(){pending=true;tick=0;hits=blocks=damage=0;},
      beforeStep(g){
        game=g;
        const stage=STAGES[CHARACTERS.indexOf(config.def)%STAGES.length];
        this.ready=window.DrawnAnimation?.status==='ready'&&!!window.STAGE_ART?.[stage.id]?.ready;
        if(!this.ready)return false;
        if(pending){
          pending=false;cycle++;tick=0;hits=blocks=damage=0;Input.clear();
          const m=config.def.moves[config.move],distance=m.counter?68:m.grab?95:m.projectile?330:190;
          const x=config.facing===1?260:700,index=CHARACTERS.indexOf(config.def);
          const a=new Fighter(config.def,x,config.facing,'P1');
          const b=new Fighter(CHARACTERS[(index+1)%CHARACTERS.length],x+config.facing*distance,-config.facing,'P2');
          a.foe=b;b.foe=a;a.meter=b.meter=300;
          const takeHit=b.takeHit.bind(b);
          b.takeHit=(...args)=>{
            const result=takeHit(...args);
            if(!result.ignored&&!result.countered){if(result.blocked)blocks++;else hits++;damage+=result.dmg||0;}
            return result;
          };
          Object.assign(g,{scene:'fight',roundState:'fight',roundTime:Infinity,pve:false,training:true,
            trainingOptions:{opponent:'dummy'},trainingResetT:0,paused:false,f1:a,f2:b,ai:null,
            stage,projectiles:[],effects:[],hitstop:0,shake:0,cameraX:0,t:0,
            combo:{P1:{count:0,timer:0},P2:{count:0,timer:0}}});
        }
        return true;
      },
      intent(who){
        const m=config.def.moves[config.move],attacker=who==='p1';
        // These scenarios use actual movement / jump inputs. Traps arm in their
        // normal time, and anti-air projectiles meet a genuinely airborne foe.
        const antiAir=config.def.id==='ryu'&&config.move==='skill';
        const approach=!attacker&&m.armFrames&&tick>=m.startup+m.armFrames+22&&hits+blocks===0;
        return {move:approach?-config.facing:0,up:!attacker&&antiAir&&tick===36,down:!attacker&&config.guard&&m.level==='low',
          block:!attacker&&config.guard,
          command:attacker&&tick===12?config.move:!attacker&&m.counter&&tick===18?'light':undefined,
          commandOptions:{strength:2,od:attacker&&config.od}};
      },
      afterStep(){if(++tick>=240)pending=true;},
      snapshot(){
        const a=game?.f1,m=a?.attack;
        const failed=window.DrawnAnimation?.status==='fallback'||window.STAGE_ART?.[STAGES[CHARACTERS.indexOf(config.def)%STAGES.length].id]?.failed;
        const phase=failed?'原画载入失败，请关闭后重试':!this.ready?'载入原画中':pending||tick<=12?'准备':m?
          a.stateT<m.startup?'前摇':a.stateT<m.startup+m.active?'出招':'收招':
          game.projectiles.some(p=>p.owner===a)?'飞行道具':hits?'命中后效果':blocks?'格挡后效果':'动作结束';
        return {ready:this.ready,failed,frame:tick,hits,blocks,damage,phase,cycle,character:config.def.id,move:config.move};
      }
    };
    session.select(query.get('character'),query.get('move'));
    return;
  }

  let dialog,frame,trigger,loaded=false;
  const find=id=>dialog.querySelector('#demo-'+id);
  function mount(){
    if(dialog)return;
    dialog=document.createElement('dialog');dialog.id='move-demo-dialog';
    dialog.setAttribute('aria-labelledby','demo-title');
    dialog.innerHTML=`<header><div><small>SPECIAL MOVE SHOWCASE</small><h1 id="demo-title">必杀技 · 对敌演示</h1></div><button id="demo-close" autofocus>返回出招表 ✕</button></header>
      <div class="demo-body"><div class="demo-selects"><label>角色<select id="demo-character"></select></label><label class="demo-move-label">招式<select id="demo-move"></select></label></div>
      <div id="demo-stage" aria-busy="true"><div id="demo-loading" role="status">正在载入角色原画…</div></div>
      <div class="demo-toolbar"><button id="demo-play" aria-pressed="false">暂停</button><button id="demo-restart">重新播放</button><label>速度<select id="demo-speed"><option value="1">正常</option><option value="0.5">1/2 慢放</option><option value="0.25">1/4 慢放</option></select></label><label>对手<select id="demo-opponent"><option value="hit">承受攻击</option><option value="guard">尝试格挡</option></select></label><label><input id="demo-od" type="checkbox">OD 强化</label></div>
      <p id="demo-command"></p><div class="demo-result"><strong id="demo-phase">准备</strong><span id="demo-result">0 次命中 · 0 伤害</span></div><p id="demo-note" class="settings-help"></p></div>`;
    document.body.appendChild(dialog);
    for(const c of CHARACTERS){const o=document.createElement('option');o.value=c.id;o.textContent=c.name;find('character').appendChild(o);}
    find('character').addEventListener('change',()=>{fillMoves();select();});
    for(const id of ['move','opponent','od'])find(id).addEventListener('change',select);
    find('speed').addEventListener('change',()=>{const s=player();if(s)s.speed=Number(find('speed').value);});
    find('play').addEventListener('click',()=>{const s=player();if(s){s.playing=!s.playing;playLabel();}});
    find('restart').addEventListener('click',()=>{const s=player();if(s){s.restart();s.playing=true;playLabel();}});
    find('close').addEventListener('click',close);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  }
  function definition(){return CHARACTERS.find(c=>c.id===find('character').value);}
  function fillMoves(preferred=find('move').value){
    const c=definition();find('move').replaceChildren();
    for(const key of keys()){
      const o=document.createElement('option');o.value=key;
      o.textContent=(c.moves[key].saLevel?'SA'+c.moves[key].saLevel+' · ':'')+c.moves[key].name;find('move').appendChild(o);
    }
    if(keys().includes(preferred))find('move').value=preferred;
  }
  function player(){return loaded?frame?.contentWindow?.MoveDemoSession:null;}
  function playLabel(){const paused=!player()?.playing;find('play').textContent=paused?'继续播放':'暂停';find('play').setAttribute('aria-pressed',String(paused));}
  function select(){
    const c=definition(),key=find('move').value,m=c.moves[key];
    dialog.querySelector('#demo-title').textContent=c.name+' · '+m.name;
    find('od').disabled=!CombatRules.isSpecial(key);
    if(find('od').disabled)find('od').checked=false;
    find('command').textContent='经典：'+m.command+'　·　'+m.startup+' 帧前摇 / '+m.active+' 帧有效 / '+m.recovery+' 帧收招（中版）';
    find('note').textContent=(m.counter?'对手会主动出拳，触发反击后再展示还击。':m.grab?'投技演示：对手站立时抓取，普通格挡无法防住。':m.armFrames?'陷阱布置并生效后，对手走入范围，展示命中或格挡。':c.id==='ryu'&&key==='skill'?'对空演示：对手真实起跳，空中不能格挡。':find('opponent').value==='guard'?'对手按招式高低尝试格挡，展示实际防御反馈。':'展示完整起手、命中、击退与收招。')+' 自动循环；关闭演示后返回出招表，当前对局保持暂停。';
    const s=player();if(s){s.select(c.id,key,{guard:find('opponent').value==='guard',od:find('od').checked});s.speed=Number(find('speed').value);s.playing=true;playLabel();}
    find('phase').textContent='准备';find('result').textContent='0 次命中 · 0 伤害';
  }
  function open(character,move,source){
    if(dialog?.open)close();
    mount();trigger=source||document.activeElement;
    find('character').value=character;fillMoves(move);
    find('speed').value='1';find('opponent').value='hit';find('od').checked=false;
    loaded=false;find('stage').setAttribute('aria-busy','true');find('loading').hidden=false;
    select();
    frame=document.createElement('iframe');frame.title='必杀技对敌演示画面';frame.tabIndex=-1;
    const url=new URL('index.html',window.location.href);url.search='';url.hash='';
    url.searchParams.set('moveDemo','1');url.searchParams.set('character',character);url.searchParams.set('move',move);
    frame.src=url.href;frame.inert=true;frame.addEventListener('load',e=>{if(e.currentTarget!==frame)return;loaded=true;select();});
    find('stage').appendChild(frame);dialog.showModal();
  }
  function close(){
    if(!dialog?.open)return;
    loaded=false;frame?.remove();frame=null;dialog.close();trigger?.focus();
  }
  function draw(){
    if(!dialog?.open)return;
    const state=player()?.snapshot();if(!state)return;
    find('loading').textContent=state.failed?state.phase:'正在载入角色原画…';
    find('loading').hidden=state.ready;find('stage').setAttribute('aria-busy',String(!state.ready));
    find('phase').textContent=state.phase;
    find('result').textContent=state.hits+' 次命中 · '+state.blocks+' 次格挡 · '+Math.round(state.damage*100)/100+' 伤害';
  }
  window.MoveDemo={open,close,draw,get isOpen(){return !!dialog?.open;}};
})();
