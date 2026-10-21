// ============================================================
// fighter.js — 战斗角色实例:物理、状态机、命中判定、绘制。
// 以及 Projectile(飞行道具)。
// 逻辑坐标:x 为角色中心,y 为脚底(= GROUND_Y 时站地面)。
// ============================================================
(function () {
  const GROUND = 460;      // == GROUND_Y
  const GRAV = 0.62;
  const FLOOR_MINX = -150, FLOOR_MAXX = 1110; // 1440 宽舞台，两端留出角色空间
  const SIZE = 2;           // 人物与战斗判定同步放大
  const SCALE = 2.1 * SIZE;
  const MOVE_SPEED = 1.3; // 旧定义的回退值，新角色使用独立前后步速。
  const WALK_ANIMATION_RATE = 0.75; // Only the walking drawings slow down; world movement stays unchanged.
  const WALK_FORWARD_ANIMATION_RATE = WALK_ANIMATION_RATE * 2 / 3;
  const AIR_JUMP_SCALE = 0.8; // 第二跳稍低，最高点仍留在战斗画面内。
  const ATTACK_STATES = window.ATTACK_STATES || ['light','heavy','special','uppercut','rush','tech','skill','super'];

  // Eight discrete pixel-effect exposures. Broad pixel facets are complemented
  // by one-world-pixel material seams, threads and grains inside the exact damage
  // footprint; neither the bright core nor its decorative particles extend it.
  // Drawing has no random calls and cannot change the simulation's random sequence.
  const projectileArt = new Map();
  const PROJECTILE_ART_PIXEL_BUDGET=2*1024*1024; // At most 8 MiB of cached RGBA pixels.
  let projectileArtPixels=0;
  function drawPixelProjectile(ctx,p) {
    if(typeof document.createElement!=='function')return; // Logic-only harness has no drawing surface.
    const id=p.owner.def.id,frame=Math.floor(p.t/3)%8,dormant=p.t<p.armFrames;
    const key=[id,p.shape,p.r,frame,dormant,!!p.armFrames,p.big].join(':');
    let art=projectileArt.get(key);
    if(!art){
      const r=p.r,near=p.shape==='spear'?-r*2:p.shape==='crescent'?0:p.shape==='flame'?-r*1.6:-r;
      const height=p.shape==='spear'?12:r*2,width=r-near;
      const canvas=document.createElement('canvas');
      canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);
      const c=canvas.getContext('2d'),sx=canvas.width/width,sy=canvas.height/height;
      // Scan conversion keeps every edge a hard pixel step, including diagonals.
      const poly=(color,points)=>{
        const v=points.map(([x,y])=>[(x*r-near)*sx,(y*r+height/2)*sy]);
        c.fillStyle=color;
        for(let y=Math.max(0,Math.floor(Math.min(...v.map(q=>q[1]))));y<Math.min(canvas.height,Math.ceil(Math.max(...v.map(q=>q[1]))));y++){
          const spans=[];
          for(let i=0,j=v.length-1;i<v.length;j=i++){
            const a=v[j],b=v[i],row=y+.5;
            if((a[1]>row)!==(b[1]>row))spans.push(a[0]+(row-a[1])*(b[0]-a[0])/(b[1]-a[1]));
          }
          spans.sort((a,b)=>a-b);
          for(let i=0;i+1<spans.length;i+=2){
            const left=Math.max(0,Math.ceil(spans[i]-.5)),right=Math.min(canvas.width,Math.ceil(spans[i+1]-.5));
            if(right>left)c.fillRect(left,y,right-left,1);
          }
        }
      };
      const rect=(color,x,y,w,h)=>poly(color,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]);
      const diamond=(color,x,y,w,h)=>poly(color,[[x-w,y],[x,y-h],[x+w,y],[x,y+h]]);
      // Bresenham seams remain hard pixels instead of anti-aliased Canvas strokes.
      const line=(color,x0,y0,x1,y1)=>{
        let x=Math.round((x0*r-near)*sx),y=Math.round((y0*r+height/2)*sy);
        const endX=Math.round((x1*r-near)*sx),endY=Math.round((y1*r+height/2)*sy);
        const dx=Math.abs(endX-x),dy=-Math.abs(endY-y),stepX=x<endX?1:-1,stepY=y<endY?1:-1;
        let error=dx+dy;c.fillStyle=color;
        while(true){
          c.fillRect(x,y,1,1);if(x===endX&&y===endY)break;
          const twice=error*2;if(twice>=dy){error+=dy;x+=stepX;}if(twice<=dx){error+=dx;y+=stepY;}
        }
      };
      const seam=(color,points)=>{for(let i=1;i<points.length;i++)line(color,...points[i-1],...points[i]);};
      const chip=(edge,light,x,y,w=.08,h=.11)=>{
        diamond(edge,x,y,w,h);rect(light,x-w*.35,y-h*.55,Math.max(.035,w*.65),Math.max(.035,h*.6));
      };
      const pin=(color,x,y,w=1,h=1)=>{
        c.fillStyle=color;c.fillRect(Math.round((x*r-near)*sx),Math.round((y*r+height/2)*sy),w,h);
      };
      const veil=(color,points,alpha)=>{c.globalAlpha=alpha;poly(color,points);c.globalAlpha=1;};
      // Authored offsets change only at an exposure boundary; no frame blending,
      // blur, stochastic emitters or transform-based warping of sprite artwork.
      const ember=[-.13,-.06,.04,.12,.06,-.04,-.11,-.02][frame];
      const gleam=[-.74,-.5,-.25,0,.25,.5,.73,.37][frame];
      if(dormant){
        // Delayed mines are outlines, not an apparently live full-area attack.
        const edge=id==='sage'?'#6c382f':'#35556d',glint=id==='sage'?'#b87542':'#73a9ac';
        poly(edge,[[-.8,.05],[-.4,-.24],[.4,-.24],[.8,.05],[.4,.34],[-.4,.34]]);
        poly('#171e32',[[-.64,.05],[-.32,-.14],[.32,-.14],[.64,.05],[.32,.24],[-.32,.24]]);
        rect(glint,-.5,-.08,.14,.06);rect(glint,.36,.16,.14,.06);
        rect(glint,-.06,-.5,.12,.16);rect(edge,-.06,.36,.12,.14);
        if(frame%2===0)diamond(glint,0,.05,.1,.1);
        // Inactive traps retain a low, hollow indicator rather than a live burst.
        seam(edge,[[-.72,-.13],[-.46,-.36],[-.26,-.36]]);
        seam(edge,[[.26,.46],[.46,.46],[.72,.23]]);
        rect(edge,-.36,.02,.13,.05);rect(edge,.23,.02,.13,.05);
        const tick=[[-.45,-.28],[-.1,-.28],[.27,-.28],[.61,-.05],[.27,.33],[-.1,.33],[-.45,.24],[-.61,.01]][frame];
        rect(glint,tick[0],tick[1],.1,.055);
        if(id==='sage')seam(edge,[[-.19,.18],[0,-.08],[.19,.18]]);
        else{rect(edge,-.18,-.04,.06,.17);rect(edge,.12,-.04,.06,.17);}
      }else if(p.shape==='spear'){
        const h=6/r;
        if(id==='ryu'){
          // Ryu's narrow wind lance: two swept blades and separated air rails.
          poly('#163d65',[[-1.9,0],[-.7,-h*.6],[.38,-h],[1,0],[.38,h],[-.7,h*.6]]);
          poly('#327db0',[[-1.65,0],[-.5,-h*.32],[.4,-h*.65],[.95,0],[.4,h*.65],[-.5,h*.32]]);
          poly('#8bdded',[[-1.2,0],[.42,-h*.3],[.84,0],[.42,h*.3]]);
          line('#e1ffff',-.82+frame*.11,0,.75,0);
          line('#5aa7c0',-1.95,-h*.82,-.65,-h*.82);
          line('#5aa7c0',-1.8,h*.67,-.9,h*.67);
          rect('#d5ffff',-1.5+gleam*.25,-h*.3,.2,h*.3);
          // Condensed air is a bundle of tapered, separated streaks, with a
          // darker underside and bright pressure front, rather than a solid bar.
          veil('#578ca8',[[-1.9,-h*.22],[-1.12,-h*.52],[.32,-h*.76],[-.15,-h*.31]],.65);
          seam('#b9edf0',[[-1.72,-h*.12],[-.79,-h*.24],[.31,-h*.47],[.73,-h*.12]]);
          seam('#24506f',[[-1.37,h*.31],[-.55,h*.42],[.36,h*.66],[.69,h*.26]]);
          for(let i=0;i<6;i++)pin(i%2?'#99dce5':'#397994',-1.9+i*.25+ember*.4,(i%2?-.72:.77)*h,2,1);
        }else{
          // Volt's electric spear is a jagged discharge with branching gaps,
          // not the wind-lance silhouette painted yellow.
          const pulse=[[-1.98,0],[-1.58,-h*.7],[-1.45,h*.55],[-1.02,-h*.55],[-.9,h*.72],[-.44,-h*.5],[-.3,h*.45],[.12,-h*.58],[.26,h*.3],[.93,0]];
          seam('#a88c36',pulse);seam('#e1f9dc',pulse.map(([x,y])=>[x,y*.5]));
          line('#fff4aa',.18,0,.96,0);
          seam('#69c4cc',[[-1.3,0],[-1.04,h*.9],[-.72,h*.9]]);
          seam('#d6b74e',[[-.48,0],[-.2,-h*.94],[.16,-h*.94]]);
          const pulseX=-1.65+frame*.27;
          rect('#fff8c8',pulseX,-h*.3,.16,h*.6);
          rect('#97dbe0',pulseX-.16,h*.68,.1,h*.22);
          seam('#467889',[[-1.9,-h*.7],[-1.72,-h*.92],[-1.4,-h*.86]]);
          seam('#f4da7e',[[-1.05,h*.75],[-.93,h*.96],[-.61,h*.78]]);
          seam('#a2e4e4',[[-.49,-h*.38],[-.32,-h*.86],[-.05,-h*.76]]);
          for(let i=0;i<7;i++)pin(i%3?'#d8f4e7':'#f7d97b',-1.92+i*.35+ember*.2,(i%2?-.86:.8)*h);
        }
      }else if(id==='ryu'){
        // Two exposed steel edges alternate with two diagonal wind-vane drawings.
        const outline=frame%2===0?
          [[-.16,-1],[.16,-1],[.3,-.3],[1,-.16],[1,.16],[.3,.3],[.16,1],[-.16,1],[-.3,.3],[-1,.16],[-1,-.16],[-.3,-.3]]:
          [[-.7,-.83],[-.4,-.83],[0,-.4],[.7,-.83],[.83,-.7],[.4,0],[.83,.7],[.7,.83],[0,.4],[-.7,.83],[-.83,.7],[-.4,0],[-.83,-.7]];
        poly('#16354f',outline);
        if(frame%2===0){
          poly('#397e9b',[[0,-.9],[.15,-.2],[.9,0],[.2,.15],[0,.9],[-.15,.2],[-.9,0],[-.2,-.15]]);
          poly('#8edce8',[[0,-.83],[.08,-.2],[.7,-.08],[.23,.02],[.03,.68],[-.08,.2],[-.73,.08],[-.22,-.02]]);
          poly('#5b8c9d',[[-.11,-.85],[.01,-.88],[.12,-.31],[0,-.17],[-.15,-.3]]);
          poly('#afced5',[[.21,-.15],[.84,-.05],[.86,.02],[.29,.12],[.15,0]]);
          poly('#244b65',[[.03,.2],[.15,.31],[.08,.87],[.01,.9],[-.06,.31]]);
          line('#e7f6ec',-.08,-.82,-.01,-.32);line('#b0d9dd',.3,-.09,.77,-.02);
          line('#15354e',-.78,.02,-.28,.1);line('#87a7b3',-.01,.38,.02,.76);
        }else{
          // Alternate exposure has genuine diagonal steel faces, not a cross
          // painted over the X silhouette. Reflections follow each bevel.
          poly('#3d7188',[[-.68,-.77],[-.46,-.77],[0,-.27],[.65,-.77],[.76,-.65],[.27,0],[.77,.66],[.67,.77],[0,.27],[-.66,.77],[-.77,.66],[-.27,0],[-.77,-.66]]);
          poly('#adcfd5',[[-.64,-.72],[-.5,-.72],[-.06,-.21],[-.22,-.17]]);
          poly('#6fabbc',[[.2,-.17],[.67,-.72],[.71,-.63],[.3,-.15]]);
          poly('#c8e6e3',[[.16,.2],[.69,.64],[.66,.71],[.16,.3]]);
          poly('#608b9c',[[-.19,.19],[-.67,.7],[-.71,.61],[-.28,.15]]);
          line('#e5f7ed',-.61,-.71,-.25,-.31);line('#22475f',.3,-.21,.65,-.61);
          line('#c5e1dc',.28,.3,.61,.61);line('#244b65',-.32,.26,-.61,.64);
        }
        rect('#d5ffff',-.1,-.2,.2,.4);rect('#d5ffff',-.2,-.1,.4,.2);
        diamond('#173b59',0,0,.09,.09);
        rect('#5baac7',-.78,-.65+ember,.12,.18);rect('#67c4d7',.58,.47+ember,.13,.13);
        // Blue wind threads surround bevelled steel, leaving the four blades clear.
        seam('#24536f',[[-.84,-.39],[-.68,-.63],[-.36,-.78],[-.12,-.78]]);
        seam('#346f87',[[.84,.39],[.68,.63],[.36,.78],[.12,.78]]);
        seam('#6fb5c6',[[-.86,.28],[-.74,.52],[-.5,.67]]);
        seam('#427e98',[[.86,-.28],[.74,-.52],[.5,-.67]]);
        line('#1c4b65',0,-.7,.08,-.29);line('#ebffff',.27,-.06,.7,-.06);
        line('#28617a',-.08,.29,0,.68);line('#b7f1ef',-.67,.06,-.27,.06);
        const motes=[[-.83,-.73],[-.45,-.89],[.36,-.83],[.82,-.57],[.84,.63],[.37,.88],[-.43,.83],[-.86,.49]];
        for(let i=0;i<4;i++){
          const q=motes[(frame+i*2)%8];chip('#326e89',i%2?'#9ee4e8':'#5eafc6',q[0],q[1],.055,.075);
        }
        rect('#f0ffff',gleam*.65,-.12,.07,.07);
        // Separated wisps vary in opacity and length, so air reads as flowing
        // pressure around dense metal rather than another opaque energy disc.
        veil('#315c77',[[-.96,-.29],[-.87,-.51],[-.62,-.72],[-.3,-.82],[-.56,-.68],[-.79,-.43]],.55);
        seam('#8dc6cd',[[.94,.2],[.86,.47],[.62,.7],[.39,.77]]);
        seam('#35647b',[[-.93,.07],[-.91,.21],[-.82,.34]]);
        for(let i=0;i<9;i++){
          const q=motes[(frame+i)%8],offset=i%3*.028;
          pin(i%3===0?'#d3eeea':'#669cac',q[0]+offset,q[1]+(i%2?-.025:.025));
        }
      }else if(id==='mei'){
        // Opposed curved steel petals, with rose fabric knots at the spindle.
        poly('#64314e',[[-.9,-.45],[-.58,-.84],[.05,-1],[.63,-.72],[1,-.15],[.6,-.36],[.22,-.4],[-.24,-.25],[-.54,.12]]);
        poly('#e782ad',[[-.75,-.47],[-.46,-.72],[.06,-.84],[.53,-.62],[.82,-.25],[.22,-.57],[-.22,-.43],[-.48,-.1]]);
        poly('#fff0e9',[[-.56,-.56],[.06,-.83],[.55,-.6],[.74,-.35],[.14,-.65],[-.22,-.54]]);
        poly('#64314e',[[.9,.45],[.58,.84],[-.05,1],[-.63,.72],[-1,.15],[-.6,.36],[-.22,.4],[.24,.25],[.54,-.12]]);
        poly('#d56e9b',[[.75,.47],[.46,.72],[-.06,.84],[-.53,.62],[-.82,.25],[-.22,.57],[.22,.43],[.48,.1]]);
        poly('#ffe0e9',[[.56,.56],[-.06,.83],[-.55,.6],[-.74,.35],[-.14,.65],[.22,.54]]);
        diamond('#9b3b6b',0,0,.22,.23);diamond('#ffd1de',0,0,.11,.12);
        diamond('#f4a2bf',-.7+ember,.18,.1,.16);diamond('#f4a2bf',.64-ember,-.13,.08,.13);
        seam('#a4557c',[[-.55,-.48],[-.18,-.65],[.16,-.69],[.47,-.55]]);
        seam('#fff8ef',[[.32,-.72],[.58,-.56],[.72,-.39]]);
        seam('#a4557c',[[.55,.48],[.18,.65],[-.16,.69],[-.47,.55]]);
        seam('#ffe4ee',[[-.32,.72],[-.58,.56],[-.72,.39]]);
        // Detached petals have shaded folds; thin rose ribbons join the spindle.
        seam('#933c68',[[-.46,.22],[-.22,.34],[.04,.23],[.25,.35],[.46,.18]]);
        seam('#cf7a9f',[[-.39,-.16],[-.19,-.3],[.03,-.22],[.27,-.3],[.41,-.18]]);
        const petals=[[-.86,-.11],[-.7,.39],[-.37,.87],[.15,.91],[.86,.18],[.64,-.46],[.31,-.88],[-.25,-.89]];
        for(let i=0;i<4;i++){
          const q=petals[(frame+i*2)%8];chip('#a84f7d','#ffd9e6',q[0],q[1],.055,.09);
        }
        rect('#fff8ef',-.04,-.04,.08,.08);rect('#e68db4',-.18,.07,.07,.07);
        // Petal blades have a folded translucent membrane and a hard pale rim.
        // The rose back, ivory face and wine crease stay different materials.
        veil('#b95080',[[-.76,-.41],[-.51,-.66],[-.1,-.78],[.22,-.73],[-.16,-.62],[-.49,-.5]],.6);
        veil('#f9c6d7',[[.14,-.76],[.5,-.59],[.69,-.36],[.36,-.53]],.55);
        veil('#7a385d',[[.66,.4],[.45,.61],[.04,.8],[-.28,.69],[.08,.6],[.37,.5]],.65);
        seam('#fff7ec',[[-.66,-.49],[-.36,-.7],[.05,-.8],[.36,-.68]]);
        seam('#e7b8ca',[[.64,.48],[.32,.69],[-.06,.79],[-.4,.64]]);
        for(let i=0;i<6;i++){
          const q=petals[(frame+i)%8],fold=i%2?1:-1,x=q[0],y=q[1];
          veil('#d16b98',[[x-.075,y+.035],[x-.025,y-.09],[x+.08,y-.035],[x+.03,y+.08]],.5);
          line('#ffe4e5',x-.025,y-.065,x+.03,y+.035);
          pin('#8e4268',x-.035,y+.045,2,1);pin('#edb4cb',x+.06,y-.025);
          if(i<3)line('#7e3f66',x+.08*fold,y+.12,x+.14*fold,y+.17);
        }
      }else if(id==='tank'){
        // Three detached fault slabs: top planes catch light, broad front faces
        // carry strata and side faces remain dark. Open fissures stay visible.
        const lift=[0,-.025,-.045,-.015,.025,.045,.015,-.01][frame];
        const stone=(color,points,dy=0)=>poly(color,points.map(([x,y])=>[x,y+dy]));
        stone('#443a31',[[-1.43,.42],[-1.19,.15],[-.94,.2],[-.84,.36],[-.88,.83],[-1.22,.96],[-1.46,.79]],lift);
        stone('#a68b65',[[-1.43,.42],[-1.19,.15],[-.94,.2],[-1.1,.46]],lift);
        stone('#896f50',[[-1.43,.42],[-1.1,.46],[-1.12,.87],[-1.37,.78]],lift);
        stone('#624f3d',[[-1.1,.46],[-.94,.2],[-.84,.36],[-.88,.83],[-1.12,.87]],lift);
        seam('#c9b48a',[[-1.35,.4+lift],[-1.19,.22+lift],[-1.02,.25+lift]]);
        seam('#4c4133',[[-1.34,.63+lift],[-1.15,.59+lift],[-1.03,.67+lift]]);
        stone('#443a32',[[-.76,.08],[-.54,-.39],[-.25,-.35],[-.08,-.02],[-.16,.73],[-.52,.88],[-.75,.65]],-lift*.6);
        stone('#c3a579',[[-.76,.08],[-.54,-.39],[-.25,-.35],[-.39,.03]],-lift*.6);
        stone('#a1835e',[[-.76,.08],[-.39,.03],[-.43,.75],[-.66,.64]],-lift*.6);
        stone('#6c5741',[[-.39,.03],[-.25,-.35],[-.08,-.02],[-.16,.73],[-.43,.75]],-lift*.6);
        seam('#e0c99a',[[-.69,.04-lift*.6],[-.53,-.31-lift*.6],[-.32,-.28-lift*.6]]);
        seam('#5a4736',[[-.61,.13],[-.5,.28],[-.55,.43],[-.45,.57]]);
        seam('#c0a77a',[[-.68,.52],[-.46,.44],[-.31,.46]]);
        stone('#443c33',[[.08,-.66],[.34,-.96],[.7,-.77],[.74,-.33],[.9,-.14],[.81,.24],[.84,.82],[.5,.95],[.03,.7],[.14,.27],[.07,-.07]],lift*.45);
        stone('#cab18b',[[.08,-.66],[.34,-.96],[.7,-.77],[.47,-.5]],lift*.45);
        stone('#a88e6b',[[.08,-.66],[.47,-.5],[.51,.84],[.03,.7],[.14,.27],[.07,-.07]],lift*.45);
        stone('#6d5a43',[[.47,-.5],[.7,-.77],[.74,-.33],[.9,-.14],[.81,.24],[.84,.82],[.51,.84]],lift*.45);
        stone('#8b7254',[[.17,-.54],[.4,-.42],[.35,-.01],[.19,.12]],lift*.45);
        seam('#e2cfaa',[[.17,-.65],[.35,-.87],[.58,-.76]]);
        seam('#584a38',[[.29,-.49],[.24,-.13],[.35,.04],[.28,.31],[.36,.52],[.3,.76]]);
        seam('#c3ab80',[[.12,.32],[.29,.25],[.46,.32]]);
        seam('#514334',[[.58,-.38],[.65,-.11],[.55,.08],[.65,.26],[.59,.52]]);
        line('#b39770',.73,-.05,.68,.15);line('#a58b64',.58,.62,.75,.59);
        const stones=[[-1.38,-.07],[-1.08,-.25],[-.79,-.56],[-.35,-.77],[.03,-.91],[.86,-.45],[.95,.24],[-.94,.08]];
        for(let i=0;i<6;i++){
          const q=stones[(frame+i*3)%8];chip('#675540',i%2?'#c8af81':'#a58c61',q[0],q[1],.045,.065);
        }
        // Loose granular dust is translucent and low, never a solid triangular
        // wave joining the rock chunks back together.
        for(let i=0;i<4;i++){
          const x=-1.43+i*.53+ember*.13,y=.87+(i%2)*.045;
          veil('#b09a71',[[x-.14,y],[x-.1,y-.11],[x+.04,y-.13],[x+.18,y-.03],[x+.22,y+.06],[x-.05,y+.08]],.22);
        }
        for(let i=0;i<21;i++){
          const x=-1.51+(i%9)*.26+(i>8?.04:0),y=.77+Math.floor(i/9)*.075+ember*.2;
          pin(i%4===0?'#dac59b':i%3===0?'#846c4f':'#ac946d',x,y,i%5===0?2:1,1);
        }
      }else if(id==='volt'){
        // An irregular ionised core and wandering discharge paths replace a
        // regular star badge. Empty gaps separate every branching streamer.
        const coreX=[-.06,-.02,.04,.01,-.05,-.09,-.03,.03][frame];
        const coreY=[-.04,.03,.06,-.02,-.07,-.01,.04,.01][frame];
        const core=points=>points.map(([x,y])=>[x+coreX,y+coreY]);
        veil('#2a596b',core([[-.35,-.15],[-.14,-.37],[.09,-.34],[.32,-.12],[.24,.18],[.02,.31],[-.27,.19]]),.7);
        poly('#43828c',core([[-.28,-.12],[-.11,-.28],[.08,-.27],[.26,-.1],[.18,.16],[-.03,.25],[-.23,.11]]));
        poly('#85c9c7',core([[-.2,-.11],[-.08,-.21],[.07,-.19],[.16,-.04],[.08,.12],[-.08,.16],[-.2,.05]]));
        c.globalCompositeOperation='destination-out';
        poly('#000000',core([[-.11,-.08],[.04,-.13],[.11,-.02],[.02,.12],[-.1,.07]]));
        c.globalCompositeOperation='source-over';
        const paths=[
          [[-.95,.08],[-.73,-.01],[-.63,-.2],[-.38,-.08],[-.12,-.18],[.04,-.02],[.29,-.2],[.48,.02],[.77,-.11],[.96,.02]],
          [[-.94,-.19],[-.68,-.06],[-.56,.15],[-.32,-.04],[-.09,.04],[.1,-.13],[.33,-.06],[.47,.13],[.72,.02],[.95,.21]],
          [[-.93,.22],[-.75,.04],[-.52,.12],[-.37,-.12],[-.12,-.02],[.06,.13],[.3,-.05],[.57,-.13],[.73,.08],[.96,-.03]],
          [[-.94,-.07],[-.69,-.21],[-.51,-.04],[-.28,.11],[-.06,-.07],[.13,-.01],[.28,.17],[.52,-.05],[.79,.13],[.95,.04]],
          [[-.95,.16],[-.74,.2],[-.6,-.04],[-.35,.04],[-.13,-.16],[.1,-.07],[.31,.06],[.48,-.15],[.72,-.03],[.97,-.15]],
          [[-.94,.02],[-.76,-.14],[-.5,.05],[-.31,-.08],[-.13,.09],[.07,.01],[.3,-.18],[.56,.03],[.76,.16],[.96,.07]],
          [[-.94,-.15],[-.7,.02],[-.54,-.13],[-.34,.08],[-.14,-.05],[.05,-.17],[.32,.02],[.53,-.04],[.77,-.17],[.96,.04]],
          [[-.95,.18],[-.75,-.03],[-.55,.09],[-.33,-.1],[-.11,.05],[.1,-.07],[.28,.12],[.51,-.11],[.75,-.02],[.96,.15]]
        ];
        const filament=(points,width,edge,light)=>{
          for(let i=1;i<points.length;i++){
            const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1,ox=-dy/len*width,oy=dx/len*width;
            poly(edge,[[a[0]-ox,a[1]-oy],[a[0]+ox,a[1]+oy],[b[0]+ox,b[1]+oy],[b[0]-ox,b[1]-oy]]);
          }
          seam(light,points);
        };
        filament(paths[frame],.055,'#3d7c89','#e8f5cd');
        const branches=[
          [[-.56,-.08],[-.51,-.39],[-.73,-.55],[-.64,-.83]],
          [[-.03,-.1],[.13,-.38],[.03,-.54],[.28,-.9]],
          [[.4,-.08],[.61,-.36],[.53,-.55],[.84,-.76]],
          [[.52,.03],[.75,.22],[.63,.38],[.89,.59]],
          [[.02,.09],[.16,.32],[.06,.51],[.31,.87]],
          [[-.36,.03],[-.57,.25],[-.43,.41],[-.69,.72]],
          [[-.7,-.03],[-.89,-.2],[-.77,-.37],[-.92,-.58]],
          [[-.18,.05],[-.38,.32],[-.3,.55],[-.44,.88]]
        ];
        for(let i=0;i<5;i++){
          const points=branches[(frame+i*3)%8];filament(points,i%2?.017:.025,i%2?'#627c68':'#417c89',i%2?'#dfc879':'#a7e4df');
          const q=points[2],end=points[3];pin(i%2?'#ffeab0':'#d1f6e9',q[0],q[1]);
          if(i%2===0)line('#47768a',q[0],q[1],end[0]-.12,end[1]+.02);
        }
        seam('#bdded5',core([[-.28,-.14],[-.12,-.3],[.06,-.28]]));
        seam('#d8d49c',core([[.24,.04],[.16,.2],[-.01,.28]]));
        const sparks=[[-.8,-.66],[-.3,-.91],[.54,-.81],[.87,-.23],[.75,.67],[.25,.88],[-.58,.83],[-.89,.21]];
        for(let i=0;i<9;i++){
          const q=sparks[(frame+i)%8];pin(i%3?'#96ccd3':'#eed99b',q[0]+(i%2?-.025:.025),q[1]+(i%3-1)*.035);
        }
        if(p.armFrames){
          // Armed field marks remain broken conductors, never a solid perimeter.
          seam('#598895',[[-.68,.72],[-.45,.8],[-.29,.75]]);
          seam('#a89e64',[[.42,-.8],[.6,-.75],[.71,-.8]]);
          pin('#d4f2dc',-.54,.82,2,1);pin('#f2d98d',.57,-.83,2,1);
        }
      }else if(id==='kaze'){
        // The crescent occupies only the forward half-plane of its actual box.
        poly('#4f466d',[[0,-1],[.35,-.91],[.7,-.64],[.91,-.34],[1,0],[.91,.34],[.7,.64],[.35,.91],[0,1],[.27,.64],[.45,.33],[.5,0],[.45,-.33],[.27,-.64]]);
        poly('#9b8cc3',[[.05,-.94],[.38,-.8],[.7,-.49],[.87,-.16],[.89,.16],[.7,.49],[.38,.8],[.05,.94],[.38,.54],[.59,.22],[.59,-.22],[.38,-.54]]);
        poly('#e8dff4',[[.1,-.9],[.45,-.65],[.72,-.29],[.78,0],[.72,.29],[.45,.65],[.1,.9],[.43,.4],[.57,.06],[.53,-.3],[.31,-.66]]);
        poly('#fff8f0',[[.48,-.6],[.76,-.24],[.8,.05],[.69,.4],[.58,.55],[.68,.11],[.64,-.23]]);
        rect('#b4a3d2',.05,-.47+ember,.15,.06);rect('#d8d0eb',.13,.33-ember,.13,.06);
        // Parallel etched arcs and blade fragments travel inside the forward
        // crescent; the hollow rear half is never filled with a false hit halo.
        seam('#665584',[[.18,-.83],[.47,-.63],[.71,-.35],[.83,-.07],[.78,.23],[.64,.5],[.43,.72]]);
        seam('#cfc3e2',[[.21,-.72],[.43,-.47],[.57,-.17],[.58,.13],[.46,.43],[.25,.72]]);
        seam('#f9f3ec',[[.73,-.35],[.84,-.11],[.85,.14],[.76,.36]]);
        seam('#796895',[[.04,-.66],[.16,-.51],[.24,-.34]]);
        seam('#a292be',[[.05,.6],[.17,.44],[.24,.27]]);
        const glints=[[.23,-.83],[.5,-.65],[.74,-.41],[.91,-.08],[.86,.28],[.65,.59],[.38,.8],[.11,.9]];
        const q=glints[frame];chip('#9480b2','#fff9ef',q[0],q[1],.045,.07);
        for(let i=0;i<3;i++){
          const q=glints[(frame+2+i*2)%8];rect('#b2a1cf',Math.max(.02,q[0]-.13),q[1],.065,.05);
        }
        // A narrow polished steel face rolls from violet shadow into an ivory
        // specular edge; separate secondary trails remain thin and cold.
        poly('#6d6188',[[.13,-.88],[.43,-.71],[.7,-.43],[.87,-.12],[.88,.16],[.71,.51],[.43,.77],[.1,.93],[.3,.76],[.6,.45],[.75,.12],[.73,-.19],[.52,-.54]]);
        poly('#b3bacf',[[.34,-.7],[.61,-.47],[.8,-.16],[.81,.13],[.68,.43],[.44,.7],[.26,.82],[.46,.57],[.62,.28],[.65,-.04],[.56,-.33]]);
        seam('#f5f7ed',[[.45,-.65],[.68,-.38],[.81,-.09],[.8,.14],[.66,.44]]);
        seam('#d6d6e7',[[.18,-.82],[.43,-.64],[.64,-.4]]);
        seam('#514866',[[.35,.77],[.57,.52],[.7,.25],[.73,-.03]]);
        const hot=glints[frame];
        line('#fffdf3',hot[0]-.025,hot[1]-.05,hot[0]+.035,hot[1]+.035);
        for(let i=0;i<5;i++){
          const q=glints[(frame+i*2)%8],x=Math.max(.02,q[0]-.23),y=q[1]*.86;
          line(i%2?'#74678e':'#a6a0bd',x,y,x+.055,y-.06);pin('#dedde5',x+.06,y-.06);
        }
      }else{
        // A blunt, split combustion front and unequal folded tongues replace
        // the symmetric arrow. Eight separate exposures shift the flame clefts.
        const flameTop=[-.33,-.27,-.38,-.3,-.24,-.35,-.29,-.39][frame];
        const flameGap=[-.055,-.02,.025,.055,.015,-.045,-.075,-.015][frame];
        const head=[.94,.88,.96,.91,.97,.9,.95,.92][frame];
        poly('#6d3531',[
          [-1.57,.13],[-1.18,-.11],[-1.42,-.39],[-1.07,-.46],[-.85,-.86],[-.72,-.5],[-.43,-.68],[-.11,-.52],
          [.08,-.8],[.32,-.69],[.39,-.39],[.64,-.47],[.82,flameTop],[head,-.14],[head-.03,flameGap],
          [.69,flameGap+.025],[.78,.12],[head,.21],[.88,.39],[.64,.44],[.42,.36],[.35,.65],[.11,.72],[-.06,.51],
          [-.24,.88],[-.49,.67],[-.6,.33],[-.87,.52],[-1.11,.4],[-.93,.2],[-1.3,.29]
        ]);
        poly('#b55b35',[
          [-1.35,.11],[-.98,-.05],[-1.16,-.29],[-.91,-.34],[-.8,-.65],[-.65,-.34],[-.39,-.5],[-.16,-.34],
          [.09,-.59],[.25,-.5],[.29,-.24],[.61,-.34],[.77,flameTop+.12],[head-.14,-.11],[.61,flameGap+.01],
          [.71,.2],[.81,.29],[.57,.3],[.36,.22],[.25,.49],[.08,.54],[-.09,.32],[-.26,.63],[-.42,.48],[-.43,.22],[-.72,.35],[-.89,.27],[-.73,.1]
        ]);
        poly('#e99446',[[-.94,.1],[-.61,-.1],[-.72,-.38],[-.45,-.24],[-.24,-.34],[-.07,-.2],[.11,-.45],[.21,-.27],[.13,-.06],[-.08,.08],[-.2,.4],[-.4,.23],[-.63,.22]]);
        poly('#edaa51',[[.06,-.15],[.21,-.34],[.45,-.3],[.65,-.17],[.48,-.1],[.3,-.2],[.18,-.025]]);
        poly('#f5b65e',[[.03,.17],[.29,.025],[.58,.14],[.72,.28],[.49,.26],[.33,.42],[.09,.34],[-.07,.25]]);
        poly('#ffe5a3',[[.09,-.12],[.24,-.25],[.42,-.23],[.56,-.16],[.35,-.15],[.21,-.08]]);
        poly('#fff0bc',[[.13,.18],[.34,.12],[.54,.2],[.33,.3],[.14,.27]]);
        // Pinched transparent combustion pockets give the core depth and let
        // the background show between the hot sheets, instead of a solid badge.
        c.globalCompositeOperation='destination-out';
        poly('#000000',[[-1.17,-.21],[-.94,-.27],[-.76,-.2],[-.86,-.13],[-1.08,-.12]]);
        poly('#000000',[[.38,-.025],[.57,-.09],[.74,flameGap+.01],[.6,.045],[.47,.06]]);
        c.globalCompositeOperation='source-over';
        veil('#70382f',[[-.58,-.22],[-.33,-.4],[-.17,-.29],[-.29,-.2],[-.46,-.11]],.8);
        seam('#f3bc71',[[-.88,.08],[-.56,-.07],[-.62,-.28],[-.45,-.2]]);
        seam('#ffc87e',[[-.37,.14],[-.21,.05],[-.12,-.12],[.06,-.18],[.15,-.36]]);
        seam('#85422e',[[-.79,.31],[-.58,.23],[-.48,.3],[-.3,.47],[-.19,.34]]);
        seam('#fbd28d',[[.16,.16],[.32,.08],[.51,.14],[.67,.25]]);
        seam('#8b452f',[[.44,-.34],[.62,-.3],[.78,-.2]]);
        // A detached hot tongue and dark cooling billow have different lengths
        // and opacity; cinders follow the wake instead of a symmetric ring.
        veil('#aa5535',[[-1.43,-.16],[-1.24,-.33],[-1.06,-.39],[-1.18,-.25],[-1.34,-.19]],.65);
        veil('#70412f',[[-1.27,.39],[-1.07,.31],[-.93,.39],[-1.03,.51],[-1.22,.5]],.5);
        const cinders=[[-1.48,-.31],[-1.2,-.57],[-.88,-.77],[-.49,-.86],[.09,-.92],[.58,-.64],[.72,.57],[-.32,.91],[-.79,.63],[-1.35,.53]];
        for(let i=0;i<15;i++){
          const q=cinders[(frame+i*3)%10],x=q[0]+(i%3-1)*.03,y=q[1]+ember*.25;
          pin(i%4===0?'#f6d694':i%3===0?'#a25132':'#df9349',x,y,i%4===0?2:1,1);
          if(i<4)line('#743b2d',x-.02,y+.04,x-.1,y+.08);
        }
        if(p.armFrames){
          rect('#ffe6a9',-.28,-.18,.045,.31);rect('#ffe6a9',-.4,-.05,.26,.045);
          seam('#d28943',[[-.47,-.25],[-.22,-.4],[.05,-.28],[.17,-.035],[.04,.21],[-.19,.3],[-.43,.16]]);
          pin('#f0cb82',-.16,-.46,1,3);pin('#ae6038',-.45,.31,2,1);
        }
      }
      // Bake dormant opacity into the shared raster. Applying fractional alpha
      // during drawImage takes different native fast-copy / flipped paths and
      // can round translucent RGB by one channel value on opposite facings.
      if(dormant){
        c.globalCompositeOperation='destination-in';c.globalAlpha=.58;
        c.fillRect(0,0,canvas.width,canvas.height);
        c.globalAlpha=1;c.globalCompositeOperation='source-over';
      }
      // Bound both item count and actual raster bytes as new radii are added.
      const pixels=canvas.width*canvas.height;
      while(projectileArt.size&&(projectileArt.size>=512||projectileArtPixels+pixels>PROJECTILE_ART_PIXEL_BUDGET)){
        const oldest=projectileArt.keys().next().value;
        projectileArtPixels-=projectileArt.get(oldest).pixels;projectileArt.delete(oldest);
      }
      projectileArtPixels+=pixels;
      art={canvas,near,width,height,pixels};projectileArt.set(key,art);
    }
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(p.dir,1);ctx.imageSmoothingEnabled=false;
    ctx.globalAlpha=1;
    ctx.drawImage(art.canvas,art.near,-art.height/2,art.width,art.height);
    ctx.restore();
  }

  class Projectile {
    constructor(owner, dir, cfg) {
      this.owner = owner;
      this.dir = dir;
      this.x = owner.x + dir * (cfg.projOriginX ?? 40 * SIZE);
      this.y = owner.y + (cfg.projOriginY ?? -34 * SIZE);
      this.vx = dir * (cfg.projSpeed ?? (cfg.big ? 6.5 : 8.5));
      this.color = cfg.projColor || '#5ad2ff';
      this.big = !!cfg.big;
      this.dmg = cfg.dmg;
      this.kb = cfg.kb;
      this.hitstun = cfg.hitstun;
      this.r = (cfg.big ? 20 : 13) * SIZE;
      this.life = cfg.projLife || 120;
      this.dead = false;
      this.t = 0;
      this.reaction=cfg.reaction;this.returnFrame=cfg.projReturnFrame||35;
      this.shape=cfg.projShape||'orb';this.path=cfg.projPath||'straight';
      this.baseY=this.y;this.vy=cfg.projVy||0;this.gravity=cfg.projGravity||0;
      this.amplitude=cfg.projAmplitude||28;this.bounce=!!cfg.projBounce;
      this.knockdown=!!cfg.knockdown;this.level=cfg.level;this.blockstun=cfg.blockstun;this.armFrames=cfg.armFrames||0;this.attackId=owner.attackId;this.meterGain=cfg.meterGain;this.scaleFloor=cfg.scaleFloor;
      this.comboMeta={owner,attackId:this.attackId,kind:owner.attackKind,lightStarter:cfg.lightStarter,starterScaling:cfg.starterScaling,damagePenalty:cfg.damagePenalty};
      if(cfg.projRadius)this.r=cfg.projRadius*SIZE;
      if(cfg.projGround)this.y=GROUND-this.r;this.baseY=this.y;
    }
    get box() {
      let near=-this.r,far=this.r,height=this.r*2;
      if(this.shape==='spear'){near=-this.r*2;height=12;}
      if(this.shape==='crescent')near=0;
      if(this.shape==='flame')near=-this.r*1.6;
      return {x:this.x+(this.dir>0?near:-far),y:this.y-height/2,w:far-near,h:height};
    }
    hitTarget(target) {
      if (this.dead || this.t < this.armFrames || target.state === 'ko' || target.invuln > 0 || target.trainingInvincible) return null;
      if (!U.overlap(this.box, target.bodyBox)) return null;
      const blocked = target.blocking && target.facing === -this.dir && target.onGround && (this.level !== 'low' || target.crouching);
      const result = target.takeHit({...this.comboMeta,dmg:this.dmg,kb:this.kb,hitstun:this.hitstun,type:'special',projectile:true,knockdown:this.knockdown,level:this.level,reaction:this.reaction,blockstun:this.blockstun,scaleFloor:this.scaleFloor}, this.dir, blocked);
      if (result.ignored) return null;
      if (this.owner.attackId === this.attackId) {
        this.owner.attackContact = true; this.owner.attackConnected = !result.blocked;
        this.owner.contactFrame = this.owner.stateT;
      }
      if (!result.blocked) this.owner.meter = Math.min(this.owner.maxMeter, this.owner.meter + (this.meterGain ?? 10));
      this.dead = true;
      return result;
    }
    update() {
      this.x += this.vx; this.t += 1; this.life--;
      if(this.path==='return'&&this.t===this.returnFrame)this.vx*=-1;
      if(this.path==='wave')this.y=this.baseY+Math.sin(this.t*.12)*this.amplitude;
      if(this.path==='arc'){
        this.y+=this.vy;this.vy+=this.gravity;
        if(this.y+this.r>=GROUND){
          if(this.bounce){this.y=GROUND-this.r;this.vy=-Math.abs(this.vy)*.65;this.bounce=false;}
          else this.dead=true;
        }
      }
      if (this.life <= 0 || this.x < -320 || this.x > 1280) this.dead = true;
    }
    draw(ctx) {
      drawPixelProjectile(ctx,this);
    }
  }

  class Fighter {
    static get walkAnimationRate() { return WALK_ANIMATION_RATE; }
    static get walkForwardAnimationRate() { return WALK_FORWARD_ANIMATION_RATE; }
    constructor(def, x, facing, playerLabel) {
      this.def = def;
      this.name = def.name;
      this.label = playerLabel;      // 'P1' / 'P2'
      this.x = x;
      this.y = GROUND;
      this.vx = 0; this.vy = 0;
      this.facing = facing;          // 1 右, -1 左
      this.onGround = true;
      this.maxHp = def.hp;
      this.hp = def.hp;
      this.meter = 0; this.maxMeter = 300;
      this.drive=6;this.maxDrive=6;this.burnout=false;this.driveRegenDelay=0;this.driveBoost=0;this.parrying=false;this.parryFrames=0;
      this.assistRoute=null;this.attackContact=false;this.attackId=0;this.juggleHits=0;this.repeatChain=0;
      this.state = 'idle';
      this.reaction=null;this.reactionDuration=20;this.reactionDir=-1;
      this.stateT = 0;               // 当前状态已持续帧
      this.walkPhase = 0;
      this.stepPhase = 0;
      this.gaitDirection = 1;
      this.gaitMoving = false;
      this.gaitSettling = 0;
      this.gaitSettleFrom = 0;
      this.gaitSettleTo = 0;
      this.gaitSettleDuration = 8;
      this.moveBlend = 0;
      this.moveLean = 0;
      this.airFrames = 0;
      this.jumpDirection = 0;
      this.jumpsUsed = 0;
      this.airJumpEffect = null;
      this.landingFrames = 0;
      this.airLandingFrames = 0;
      this.trail = [];
      this.armorLeft=0;this.counterTriggered=false;this.moveLabelT=0;
      this.attack = null;            // 当前招式对象
      this.pendingRush = false;
      this.bufferedAttack = null;
      this.dash=null;this.bufferedDash=null;
      this.attackConnected = false;
      this.contactFrame = 0;
      this.comboHits = 0;
      this.comboDamage = 0;
      this.comboActive=false;this.comboMoves=0;this.comboMoveScales=[];this.comboPenalty=0;this.comboLightStarter=false;
      this.lastDamageScale=1;this.lastHitDamage=0;this.pendingComboPenalty=0;this.pushbackSource=null;
      this.attackHasHit = false;     // 本次攻击是否已命中(避免多次)
      this.hitstun = 0;              // 受击硬直剩余帧
      this.blockstun = 0;
      this.stunned = false;
      this.crouching = false;
      this.blocking = false;
      this.invuln = 0;
      this.wins = 0;
      this.flashT = 0;               // 受击白闪
      this.koFall = 0;               // KO 倒地旋转
      this.dead = false;
      this.throwInputFrames=0;this.grabbedBy=null;this.throwSequence=null;this.throwRotation=0;
      this.width = 34 * SIZE;               // 身体碰撞宽(逻辑)
    }

    get bodyBox() {
      const h = (this.crouching ? 54 : 84) * SIZE;
      return { x: this.x - this.width/2, y: this.y - h, w: this.width, h };
    }

    // 命中盒(仅攻击 active 帧有效)
    getHitBox() {
      if (!this.attack || this.state === 'hit' || this.state === 'ko') return null;
      const m = this.attack;
      const prog = this.stateT;
      if (prog < m.startup || prog >= m.startup + m.active) return null;
      if (m.projectile || m.noHit || (m.counter && !this.counterTriggered)) return null; // 飞行道具在生成时处理
      const front = this.facing;
      const geometry=CombatSpacing.geometry(m,this.width,this.stateT,!this.onGround&&!m.launch);
      const cx = this.x + front * geometry.center;
      const wk=1;
      return {
        x: cx - geometry.w/2, y: this.y + geometry.y-geometry.h/2, w: geometry.w, h: geometry.h,
        dmg: m.dmg * wk, kb: m.hitFrames && this.stateT>=m.hitFrames[m.hitFrames.length-1] ? (m.finalKb??m.kb) : m.kb, hitstun: m.hitstun, type: m.type, grab:!!m.grab,
        owner:this,attackId:this.attackId,kind:this.attackKind,lightStarter:m.lightStarter,starterScaling:m.starterScaling,damagePenalty:m.damagePenalty,
        groundCombo:!m.knockdown||!!m.hitFrames&&prog<m.hitFrames[m.hitFrames.length-1],level:m.level,knockdown:!!m.knockdown&&(!m.hitFrames||prog>=m.hitFrames[m.hitFrames.length-1]),normalThrow:!!m.normalThrow,blockstun:m.blockstun,scaleFloor:m.scaleFloor,driveDamage:m.category==='drive'?1:.25,reaction:m.reaction,launch:!!m.launch,
        ...(m.airNormal?{airHit:m.airHit,airFeedback:m.airFeedback}:{}),
      };
    }

    canAct() {
      return this.hitstun <= 0 && this.blockstun <= 0 && !this.stunned &&
             !this.dash && !this.airLandingFrames &&
             !['ko','hit','grabbed'].includes(this.state) &&
             !ATTACK_STATES.includes(this.state);
    }

    queueAttack(kind, opts = {}) {
      this.bufferedDash=null;
      if(this.state!=='ko'&&!this.grabbedBy)this.bufferedAttack={kind,opts,frames:opts.assist?45:8};
    }
    queueDash(kind){
      if(!this.onGround||this.state==='ko'||this.grabbedBy||!this.def.dashes[kind])return;
      this.bufferedAttack=null;this.assistRoute=null;
      this.bufferedDash={kind,frames:6,inputSerial:window.Input?.resetSerial};
    }
    startDash(kind){
      if(!this.canAct()||!this.onGround||this.throwSequence)return false;
      const config=this.def.dashes[kind];if(!config)return false;
      this.dash={...config,kind,dir:this.facing*(kind==='forward'?1:-1),travelBlocked:false};
      this.bufferedDash=null;this.attack=null;this.pendingRush=false;
      this.parrying=this.blocking=this.crouching=false;this.vx=this.vy=0;
      this.driveBoost=0;this.pendingComboPenalty=0;this.trail=[];
      this.state=kind==='forward'?'dashForward':'dashBack';this.stateT=0;
      this.moveLabel=kind==='forward'?'前冲':'后撤步';this.moveLabelT=config.frames+12;
      Audio2.sfx.whiff();return true;
    }
    isThrowInvulnerable(){return this.dash?.kind==='back';}
    queueAssist(button){
      const route=this.def.assistCombos[button];
      if(!route||this.state==='ko')return;
      if(!this.assistRoute||this.assistRoute.button!==button||this.assistRoute.frames<=0||(!this.attack&&!this.foe?.hitstun&&!this.foe?.blockstun))this.assistRoute={button,index:0,frames:90};
      const at=this.assistRoute.index;
      if(at>=route.length){this.assistRoute=null;return;}
      const entry=typeof route[at]==='string'?{kind:route[at]}:route[at];
      if(at>0&&this.attackContact&&!this.attackConnected&&(entry.od||CombatRules.isSuper(entry.kind))){this.assistRoute=null;this.moveLabel='辅助连段停止 · 未命中';this.moveLabelT=45;return;}
      this.queueAttack(entry.kind,{...entry,shortcut:CombatRules.isSpecial(entry.kind)||CombatRules.isSuper(entry.kind),strength:2,assist:{button,index:at}});
    }
    spendDrive(cost){
      if(this.burnout||this.drive+1e-6<cost){this.moveLabel=this.burnout?'斗气耗尽':'斗气不足';this.moveLabelT=45;return false;}
      this.drive=Math.max(0,this.drive-cost);this.driveRegenDelay=100;
      if(this.drive<=.001)this.burnout=true;
      return true;
    }
    hasCancelWindow(){
      return !!this.attack&&this.attackContact&&this.stateT>=this.contactFrame&&this.stateT-this.contactFrame<=(this.attack.cancelWindow??10);
    }
    moveFor(kind) {
      return (!this.onGround&&CombatRules.airMove(this.def,kind))||this.def.moves[kind];
    }
    canStartAttack(kind) {
      const next=this.moveFor(kind);
      if(!next||this.airLandingFrames||this.grabbedBy||this.hitstun>0||this.blockstun>0||this.stunned||this.state==='ko')return false;
      if(next.groundOnly&&!this.onGround&&!(next.category==='super'&&this.attack?.launch&&this.attackContact))return false;
      if(this.canAct())return true;
      if(this.attack&&this.attackKind==='driveRush'&&this.stateT>=3)return next.category==='normal';
      if(!this.hasCancelWindow())return false;
      if(next.grab||next.counter||this.attack?.grab)return false;
      if(kind==='driveRush')return this.attack?.category==='normal'&&this.attack.cancellable;
      if(this.attack?.category==='normal'){
        if(next.category==='special'||next.category==='super')return this.attack.cancellable;
        if(next.category==='normal')return (this.attack.cancelInto||[]).includes(kind)||((this.attack.chainInto||[]).includes(kind)&&this.repeatChain<(this.attack.chainLimit||3));
      }
      if(this.attack?.category==='special'&&next.category==='super')return next.saLevel===3||this.attack.od&&next.saLevel===2;
      return false;
    }

    setState(s) {
      if (this.state === s) return;
      this.state = s; this.stateT = 0;
    }

    walkVelocity(target) {
      if(!target){this.vx=0;return;}
      // A short weight-transfer on starting; a direction change responds now,
      // without drifting toward the old input or delaying a defensive action.
      if(this.vx*target<0)this.vx=0;
      const step=this.def.walkAcceleration||.65;
      this.vx+=U.clamp(target-this.vx,-step,step);
    }

    tryJump(move) {
      if (!this.canAct() || this.grabbedBy || this.throwSequence) return false;
      // 只有主动起跳才能接第二跳；上升必杀或被挑空不提供额外跳跃。
      const second = !this.onGround;
      if (second && (this.state !== 'jump' || this.jumpsUsed !== 1)) return false;
      const speed = this.def.jumpTravel || this.def.walk * MOVE_SPEED;
      this.vy = -this.def.jump * (second ? AIR_JUMP_SCALE : 1);
      // 第二跳可立即改变方向；不输入方向时沿用原来的水平惯性。
      if (!second || move) this.vx = move * speed;
      this.onGround = false;
      this.jumpsUsed = second ? 2 : 1;
      this.airFrames = 0;
      this.jumpDirection = Math.sign(this.vx * this.facing);
      this.landingFrames = 0;
      this.blocking = this.crouching = this.parrying = false;
      this.state = 'jump'; this.stateT = 0;
      if (second) {
        this.airJumpEffect = { x: this.x, y: this.y, frames: 16 };
        this.moveLabel = '二段跳'; this.moveLabelT = 24;
      }
      Audio2.sfx.jump();
      return true;
    }

    startAttack(kind, opts={}) {
      if(opts.assist&&opts.assist.index>0&&this.attack?.hitFrames&&this.stateT<this.attack.hitFrames.at(-1))return false;
      if(opts.assist&&opts.assist.index>0&&this.attackContact&&!this.attackConnected&&(opts.od||CombatRules.isSuper(kind))){this.assistRoute=null;this.bufferedAttack=null;return false;}
      if(!this.canStartAttack(kind))return false;
      if(opts.assist&&opts.assist.index>0&&!this.foe?.hitstun&&!this.foe?.blockstun&&!(this.attack&&this.attackKind==='driveRush')){
        this.bufferedAttack=null;this.assistRoute=null;return false;
      }
      const source=this.moveFor(kind),m={...source};
      const cancelling=this.hasCancelWindow();
      const targetCancel=cancelling&&this.attack.category==='normal'&&(this.attack.cancelInto||[]).includes(kind);
      const lightChain=cancelling&&(this.attack.chainInto||[]).includes(kind);
      const cost=m.cost||0;
      if(this.meter<cost){this.moveLabel='SA 不足 · 需要 '+cost/100+' 级';this.moveLabelT=45;this.bufferedAttack=null;this.assistRoute=null;return false;}
      const driveCost=kind==='driveRush'?(this.attack?.category==='normal'?3:1):m.driveCost||(opts.od&&m.category==='special'?2:0);
      if(driveCost&&!this.spendDrive(driveCost)){this.bufferedAttack=null;this.assistRoute=null;return false;}
      this.meter-=cost;
      if(m.category==='special'){
        const strength=Math.max(1,Math.min(3,opts.strength||2)),recoveryShift=strength===1?-2:strength===3?2:0;
        const shift=strength===1&&kind==='uppercut'?-1:recoveryShift;
        CombatRules.retimeStartup(m,shift);m.recovery=Math.max(6,m.recovery+recoveryShift);
        if(m.travelDistance){m.travelStart=Math.max(1,m.startup-4);m.travelEnd=m.startup+m.active;m.travelDistance*=strength===1?.9:strength===3?1.1:1;}
        m.dmg*=strength===1?.88:strength===3?1.12:1;
        if(m.projSpeed)m.projSpeed*=strength===1?.85:strength===3?1.15:1;
        if(opts.od){m.od=true;m.dmg*=1.2;m.hitstun+=m.odHitstunBonus??6;m.blockstun+=3;if(kind==='uppercut')m.invincible=m.startup+5;}
      }
      if(opts.shortcut&&(m.category==='special'||m.category==='super'))m.dmg*=.8;
      if(m.category==='super'){m.scaleFloor=[0,.3,.4,.5][m.saLevel];if(this.attack?.launch){this.y=GROUND;this.vy=0;this.onGround=true;}}
      m.damagePenalty=targetCancel?.1:0;
      if(this.driveBoost>0&&m.category==='normal'){
        m.hitstun+=4;m.blockstun=(m.blockstun||10)+4;this.driveBoost=0;
        m.damagePenalty+=this.pendingComboPenalty;this.pendingComboPenalty=0;
      }
      if(kind==='driveRush'){this.driveBoost=90;this.pendingComboPenalty=cancelling?.15:0;}
      this.repeatChain=lightChain?this.repeatChain+1:1;
      this.bufferedAttack=null;this.attackConnected=false;this.attackContact=false;this.attackId++;
      this.blocking=this.crouching=this.parrying=false;
      this.reaction=null;this.attack=m;this.attackKind=kind;this.throwBack=!!opts.back;this.attackHasHit=false;this._specialWeak=false;
      this.armorLeft=m.armor||0;this.counterTriggered=false;
      this.moveLabel=(m.od?'OD · ':'')+(m.saLevel?'SA'+m.saLevel+' · ':'')+m.name;this.moveLabelT=55;
      this.state=kind;this.stateT=0;if(!m.airNormal)this.vx=0;this.pendingRush=!!(m.rush||m.rushSpeed);
      if(m.invincible)this.invuln=m.invincible;
      if(m.airNormal)this.assistRoute=null;
      else if(opts.assist)this.assistRoute={button:opts.assist.button,index:opts.assist.index+1,frames:90};
      return true;
    }

    // 输入意图:{move:-1/0/1, up, down, light, heavy, special, block}
    handleIntent(intent, game) {
      if (this.state === 'ko') return;
      if(this.canAct())this.endCombo();

      if(intent.throw){this.throwInputFrames=8;if(this.grabbedBy)this.grabbedBy.escapeThrow(game);else this.queueAttack('throw',{back:intent.move===-this.facing});}
      if(this.grabbedBy)return;

      if(intent.throw){}
      else if (intent.command) this.queueAttack(intent.command, { motion:true, ...intent.commandOptions });
      else if (intent.special) this.queueAttack('special');
      else if (intent.heavyKick) this.queueAttack(intent.down?'sweep':'heavyKick');
      else if (intent.lightKick) this.queueAttack(intent.down?'lowKick':'lightKick');
      else if (intent.mediumKick) this.queueAttack(intent.down?'lowMediumKick':'mediumKick');
      else if (intent.medium) this.queueAttack('medium');
      else if (intent.heavy) this.queueAttack('heavy');
      else if (intent.light) this.queueAttack('light');
      if (this.bufferedAttack && this.startAttack(this.bufferedAttack.kind, this.bufferedAttack.opts)) return;
      if(intent.dash&&!intent.up&&!intent.parryHeld)this.queueDash(intent.dash);
      if(intent.up||intent.parryHeld)this.bufferedDash=null;
      if(this.bufferedDash?.inputSerial!==window.Input?.resetSerial)this.bufferedDash=null;
      if(this.bufferedDash&&this.startDash(this.bufferedDash.kind))return;
      if (!this.canAct()) return;

      this.blocking=false;this.crouching=false;
      if(intent.parryHeld&&this.onGround&&!this.burnout){
        if(!this.parrying&&!this.spendDrive(.5))return;
        if(!this.parrying)this.parryFrames=0;
        this.parrying=true;this.state='parry';this.vx=0;return;
      }
      this.parrying=false;
      // up 是再次按下的边沿，按住跳跃不会自动消耗第二跳。
      if (intent.up && this.tryJump(intent.move)) return;
      if (this.onGround) {
        // 下蹲(可格挡下段/减速)
        if (intent.down) {
          this.blocking=!!intent.block;this.crouching = true;
          this.setState('crouch');
          this.vx = 0;
          return;
        }
        // 格挡:后退方向按住 block。允许边后退边防御,不再原地锁死。
        if (intent.block) {
          this.blocking = true;
          this.setState('block');
          this.walkVelocity(intent.move * (this.def.walkBackward||this.def.walk*MOVE_SPEED*.55));
          return;
        }
        // 移动
        if (intent.move !== 0) {
          this.walkVelocity(intent.move * (intent.move===this.facing?this.def.walkForward:this.def.walkBackward));
          this.setState('walk');

        } else {
          this.vx = 0;
          this.setState('idle');
        }
      } else {
        // 空中:可小幅控制
        if (intent.move !== 0) this.vx = U.clamp(this.vx + intent.move*.18, -(this.def.jumpTravel||this.def.walk*MOVE_SPEED), this.def.jumpTravel||this.def.walk*MOVE_SPEED);
      }
    }

    // 受击
    endCombo(){
      // Leave the last damage result visible. A combo ends when a defensive
      // action can actually be entered, including the exact hitstun boundary.
      this.comboActive=false;
    }
    takeHit(hit, fromDir, blocked) {
      if(hit.grab&&this.isThrowInvulnerable())return {dmg:0,blocked:false,ignored:true};
      if (this.invuln > 0 || this.trainingInvincible) return { dmg: 0, blocked: false, ignored: true };
      if(this.parrying&&!hit.grab&&!this.burnout){
        this.drive=Math.min(6,this.drive+.4);this.moveLabel=this.parryFrames<=2?'精准招架':'招架';this.moveLabelT=35;
        return {dmg:0,blocked:true,parried:true};
      }
      if(!this.onGround&&!blocked&&hit.airHit){
        hit={...hit,airVy:hit.airHit.vy,airReaction:hit.airHit.reaction,knockdown:!!hit.knockdown||!!hit.airHit.knockdown};
      }
      this.bufferedAttack=null;this.assistRoute=null;this.attackConnected=false;this.attackContact=false;this.parrying=false;
      this.airLandingFrames=0;
      this.pendingComboPenalty=0;this.driveBoost=0;
      this.dash=null;this.bufferedDash=null;this.trail=[];
      const counter=this.attack?.counter && this.stateT>=3 && this.stateT<=18 && !this.counterTriggered;
      if(counter&&!hit.grab&&!hit.projectile){
        this.counterTriggered=true;this.attackHasHit=true;this.stateT=this.attack.startup;
        this.moveLabel=this.attack.name+' · 反击';this.moveLabelT=45;
        return {dmg:0,blocked:false,countered:true};
      }
      if(!blocked && !hit.grab && this.armorLeft>0 && this.attack && this.stateT<=(this.attack.armorUntil||0)){
        this.armorLeft--;const damage=Math.max(1,Math.round(hit.dmg*.7));
        this.hp=Math.max(0,this.hp-damage);this.flashT=5;
        if(this.hp<=0)this.startKO(fromDir);
        return {dmg:damage,blocked:false,armored:true};
      }
      if (blocked) {
        this.endCombo();
        const chip=this.burnout&&hit.type==='special'?Math.max(1,Math.round(hit.dmg*.15)):0;
        this.hp = Math.max(0, this.hp - chip);
        this.blockstun=(hit.blockstun||Math.round(hit.hitstun*.5))+(this.burnout?4:0);
        if(!this.burnout){this.drive=Math.max(0,this.drive-(hit.driveDamage||.2));this.driveRegenDelay=100;if(this.drive===0)this.burnout=true;}
        this.attack=null;this.pendingRush=false;
        this.vx = fromDir * (hit.kb * 0.4);
        this.pushbackSource=hit.owner||this.foe;
        this.meter = Math.min(this.maxMeter, this.meter + 4);
        this.flashT = 4;
        this.reaction=this.crouching?'guardLow':'guard';this.reactionDir=fromDir*this.facing;this.reactionDuration=this.blockstun;
        this.state='block';this.stateT=0;
        return { dmg: chip, blocked: true };
      }
      if(!this.comboActive){
        this.comboHits=0;this.comboDamage=0;this.comboMoves=0;this.comboMoveScales=[];
        this.comboLightStarter=!!hit.lightStarter;this.comboPenalty=hit.starterScaling||0;
      }
      let move=hit.owner&&hit.attackId!=null?this.comboMoveScales.find(m=>m.owner===hit.owner&&m.attackId===hit.attackId):null;
      if(!move){
        this.comboMoves++;
        if(this.comboMoves>1)this.comboPenalty+=hit.damagePenalty||0;
        const scale=this.comboMoves===1?1:CombatRules.damageScale(this.comboMoves,this.comboLightStarter,this.comboPenalty,hit.scaleFloor??.1);
        move={owner:hit.owner,attackId:hit.attackId,scale};this.comboMoveScales.push(move);
      }
      this.comboActive=true;this.comboHits++;
      const damage = Math.max(1, Math.round(hit.dmg * move.scale));
      this.lastDamageScale=move.scale;this.lastHitDamage=damage;
      this.comboDamage += damage;
      this.hp = Math.max(0, this.hp - damage);
      this.hitstun = hit.hitstun;
      this.vx = fromDir * hit.kb;
      this.pushbackSource=hit.owner||this.foe;
      this.reaction=hit.airReaction||(hit.grab?'throw':hit.launch?'launch':hit.knockdown?(hit.level==='low'?'sweep':'knockdown'):!this.onGround?'air':hit.reaction|| (hit.type==='light'?'head':'heavy'));
      this.reactionDir=fromDir*this.facing;this.reactionDuration=Math.max(1,hit.hitstun);
      this.vy=hit.airVy??(hit.launch?-10:hit.knockdown?-7:this.onGround?0:-4);
      if(!this.onGround){this.juggleHits++;if(this.juggleHits>6)this.vy=Math.max(3,this.vy);}else this.juggleHits=0;
      this.knockedDown=!!hit.knockdown;
      if (this.vy < 0) this.onGround = false;
      this.attack = null;
      this.pendingRush = false;
      this.meter = Math.min(this.maxMeter, this.meter + 3);
      this.flashT = 6;
      this.state='hit';this.stateT=0;
      if (this.hp <= 0) this.startKO(fromDir);
      return { dmg: damage, blocked: false };
    }

    startKO(dir) {
      this.dash=null;this.bufferedDash=null;
      this.reaction='knockdown';this.reactionDuration=60;
      this.state = 'ko'; this.stateT = 0;
      this.vx = dir * 5; this.vy = -8; this.onGround = false;
      this.koDir = dir;
    }

    beginThrow(target,game){
      if(target.isThrowInvulnerable())return;
      if(target.throwInputFrames>0){this.throwSequence={target,t:0};this.escapeThrow(game);return;}
      this.assistRoute=null;target.assistRoute=null;target.parrying=false;
      target.endCombo();
      this.throwSequence={target,t:0,dir:this.throwBack?-this.facing:this.facing,hit:{owner:this,attackId:this.attackId,dmg:this.attack.dmg,kb:this.attack.kb,hitstun:this.attack.hitstun,type:'heavy',grab:true,knockdown:true}};
      target.grabbedBy=this;target.attack=null;target.bufferedAttack=null;target.blocking=target.crouching=false;
      target.dash=null;target.bufferedDash=null;
      target.hitstun=45;target.vx=target.vy=0;target.state='grabbed';target.stateT=0;target.reaction='throw';target.reactionDuration=24;target.reactionDir=this.facing*target.facing;
      this.invuln=30;target.invuln=30;
      this.moveLabel=this.throwBack?'后投 · '+this.attack.name:this.attack.name;
    }
    escapeThrow(game){
      const q=this.throwSequence;if(!q||q.t>7)return false;
      const target=q.target;this.throwSequence=null;target.grabbedBy=null;
      for(const f of [this,target]){f.attack=null;f.bufferedAttack=null;f.pendingRush=false;f.invuln=12;f.hitstun=12;f.y=GROUND;f.onGround=true;f.throwRotation=0;f.vy=0;f.state='hit';f.stateT=0;f.reaction='body';f.reactionDuration=12;f.moveLabel='拆投';f.moveLabelT=40;}
      const dir=this.facing;this.vx=-dir*5;target.vx=dir*5;game.hitstop=4;
      return true;
    }
    update(game) {
      if(this.canAct())this.endCombo();
      if(this.driveRegenDelay>0)this.driveRegenDelay--;
      if(this.driveBoost>0)this.driveBoost--;
      if(this.assistRoute&&--this.assistRoute.frames<=0)this.assistRoute=null;
      if(this.parrying){this.parryFrames++;this.drive=Math.max(0,this.drive-.016);this.driveRegenDelay=100;if(this.drive===0){this.burnout=true;this.parrying=false;}}
      else if(this.burnout||this.driveRegenDelay===0&&!this.attack&&this.hitstun<=0&&this.blockstun<=0){
        this.drive=Math.min(6,this.drive+(this.burnout?.008:.009));if(this.drive===6)this.burnout=false;
      }
      if(this.throwInputFrames>0)this.throwInputFrames--;
      if(this.airLandingFrames>0)this.airLandingFrames--;
      if(this.grabbedBy){this.stateT++;return;}
      if(this.throwSequence){
        const q=this.throwSequence,v=q.target;q.t++;
        const lift=Math.sin(Math.max(0,(q.t-7)/17)*Math.PI);
        const toss={ryu:[100,1.4],mei:[85,2.2],tank:[145,.8],volt:[55,1.8],kaze:[115,1.6],sage:[125,.6]}[this.def.id]||[90,1.4];
        v.x=U.clamp(this.x+q.dir*(48+q.t*1.5),FLOOR_MINX,FLOOR_MAXX);
        v.y=GROUND-lift*toss[0];v.throwRotation=q.dir*lift*toss[1];
        if(q.t>=24){
          v.grabbedBy=null;v.throwRotation=0;v.invuln=0;v.onGround=false;
          v.takeHit(q.hit,q.dir,false);this.throwSequence=null;
          this.meter=Math.min(this.maxMeter,this.meter+12);game.hitstop=8;game.shake=12;
          game.effects.push({x:v.x,y:GROUND-10,t:0,life:16,big:true,blocked:false});
          Audio2.sfx.hitHeavy();
        }
      }
      this.stateT++;
      if(this.attack&&this.stateT===this.attack.startup&&(this.attack.category==='normal'||this.attack.normalThrow))Audio2.sfx.whiff();
      if(this.moveLabelT>0)this.moveLabelT--;
      if (this.airJumpEffect && --this.airJumpEffect.frames <= 0) this.airJumpEffect = null;
      if(this.attack?.hitFrames?.includes(this.stateT))this.attackHasHit=false;
      if(this.attack?.moveSpeed && this.stateT>=this.attack.startup && this.stateT<this.attack.startup+this.attack.active)this.vx=this.facing*this.attack.moveSpeed;
      this.walkPhase += .055;
      if (this.landingFrames > 0) this.landingFrames--;
      if(this.getupFrames>0&&this.onGround)this.getupFrames--;
      if (!this.onGround) this.airFrames++;
      if (this.dash || ['rush','uppercut'].includes(this.state) || (this.state === 'special' && this.pendingRush)) {
        if (this.stateT % 2 === 0) this.trail.push({x:this.x,y:this.y});
        if(this.trail.length>4)this.trail.shift();
      } else this.trail.length=0;
      if (this.bufferedAttack && --this.bufferedAttack.frames <= 0) this.bufferedAttack = null;
      if(this.bufferedDash&&--this.bufferedDash.frames<=0)this.bufferedDash=null;
      if (this.attack?.launch && this.stateT === this.attack.startup) {
        this.vy = -9; this.vx = this.facing * 2; this.onGround = false;
      }
      if (this.hitstun > 0) this.hitstun--;
      if (this.blockstun > 0) this.blockstun--;
      if (this.invuln > 0) this.invuln--;
      if (this.flashT > 0) this.flashT--;

      // 突进必杀的旧速度回退；有距离配置时下方精确位移覆盖它。
      if (this.pendingRush && this.attack && this.stateT >= this.attack.startup && this.stateT < this.attack.startup + this.attack.active) {
        this.vx = this.facing * (this.attack.rushSpeed || 7);
      } else if (this.pendingRush && this.attack && this.stateT >= this.attack.startup + this.attack.active) {
        this.pendingRush = false;
      }

      if(this.attack?.travelDistance){
        this.vx=this.attack.travelBlocked?0:this.facing*(CombatSpacing.travelAt(this.attack,this.stateT)-CombatSpacing.travelAt(this.attack,this.stateT-1));
      }
      if(this.attack?.stepDistance&&this.onGround){
        const m=this.attack;
        this.vx=m.stepBlocked?0:this.facing*(StrikeMotion.stepAt(m,this.stateT)-StrikeMotion.stepAt(m,this.stateT-1));
      }
      if(this.dash){
        const d=this.dash;
        this.vx=d.travelBlocked?0:d.dir*(CombatSpacing.travelAt(d,this.stateT)-CombatSpacing.travelAt(d,this.stateT-1));
      }

      // 每个发射时刻独立生成；普通飞行道具每人最多两枚，超必杀允许三枚。
      if(this.attack?.projectile && (this.attack.shots||[this.attack.startup]).includes(this.stateT)){
        const cap=this.attack.category==='super'?6:2;
        if(game.projectiles.filter(p=>p.owner===this&&!p.dead).length<cap){
          const config={...this.attack,knockdown:!!this.attack.knockdown&&(!this.attack.shots||this.stateT===this.attack.shots.at(-1))};
          const proj=new Projectile(this,this.facing,config);
          if(this._specialWeak){proj.dmg=Math.round(proj.dmg*.55);proj.r*=.8;proj.weak=true;}
          game.projectiles.push(proj);
        }
        this.attackHasHit=true;
      }

      // 物理
      this.x += this.vx;
      this.y += this.vy;
      if (!this.onGround) this.vy += GRAV;

      // 地面碰撞
      if (this.y >= GROUND) {
        this.y = GROUND;
        this.jumpsUsed = 0;
        this.airJumpEffect = null;
        if (!this.onGround && this.state === 'ko') {
          this.vy = 0; this.vx *= 0.3; this.onGround=true;
        } else if (!this.onGround) {
          this.landingFrames = Math.min(9, Math.max(4, Math.round(Math.abs(this.vy))));
          this.airFrames = 0;
          if(this.knockedDown){
            this.hitstun=Math.max(this.hitstun,18);this.getupFrames=18;
            // Grounded knockdowns cannot be re-hit before the defender has a
            // chance to guard / reverse on wakeup. Air juggles remain hittable.
            this.invuln=Math.max(this.invuln,19);this.endCombo();
          }
          this.onGround = true; this.vy = 0;
          if(this.attack?.airNormal){
            // An airborne strike ends on landing; it never becomes a grounded
            // active hitbox or borrows the grounded step / cancel routes.
            this.airLandingFrames=this.attack.landingRecovery;
            this.attack=null;this.pendingRush=false;this.assistRoute=null;this.vx=0;
            this.setState('idle');
          }
          if (this.state === 'jump') this.setState('idle');
        }
        if (this.state !== 'ko') this.vy = 0;
      }
      // 地面摩擦
      if (this.onGround && this.state !== 'ko') {
        if (!['walk','block'].includes(this.state)||this.blockstun>0) this.vx *= 0.6;
        if (Math.abs(this.vx) < 0.1) this.vx = 0;
      }
      if (this.state === 'ko') this.vx *= 0.92;

      // 边界
      const unclampedX=this.x;
      this.x = U.clamp(this.x, FLOOR_MINX, FLOOR_MAXX);
      if(this.dash&&unclampedX!==this.x)this.dash.travelBlocked=true;
      if(this.attack?.stepDistance&&unclampedX!==this.x)this.attack.stepBlocked=true;
      // Transfer the displacement the wall absorbed to the attacker. Corner
      // pressure still pushes the fighters apart instead of deleting recoil.
      if(unclampedX!==this.x&&(this.hitstun>0||this.blockstun>0)&&this.pushbackSource){
        const source=this.pushbackSource;
        source.x=U.clamp(source.x-(unclampedX-this.x),FLOOR_MINX,FLOOR_MAXX);
        if(source.attack?.travelDistance)source.attack.travelBlocked=true;
        if(source.attack?.stepDistance)source.attack.stepBlocked=true;
      }

      // 攻击状态结束回 idle
      if(this.dash&&this.stateT>=this.dash.frames){
        this.dash=null;this.vx=0;this.trail=[];this.setState('idle');
      }
      if (ATTACK_STATES.includes(this.state) && this.attack) {
        const total = this.attack.startup + this.attack.active + this.attack.recovery;
        if (this.stateT >= total) {
          if(this.attack.stepDistance&&this.onGround)this.vx=0;
          this.attack = null;
          this.pendingRush = false;
          this.setState(this.onGround ? 'idle' : 'jump');
        }
      }
      // hit 状态结束
      if (this.state === 'hit' && this.hitstun <= 0 && this.onGround) {
        this.knockedDown=false;this.reaction=null;
        this.setState('idle');
      }
      // ko 倒地旋转推进
      if (this.state === 'ko') {
        this.koFall = Math.min(1, this.koFall + 0.06);
      }
    }

    // Called after BOTH fighters move and body separation is complete. A blocked
    // step or the opponent's push must not advance/restart a walking animation.
    updateGait(distance) {
      const turn=Math.PI*2;
      const canSettle=this.onGround&&!this.attack&&!this.grabbedBy&&this.hitstun<=0&&this.blockstun<=0&&['idle','walk','block'].includes(this.state);
      const travel=Math.max(0,Math.min(Math.abs(this.vx),distance*Math.sign(this.vx)));
      const moving=canSettle&&['walk','block'].includes(this.state)&&Math.abs(this.vx)>.1&&travel>.02;
      if(moving){
        this.gaitDirection=Math.sign(this.vx*this.facing)||1;
        this.gaitSettling=0;
        const stride=this.gaitDirection<0?this.def.strideBackward:this.def.stride;
        // Resume the support-foot phase instead of jumping back to pose zero.
        const rate=this.gaitDirection<0?WALK_ANIMATION_RATE:WALK_FORWARD_ANIMATION_RATE;
        this.stepPhase=(this.stepPhase+travel*turn/(stride||104)*rate)%turn;
      }else if(canSettle){
        if(this.gaitMoving){
          const phase=((this.stepPhase%turn)+turn)%turn;
          this.gaitSettleFrom=phase;
          // Freeze travel phase. Set down the moving foot, then replace the
          // support foot with a short lifted step rather than a floor slide.
          const rate=this.gaitDirection<0?WALK_ANIMATION_RATE:WALK_FORWARD_ANIMATION_RATE;
          this.gaitSettleDuration=Math.round(12/rate);
          this.gaitSettling=this.gaitSettleDuration;
        }
        if(this.gaitSettling){
          this.gaitSettling--;
          if(!this.gaitSettling){this.walkPhase=0;this.stepPhase=0;}
        }
      }else{
        this.gaitSettling=0;this.stepPhase=0;
      }
      this.gaitMoving=moving;
      this.moveBlend+=((moving?1:0)-this.moveBlend)*.3;
      this.moveLean+=((moving?this.vx*this.facing/(this.def.walkForward||this.def.walk*MOVE_SPEED):0)-this.moveLean)*.22;
    }

    // Shared animation sampling for rendering and physical contact checks.
    sampleAnimation() {
      const prog = this.attack ? (this.stateT - this.attack.startup) / Math.max(1, this.attack.active) : this.stateT * 0.1;
      const attackPose = ATTACK_STATES.includes(this.state);
      const poseState=this.grabbedBy?'hit':this.knockedDown?'ko':this.dash?(this.dash.kind==='forward'?'walk':'block'):this.state==='parry'?'block':this.attack?.pose||this.state;
      const motion = {
        fighter:this,attack:this.attack,kind:this.attackKind,state:this.state,reaction:this.reaction,reactionDuration:this.reactionDuration,reactionDir:this.reactionDir,
        attackT:this.stateT,attackStartup:this.attack?.startup,attackActive:this.attack?.active,
        gait: this.stepPhase, blend: this.gaitSettling?1:this.moveBlend, lean: this.moveLean, gaitDirection:this.gaitDirection, gaitSettle:this.gaitSettling?1-this.gaitSettling/this.gaitSettleDuration:0,
        moving: this.gaitMoving || this.gaitSettling>0,
        air: !this.onGround && this.state === 'jump',
        airFrames: this.airFrames, vy: this.vy,
        jumpDirection: this.jumpDirection, jumpDuration: 2*this.def.jump/GRAV,
        airDirection: U.clamp(this.vx * this.facing / (this.def.walkForward||this.def.walk * MOVE_SPEED), -1, 1),
        landing: this.onGround && ['idle','walk','block'].includes(this.state) ? this.landingFrames / 9 : 0,
      };
      const artProgress = attackPose&&this.attack ? this.stateT/(this.attack.startup+this.attack.active+this.attack.recovery) : (this.state==='walk'?this.stepPhase:this.stateT*.06);
      const animation=window.Motion60?.sample(this.def,poseState,artProgress,motion);
      return {animation,motion,poseState,artProgress,attackPose,prog};
    }
    // 绘制
    draw(ctx) {
      const {animation,motion,poseState,artProgress,attackPose,prog}=this.sampleAnimation();
      if(animation){
        motion.animation=animation;this.animationFrame=animation.frame;
        const drawn=window.DrawnAnimation?.selection(this.def,animation);
        this.drawnFrame=drawn?drawn.index+1:null;this.drawnFrameCount=drawn?.count;
      }
      const pose = computePose(poseState, attackPose ? (this.stateT/(this.attack? (this.attack.startup+this.attack.active+this.attack.recovery):20)) : prog, this.walkPhase, !this.onGround);

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing * SCALE, SCALE);
      if (this.state === 'ko') {
        ctx.rotate(this.koDir * this.koFall * -1.3);
      }
      // 阴影(在缩放前世界更好,这里简单处理)
      ctx.restore();
      // 地面阴影
      const shW = 40 * SIZE * (this.onGround ? 1 : 0.6);
      ctx.save();
      ctx.globalAlpha = 0.25; ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(this.x, GROUND + 4, shW/2, 6 * SIZE, 0, 0, 7); ctx.fill();
      ctx.restore();

      if(this.dash&&this.stateT<=this.dash.travelEnd){
        ctx.save();ctx.fillStyle='#e0cba5';ctx.globalAlpha=.3;
        for(let i=0;i<3;i++){
          ctx.beginPath();ctx.ellipse(this.x-this.dash.dir*(18+i*14),GROUND-2-i*2,9+i*2,2+i,0,0,Math.PI*2);ctx.fill();
        }
        ctx.restore();
      }
      if (this.airJumpEffect) {
        const effect = this.airJumpEffect, p = 1 - effect.frames / 16;
        ctx.save();
        ctx.globalAlpha = (1 - p) * .8;
        ctx.strokeStyle = this.def.fxColor || '#bdefff'; ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(effect.x, effect.y + p * 16, 22 + p * 34, 6 + p * 8, 0, 0, Math.PI * 2);
        ctx.stroke(); ctx.restore();
      }

      for(let i=0;i<this.trail.length;i++) {
        const q=this.trail[i];
        ctx.save();ctx.globalAlpha=.045+.035*i;
        ctx.translate(q.x,q.y);ctx.scale(this.facing*SCALE,SCALE);
        drawHumanoid(ctx,this.def.palette,pose,this.def.deco,poseState,artProgress,motion);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.facing * SCALE, SCALE);
      const authoredFall=window.DrawnAnimation?.version>=7&&window.DrawnAnimation.has(this.def.id);
      if (this.state === 'ko'&&!authoredFall) ctx.rotate(this.koDir * this.facing * this.koFall * -1.3);
      if(this.grabbedBy)ctx.rotate(this.throwRotation);
      else if(this.knockedDown&&!authoredFall)ctx.rotate((this.reaction==='sweep'?-.95:-.7)*(this.onGround?(this.getupFrames||0)/18:Math.min(1,this.stateT/14)));

      // 受击白闪:临时替换调色
      let pal = this.def.palette;
      if (this.flashT > 0 && Math.floor(this.flashT/2)%2===0) {
        pal = flashPalette(pal);
      }
      drawHumanoid(ctx, pal, pose, this.def.deco, poseState, artProgress, motion);
      ctx.restore();

      if(this.moveLabelT>0 && this.moveLabel){
        U.textOutline(ctx,this.moveLabel,this.x,Math.max(105,this.y-230),15,this.def.fxColor||'#fff','#101222');
      }
      if(this.parrying||this.driveBoost>0||this.attack?.od){ctx.save();ctx.strokeStyle=this.parrying?'#74a9ff':this.attack?.od?'#ffe178':'#65ffb7';ctx.lineWidth=3;ctx.globalAlpha=.7;ctx.beginPath();ctx.ellipse(this.x,this.y-90,55,100,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
      window.Motion60?.drawEffects(ctx,this);

      // 格挡火花
      if (this.state === 'block' && this.blockstun > 0) {
        ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = '#7ad0ff';
        const bx = this.x + this.facing*22 * SIZE;
        for (let i=0;i<4;i++){ctx.beginPath();ctx.arc(bx+U.rand(-6,6), this.y-40 * SIZE+U.rand(-14,14) * SIZE, 2, 0,7);ctx.fill();}
        ctx.restore();
      }
    }
  }

  function flashPalette(p) {
    const w = {};
    for (const k in p) w[k] = '#ffffff';
    w.eye = '#ff3030';
    return w;
  }

  window.Fighter = Fighter;
  window.Projectile = Projectile;
  window.FIGHT_GROUND = GROUND;
})();
