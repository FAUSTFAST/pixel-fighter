(function () {
  const canvas=document.getElementById('gallery'),ctx=canvas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  let stage=0, pose='idle', clock=0, previousTime=null, paused=false, slow=false;
  document.getElementById('slow').addEventListener('click',e=>{
    slow=!slow;e.currentTarget.setAttribute('aria-pressed',String(slow));
  });
  document.getElementById('pause').addEventListener('click',e=>{
    paused=!paused;e.currentTarget.setAttribute('aria-pressed',String(paused));
    e.currentTarget.textContent=paused?'继续动画':'暂停动画';
  });
  document.getElementById('step').addEventListener('click',()=>{
    paused=true;clock+=pose==='walk'||pose==='backwalk'?Math.PI/20:4/60;
    document.getElementById('pause').textContent='继续动画';
    document.getElementById('pause').setAttribute('aria-pressed','true');
  });
  document.getElementById('export').addEventListener('click',()=>{
    const link=document.createElement('a');link.download='pixel-fighter-art.png';
    link.href=canvas.toDataURL('image/png');link.click();
  });
  function controls(host, options, choose) {
    options.forEach(([label,value],i)=>{
      const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-pressed',i===0?'true':'false');
      b.addEventListener('click',()=>{
        for(const item of host.children)item.setAttribute('aria-pressed','false');
        b.setAttribute('aria-pressed','true');choose(value);
      });host.appendChild(b);
    });
  }
  controls(document.getElementById('stages'),STAGES.map((s,i)=>[s.name,i]),v=>{stage=v;});
  controls(document.getElementById('poses'),[['待机','idle'],['前进','walk'],['后退','backwalk'],['前跳','jumpforward'],['后跳','jumpback'],['轻拳','light'],['重拳','heavy'],['轻脚','lightKick'],['重脚','heavyKick'],['下段脚','lowKick'],['投技','throw'],['升龙','uppercut'],['突进','rush'],['必杀','special']],v=>{pose=v;});
  function frame(now){
    if(previousTime!==null&&!paused)clock+=Math.min(.05,(now-previousTime)/1000)*(slow?.25:1);
    previousTime=now;
    const ready=Object.values(window.MOVEMENT_ART||{}).filter(a=>a.ready).length;
    const combatReady=Object.values(window.COMBAT_ART||{}).filter(a=>a.ready).length;
    document.getElementById('load-status').textContent=`移动图集 ${ready}/6 · 拳脚投图集 ${combatReady}/6`;
    const t=clock;STAGES[stage].draw(ctx,t,Number(document.getElementById('camera').value));
    ctx.fillStyle='#060c2266';ctx.fillRect(0,0,960,540);
    for(let i=0;i<CHARACTERS.length;i++){
      const c=CHARACTERS[i], x=80+i*160;
      const prog=(t*.6)%1;
      const walking=pose==='walk'||pose==='backwalk';
      const jumping=pose==='jumpforward'||pose==='jumpback';
      const direction=pose==='backwalk'||pose==='jumpback'?-1:1;
      const jumpFrame=Math.floor((t%1.4)*60), inAir=jumping&&jumpFrame<40;
      const jumpY=inAir?Math.max(0,12*jumpFrame-.31*jumpFrame*jumpFrame):0;
      const state=walking?'walk':inAir?'jump':jumping?'idle':pose;
      const motion={moving:walking,blend:walking?1:0,gait:t*5*direction,lean:walking?direction:0,
        air:inAir,jumpDirection:direction,jumpDuration:40,airFrames:jumpFrame,vy:-12+.62*jumpFrame,airDirection:direction,
        landing:jumping&&!inAir?Math.max(0,(49-jumpFrame)/9):0};
      const p=computePose(state,prog,t*5+i,inAir);
      ctx.fillStyle='#04071660';ctx.beginPath();ctx.ellipse(x,464,32,6,0,0,Math.PI*2);ctx.fill();
      ctx.save();ctx.translate(x,460-jumpY);ctx.scale(4.2,4.2);
      const track=walking?(direction<0?'backwalk':'walk'):jumping?(direction<0?'backjump':'jump'):state;
      motion.animation=Motion60.preview(c,track,Math.floor(prog*60));
      drawHumanoid(ctx,c.palette,p,c.deco,state,['idle','walk'].includes(state)?t*3:prog,motion);ctx.restore();
      U.textOutline(ctx,c.name,x,500,17,'#eed5a4','#0b1222');
      U.text(ctx,c.title,x,518,11,'#d0d6df','center','normal');
    }
    STAGES[stage].drawForeground(ctx,t,Number(document.getElementById('camera').value));
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
