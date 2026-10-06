// ============================================================
// stages.js — 七张宽幅像素背景地图与轻量环境动画。
// 绘制在逻辑分辨率 960x540。地面线 GROUND_Y 统一。
// ============================================================
(function () {
  const W = 960, H = 540;
  const GROUND_Y = 460; // 角色双脚所在 y

  const art = {};
  if (typeof Image !== 'undefined' && typeof document.createElement === 'function') {
    for (const id of ['dojo','city','beach','volcano','station','snow','garden']) {
      const img = new Image();
      art[id] = { ready:false, failed:false };
      img.onload = () => {
        // 完整的生成全景图；按统一比例绘制，不再拼贴或翻转边缘。
        const panorama=document.createElement('canvas');panorama.width=1440;panorama.height=540;
        const p=panorama.getContext('2d');p.imageSmoothingEnabled=false;
        // 等比例取景，使海滩与熔岩平台覆盖角色脚下的地面线。
        const framing={beach:1.025,volcano:1.14}[id]||1;
        const scale=Math.max(1440/img.width,540/img.height)*framing;
        const width=img.width*scale,height=img.height*scale;
        p.drawImage(img,(1440-width)/2,framing>1?0:(540-height)/2,width,height);
        // 菜单缩略图仍显示舞台中央的 16:9 视口。
        const layer=document.createElement('canvas');layer.width=640;layer.height=360;
        const c=layer.getContext('2d');c.imageSmoothingEnabled=false;
        c.drawImage(panorama,240,0,960,540,0,0,640,360);
        art[id]={ready:true,layer,panorama};
      };
      img.onerror=()=>{art[id].failed=true;};
      img.src='assets/stages/'+id+'-panorama-v3.png';
    }
  }

  function atmosphere(ctx,id,t,front=false) {
    ctx.save();
    const count=front?9:(id==='city'?65:24);
    for(let i=0;i<count;i++) {
      const seed=i*137.508, speed=front?1.4:1;
      if(id==='city'||id==='station') {
        const x=(seed*7-t*38*speed+9600)%960,y=(i*73+t*210*speed)%540;
        ctx.fillStyle=front?'#a0c9de70':'#879dc538';
        ctx.fillRect(Math.round(x),Math.round(y),1,front?10:6);
      } else if(id==='volcano') {
        const x=(seed*9+Math.sin(t+i)*20)%960,y=540-((i*37+t*(15+i%4)*speed)%540);
        ctx.fillStyle=i%3?'#ffad6390':'#ffe5b4b0';
        ctx.fillRect(Math.round(x),Math.round(y),front?3:2,front?3:2);
      } else if(id==='snow') {
        const x=(seed*11+t*12*speed+Math.sin(t*.6+i)*14)%960,y=(i*31+t*14*speed)%540;
        ctx.fillStyle=front?'#f4f7ff90':'#daeaff70';
        ctx.fillRect(Math.round(x),Math.round(y),front?3:2,front?3:2);
      } else if(id==='dojo'||id==='garden') {
        const x=(seed*11+t*22*speed)%960,y=(i*31+t*10*speed+Math.sin(t+i)*9)%510;
        ctx.fillStyle=i%3?'#e7a5c4a0':'#fff0d5b0';
        ctx.fillRect(Math.round(x),Math.round(y),front?4:2,2);
        if(front)ctx.fillRect(Math.round(x)+1,Math.round(y)-1,2,1);
      } else if(id==='beach'&&!front) {
        const x=180+(i*83)%640,y=308+(i*13)%68;
        ctx.globalAlpha=.15+.15*Math.sin(t*2+i);
        ctx.fillStyle='#ffe9b0';ctx.fillRect(x,y,5+i%9,1);
      }
    }
    ctx.restore();
  }

  // 纯背景动画：不生成实体、碰撞、声音或战斗随机数。
  function person(ctx,x,y,t,color,phase){
    const bob=Math.sin(t*1.4+phase)*.6;
    ctx.fillStyle='#11182b';ctx.fillRect(x-4,y-23+bob,8,8);
    ctx.fillStyle='#b18b79';ctx.fillRect(x-3,y-20+bob,6,5);
    ctx.fillStyle=color;ctx.fillRect(x-5,y-14+bob,10,12);
    ctx.fillStyle='#172133';ctx.fillRect(x-4,y-3,3,6);ctx.fillRect(x+1,y-3,3,6);
    ctx.fillStyle=color;ctx.fillRect(x+5,y-12+bob,3,Math.sin(t*2+phase)>0?5:9);
  }
  function bird(ctx,x,y,t,color){
    const flap=Math.sin(t*6)*3;ctx.strokeStyle=color;ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x-7,y-flap);ctx.lineTo(x,y);ctx.lineTo(x+7,y-flap);ctx.stroke();
  }
  function scenery(ctx,id,t,camera){
    ctx.save();ctx.translate(-Math.round(camera),0);ctx.globalAlpha=.68;
    if(id==='dojo'){
      person(ctx,735,371,t,'#667584',0);person(ctx,756,371,t,'#816c70',2);
      // 檐下灯笼微摆，烛光缓慢呼吸。
      for(const x of [117,835]){
        const swing=Math.sin(t*.9+x)*2;ctx.fillStyle='#362a31';ctx.fillRect(x+swing,244,1,12);
        ctx.fillStyle='#c28c57';ctx.fillRect(x-5+swing,256,11,16);
        ctx.fillStyle='#ffe2a2';ctx.globalAlpha=.38+.12*Math.sin(t*1.7+x);ctx.fillRect(x-2+swing,259,5,10);ctx.globalAlpha=.68;
      }
      // 小猫隔一段时间走过远处石阶，独立于战斗位置。
      const cycle=(t+9)%31;
      const visit=Math.sin(Math.floor((t+9)/31)*71.3+12.7)*437.1;
      if(cycle<8 && visit-Math.floor(visit)>.3){const x=555+cycle*18,y=391;
        ctx.fillStyle='#776e83';ctx.fillRect(x,y-6,15,6);ctx.fillRect(x+11,y-12,7,8);
        ctx.fillRect(x+11,y-15,2,4);ctx.fillRect(x+16,y-15,2,4);
        ctx.fillRect(x-5,y-9,7,2);const step=Math.floor(t*7)%2;
        ctx.fillRect(x+2,y,2,3+step);ctx.fillRect(x+11,y,2,4-step);
      }
    }else if(id==='city'){
      person(ctx,184,386,t,'#766089',0);person(ctx,207,386,t,'#557b83',2);person(ctx,229,386,t,'#856653',4);
      // 同一块招牌交替文字与移动光条，无高频闪烁。
      ctx.fillStyle='#121e36';ctx.fillRect(684,174,88,49);
      ctx.strokeStyle='#8971b7';ctx.lineWidth=2;ctx.strokeRect(684,174,88,49);
      ctx.fillStyle='#ef7ed6';ctx.font='bold 13px monospace';ctx.textAlign='center';ctx.fillText(Math.floor(t/5)%2?'夜市 OPEN':'NEON 24H',728,197);
      ctx.save();ctx.beginPath();ctx.rect(690,204,76,12);ctx.clip();
      ctx.fillStyle='#74d6dd';for(let i=0;i<5;i++)ctx.fillRect(688+((t*14+i*21)%100),207,10,3);ctx.restore();
      ctx.globalAlpha=.15+.08*Math.sin(t);ctx.fillStyle='#df70c6';ctx.fillRect(690,397,65,2);
    }else if(id==='beach'){
      for(let i=0;i<4;i++)bird(ctx,((i*237+t*(8+i))%1250)-120,135+i*19,t+i,'#d6c7b1');
      person(ctx,733,381,t,'#786c73',0);person(ctx,752,381,t,'#698187',3);
      for(let i=0;i<5;i++){ctx.globalAlpha=.12+.10*Math.sin(t*1.2+i);ctx.fillStyle='#ffe9c5';ctx.fillRect(210+i*107+Math.sin(t+i)*8,338+i*8,48,1);}
      const cycle=(t+17)%37;const visit=Math.sin(Math.floor((t+17)/37)*42.7+3)*237.9;if(cycle<7 && visit-Math.floor(visit)>.25){const x=350+cycle*12;ctx.globalAlpha=.6;ctx.fillStyle='#c59478';ctx.fillRect(x,406,8,4);ctx.fillRect(x-3,403,3,3);ctx.fillRect(x+8,403,3,3);}
    }else{
      for(let i=0;i<7;i++){
        const phase=(t*.12+i*.19)%1;ctx.globalAlpha=(1-phase)*.12;ctx.fillStyle='#9b7781';
        ctx.fillRect(118+i*125+Math.sin(t*.4+i)*10,350-phase*140,14+phase*22,8+phase*12);
      }
      ctx.globalAlpha=.15+.06*Math.sin(t*.8);ctx.fillStyle='#ff862f';ctx.fillRect(106,395,130,2);ctx.fillRect(696,383,150,2);
      bird(ctx,((t*12)%1380)-180,170+Math.sin(t*.6)*12,t,'#382a38');
    }
    ctx.restore();
  }

  function drawArt(ctx,id,t,camera=0) {
    if(!art[id]?.ready) return false;
    ctx.save();ctx.imageSmoothingEnabled=false;
    // 原图包含完整建筑和地面，必须作为刚性平面整体移动，不能逐行错切。
    camera=Math.max(-240,Math.min(240,Number.isFinite(camera)?camera:0));
    const sourceX=Math.round(240+camera);
    ctx.drawImage(art[id].panorama,sourceX,0,960,540,0,0,960,540);
    scenery(ctx,id,t,camera);
    // 顶部暗部留给 HUD，舞台中部保留角色剪影的对比。
    const shade=ctx.createLinearGradient(0,0,0,540);
    shade.addColorStop(0,'#060b2590');shade.addColorStop(.25,'#080c2010');
    shade.addColorStop(.7,'#05091925');shade.addColorStop(1,'#05081840');
    ctx.fillStyle=shade;ctx.fillRect(0,0,960,540);
    atmosphere(ctx,id,t);
    ctx.restore();return true;
  }

  function sky(ctx, c1, c2) {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND_Y);
  }
  function ground(ctx, top, bottom) {
    ctx.fillStyle = top; ctx.fillRect(0, GROUND_Y, W, 6);
    ctx.fillStyle = bottom; ctx.fillRect(0, GROUND_Y + 6, W, H - GROUND_Y);
  }

  const STAGES = [
    {
      id: 'dojo', name: '古武道场',
      draw(ctx, t, camera=0) {
        if (drawArt(ctx, 'dojo', t, camera)) return;
        sky(ctx, '#3a2a4a', '#6a4a5a');
        // 远山
        ctx.fillStyle = '#4a3a5a';
        ctx.beginPath(); ctx.moveTo(0,300);
        for (let x=0;x<=W;x+=60) ctx.lineTo(x, 300 - Math.sin(x*0.01)*40 - (x%120?0:20));
        ctx.lineTo(W,GROUND_Y); ctx.lineTo(0,GROUND_Y); ctx.fill();
        // 道场墙
        ctx.fillStyle = '#e8dcc0'; ctx.fillRect(80, 180, 800, 280);
        ctx.fillStyle = '#c8a878'; ctx.fillRect(80, 180, 800, 14);
        // 木梁
        ctx.fillStyle = '#7a5230';
        for (let x=80;x<=880;x+=100) ctx.fillRect(x-4, 180, 8, 280);
        ctx.fillRect(80,180,800,10); ctx.fillRect(80,300,800,8);
        // 门/挂轴
        ctx.fillStyle = '#b03030'; ctx.fillRect(420, 210, 120, 130);
        ctx.fillStyle = '#e8dcc0'; ctx.fillRect(432, 224, 96, 100);
        ctx.fillStyle = '#7a2020'; U.text(ctx,'武',452,300,54,'#7a2020','left');
        ground(ctx, '#8a6a40', '#5a4028');
        // 地板木纹
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        for (let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,GROUND_Y+6);ctx.lineTo(x,H);ctx.stroke();}
      }
    },
    {
      id: 'city', name: '霓虹夜街',
      draw(ctx, t, camera=0) {
        if (drawArt(ctx, 'city', t, camera)) return;
        sky(ctx, '#0a0a2a', '#2a1a4a');
        // 楼群剪影 + 窗户灯
        for (let i=0;i<10;i++){
          const bx=i*100-10, bw=80, bh=120+((i*53)%160);
          ctx.fillStyle = '#14142e'; ctx.fillRect(bx, GROUND_Y-bh, bw, bh);
          for (let wy=GROUND_Y-bh+10; wy<GROUND_Y-10; wy+=18)
            for (let wx=bx+8; wx<bx+bw-8; wx+=16){
              const on = ((wx*7+wy*13+i*29)%5)===0;
              ctx.fillStyle = on ? (((wx+wy)%2)?'#ffd060':'#60d0ff') : '#20203a';
              ctx.fillRect(wx, wy, 8, 10);
            }
        }
        // 霓虹招牌
        const glow = 0.6+0.4*Math.sin(t*4);
        ctx.globalAlpha = glow; ctx.fillStyle = '#ff2a6a';
        ctx.fillRect(140, 250, 90, 40); ctx.globalAlpha=1;
        ctx.fillStyle='#fff'; U.text(ctx,'拳',158,282,34,'#fff','left');
        ctx.globalAlpha=glow; ctx.fillStyle='#2affd0'; ctx.fillRect(720,220,80,50);ctx.globalAlpha=1;
        ground(ctx, '#3a3a4a', '#1a1a26');
        // 路面反光
        ctx.fillStyle='rgba(120,120,220,0.08)';
        for(let x=0;x<W;x+=40) ctx.fillRect(x,GROUND_Y+8,20,H);
      }
    },
    {
      id: 'beach', name: '落日海滩',
      draw(ctx, t, camera=0) {
        if (drawArt(ctx, 'beach', t, camera)) return;
        sky(ctx, '#ff9a3a', '#ffd88a');
        // 太阳
        ctx.fillStyle='#fff2c0'; ctx.beginPath(); ctx.arc(480,240,70,0,7); ctx.fill();
        ctx.fillStyle='rgba(255,120,40,0.25)'; ctx.beginPath(); ctx.arc(480,240,110,0,7); ctx.fill();
        // 海面
        ctx.fillStyle='#2a6a9a'; ctx.fillRect(0,320,W,GROUND_Y-320);
        ctx.fillStyle='rgba(255,240,180,0.5)';
        for(let y=330;y<GROUND_Y;y+=10){const w=Math.sin(y*0.2+t*3)*20; ctx.fillRect(400+w,y,160,3);}
        // 棕榈
        ctx.strokeStyle='#5a3a1a'; ctx.lineWidth=8;
        ctx.beginPath(); ctx.moveTo(120,GROUND_Y); ctx.quadraticCurveTo(100,300,140,270); ctx.stroke();
        ctx.fillStyle='#2a8a3a';
        for(let a=0;a<6;a++){const ang=-0.5-a*0.4; ctx.save(); ctx.translate(140,270); ctx.rotate(ang);
          ctx.beginPath(); ctx.ellipse(30,0,34,9,0,0,7); ctx.fill(); ctx.restore();}
        ground(ctx, '#e8d08a', '#c8a860');
        // 沙纹
        ctx.strokeStyle='rgba(160,120,60,0.4)';
        for(let x=0;x<W;x+=30){ctx.beginPath();ctx.arc(x,GROUND_Y+30,14,3.4,6.0);ctx.stroke();}
      }
    },
    {
      id: 'volcano', name: '熔岩神殿',
      draw(ctx, t, camera=0) {
        if (drawArt(ctx, 'volcano', t, camera)) return;
        sky(ctx, '#2a0a0a', '#6a1a0a');
        // 熔岩流动的裂纹背景
        ctx.fillStyle='#3a1010';
        ctx.beginPath(); ctx.moveTo(0,200);
        for(let x=0;x<=W;x+=40) ctx.lineTo(x,200+Math.sin(x*0.02)*30);
        ctx.lineTo(W,GROUND_Y);ctx.lineTo(0,GROUND_Y);ctx.fill();
        // 神殿柱
        for(let i=0;i<4;i++){const x=120+i*230;
          ctx.fillStyle='#4a3a3a'; ctx.fillRect(x,160,50,300);
          ctx.fillStyle='#5a4a4a'; ctx.fillRect(x-6,150,62,16);
          ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x+20,160,6,300);
        }
        // 熔岩发光缝
        const g=0.5+0.5*Math.sin(t*3);
        ctx.fillStyle=`rgba(255,${100+g*80|0},0,${0.6})`;
        for(let x=0;x<W;x+=8) ctx.fillRect(x, 300+Math.sin(x*0.1+t*2)*6, 4, 3);
        ground(ctx, '#5a2a1a', '#2a1008');
        // 地面熔岩缝
        ctx.fillStyle=`rgba(255,${120+g*100|0},20,0.9)`;
        ctx.fillRect(0,GROUND_Y+2,W,3);
        for(let x=0;x<W;x+=60) ctx.fillRect(x, GROUND_Y+10, 30, 2);
      }
    },
  ];

  for(const [id,name,top,bottom] of [
    ['station','雨夜车站','#111b38','#4d536d'],
    ['snow','雪山神社','#263d67','#b2c4df'],
    ['garden','空中庭院','#e6b68c','#85b5b7']
  ]) STAGES.push({id,name,draw(ctx,t,camera=0){
    if(drawArt(ctx,id,t,camera))return;
    sky(ctx,top,bottom);ground(ctx,bottom,top);
  }});

  for(const stage of STAGES) {
    stage.worldWidth=1440;stage.cameraMin=-240;stage.cameraMax=240;
    stage.drawForeground=(ctx,t,camera=0)=>{
      ctx.save();ctx.translate(-camera*.16,0);atmosphere(ctx,stage.id,t,true);ctx.restore();
    };
  }
  window.STAGE_ART = art;
  window.STAGES = STAGES;
  window.GROUND_Y = GROUND_Y;
  window.STAGE_W = W;
  window.STAGE_H = H;
})();
