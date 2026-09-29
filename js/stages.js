// ============================================================
// stages.js — 4张代码绘制的像素背景地图。每张含天空渐变、远景、地面。
// 绘制在逻辑分辨率 960x540。地面线 GROUND_Y 统一。
// ============================================================
(function () {
  const W = 960, H = 540;
  const GROUND_Y = 460; // 角色双脚所在 y

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
      draw(ctx, t) {
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
      draw(ctx, t) {
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
      draw(ctx, t) {
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
      draw(ctx, t) {
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

  window.STAGES = STAGES;
  window.GROUND_Y = GROUND_Y;
  window.STAGE_W = W;
  window.STAGE_H = H;
})();
