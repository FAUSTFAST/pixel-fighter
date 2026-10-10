(function () {
  const $=id=>document.getElementById(id),canvas=$('replay'),ctx=canvas.getContext('2d');
  const labels={stand:'站立对照',single:'单跳对照',double:'二段跳'};
  let mode='double',frame=0,playing=true,previous=0,accumulator=0,replays;
  function rebuild(){
    const test=JumpWaveScenario.cases[$('wave-case').value];
    replays=Object.fromEntries(Object.keys(labels).map(k=>[k,JumpWaveScenario.simulate(k,test.options)]));
    const host=$('results');host.replaceChildren();
    for(const k of Object.keys(labels)){
      const r=replays[k].result,pass=r.hits===0&&r.passed;
      const card=document.createElement('article');card.className='result'+(pass?' pass':'');
      const title=document.createElement('strong');title.textContent=labels[k];
      const verdict=document.createElement('div');verdict.className='verdict';verdict.textContent=pass?'完整躲过':'被波击中';
      const data=document.createElement('small');data.textContent=`${r.hits} 次命中 · 扣血 ${r.damage} · HP ${r.hp}/100`;
      card.append(title,verdict,data);host.appendChild(card);
    }
    const r=replays.double.result,cfg=replays.double.settings;
    $('explanation').textContent=`疾风与对手相距 ${cfg.attackerX-cfg.defenderX} px，第 ${cfg.firstJump} 帧首跳、第 ${cfg.secondJump} 帧二段跳。`+(r.passed&&r.hits===0?`这组时机下，单跳被击中；第二跳延长滞空后，整道波从脚下通过，最小垂直间隔 ${r.clearance.toFixed(1)} px。`:'苍月的大剑气位置较高、体积较大。这组时机下，角色完成两次起跳后仍被击中，二段跳不会提供无敌。');
    frame=0;accumulator=0;renderEvents();draw();
  }
  function renderEvents(){
    const list=$('events');list.replaceChildren();
    for(const e of replays[mode].events){
      const li=document.createElement('li'),button=document.createElement('button');
      li.dataset.frame=e.frame;button.textContent=`F${e.frame}`;button.setAttribute('aria-label',`查看第 ${e.frame} 帧：${e.text}`);
      button.onclick=()=>{frame=e.frame;playing=false;syncPlay();draw();};li.append(button,document.createTextNode(e.text));list.appendChild(li);
    }
  }
  function syncPlay(){$('play').textContent=playing?'暂停':'播放';}
  function draw(){
    if(!replays)return;
    const replay=replays[mode],snap=replay.frames[frame],f=snap.defender,foe=snap.attacker;
    ctx.imageSmoothingEnabled=false;STAGES[0].draw(ctx,frame/60,0);
    f.draw(ctx);foe.draw(ctx);for(const p of snap.projectiles)p.draw(ctx);
    if($('boxes').checked){
      ctx.save();ctx.lineWidth=2;ctx.setLineDash([6,4]);
      const rect=(b,color)=>{ctx.strokeStyle=color;ctx.strokeRect(b.x,b.y,b.w,b.h);};
      rect(f.bodyBox,'#7aebe2');for(const p of snap.projectiles)rect(p.box,'#ffb26f');ctx.restore();
    }
    const last=snap.events.at(-1);if(last?.type==='hit'&&frame-last.frame<18){ctx.save();ctx.fillStyle='#ff715522';ctx.fillRect(0,0,960,540);ctx.restore();}
    ctx.fillStyle='#091523ed';ctx.fillRect(0,0,960,92);
    U.text(ctx,'疾风 · '+labels[mode],26,33,20,'#d8ebe7','left');U.text(ctx,foe.name+' · '+foe.def.moves[replay.settings.move].name,934,33,20,'#e7cba5','right');
    ctx.fillStyle='#2c4051';ctx.fillRect(26,50,290,10);ctx.fillStyle=snap.hits?'#ec887e':'#8bd8ad';ctx.fillRect(26,50,290*f.hp/f.maxHp,10);
    U.text(ctx,`HP ${f.hp}/${f.maxHp} · 命中 ${snap.hits} 次`,26,81,14,'#b9d3d5','left');
    U.text(ctx,`第 ${frame} 帧 / ${(frame/60).toFixed(2)} 秒`,934,70,14,'#aebed0','right');
    ctx.fillStyle='#091523df';ctx.fillRect(0,492,960,48);
    const status=snap.hits?'已命中 · 扣血 '+(f.maxHp-f.hp):snap.passed?'躲避成功 · 波已完整通过':last?.text||'准备测试';
    U.text(ctx,status,480,522,20,snap.hits?'#f3a99a':snap.passed?'#a0ebbf':'#e2d4b8','center');
    $('frame').value=frame;$('counter').textContent=`${frame} / ${replay.settings.frames} 帧`;
    for(const li of $('events').children)li.classList.toggle('active',Number(li.dataset.frame)<=frame);
  }
  $('wave-case').onchange=()=>{playing=true;syncPlay();rebuild();};
  for(const button of document.querySelectorAll('[data-mode]'))button.onclick=()=>{
    mode=button.dataset.mode;frame=0;accumulator=0;playing=true;syncPlay();renderEvents();
    for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b===button));draw();
  };
  $('play').onclick=()=>{playing=!playing;syncPlay();};
  $('restart').onclick=()=>{frame=0;accumulator=0;playing=true;syncPlay();draw();};
  $('step').onclick=()=>{playing=false;frame=Math.min(frame+1,replays[mode].settings.frames);syncPlay();draw();};
  $('frame').oninput=()=>{frame=Number($('frame').value);playing=false;syncPlay();draw();};
  $('boxes').onchange=draw;
  function loop(now){
    const elapsed=previous?Math.min(.1,(now-previous)/1000):0;previous=now;
    if(playing&&replays){
      accumulator+=elapsed*60*Number($('speed').value);
      while(accumulator>=1){accumulator--;if(frame<replays[mode].settings.frames)frame++;else if($('loop').checked)frame=0;else{playing=false;syncPlay();break;}}
    }
    draw();requestAnimationFrame(loop);
  }
  rebuild();DrawnAnimation.loading.then(()=>{$('asset-status').textContent=DrawnAnimation.status==='ready'?'游戏原版角色动画 · 60 Hz 判定':'部分素材未加载，使用游戏备用绘制';draw();});
  requestAnimationFrame(loop);
})();
