// 出招表内的逐帧图鉴；复用游戏同一动画轨道和距离定义，不打开额外页面。
(function(){
  let root=null,frame=0,previous=0,playing=true,accumulator=0;
  const basics=[['idle','待机'],['walk','稳步前进'],['backwalk','稳步后退'],['jump','前跳'],['backjump','后跳'],['airPunch','空中拳'],['airKick','空中脚'],['crouch','下蹲'],['block','站防'],['landing','落地'],['getup','起身'],['ko','倒地']];
  const reactions=[['head','头部轻击'],['body','腹部打击'],['heavy','重击后仰'],['low','下段屈膝'],['slash','斩击'],['electric','电击'],['burn','灼烧'],['launch','挑空'],['air','空中受击'],['sweep','扫倒'],['knockdown','击倒'],['throw','投技受身'],['guard','站立格挡'],['guardLow','蹲防格挡']];
  function mount(host){
    root=host;
    root.innerHTML=`<details id="motion-gallery"><summary>街机动作图鉴 · 全动作重绘</summary>
      <p class="settings-help">选择角色与动作，对照待机形象查看服装、发型与武器。可慢放、逐帧查看必杀和受击；下方 60 格为招式时间轴，说明栏显示实际图帧。</p>
      <div class="motion-tools"><label>角色 <select id="motion-character"></select></label><label>动作 <select id="motion-action"></select></label><label>播放速度 <select id="motion-speed"><option value="1">正常</option><option value="0.25">1/4 慢速</option></select></label></div>
      <div class="motion-tools"><label><input id="motion-identity" type="checkbox" checked>站姿对照</label><label><input id="motion-flash" type="checkbox">受击闪光</label><label>朝向 <select id="motion-facing"><option value="1">朝右</option><option value="-1">朝左</option></select></label><label><input id="motion-jump-path" type="checkbox" checked>显示跳跃轨迹</label></div>
      <canvas id="motion-canvas" width="720" height="420" aria-label="同一角色的站姿与动作对照"></canvas>
      <div class="motion-tools"><button id="motion-play">暂停</button><button id="motion-step">下一帧</button><label>时间格 <input id="motion-frame" type="range" min="0" max="59" value="0"><output id="motion-counter">1 / 60</output></label></div>
      <p id="motion-caption" class="settings-help"></p></details>`;
    const chars=root.querySelector('#motion-character'),moves=root.querySelector('#motion-action');
    CHARACTERS.forEach((c,i)=>{const o=document.createElement('option');o.value=i;o.textContent=c.name;chars.appendChild(o);});
    const fill=()=>{
      const old=moves.value;const c=CHARACTERS[Number(chars.value)];moves.replaceChildren();
      for(const [id,label] of [...basics,...Object.entries(c.moves).map(([k,m])=>[k,m.name]),...reactions.map(([k,v])=>['react:'+k,v])]){
        const o=document.createElement('option');o.value=id;o.textContent=label;moves.appendChild(o);
      }
      if([...moves.options].some(o=>o.value===old))moves.value=old;frame=0;accumulator=0;
    };
    chars.addEventListener('change',fill);moves.addEventListener('change',()=>{frame=0;accumulator=0;});fill();
    root.querySelector('#motion-play').addEventListener('click',e=>{playing=!playing;e.target.textContent=playing?'暂停':'播放';});
    root.querySelector('#motion-step').addEventListener('click',()=>{playing=false;frame=(frame+1)%60;root.querySelector('#motion-play').textContent='播放';});
    root.querySelector('#motion-frame').addEventListener('input',e=>{playing=false;frame=Number(e.target.value);root.querySelector('#motion-play').textContent='播放';});
  }
  function draw(now){
    if(!root||!window.AppPanels?.isOpen||!root.querySelector('details').open){previous=now;return;}
    const elapsed=Math.min(.05,(now-previous)/1000);previous=now;
    const def=CHARACTERS[Number(root.querySelector('#motion-character').value)],name=root.querySelector('#motion-action').value,m=def.moves[name];
    const walking=name==='walk'||name==='backwalk',backward=name==='backwalk';
    const cycleTicks=walking?(backward?def.strideBackward/def.walkBackward:def.stride/def.walkForward)/Fighter.walkAnimationRate:60;
    if(playing){accumulator+=elapsed*60*(60/cycleTicks)*Number(root.querySelector('#motion-speed').value);while(accumulator>=1){frame=(frame+1)%60;accumulator--;}}
    const canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');
    ctx.fillStyle='#0a1422';ctx.fillRect(0,0,720,420);
    ctx.strokeStyle='#26384a';ctx.lineWidth=1;
    for(let x=0;x<=720;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,395);ctx.stroke();}
    ctx.fillStyle='#33445b';ctx.fillRect(0,395,720,2);
    const compare=root.querySelector('#motion-identity').checked;
    const flash=root.querySelector('#motion-flash').checked;
    const x=compare?405:235,y=390,anim=Motion60.preview(def,name,frame);
    const facing=Number(root.querySelector('#motion-facing').value);
    const jumping=name==='jump'||name==='backjump';
    const jumpHeight=jumping&&root.querySelector('#motion-jump-path').checked?4*(frame/59)*(1-frame/59)*def.jump*def.jump/(2*.62):0;
    ctx.font='16px sans-serif';ctx.fillStyle='#c6d6e8';ctx.textAlign='center';
    if(compare){
      ctx.fillText(def.name+' · 站姿',145,42);
      ctx.save();ctx.translate(145,y);ctx.scale(facing*4.2,4.2);Motion60.draw(ctx,def,Motion60.preview(def,'idle',0));ctx.restore();
    }
    ctx.fillText(def.name+' · 当前动作',x,42);
    ctx.fillStyle='#0008';ctx.beginPath();ctx.ellipse(x,y,50,6,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(x,y-jumpHeight);ctx.scale(facing*4.2,4.2);if(!window.DrawnAnimation?.has?.(def.id)){if(name==='ko'||name==='react:knockdown'||name==='react:sweep')ctx.rotate(-Math.min(1,frame/24)*1.3);if(name==='getup')ctx.rotate(-(1-frame/59)*.7);}Motion60.draw(ctx,def,anim,flash);ctx.restore();
    if(m&&!m.projectile&&!m.noHit){
      const g=CombatSpacing.geometry(m),left=facing>0?x+g.near:x-g.far;ctx.fillStyle='#efb56d20';ctx.strokeStyle='#efb56d';ctx.setLineDash([4,4]);ctx.fillRect(left,y+g.y-g.h/2,g.w,g.h);ctx.strokeRect(left,y+g.y-g.h/2,g.w,g.h);ctx.setLineDash([]);
    }
    root.querySelector('#motion-counter').textContent=(frame+1)+' / 60';root.querySelector('#motion-frame').value=frame;
    const drawn=window.DrawnAnimation?.selection(def,anim);
    const source=drawn?`街机重绘 · ${drawn.label} · 图帧 ${drawn.index+1} / ${drawn.count} · `:window.DrawnAnimation?.status==='loading'?'新图集载入中 · ':'原有图集直接选帧 · ';
    root.querySelector('#motion-caption').textContent=source+(m?`${m.name} · 实战 ${m.startup} 帧起手 / ${m.active} 帧有效 / ${m.recovery} 帧收招${m.projectile?' · 飞行道具判定独立移动':m.noHit?' · 位移动作':' · 虚线为有效帧的攻击范围，最远 '+CombatSpacing.geometry(m).far+' px'}${m.travelDistance?' · 自由突进 '+m.travelDistance+' px':''}`:walking?`低抬脚 · 稳定重心 · ${backward?'后脚先退、前脚跟随':'前脚先迈、后脚跟随'} · 完整步态 ${(cycleTicks/60).toFixed(2)} 秒`:jumping?'上升伸展 → 顶点收腿 → 展腿下落 · 身体比例与站姿一致，收腿不改变身体中心':['airPunch','airKick'].includes(name)?'空中姿势按髋部定位，脚部可自然收起':'地面参考线固定在脚底');
  }
  window.MotionGallery={mount,draw};
})();
