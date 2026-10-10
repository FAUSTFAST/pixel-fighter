// ============================================================
// characters.js — 6名角色:配色、属性、招式数据 + 像素人形骨架渲染器
// 坐标系:角色朝右,原点在双脚中点,y 向上为负。整体高约 48 单位。
// 绘制时由 fighter 决定 scale 与朝向翻转。
// ============================================================
(function () {

  // ---------- 通用像素人形渲染 ----------
  // pose 是一组关节的局部坐标(朝右)。我们用"粗线段"画四肢,方块画头/身。
  function seg(ctx, ax, ay, bx, by, thick, color) {
    // 沿 a->b 画一条有厚度的像素段
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    const steps = Math.max(1, Math.round(len));
    const nx = -dy / len, ny = dx / len; // 法线
    ctx.fillStyle = color;
    const h = thick / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = ax + dx * t, y = ay + dy * t;
      ctx.fillRect(Math.round(x - h), Math.round(y - h), thick, thick);
    }
  }

  // 计算 idle/walk/attack 等姿态。返回关节点坐标。
  // 参数 f: 该动作内的插值相位辅助由各 pose 生成。
  // 关键关节:hip, neck, headC, shoulder, elbowF/handF(前臂-前手), elbowB/handB, kneeF/footF, kneeB/footB
  function basePose() {
    return {
      hipX: 0, hipY: -20,
      neckX: 0, neckY: -37,
      headX: 0, headY: -44,
      lean: 0,          // 上身前倾(向右为正)
      // 手:相对 shoulder 的位置
      handF: { x: 6, y: -26 }, elbowF: { x: 4, y: -30 },
      handB: { x: -5, y: -26 }, elbowB: { x: -4, y: -30 },
      footF: { x: 6, y: 0 }, kneeF: { x: 5, y: -10 },
      footB: { x: -6, y: 0 }, kneeB: { x: -5, y: -10 },
      crouch: 0,        // 下蹲量,抬高双脚使身体下沉
      headTiltDmg: 0,
    };
  }

  // 姿态库:根据 state + 帧进度返回 pose。t 为 0..1 该动作进度,walkPhase 用于走路循环。
  function computePose(state, prog, walkPhase, airborne) {
    const p = basePose();
    switch (state) {
      case 'idle': {
        const b = Math.sin(walkPhase * 2) * 1.2;      // 呼吸
        p.neckY += b * 0.4; p.headY += b * 0.4;
        p.handF = { x: 7, y: -25 + b }; p.elbowF = { x: 5, y: -30 };
        p.handB = { x: -6, y: -25 - b }; p.elbowB = { x: -5, y: -30 };
        p.footF = { x: 7, y: 0 }; p.footB = { x: -7, y: 0 };
        break;
      }
      case 'walk': {
        const s = Math.sin(walkPhase);
        p.footF = { x: 6 + s * 7, y: -Math.max(0, s) * 4 };
        p.footB = { x: -6 - s * 7, y: -Math.max(0, -s) * 4 };
        p.kneeF = { x: 4 + s * 4, y: -10 };
        p.kneeB = { x: -4 - s * 4, y: -10 };
        p.handF = { x: 6 - s * 5, y: -26 }; p.handB = { x: -6 + s * 5, y: -26 };
        p.lean = 2;
        break;
      }
      case 'crouch': {
        p.crouch = 10;
        p.hipY = -12; p.neckY = -26; p.headY = -33;
        p.footF = { x: 9, y: 0 }; p.footB = { x: -9, y: 0 };
        p.kneeF = { x: 8, y: -6 }; p.kneeB = { x: -8, y: -6 };
        p.handF = { x: 8, y: -18 }; p.handB = { x: -6, y: -18 };
        break;
      }
      case 'jump': {
        p.footF = { x: 5, y: -6 }; p.footB = { x: -6, y: -3 };
        p.kneeF = { x: 6, y: -12 }; p.kneeB = { x: -5, y: -11 };
        p.handF = { x: 8, y: -32 }; p.handB = { x: -8, y: -32 };
        p.lean = 3;
        break;
      }
      case 'block': {
        p.lean = -3;
        p.handF = { x: 4, y: -30 }; p.elbowF = { x: 2, y: -28 };
        p.handB = { x: 2, y: -24 }; p.elbowB = { x: 0, y: -28 };
        p.footF = { x: 4, y: 0 }; p.footB = { x: -9, y: 0 };
        break;
      }
      case 'light': {
        // 直拳:前手快速伸出,prog 0..1
        const ext = Math.sin(Math.min(1, prog) * Math.PI); // 出拳-收回
        p.lean = 3 + ext * 3;
        p.handF = { x: 8 + ext * 20, y: -28 }; p.elbowF = { x: 6 + ext * 10, y: -29 };
        p.handB = { x: -7, y: -24 };
        p.footF = { x: 8, y: 0 }; p.footB = { x: -8, y: 0 };
        break;
      }
      case 'heavy': {
        // 摆拳/勾拳:后手大幅挥出
        const ext = Math.sin(Math.min(1, prog) * Math.PI);
        p.lean = 4 + ext * 5;
        p.handB = { x: -6 + ext * 30, y: -30 + ext * 4 }; p.elbowB = { x: -4 + ext * 14, y: -31 };
        p.handF = { x: 6, y: -22 };
        p.footF = { x: 10, y: 0 }; p.footB = { x: -7, y: 0 };
        p.hipX = ext * 3;
        break;
      }
      case 'special': {
        // 蓄力后冲拳/发波:先后仰蓄力再前冲
        const wind = prog < 0.4 ? prog / 0.4 : 1;
        const push = prog >= 0.4 ? (prog - 0.4) / 0.6 : 0;
        const ext = Math.sin(Math.min(1, push) * Math.PI);
        p.lean = -wind * 6 + ext * 12;
        p.handF = { x: 4 - wind * 8 + ext * 26, y: -26 };
        p.elbowF = { x: 2 + ext * 12, y: -28 };
        p.handB = { x: -8 + wind * 4 + ext * 20, y: -26 };
        p.elbowB = { x: -6, y: -29 };
        p.footF = { x: 8 + ext * 4, y: 0 }; p.footB = { x: -10 - wind * 2, y: 0 };
        break;
      }
      case 'uppercut': {
        const rise = Math.min(1, prog * 5);
        p.lean = 3;
        p.handF = { x: 22, y: -30 - rise * 18 };
        p.elbowF = { x: 12, y: -34 - rise * 5 };
        p.handB = { x: -5, y: -29 };
        p.kneeF = { x: 10, y: -17 }; p.footF = { x: 9, y: -9 };
        p.kneeB = { x: -5, y: -10 }; p.footB = { x: -9, y: -2 };
        break;
      }
      case 'rush': {
        p.lean = 10; p.hipX = 3;
        p.handF = { x: 29, y: -28 }; p.elbowF = { x: 18, y: -30 };
        p.handB = { x: -8, y: -23 };
        p.footF = { x: 13, y: 0 }; p.footB = { x: -15, y: -3 };
        break;
      }
      case 'hit': {
        p.lean = -6;
        p.headTiltDmg = -3;
        p.handF = { x: 4, y: -22 }; p.handB = { x: -9, y: -24 };
        p.footF = { x: 4, y: 0 }; p.footB = { x: -10, y: 0 };
        p.hipX = -2;
        break;
      }
      case 'ko': {
        // 倒地:整体躺平(由 fighter 额外旋转),这里给一个瘫软姿态
        p.lean = -10;
        p.hipY = -8; p.neckY = -16; p.headY = -22;
        p.handF = { x: 10, y: -10 }; p.handB = { x: -10, y: -10 };
        p.footF = { x: 12, y: -2 }; p.footB = { x: -12, y: -2 };
        break;
      }
    }
    return p;
  }

  // 每名斗士 4×4 姿势图集。按透明边界校正脚底和列内分隔，避免切帧跳动。
  const characterArt = {};
  window.CHARACTER_ART = characterArt;
  const movementArt = {};
  window.MOVEMENT_ART = movementArt;
  const combatArt={};window.COMBAT_ART=combatArt;
  if (typeof Image !== 'undefined' && typeof document.createElement === 'function') {
    for(const id of ['ryu','mei','tank','volt','kaze','sage']) {
      const image=new Image();characterArt[id]={ready:false,failed:false};
      image.onload=()=>{
        try { characterArt[id]={ready:true,frames:prepareAtlas(image)}; }
        catch (_error) { characterArt[id].failed=true; }
      };
      image.onerror=()=>{characterArt[id].failed=true;};
      image.src='assets/characters/'+id+'-v2.png';
      const movement=new Image();movementArt[id]={ready:false,failed:false};
      movement.onload=()=>{
        try {movementArt[id]={ready:true,frames:prepareAtlas(movement,8)};}
        catch(error){movementArt[id].failed=true;console.warn('Movement atlas unavailable:',id,error);}
      };
      movement.onerror=()=>{movementArt[id].failed=true;};
      movement.src='assets/characters/'+id+'-movement-v3.png';
      const combat=new Image();combatArt[id]={ready:false,failed:false};
      combat.onload=()=>{try{combatArt[id]={ready:true,frames:prepareAtlas(combat)};}catch(error){combatArt[id].failed=true;console.warn('Combat atlas unavailable:',id,error);}};
      combat.onerror=()=>{combatArt[id].failed=true;};
      combat.src='assets/characters/'+id+'-combat-v4.png';
    }
  }
  function prepareAtlas(image, columns=4) {
    const sheet=document.createElement('canvas');sheet.width=image.width;sheet.height=image.height;
    const context=sheet.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
    const cw=image.width/columns,ch=image.height/4;
    let pixels=null;
    try {pixels=context.getImageData(0,0,sheet.width,sheet.height).data;} catch (_error) { /* file:// 仍可按固定网格绘制。 */ }
    const occupied=(x,y)=>!pixels||pixels[(y*sheet.width+x)*4+3]>48;
    const boxes=[];
    for(let col=0;col<columns;col++) {
      const left=Math.round(col*cw),right=Math.round((col+1)*cw);
      const cuts=[0];
      for(let row=1;row<4;row++) {
        let best=Math.round(row*ch),bestScore=Infinity;
        if(pixels) {
          for(let y=Math.round(row*ch-ch*.22);y<=Math.round(row*ch+ch*(columns===8?.32:.12));y++) {
            let count=0;
            for(let x=left;x<right;x++)if(occupied(x,y))count++;
            const score=count*1000+Math.abs(y-row*ch);
            if(score<bestScore){bestScore=score;best=y;}
          }
        }
        cuts.push(best);
      }
      cuts.push(image.height);
      for(let row=0;row<4;row++) {
        let minX=right,maxX=left,minY=cuts[row+1],maxY=cuts[row];
        if(pixels) {
          for(let y=cuts[row];y<cuts[row+1];y++)for(let x=left;x<right;x++) {
            if(occupied(x,y)){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
          }
        } else {minX=left;maxX=right-1;minY=cuts[row];maxY=cuts[row+1]-1;}
        boxes[row*columns+col]={x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,footX:left+cw/2,footY:pixels?maxY:cuts[row]+ch*.86};
      }
    }
    // 100 像素的待机身高，经游戏的 4.2 倍变换后保持约 210 屏幕像素。
    const referenceHeights=boxes.slice(0,columns===8?8:2).map(b=>b.h).sort((a,b)=>a-b);
    const ratio=100/(pixels?referenceHeights[Math.floor(referenceHeights.length/2)]:ch*.63);
    if (columns===8 && pixels) {
      // 空中收腿不能按最低脚尖重新锚定，否则膝盖收起时身体会突然下沉。
      for(let row=2;row<4;row++) {
        const baseline=Math.max(...[0,6,7].map(col=>boxes[row*columns+col].footY));
        for(let col=0;col<columns;col++) boxes[row*columns+col].footY=baseline;
      }
    }
    return boxes.map(b=>{
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(b.w*ratio));canvas.height=Math.max(1,Math.ceil(b.h*ratio));
      const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(image,b.x,b.y,b.w,b.h,0,0,canvas.width,canvas.height);
      const flash=document.createElement('canvas');flash.width=canvas.width;flash.height=canvas.height;
      const f=flash.getContext('2d');f.drawImage(canvas,0,0);f.globalCompositeOperation='source-atop';f.fillStyle='rgba(255,246,220,0.24)';f.fillRect(0,0,flash.width,flash.height);
      return {canvas,flash,x:(b.footX-b.x)*ratio,y:(b.footY-b.y)*ratio};
    });
  }
  function atlasFrame(id,state,progress) {
    if(state==='idle')return Math.floor(progress*.6)%2;
    if(state==='walk')return 2+Math.floor(progress*.9)%2;
    if(state==='crouch')return 4;
    if(state==='jump')return 5;
    if(state==='block')return 6;
    if(state==='hit'||state==='ko')return 7;
    if(state==='uppercut')return 14;
    if(state==='rush')return 15;
    const def=CHARACTERS.find(c=>c.id===id),m=def?.moves[state];
    const extended=m&&progress>=m.startup/(m.startup+m.active+m.recovery)&&progress<.78;
    return (state==='light'?8:state==='heavy'?10:12)+(extended?1:0);
  }

  // 二倍内部像素网格：扫描线多边形保证边缘清晰，角色帧缓存避免逐帧重复绘制。
  const spriteCache = new Map();
  function pixelPoly(ctx, pts, color) {
    const v = pts.map(([x,y]) => [Math.round(x*2), Math.round(y*2)]);
    const lo = Math.min(...v.map(p=>p[1])), hi = Math.max(...v.map(p=>p[1]));
    ctx.fillStyle = color;
    for (let y=lo; y<hi; y++) {
      const hits=[];
      for (let i=0,j=v.length-1;i<v.length;j=i++) {
        const a=v[j], b=v[i], scan=y+0.5;
        if ((a[1]<=scan && b[1]>scan)||(b[1]<=scan && a[1]>scan)) hits.push(a[0]+(scan-a[1])*(b[0]-a[0])/(b[1]-a[1]));
      }
      hits.sort((a,b)=>a-b);
      for(let i=0;i+1<hits.length;i+=2) {
        const x=Math.ceil(hits[i]), end=Math.ceil(hits[i+1]);
        ctx.fillRect(x/2,y/2,(end-x)/2,0.5);
      }
    }
  }
  function dot(ctx,x,y,w,h,c) {ctx.fillStyle=c;ctx.fillRect(Math.round(x*2)/2,Math.round(y*2)/2,w,h);}
  function ribbon(ctx,a,b,w,c) {
    const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
    const nx=-dy/len*w/2, ny=dx/len*w/2;
    pixelPoly(ctx,[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]],c);
  }
  function shadedLimb(ctx,a,b,w,base,shade,light) {
    ribbon(ctx,a,b,w+1.6,'#101321');
    ribbon(ctx,a,b,w,shade);
    ribbon(ctx,[a[0]-.6,a[1]-.3],[b[0]-.6,b[1]-.3],w*.68,base);
    ribbon(ctx,[a[0]-w*.25,a[1]-.5],[b[0]-w*.25,b[1]-.5],.8,light);
  }

  function drawDetailedFighter(ctx,P,p,id,state,phase) {
    const ink='#101321', cloth=P.cloth, shadow=P.clothSh, light=P.cloth2;
    const skin=P.skin, skinSh=P.skinSh, skinHi=U.shade(skin,24);
    const steel='#bad4e0', steelHi='#f0f4e8';
    const tank=id==='tank', mage=id==='sage', sword=id==='kaze', mei=id==='mei', volt=id==='volt';
    const tx=p.neckX+p.lean, sy=p.neckY+3, hx=p.headX+p.lean+(p.headTiltDmg||0), hy=p.headY;
    const swing=Math.round(Math.sin(phase*2)*3)/2;
    const rearPants=tank?'#302c3f':(volt?'#263444':shadow);
    const pants=mei?'#342b48':(volt?'#35455b':cloth);
    const pantsHi=mei?'#686079':(volt?'#617184':light);

    // 后摆、围巾与武器从身体后方露出。
    if (sword || mage || mei) {
      pixelPoly(ctx,[[tx-6,sy+3],[tx+3,sy+4],[p.hipX+6,p.hipY+4],[p.hipX+3+swing,-4],[p.hipX-9+swing,-7],[p.hipX-7,p.hipY-2]],ink);
      pixelPoly(ctx,[[tx-5,sy+4],[tx+2,sy+5],[p.hipX+4,p.hipY+4],[p.hipX+2+swing,-6],[p.hipX-7+swing,-8],[p.hipX-6,p.hipY-2]],shadow);
      ribbon(ctx,[p.hipX-6,p.hipY+1],[p.hipX-7+swing,-9],1,P.trim);
    }
    if(id==='ryu'||volt) {
      const c=volt?'#56d8ed':'#ce5773';
      pixelPoly(ctx,[[tx-2,sy-1],[tx-10,sy+1],[tx-18,sy-2+swing],[tx-25,sy+3+swing],[tx-21,sy+5+swing],[tx-13,sy+2],[tx-5,sy+5]],ink);
      pixelPoly(ctx,[[tx-3,sy],[tx-10,sy+2],[tx-18,sy-1+swing],[tx-24,sy+3+swing],[tx-20,sy+3+swing],[tx-12,sy+3],[tx-5,sy+4]],c);
      ribbon(ctx,[tx-8,sy+2],[tx-17,sy+swing],1,U.shade(c,35));
    }
    if(sword) {
      shadedLimb(ctx,[-10,-37],[-18,-10],2.6,'#353a55','#1c2036','#7c859f');
      ribbon(ctx,[-11,-38],[-8,-43],2.2,'#c2ba91');
      ribbon(ctx,[-13,-36],[-7,-35],1.4,steel);
    }
    if(mei) {
      pixelPoly(ctx,[[hx-2,hy-4],[hx-6,hy-6],[hx-10,hy-3],[hx-11+swing,hy+9],[hx-15+swing,hy+13],[hx-8+swing,hy+10],[hx-6,hy+1]],ink);
      pixelPoly(ctx,[[hx-4,hy-4],[hx-7,hy-3],[hx-8+swing,hy+8],[hx-12+swing,hy+11],[hx-6+swing,hy+8],[hx-5,hy]],'#4d384f');
    }

    function leg(front) {
      const k=front?p.kneeF:p.kneeB, f=front?p.footF:p.footB;
      const h=[p.hipX+(front?2:-2),p.hipY];
      const c=front?pants:rearPants, sh=front?shadow:U.shade(shadow,-16);
      shadedLimb(ctx,h,[k.x,k.y],tank?6:5,c,sh,front?pantsHi:c);
      shadedLimb(ctx,[k.x,k.y],[f.x,f.y-2],4.1,c,sh,front?pantsHi:c);
      ribbon(ctx,[k.x-1,k.y-2],[k.x+2,k.y-1],.7,U.shade(c,28));
      const boot=P.shoe||'#242637';
      pixelPoly(ctx,[[f.x-3.3,f.y-7],[f.x+1.8,f.y-7],[f.x+2.4,f.y-2],[f.x+5,f.y-.8],[f.x+5,f.y+1],[f.x-4,f.y+1]],ink);
      pixelPoly(ctx,[[f.x-2.5,f.y-6.4],[f.x+1,f.y-6.4],[f.x+1.5,f.y-1.3],[f.x+4,f.y-.3],[f.x+4,f.y],[f.x-3,f.y]],boot);
      dot(ctx,f.x-2.7,f.y-.1,7,.7,steel);
      ribbon(ctx,[f.x-2,f.y-5],[f.x+.6,f.y-4.5],.7,P.trim);
      ribbon(ctx,[f.x-2,f.y-3.4],[f.x+.8,f.y-3],.5,steel);
    }
    leg(false);

    function arm(front) {
      const e=front?p.elbowF:p.elbowB,h=front?p.handF:p.handB;
      const shoulder=[tx+(front?3:-4),sy+2];
      const sleeve=!tank&&!mei, base=sleeve?cloth:skin, sh=sleeve?shadow:skinSh;
      shadedLimb(ctx,shoulder,[e.x,e.y],tank?5.2:4.2,front?base:U.shade(base,-14),sh,sleeve?light:skinHi);
      shadedLimb(ctx,[e.x,e.y],[h.x,h.y],tank?4.2:3.3,skin,skinSh,skinHi);
      if(!tank) {
        const cuff=[e.x+(h.x-e.x)*.62,e.y+(h.y-e.y)*.62];
        shadedLimb(ctx,cuff,[h.x,h.y],4,mei?steel:shadow,ink,mei?steelHi:light);
        ribbon(ctx,[cuff[0]-1,cuff[1]],[cuff[0]+1,cuff[1]+1],.7,steelHi);
      }
      const glove=tank?P.trim:(mage?skin:'#253447');
      const w=tank?3.6:2.4;
      pixelPoly(ctx,[[h.x-w,h.y-2.8],[h.x+1,h.y-3.6],[h.x+w+1,h.y-1.2],[h.x+w+1,h.y+2],[h.x-w,h.y+2.8]],ink);
      pixelPoly(ctx,[[h.x-w+.7,h.y-2],[h.x+1,h.y-2.8],[h.x+w,h.y-.6],[h.x+w,h.y+1.4],[h.x-w+.7,h.y+2]],glove);
      dot(ctx,h.x-.5,h.y-2.1,w,.8,tank?U.shade(P.trim,55):skinHi);
      if(!tank) dot(ctx,h.x+w-.5,h.y-.7,1,1.8,skin);
    }
    arm(false);
    leg(true);

    // 肩、腰与胸部分色，至少四阶阴影。
    const tw=tank?8:6;
    pixelPoly(ctx,[[tx-tw-1,sy-1],[tx+tw,sy-1],[tx+tw+1,sy+5],[p.hipX+5,p.hipY+2],[p.hipX-6,p.hipY+2],[tx-tw-1,sy+6]],ink);
    pixelPoly(ctx,[[tx-tw,sy],[tx+tw-.7,sy],[tx+tw,sy+5],[p.hipX+4,p.hipY+1],[p.hipX-5,p.hipY+1],[tx-tw,sy+5]],tank?skinSh:shadow);
    pixelPoly(ctx,[[tx-tw+.7,sy+.5],[tx+2,sy],[tx+4,sy+6],[p.hipX+1,p.hipY],[p.hipX-4,p.hipY],[tx-tw+.7,sy+5]],tank?skin:cloth);
    pixelPoly(ctx,[[tx-tw+1,sy+1],[tx-2,sy+.5],[tx,sy+4],[tx-4,sy+6],[tx-5,sy+10]],tank?skinHi:light);
    if(tank) {
      ribbon(ctx,[tx-5,sy+6],[tx,sy+7],.7,skinSh);
      ribbon(ctx,[tx+1,sy+6],[tx+5,sy+5],.7,skinSh);
      for(let i=0;i<3;i++)dot(ctx,p.hipX-1,p.hipY-3-i*2,2,.5,skinSh);
      ribbon(ctx,[tx+3,sy+2],[tx+6,sy+6],.7,'#8c4949');
    } else {
      ribbon(ctx,[tx+2,sy+1],[p.hipX-1,p.hipY-1],1.3,P.trim);
      ribbon(ctx,[tx+3.5,sy+3],[p.hipX+1,p.hipY-1],.5,steelHi);
      ribbon(ctx,[p.hipX-4,p.hipY-3],[p.hipX+1,p.hipY-4],.6,light);
      ribbon(ctx,[tx-4,sy+9],[tx-1,sy+10],.7,shadow);
      if(volt) {
        dot(ctx,tx-5,sy+5,2,3,shadow); dot(ctx,tx-4.5,sy+5,1,.5,P.trim);
      }
      if(id==='ryu') {
        ribbon(ctx,[tx-6,sy+2],[p.hipX+4,p.hipY-3],2.1,'#283041');
        ribbon(ctx,[tx-6,sy+1],[p.hipX+4,p.hipY-4],.6,steel);
      }
    }
    dot(ctx,p.hipX-6,p.hipY-1,12,3,ink);
    dot(ctx,p.hipX-5.5,p.hipY-.5,11,1.5,tank?'#bd813e':P.trim);
    dot(ctx,p.hipX+1,p.hipY-1,3,3,tank?'#f5d58b':steel);
    dot(ctx,p.hipX+1.5,p.hipY-.5,2,2,tank?'#a96732':shadow);
    if(!tank) {
      pixelPoly(ctx,[[p.hipX+3,p.hipY+1],[p.hipX+5,p.hipY+1],[p.hipX+7+swing,p.hipY+9],[p.hipX+4+swing,p.hipY+8]],P.trim);
    }

    // 侧脸、鼻梁和下颌不再用一个方块表示。
    dot(ctx,tx-2,hy+3,4,sy-hy-1,ink); dot(ctx,tx-1.5,hy+3,3,sy-hy-1.5,skinSh);
    pixelPoly(ctx,[[hx-4.5,hy-4],[hx+2,hy-5],[hx+4,hy-2],[hx+4.5,hy],[hx+5.5,hy+1],[hx+4,hy+2],[hx+3.5,hy+4],[hx-.5,hy+4.5],[hx-4,hy+2]],ink);
    pixelPoly(ctx,[[hx-3.5,hy-3.5],[hx+1.5,hy-4],[hx+3.2,hy-1.5],[hx+3.8,hy+.5],[hx+4.5,hy+1],[hx+3,hy+1.8],[hx+2.8,hy+3.3],[hx,hy+3.5],[hx-3,hy+1.5]],skin);
    pixelPoly(ctx,[[hx-3.5,hy-3],[hx-1.5,hy-2],[hx-1,hy+2],[hx+1,hy+3.5],[hx-1,hy+3.5],[hx-3,hy+1.5]],skinSh);
    dot(ctx,hx+1,hy,2.2,1,steelHi);dot(ctx,hx+2.4,hy,.7,1.1,P.eye);dot(ctx,hx+.5,hy-.8,3,.7,ink);
    dot(ctx,hx+2.5,hy+2.7,1.4,.5,skinSh);dot(ctx,hx+3.4,hy+.8,1,.7,skinHi);
    dot(ctx,hx-2.8,hy+.2,1.3,1.8,skinHi);

    if(tank) {
      pixelPoly(ctx,[[hx-4.5,hy-2],[hx-3.5,hy-5],[hx,hy-6],[hx+3,hy-4.5],[hx+3.5,hy-3],[hx-.5,hy-4],[hx-3.5,hy-1]],'#533c43');
      ribbon(ctx,[hx-2.5,hy-4.3],[hx+.5,hy-4.8],.7,'#9d715d');
      dot(ctx,hx+.2,hy+3,2.5,.8,'#624747');
    } else {
      const hair=mage?'#d9dfe3':P.hair;
      pixelPoly(ctx,[[hx-5,hy+1],[hx-6.5,hy-3],[hx-4.5,hy-4],[hx-5.5,hy-7],[hx-2,hy-6],[hx-1,hy-9],[hx+1,hy-6.5],[hx+4,hy-8],[hx+3.5,hy-5],[hx+6,hy-4.5],[hx+3,hy-1],[hx+1.5,hy-2],[hx-.5,hy],[hx-1.5,hy-2.5],[hx-3,hy+1.5]],ink);
      pixelPoly(ctx,[[hx-4.5,hy-.5],[hx-5,hy-3],[hx-3.5,hy-3.5],[hx-4,hy-5.5],[hx-1.5,hy-5],[hx-1,hy-7],[hx+.7,hy-5],[hx+3,hy-6],[hx+2.5,hy-4],[hx+4,hy-3.5],[hx+2.5,hy-2],[hx+1.5,hy-3],[hx-.5,hy-1.5],[hx-1.5,hy-4],[hx-3,hy]],hair);
      ribbon(ctx,[hx-3.5,hy-4],[hx-.5,hy-5.5],1,U.shade(hair,35));
      ribbon(ctx,[hx+1,hy-4.5],[hx+2.5,hy-5],.5,U.shade(hair,60));
      if(id==='ryu') {
        dot(ctx,hx-4.5,hy-2.5,8.5,1.7,'#697d94');dot(ctx,hx-1.5,hy-2.5,4.5,1.2,steelHi);
        dot(ctx,hx+.5,hy-2.2,1,.7,'#4e6178');
      }
      if(mage) {
        pixelPoly(ctx,[[tx-6,sy-1],[tx-4,sy-6],[tx-1,sy-3],[tx+3,sy-5],[tx+6,sy-2],[tx+4,sy+3],[tx-3,sy+1]],ink);
        ribbon(ctx,[tx-4,sy-4],[tx-2,sy],1.5,'#d9bd75');
        ribbon(ctx,[tx+4,sy-3],[tx+2,sy+1],1.5,'#d9bd75');
      }
    }
    arm(true);
    if(sword && ['heavy','special','uppercut','rush'].includes(state)) {
      const h=p.handF;
      ribbon(ctx,[h.x-2,h.y+1],[h.x+25,h.y-17],3.5,ink);
      ribbon(ctx,[h.x+3,h.y-2],[h.x+24,h.y-17],2,steel);
      ribbon(ctx,[h.x+3,h.y-3],[h.x+24,h.y-17.5],.7,steelHi);
      ribbon(ctx,[h.x+1,h.y-5],[h.x+5,h.y+1],1.5,'#e0c68c');
    }
    if(mage) {
      const h=p.handB;
      shadedLimb(ctx,[h.x-2,h.y+17],[h.x-2,h.y-17],2,'#96674f','#4d3442','#d4a271');
      pixelPoly(ctx,[[h.x-6,h.y-17],[h.x-2,h.y-23],[h.x+2,h.y-17],[h.x-2,h.y-12]],ink);
      pixelPoly(ctx,[[h.x-5,h.y-17],[h.x-2,h.y-21],[h.x+1,h.y-17],[h.x-2,h.y-13]],'#ed8e54');
      dot(ctx,h.x-3,h.y-19,1.5,3,'#fff0c4');
    }
  }

  function drawHumanoid(ctx, palette, p, charDraw, state, prog, motion) {
    const id=Object.keys(deco).find(k=>deco[k]===charDraw)||'ryu';
    const def=CHARACTERS.find(c=>c.id===id);
    if(motion?.animation&&window.Motion60?.draw(ctx,def,motion.animation,palette.skin!==def.palette.skin))return;
    if(!motion?.animation&&window.DrawnAnimation?.version>=7&&window.DrawnAnimation.draw(ctx,def,{name:state||'idle',phase:((prog||0)%1+1)%1,frame:0,attack:def.moves[state]},palette.skin!==def.palette.skin))return;
    if(combatArt[id]?.ready && ['lightKick','heavyKick','lowKick','throw','weaponThrow'].includes(state)){
      const row={lightKick:0,heavyKick:1,lowKick:2,throw:3,weaponThrow:3}[state];
      const m=CHARACTERS.find(c=>c.id===id).moves[state==='weaponThrow'?'throw':state];
      const frameTime=motion?.attackStartup===undefined?(prog||0)*(m.startup+m.active+m.recovery):motion.attackT;
      const startup=motion?.attackStartup??m.startup,active=motion?.attackActive??m.active;
      const col=state==='weaponThrow'?(frameTime<startup?0:3):state==='throw'?Math.min(3,Math.floor((prog||0)*4)):
        frameTime<startup/2?0:frameTime<startup?1:frameTime<startup+active?2:3;
      const f=combatArt[id].frames[row*4+col];
      const base=CHARACTERS.find(c=>c.id===id).palette;
      const image=palette.skin===base.skin?f.canvas:f.flash;
      ctx.imageSmoothingEnabled=false;ctx.drawImage(image,-f.x/2,-f.y/2,image.width/2,image.height/2);return;
    }
    if(characterArt[id]?.ready) {
      let frameIndex=atlasFrame(id,state,prog||0);
      let offsetY=0, stretchX=1, stretchY=1, tilt=0;
      if (motion) {
        if (motion.moving && motion.blend > .08) {
          const cycle=((motion.gait/(Math.PI*2))%1+1)%1;
          // 支撑、交脚、另一腿支撑：插入收腿姿势，避免两张大跨步来回闪切。
          const steps=[2,2,0,0,3,3,1,1];
          frameIndex=steps[Math.floor(cycle*steps.length)];
          offsetY=-Math.pow(Math.sin(motion.gait),2)*.65*motion.blend;
          tilt=motion.lean*.035;
        }
        if (motion.air) {
          // 起跳蹬伸 → 收膝滞空 → 下落伸腿；前跳前倾，后跳保持面向对手。
          frameIndex=motion.airFrames <= 3 ? 0 : motion.vy > 5 ? 0 : 5;
          const launch=Math.max(0,1-motion.airFrames/6);
          stretchY=1+launch*.035;
          stretchX=1-launch*.02;
          tilt=motion.airDirection*(motion.vy < -2 ? .08 : motion.vy > 3 ? -.025 : .035);
        }
        if (motion.landing > 0) {
          const compression=Math.sin(motion.landing*Math.PI)*.075;
          stretchY-=compression;stretchX+=compression*.35;
        }
      }
      let frames=characterArt[id].frames, flipMovement=false;
      if (movementArt[id]?.ready && motion) {
        const backward=motion.air ? motion.jumpDirection < 0 : motion.lean < -.05;
        let movementFrame=null;
        if (motion.air) {
          const phase=motion.airFrames/Math.max(1,motion.jumpDuration||40);
          const frame=phase<.055?0:phase<.14?1:phase<.29?2:phase<.46?3:phase<.60?4:5;
          movementFrame=(backward?24:16)+frame;
        } else if (motion.landing>0) {
          movementFrame=(motion.jumpDirection<0?24:16)+(motion.landing>.4?6:7);
        } else if (motion.moving && motion.blend>.08) {
          const phase=((Math.abs(motion.gait)/(Math.PI*2))%1+1)%1;
          movementFrame=(backward?8:0)+Math.floor(phase*8);
        }
        if(movementFrame!==null){frames=movementArt[id].frames;frameIndex=movementFrame;
          flipMovement=id==='kaze'&&movementFrame>=24&&movementFrame<=30;
          offsetY=0;stretchX=stretchY=1;tilt=0;
        }
      }
      const f=frames[frameIndex];
      const base=CHARACTERS.find(c=>c.id===id).palette;
      const image=palette.skin===base.skin?f.canvas:f.flash;
      ctx.imageSmoothingEnabled=false;
      ctx.save();
      ctx.translate(0,offsetY);ctx.rotate(tilt);ctx.scale(stretchX*(flipMovement?-1:1),stretchY);
      ctx.drawImage(image,-f.x/2,-f.y/2,image.width/2,image.height/2);
      ctx.restore();
      return;
    }
    const phase=Math.floor((prog||0)*6)/6;
    const key=id+state+palette.skin+palette.cloth+Math.round(Math.sin(phase*2)*3)+JSON.stringify(p,(_k,v)=>typeof v==='number'?Math.round(v*2)/2:v);
    if (typeof document.createElement !== 'function') { drawDetailedFighter(ctx,palette,p,id,state,phase); return; }
    let sprite=spriteCache.get(key);
    if (!sprite) {
      sprite=document.createElement('canvas'); sprite.width=224;sprite.height=144;
      const c=sprite.getContext('2d');c.imageSmoothingEnabled=false;
      c.translate(80,128);c.scale(2,2);
      drawDetailedFighter(c,palette,p,id,state,phase);
      if(spriteCache.size>=160) spriteCache.delete(spriteCache.keys().next().value);
      spriteCache.set(key,sprite);
    }
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(sprite,-40,-64,112,72);
  }

  // ---------- 各角色装饰绘制 ----------
  const deco = {
    // 忍者:头巾 + 尾带
    ryu(ctx, p, P, st, pr, m) {
      U.px(ctx, m.hx - 6, m.hy - 6, 13, 4, P.trim);          // 头带
      U.px(ctx, m.hx - 6, m.hy - 3, 13, 2, U.shade(P.trim, -40));
      // 飘带
      const w = Math.sin((pr || 0) * 6 + p.hipX) * 4;
      seg(ctx, m.hx - 6, m.hy - 4, m.hx - 14, m.hy - 2 + w, 3, P.trim);
      U.px(ctx, m.hx - 5, m.hy - 8, 10, 3, P.hair);          // 前发
    },
    // 女武者:马尾 + 护腕
    mei(ctx, p, P, st, pr, m) {
      const sway = Math.sin((pr || 0) * 5) * 3;
      seg(ctx, m.hx - 4, m.hy - 5, m.hx - 12, m.hy + 6 + sway, 4, P.hair); // 马尾
      U.px(ctx, m.hx - 5, m.hy - 7, 11, 4, P.hair);          // 刘海
      U.px(ctx, p.handF.x - 4, p.handF.y - 4, 8, 3, P.trim);  // 护腕
    },
    // 拳王:光头 + 拳套 + 腰带
    tank(ctx, p, P, st, pr, m) {
      U.px(ctx, m.hx - 5, m.hy - 6, 11, 4, U.shade(P.skin, -30)); // 头顶阴影
      U.px(ctx, p.handF.x - 4, p.handF.y - 4, 8, 8, P.trim);   // 大拳套
      U.px(ctx, p.handB.x - 3, p.handB.y - 3, 6, 6, P.trim);
      U.px(ctx, p.hipX - 7, p.hipY - 1, 14, 3, '#e8c020');     // 金腰带
    },
    // 电光少年:尖发 + 头盔条
    volt(ctx, p, P, st, pr, m) {
      ctx.fillStyle = P.hair;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(m.hx + i*4 - 2, m.hy - 5);
        ctx.lineTo(m.hx + i*4, m.hy - 12 - Math.abs(i)*2);
        ctx.lineTo(m.hx + i*4 + 2, m.hy - 5);
        ctx.fill();
      }
      // 蓄力时手上有电球
      if (st === 'special') {
        const g = 4 + Math.sin((pr||0)*20)*2;
        ctx.fillStyle = P.trim;
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.arc(p.handF.x, p.handF.y, g, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
    },
    // 剑客:头发 + 背刀/挥刀
    kaze(ctx, p, P, st, pr, m) {
      U.px(ctx, m.hx - 6, m.hy - 7, 13, 5, P.hair);
      seg(ctx, m.hx - 6, m.hy - 3, m.hx - 12, m.hy + 4, 3, P.hair);
      // 武器:重攻/必杀时挥刀
      if (st === 'heavy' || st === 'special') {
        seg(ctx, p.handF.x, p.handF.y, p.handF.x + 22, p.handF.y - 14, 3, '#dfe7ef');
        seg(ctx, p.handF.x, p.handF.y, p.handF.x + 20, p.handF.y - 12, 1, '#ffffff');
      } else {
        // 背后的刀
        seg(ctx, -6, -34, -12, -20, 3, U.shade('#dfe7ef', -30));
      }
    },
    // 大法师:兜帽 + 法杖 + 火球
    sage(ctx, p, P, st, pr, m) {
      // 兜帽
      ctx.fillStyle = P.trim;
      ctx.beginPath();
      ctx.moveTo(m.hx - 7, m.hy + 5);
      ctx.lineTo(m.hx - 6, m.hy - 8);
      ctx.lineTo(m.hx + 7, m.hy - 6);
      ctx.lineTo(m.hx + 8, m.hy + 5);
      ctx.fill();
      // 法杖(后手)
      seg(ctx, p.handB.x, p.handB.y + 8, p.handB.x, p.handB.y - 14, 3, '#7a5230');
      ctx.fillStyle = st === 'special' ? '#ff5522' : '#ffb020';
      ctx.beginPath(); ctx.arc(p.handB.x, p.handB.y - 15, st==='special'?5:3, 0, 7); ctx.fill();
    },
  };

  // ---------- 招式表 ----------
  // 每招:startup 起手帧, active 命中帧, recovery 收招帧, dmg 伤害,
  // reach 命中盒相对身体前方距离/尺寸, kb 击退, meter 攒气, block:是否可被格挡
  // hitH:命中盒垂直中心相对脚(负=高)
  function moves(cfg) {
    return {
      light: { startup: 3, active: 4, recovery: 6, dmg: 6, reach: 40, hw: 26, hh: 16, hy: -30, kb: 3, meterGain: 6, hitstun: 12, type: 'light' },
      heavy: { startup: 8, active: 5, recovery: 16, dmg: 12, reach: 46, hw: 30, hh: 20, hy: -28, kb: 7, meterGain: 10, hitstun: 22, type: 'heavy' },
      uppercut: { startup: 4, active: 8, recovery: 24, dmg: 19, reach: 64, hw: 42, hh: 60, hy: -68, kb: 9, meterGain: 8, hitstun: 30, type: 'special', launch: true },
      rush: { startup: 5, active: 7, recovery: 20, dmg: 15, reach: 48, hw: 38, hh: 30, hy: -31, kb: 8, meterGain: 8, hitstun: 24, type: 'heavy', rushSpeed: 6.5 },
      special: Object.assign(
        { startup: 12, active: 8, recovery: 20, dmg: 20, kb: 12, meterGain: 0, hitstun: 30, type: 'special', cost: 50 },
        cfg.special || { reach: 60, hw: 46, hh: 26, hy: -30 }
      ),
    };
  }

  // ---------- 角色定义 ----------
  const CHARACTERS = [
    {
      id: 'ryu', name: '疾风', title: '流浪忍者',
      hp: 100, walk: 2.6, jump: 12.2, weight: 1.0,
      palette: { skin:'#e8b891', skinSh:'#c8946b', cloth:'#2b6cb0', clothSh:'#1e4e80', cloth2:'#4a90d0', hair:'#3a2b1a', eye:'#111', trim:'#e2e2e2', shoe:'#1a2a3a' },
      deco: deco.ryu,
      moves: moves({ special: { reach: 70, hw: 40, hh: 40, hy: -34, projectile: true, projColor:'#5ad2ff', projName:'风刃' } }),
      desc: '均衡型。必杀发射风刃远程打击。',
    },
    {
      id: 'mei', name: '美琳', title: '疾影武者',
      hp: 88, walk: 3.2, jump: 13.5, weight: 0.85,
      palette: { skin:'#f0c4a0', skinSh:'#d09a72', cloth:'#c53a6a', clothSh:'#95264c', cloth2:'#e86a92', hair:'#20242e', eye:'#111', trim:'#ffd166', shoe:'#40222c' },
      deco: deco.mei,
      moves: moves({ special: { reach: 64, hw: 40, hh: 46, hy: -34, rush: true } }),
      desc: '敏捷型。移动快、跳得高,必杀为多段突进。',
    },
    {
      id: 'tank', name: '铁拳', title: '钢铁拳王',
      hp: 128, walk: 2.0, jump: 10.0, weight: 1.35,
      palette: { skin:'#c98a5a', skinSh:'#9c6740', cloth:'#7a3b1e', clothSh:'#552814', cloth2:'#a85e35', hair:'#000', eye:'#111', trim:'#c0392b', shoe:'#2a2a2a' },
      deco: deco.tank,
      moves: (function(){ const m = moves({ special: { reach: 56, hw: 40, hh: 34, hy: -26 } }); m.heavy.dmg=16; m.heavy.kb=10; m.special.dmg=26; return m; })(),
      desc: '力量型。血厚攻高但慢,必杀为强力上勾冲拳。',
    },
    {
      id: 'volt', name: '闪电', title: '电光少年',
      hp: 84, walk: 3.4, jump: 13.0, weight: 0.8,
      palette: { skin:'#e8b891', skinSh:'#c08a5e', cloth:'#f0c020', clothSh:'#c09a10', cloth2:'#fff07a', hair:'#3a3a3a', eye:'#111', trim:'#5ad2ff', shoe:'#333' },
      deco: deco.volt,
      moves: (function(){ const m = moves({ special: { reach: 66, hw: 44, hh: 40, hy: -32, projectile:true, projColor:'#fff07a', projName:'雷球' } }); m.light.startup=2; m.light.recovery=5; return m; })(),
      desc: '速攻型。出手极快,必杀放出雷球。',
    },
    {
      id: 'kaze', name: '苍月', title: '流云剑客',
      hp: 92, walk: 2.8, jump: 12.5, weight: 0.95,
      palette: { skin:'#eabf9a', skinSh:'#c8946b', cloth:'#3a4a5a', clothSh:'#26323e', cloth2:'#5a7088', hair:'#6a4a8a', eye:'#111', trim:'#dfe7ef', shoe:'#222' },
      deco: deco.kaze,
      moves: (function(){ const m = moves({ special: { reach: 78, hw: 52, hh: 40, hy: -32, rush:true } }); m.heavy.reach=58; m.heavy.hw=40; m.heavy.dmg=14; return m; })(),
      desc: '剑术型。攻击距离长,必杀为拔刀突斩。',
    },
    {
      id: 'sage', name: '贤者', title: '烈焰法师',
      hp: 90, walk: 2.4, jump: 11.0, weight: 1.0,
      palette: { skin:'#e0b890', skinSh:'#b88a60', cloth:'#5b3a8a', clothSh:'#3e2762', cloth2:'#8a5ac0', hair:'#cfcfcf', eye:'#111', trim:'#4a2f6a', shoe:'#2a1f3a' },
      deco: deco.sage,
      moves: (function(){ const m = moves({ special: { reach: 74, hw: 44, hh: 44, hy: -32, projectile:true, projColor:'#ff6622', projName:'火球', big:true } }); m.special.dmg=22; m.special.cost=50; return m; })(),
      desc: '术法型。必杀发射大火球,远程压制强。',
    },
  ];

  window.CHARACTERS = CHARACTERS;
  window.computePose = computePose;
  window.drawHumanoid = drawHumanoid;
})();
